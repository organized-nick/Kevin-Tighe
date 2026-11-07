/**
 * src/holes/subterranean.js
 * Subterranean State Machine, Vertical Descent Kinetics, Tier Enforcement & Escape Mechanics
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { calculateGeyserImpulse } from './geyser.js';

export const SUB_PHASE = {
  INACTIVE: 'inactive',
  REJECTED: 'rejected',
  DESCENDING: 'descending',
  GEYSER_PROPELLED: 'geyser_propelled',
  MID_SHAFT_FLIGHT: 'mid_shaft_flight',
  BREACH_RESPAWNING: 'breach_respawning'
};

export class SubterraneanSystem {
  constructor(controller, hud, audioSystem, options = {}) {
    this.controller = controller;
    this.hud = hud;
    this.audio = audioSystem;
    this.celebrations = options.celebrations || null;
    this.geyserEmitter = options.geyserEmitter || null;
    this.holeManager = options.holeManager || null;

    this.activeHole = null;
    this.phase = SUB_PHASE.INACTIVE;
    this.depthFt = 0.0;
    this.depthMeters = 0.0;

    this.rejectionCooldown = 0.0;
    this.respawnTimer = 0.0;
    this._lastSirenTime = 0;

    // Shaft descent kinetics
    this.SHAFT_GRAVITY = -14.0;       // m/s^2 (smooth vertical dive)
    this.SHAFT_TERMINAL_V = -9.0;     // m/s (allows reading gauge & collecting oranges)
    this.FLIGHT_CLIMB_SPEED = 5.5;    // m/s (upward escape climb)
  }

  setCelebrations(celebrations) {
    this.celebrations = celebrations;
  }

  setGeyserEmitter(emitter) {
    this.geyserEmitter = emitter;
  }

  setHoleManager(manager) {
    this.holeManager = manager;
  }

  /**
   * Ground collision override for CharacterController.getGroundElevation
   */
  getGroundOverride(x, z, defaultElevation) {
    if (!this.activeHole || this.phase === SUB_PHASE.INACTIVE || this.phase === SUB_PHASE.REJECTED) {
      if (this.holeManager) {
        const playerY = this.controller ? this.controller.position.y : 999;
        return this.holeManager.getGroundOverride(x, z, defaultElevation, playerY);
      }
      return defaultElevation;
    }

    const h = this.activeHole;
    const dist2D = Math.hypot(x - h.position.x, z - h.position.z);
    if (dist2D <= h.radius) {
      return h.position.y - (h.depthFt * CONFIG.M_PER_FT);
    }
    return defaultElevation;
  }

  /**
   * Check proximity to hole mouths during character update loop
   */
  checkHoleEntry(playerPos, playerVel) {
    if (this.phase !== SUB_PHASE.INACTIVE && this.phase !== SUB_PHASE.REJECTED) return;
    if (this.rejectionCooldown > 0) return;

    const holes = (this.holeManager ? this.holeManager.getHolesList() : CONFIG.HOLES) || [];
    for (const hole of holes) {
      const hx = hole.position.x;
      const hy = hole.position.y;
      const hz = hole.position.z;
      const dist2D = Math.hypot(playerPos.x - hx, playerPos.z - hz);
      if (dist2D <= hole.radius) {
        // Bluff shaft has a raised granite hazard collar on the overlook plateau.
        // Entering it requires jumping/diving into the mouth or being airborne.
        if (hole.id === 'hole_bluff_shaft') {
          const isJumpingIntoHole = !this.controller.isGrounded || playerVel.y < -0.4 || playerPos.y < hy - 0.15;
          if (!isJumpingIntoHole) {
            continue;
          }
        }

        // Trigger if within mouth radius, at or slightly below surface rim, and moving downward/neutral
        if (playerPos.y <= hy + 0.40 && playerVel.y <= 0.6) {
          this.onHoleTrigger(hole, playerPos, playerVel);
          break;
        }
      }
    }
  }

  onHoleTrigger(hole, playerPos, playerVel) {
    // -----------------------------------------------------------------------
    // Tier 1 Rejection: Holes strictly under 10.0ft (<10ft)
    // -----------------------------------------------------------------------
    if (hole.depthFt < CONFIG.DEPTH_RULES.MIN_LEGAL_FT) {
      this.phase = SUB_PHASE.REJECTED;
      this.rejectionCooldown = 0.50;

      // Keep in jumping/falling state, NEVER in_hole
      this.controller.state = 'jumping';
      this.controller.isGrounded = false;

      // Calculate radial outward recoil impulse
      const dx = playerPos.x - hole.position.x;
      const dz = playerPos.z - hole.position.z;
      const dLen = Math.hypot(dx, dz);
      const nx = dLen > 0.01 ? dx / dLen : 1.0;
      const nz = dLen > 0.01 ? dz / dLen : 0.0;

      const horizSpeed = Math.hypot(playerVel.x, playerVel.z);
      if (horizSpeed >= 0.5) {
        playerVel.x = -playerVel.x * 1.35;
        playerVel.z = -playerVel.z * 1.35;
      } else {
        playerVel.x = nx * 5.5;
        playerVel.z = nz * 5.5;
      }
      playerVel.y = 8.5; // upward bounce impulse

      if (this.audio) {
        if (typeof this.audio.playRejectionBuzzer === 'function') {
          this.audio.playRejectionBuzzer();
        }
      }

      if (this.hud) {
        this.hud.showToast(`🚫 TOO SHALLOW! (${hole.depthFt.toFixed(1)} FT) Sealed by lakeside wardens! Kevin rejects <10ft holes!`, 'warn');
        this.hud.setSubterraneanDepth(false);
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Tier 2 & Tier 3 Entry: Transition into subterranean descent state
    // -----------------------------------------------------------------------
    this.rejectionCooldown = 0.0;
    this.activeHole = hole;
    this.phase = SUB_PHASE.DESCENDING;
    if (typeof this.controller.setFlight === 'function') {
      this.controller.setFlight(false);
    }
    this.controller.isFlying = false;
    this.controller.isGrounded = false;
    this.controller.state = 'in_hole';

    // Centering toward shaft axis
    playerPos.x = hole.position.x + (playerPos.x - hole.position.x) * 0.25;
    playerPos.z = hole.position.z + (playerPos.z - hole.position.z) * 0.25;

    if (this.hud) {
      this.hud.setSubterraneanDepth(true, 0.0, hole.tier);
      this.hud.showToast(`🕳️ Entering ${hole.name}! Depth: ${hole.depthFt.toFixed(1)} FT`, 'info');
    }

    // Switch camera to vertical shaft interior framing
    if (this.controller.thirdPersonCamera && typeof this.controller.thirdPersonCamera.setSubterraneanMode === 'function') {
      this.controller.thirdPersonCamera.setSubterraneanMode(true, hole);
    }
  }

  get currentDepthFt() {
    return this.depthFt;
  }

  enterHole(holeId) {
    const hole = (this.holeManager ? this.holeManager.getHoleById(holeId) : null)
      || CONFIG.HOLES.find(h => h.id === holeId)
      || (this.holeManager ? this.holeManager.getHolesList()[0] : CONFIG.HOLES[0]);
    if (!hole) return null;

    if (this.controller) {
      if (typeof this.controller.setFlight === 'function') {
        this.controller.setFlight(false);
      }
      this.controller.isFlying = false;
      if (this.controller.keys) {
        this.controller.keys.jump = false;
      }
      this.controller.teleport(hole.position.x, hole.position.y + 0.15, hole.position.z);
      this.controller.velocity.set(0, -1.0, 0);
      this.onHoleTrigger(hole, this.controller.position, this.controller.velocity);
    } else {
      this.onHoleTrigger(hole, hole.position, new THREE.Vector3(0, -1, 0));
    }
    return hole;
  }

  escapeMidShaft() {
    if (this.phase === SUB_PHASE.DESCENDING && this.depthFt < CONFIG.DEPTH_RULES.MAX_LEGAL_FT) {
      this.phase = SUB_PHASE.MID_SHAFT_FLIGHT;
      if (this.controller) {
        this.controller.setFlight(true);
        if (this.controller.keys) {
          this.controller.keys.jump = true;
        }
      }
      return true;
    }
    return false;
  }

  update(dt) {
    if (this.rejectionCooldown > 0) {
      this.rejectionCooldown -= dt;
      if (this.rejectionCooldown <= 0 && this.phase === SUB_PHASE.REJECTED) {
        this.phase = SUB_PHASE.INACTIVE;
      }
    }

    if (this.phase === SUB_PHASE.INACTIVE || this.phase === SUB_PHASE.REJECTED || !this.activeHole) {
      return;
    }

    const h = this.activeHole;
    const pos = this.controller.position;
    const vel = this.controller.velocity;

    // Calculate live depth from surface
    this.depthMeters = Math.max(0.0, h.position.y - pos.y);
    this.depthFt = this.depthMeters * CONFIG.FT_PER_M;

    // Radial cylindrical containment inside shaft
    const maxR = Math.max(0.5, h.radius - 0.35);
    const dx = pos.x - h.position.x;
    const dz = pos.z - h.position.z;
    const r = Math.hypot(dx, dz);
    if (r > maxR && r > 0.001) {
      pos.x = h.position.x + (dx / r) * maxR;
      pos.z = h.position.z + (dz / r) * maxR;
      vel.x *= 0.5;
      vel.z *= 0.5;
    }

    // Update real-time HUD depth gauge
    if (this.hud) {
      this.hud.setSubterraneanDepth(true, this.depthFt, h.tier);
    }

    // Check shaft orange pickup collisions
    this.checkShaftOranges(pos.y);

    // -----------------------------------------------------------------------
    // Sub-Phase: DESCENDING
    // -----------------------------------------------------------------------
    if (this.phase === SUB_PHASE.DESCENDING) {
      this.controller.state = 'in_hole';

      // Mid-shaft Peter Pan flight escape check (0 - 50ft window)
      if (this.controller.keys && this.controller.keys.jump && this.controller.pixieDust > 0 && this.depthFt < CONFIG.DEPTH_RULES.MAX_LEGAL_FT) {
        this.phase = SUB_PHASE.MID_SHAFT_FLIGHT;
        this.controller.setFlight(true);
      } else {
        // Shaft vertical acceleration with terminal descent velocity
        vel.y = Math.max(this.SHAFT_TERMINAL_V, vel.y + this.SHAFT_GRAVITY * dt);
      }

      // Tier 3 Hazard Check: Boundary Breach (>50.0ft)
      if (h.tier === 'deep' && this.depthFt >= CONFIG.DEPTH_RULES.MAX_LEGAL_FT) {
        this.triggerBoundaryBreach(h);
        return;
      }

      // Tier 3 Proximity Warning Siren (40ft - 50ft)
      if (h.tier === 'deep' && this.depthFt >= 40.0 && this.depthFt < 50.0) {
        this.playProximitySiren(this.depthFt);
      }

      // Tier 2 Bottom Touch in Legal Holes (10ft - 50ft)
      const bottomY = h.position.y - (h.depthFt * CONFIG.M_PER_FT);
      if (pos.y <= bottomY + 0.18) {
        pos.y = bottomY + 0.18;
        this.triggerGeyserLaunch(h);
      }
    }

    // -----------------------------------------------------------------------
    // Sub-Phase: MID_SHAFT_FLIGHT (Escape Window)
    // -----------------------------------------------------------------------
    else if (this.phase === SUB_PHASE.MID_SHAFT_FLIGHT) {
      this.controller.state = 'in_hole';

      // Flight upward climb thrust
      const thrust = (CONFIG.PHYSICS && CONFIG.PHYSICS.FLIGHT_THRUST) || 16.5;
      vel.y = Math.min(this.FLIGHT_CLIMB_SPEED, vel.y + thrust * dt * 2.2);

      // Drain Pixie Dust fuel
      const drain = (CONFIG.PIXIE_DUST && CONFIG.PIXIE_DUST.DRAIN_RATE) || 24.0;
      this.controller.pixieDust = Math.max(0.0, this.controller.pixieDust - drain * dt);

      // Trailing golden sparkles in shaft
      if (this.controller.flight && this.controller.flight.particles) {
        this.controller.flight.particles.active = true;
      }

      // Check if player climbed all the way out to surface rim
      if (pos.y >= h.position.y) {
        this.completeEscape(h);
      } else if (this.controller.pixieDust <= 0 || (this.controller.keys && !this.controller.keys.jump)) {
        // Revert to descent if fuel exhausted or space released
        this.phase = SUB_PHASE.DESCENDING;
        this.controller.setFlight(false);
      }
    }

    // -----------------------------------------------------------------------
    // Sub-Phase: GEYSER_PROPELLED
    // -----------------------------------------------------------------------
    else if (this.phase === SUB_PHASE.GEYSER_PROPELLED) {
      this.controller.state = 'in_hole';

      // Decelerate upward flight under standard gravity
      const g = (CONFIG.PHYSICS && CONFIG.PHYSICS.GRAVITY) || -19.6;
      vel.y += g * dt;

      // Surface emergence check
      if (pos.y >= h.position.y) {
        this.completeGeyserEmergence(h);
      }
    }

    // -----------------------------------------------------------------------
    // Sub-Phase: BREACH_RESPAWNING
    // -----------------------------------------------------------------------
    else if (this.phase === SUB_PHASE.BREACH_RESPAWNING) {
      vel.set(0, 0, 0);
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.completeRespawn(h);
      }
    }
  }

  checkShaftOranges(playerY) {
    if (!this.holeManager) return;
    const oranges = this.holeManager.shaftOranges;
    for (const item of oranges) {
      if (!item.collected && item.holeId === this.activeHole.id) {
        if (Math.abs(playerY - item.worldY) < 1.15) {
          item.collected = true;
          if (item.mesh) item.mesh.visible = false;
          this.controller.oranges = (this.controller.oranges || 0) + 1;
          const pts = 100 * (this.controller.scoreMultiplier || 1.0);
          this.controller.score = (this.controller.score || 0) + pts;
          if (this.audio && this.audio.synth && typeof this.audio.synth.playOrangePickupSound === 'function') {
            this.audio.synth.playOrangePickupSound();
          }
          if (this.hud) {
            this.hud.showToast(`🍊 Shaft Orange Collected! +${pts}`, 'bonus', 1200);
          }
        }
      }
    }
  }

  triggerGeyserLaunch(hole) {
    this.phase = SUB_PHASE.GEYSER_PROPELLED;

    const isHolyGrail = Math.abs(hole.depthFt - CONFIG.DEPTH_RULES.HOLY_GRAIL_FT) <= CONFIG.DEPTH_RULES.HOLY_GRAIL_TOLERANCE_FT;

    if (isHolyGrail) {
      this.triggerHolyGrailPinnacle(hole);
    } else {
      // Standard geyser launch
      const pts = 500 * (this.controller.scoreMultiplier || 1.0);
      this.controller.score = (this.controller.score || 0) + pts;
      const launchV = calculateGeyserImpulse(hole.depthFt, 2.5);
      this.controller.velocity.y = launchV;

      if (this.geyserEmitter) {
        const bottomY = hole.position.y - (hole.depthFt * CONFIG.M_PER_FT);
        this.geyserEmitter.trigger({ x: hole.position.x, y: bottomY, z: hole.position.z }, launchV, false);
      }

      if (this.audio && typeof this.audio.playGeyserSound === 'function') {
        this.audio.playGeyserSound();
      }

      if (this.hud) {
        this.hud.showToast(`💨 GEOTHERMAL GEYSER PROPULSION! Launching skyward! (+${pts})`, 'info', 2200);
      }
    }
  }

  triggerHolyGrailPinnacle(hole) {
    const scoreBonus = 2500;
    this.controller.score = (this.controller.score || 0) + scoreBonus;
    this.controller.oranges = (this.controller.oranges || 0) + 10;

    // Super launch impulse propels Kevin 35m into the sky, clearing pine tree canopy
    const superLaunchV = 32.0;
    this.controller.velocity.y = superLaunchV;

    // 1. Geyser Eruption
    if (this.geyserEmitter) {
      const bottomY = hole.position.y - (hole.depthFt * CONFIG.M_PER_FT);
      this.geyserEmitter.trigger({ x: hole.position.x, y: bottomY, z: hole.position.z }, superLaunchV, true);
    }

    // 2. Confetti Fireworks Cannon
    if (this.celebrations && this.celebrations.confetti) {
      this.celebrations.confetti.explode(hole.position);
    }

    // 3. 15s Golden Fever Mode
    if (this.celebrations && this.celebrations.goldenFever) {
      this.celebrations.goldenFever.activate();
    }

    // 4. Audio Fanfare & Rooster Crow
    if (this.audio) {
      if (typeof this.audio.playHolyGrailFanfare === 'function') {
        this.audio.playHolyGrailFanfare();
      } else if (typeof this.audio.playPeterPanRoosterCrow === 'function') {
        this.audio.playPeterPanRoosterCrow();
      }
    }

    // 5. Grand HUD Banner
    if (this.hud) {
      this.hud.showToast('⭐ 50.0FT HOLY GRAIL CONQUERED! +2,500 PTS! 15s GOLDEN FEVER! ⭐', 'grail', 5000);
    }
  }

  completeGeyserEmergence(hole) {
    this.phase = SUB_PHASE.INACTIVE;
    this.activeHole = null;
    this.controller.state = 'jumping';

    if (this.hud) {
      this.hud.setSubterraneanDepth(false);
    }
    if (this.controller.thirdPersonCamera && typeof this.controller.thirdPersonCamera.setSubterraneanMode === 'function') {
      this.controller.thirdPersonCamera.setSubterraneanMode(false);
    }

    if (window._gameInstance && window._gameInstance.gameState) {
      window._gameInstance.gameState.legalHolesConquered = Math.min(4, (window._gameInstance.gameState.legalHolesConquered || 0) + 1);
    }
  }

  completeEscape(hole) {
    this.phase = SUB_PHASE.INACTIVE;
    this.activeHole = null;
    this.controller.state = 'flying';
    const bonus = 300 * (this.controller.scoreMultiplier || 1.0);
    this.controller.score = (this.controller.score || 0) + bonus;

    if (this.hud) {
      this.hud.setSubterraneanDepth(false);
      this.hud.showToast(`🪶 DARING FLIGHT ESCAPE! Kevin flew out before the 50ft abyss! (+${bonus})`, 'bonus', 3200);
    }
    if (this.controller.thirdPersonCamera && typeof this.controller.thirdPersonCamera.setSubterraneanMode === 'function') {
      this.controller.thirdPersonCamera.setSubterraneanMode(false);
    }
  }

  triggerBoundaryBreach(hole) {
    this.phase = SUB_PHASE.BREACH_RESPAWNING;
    this.respawnTimer = 0.8;
    this.controller.velocity.set(0, 0, 0);

    // Penalty: score deduction (-500) and loss of oranges
    this.controller.score = Math.max(0, (this.controller.score || 0) - 500);
    this.controller.oranges = Math.max(0, (this.controller.oranges || 0) - 3);

    if (this.audio && typeof this.audio.playHazardSiren === 'function') {
      this.audio.playHazardSiren();
    }

    if (this.hud) {
      this.hud.showToast('⚡ 50FT BOUNDARY BREACH! Penalty: -500 Score! Respawning...', 'warn', 2500);
    }
  }

  completeRespawn(hole) {
    this.phase = SUB_PHASE.INACTIVE;
    this.activeHole = null;

    // Safe respawn on solid overlook plateau surface
    const respawnX = hole.position.x + 3.2;
    const respawnY = hole.position.y;
    const respawnZ = hole.position.z;

    this.controller.teleport(respawnX, respawnY, respawnZ);
    this.controller.state = 'idle';

    if (this.hud) {
      this.hud.setSubterraneanDepth(false);
    }
    if (this.controller.thirdPersonCamera && typeof this.controller.thirdPersonCamera.setSubterraneanMode === 'function') {
      this.controller.thirdPersonCamera.setSubterraneanMode(false);
    }
  }

  playProximitySiren(depthFt) {
    const now = Date.now();
    if (now - this._lastSirenTime < 320) return;
    this._lastSirenTime = now;

    if (this.audio && typeof this.audio.playHazardSiren === 'function') {
      this.audio.playHazardSiren();
    }
  }
}
