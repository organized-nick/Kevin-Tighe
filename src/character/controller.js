/**
 * src/character/controller.js
 * Kevin Tighe: 3D Lakeside Retreat - Locomotion, Jump Physics, Ground Collision, Flight & Sonar
 *
 * Implements:
 * - Full character state machine: 'idle', 'walking', 'running', 'jumping', 'flying', 'pondering', 'falling', 'in_hole'
 * - Intuitive right-handed WASD / Arrow locomotion aligned with camera forward (-sin(yaw), -cos(yaw)) & right (+cos(yaw), -sin(yaw))
 * - Responsive jump physics with coyote time (0.12s), jump buffering (0.12s), gravity (-19.6 m/s^2), and terminal fall clamp (-25.0 m/s)
 * - Automatic Peter Pan glide when holding Space after a jump, plus F-key toggle flight and C/Ctrl flight descent
 * - Multi-elevation compound ground collision: Terrain + Shore-Dock Ramp + Wooden Pier (Y=0.85) + Cabin Porch & Steps (Y=2.35) + Bluff Plateau (Y=22.0) + Lake Wading (-0.35m)
 * - Steep slope sliding for cliff angles > 50 degrees (T2-BND-18)
 * - O(1) trigonometric heading wrap preventing angle-accumulation stalls
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { KevinAvatar } from './kevin.js';
import { ThirdPersonCamera } from './camera.js';
import { FlightSystem } from './flight.js';
import { FairyCompanion } from './fairy.js';
import { RunawayShadow } from './shadow.js';
import { InputManager } from '../core/input.js';

export class CharacterController {
  constructor(engine, worldManager, textureManager, options = {}) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.worldManager = worldManager;
    this.textures = textureManager;

    // 1. Initialize Avatar Rig
    this.avatar = new KevinAvatar(this.scene, this.textures);

    // 2. Spawn on the lakeward pier facing toward the shore & all 4 landmarks (-Z, yaw = 0)
    this.position = new THREE.Vector3(0.0, 0.85, 27.5);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.facingAngle = Math.PI;

    this.isGrounded = true;
    this.isFlying = false;
    this.flightMode = null; // 'hold' (Space in air) | 'toggle' (F key or API)
    this.oranges = 0;
    this.score = 0;
    this.state = 'idle';

    this.ponderTimer = 0.0;
    this.jumpJustPressed = false;
    this.coyoteTimer = 0.12;
    this.jumpBufferTimer = 0.0;
    this.airborneTime = 0.0;

    this.sonarSystem = options.sonarSystem || null;
    this.audioSystem = options.audioSystem || null;
    this.subterraneanSystem = options.subterraneanSystem || null;

    this.speedMultiplier = 1.0;
    this.scoreMultiplier = 1.0;

    // 3. Subsystems: Flight, Fairy, Shadow
    this.flight = new FlightSystem(this.scene);
    this.fairy = new FairyCompanion(this.scene);
    this.shadow = new RunawayShadow(this.scene);

    // Expose flight particles directly for contract inspection
    this.particles = this.flight.particles;

    // 4. Collect Collidable Landmark Objects for Camera Obstacle Detection
    const collidables = [];
    if (worldManager.cabin && worldManager.cabin.group) collidables.push(worldManager.cabin.group);
    if (worldManager.bluffs && worldManager.bluffs.group) collidables.push(worldManager.bluffs.group);
    if (worldManager.dock && worldManager.dock.group) collidables.push(worldManager.dock.group);
    if (worldManager.terrain && worldManager.terrain.mesh) collidables.push(worldManager.terrain.mesh);

    // 5. Initialize Orbit Follow Camera & Snap Behind Spawn
    this.thirdPersonCamera = new ThirdPersonCamera(
      this.camera,
      engine.renderer.domElement,
      collidables
    );

    // Sync initial avatar, companions, and camera transform
    this.avatar.group.position.copy(this.position);
    this.avatar.group.rotation.y = this.facingAngle;
    this.fairy.teleportTo(this.position.x, this.position.y, this.position.z);
    this.shadow.teleportTo(this.position.x, this.position.y, this.position.z, (sx, sz) => this.getGroundElevation(sx, sz));
    this.thirdPersonCamera.snapToTarget(this.position);

    // 6. Input Manager & Keys State
    this.input = options.inputManager || new InputManager({ domElement: engine.renderer.domElement });
    this.keys = this.input.keys;

    this.initInputListeners();
  }

  get pixieDust() {
    return this.flight ? this.flight.pixieDust : 100.0;
  }

  set pixieDust(val) {
    if (this.flight) {
      if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
        return;
      }
      this.flight.pixieDust = Math.max(0, Math.min(100.0, val));
    }
  }

  initInputListeners() {
    if (!this.input) return;

    this.input.on('jump', () => {
      this.jumpJustPressed = true;
      this.jumpBufferTimer = 0.12;
      // Pressing Space while clearly airborne engages Peter Pan Pixie Dust flight
      if (!this.isGrounded && this.coyoteTimer <= 0.0 && this.pixieDust > 0) {
        this.setFlight(true, 'hold');
      }
    });

    this.input.on('jumpRelease', () => {
      // Releasing Space ends hold-glide, while leaving F-toggled/API flight active
      if (this.isFlying && this.flightMode === 'hold') {
        this.setFlight(false);
      }
    });

    this.input.on('sonar', () => {
      this.triggerSonar();
    });

    this.input.on('flight', () => {
      if (this.isFlying) {
        this.setFlight(false);
      } else {
        this.setFlight(true, 'toggle');
      }
    });
  }

  /**
   * Continuous multi-elevation ground detection:
   * Combines terrain, shore-to-dock ramp, 24m wooden dock, cabin porch + steps, bluff overlook, and lake wading.
   */
  getGroundElevation(x, z) {
    let groundY = -10.0;

    // 1. Terrain elevation baseline
    if (this.worldManager.terrain && typeof this.worldManager.terrain.getElevation === 'function') {
      groundY = this.worldManager.terrain.getElevation(x, z);
    }

    // 2a. Shore-to-Dock Approach Ramp (smoothly bridges shoreline Z=4.2 up to pier deck Z=6.0 at Y=0.85m)
    if (x >= -2.1 && x <= 2.1 && z >= 4.2 && z < 6.0) {
      const rampT = (z - 4.2) / 1.8;
      groundY = Math.max(groundY, THREE.MathUtils.lerp(0.18, 0.85, rampT));
    }

    // 2b. Wooden Dock Collision: X in [-2.0, 2.0], Z in [6.0, 30.0], Deck elevation = 0.85m
    if (x >= -2.0 && x <= 2.0 && z >= 6.0 && z <= 30.0) {
      // Opening for M3 Dockside Plunge Pit (radius 1.6m centered at (0, 22.0): X in [-1.6, 1.6], Z in [20.4, 23.6])
      const inPlungePitOpening = (z >= 20.4 && z <= 23.6) && (Math.abs(x) <= 1.6);
      if (!inPlungePitOpening) {
        groundY = Math.max(groundY, 0.85);
      }
    }

    // 3a. Cabin Porch Front Stairs Ramp (X in [23.3, 26.7], Z in [-7.8, -6.5])
    if (x >= 23.3 && x <= 26.7 && z > -7.8 && z <= -6.5) {
      const stepT = 1.0 - ((z - (-7.8)) / 1.3);
      groundY = Math.max(groundY, THREE.MathUtils.lerp(2.0, 2.35, stepT));
    }

    // 3b. Cabin Porch Deck Collision: X in [20.25, 29.75], Z in [-11.0, -7.8], Y = 2.35m
    if (x >= 20.25 && x <= 29.75 && z >= -11.0 && z <= -7.8) {
      groundY = Math.max(groundY, 2.35);
    }

    // 4. Bluffs Overlook Plateau Collision (+22m elevation)
    // Only snap to the +22m top deck when approaching from trail/air at plateau altitude (prevents teleporting up from cliff base)
    if (x >= -50.0 && x <= -40.0 && z >= -6.0 && z <= 6.0) {
      if (!this.position || this.position.y >= 17.5) {
        groundY = Math.max(groundY, 22.0);
      }
    }

    // 5. Lake Water Buoyant Wading Floor (keep Kevin wading chest-high at -0.35m instead of sinking 4.5m underwater)
    if (groundY < -0.35) {
      groundY = -0.35;
    }

    // 6. Subterranean Active Hole Shaft Floor Override (carves out all 4 hole mouths & shafts cleanly)
    if (this.subterraneanSystem && typeof this.subterraneanSystem.getGroundOverride === 'function') {
      groundY = this.subterraneanSystem.getGroundOverride(x, z, groundY);
    }

    return groundY;
  }

  /**
   * Sample terrain slope gradient for steep bluff sliding
   */
  getSlopeAt(x, z) {
    if (!this.worldManager.terrain || typeof this.worldManager.terrain.getElevation !== 'function') {
      return { angleDeg: 0, normalX: 0, normalZ: 0 };
    }
    const delta = 0.5;
    const h0 = this.worldManager.terrain.getElevation(x, z);
    const hx = this.worldManager.terrain.getElevation(x + delta, z);
    const hz = this.worldManager.terrain.getElevation(x, z + delta);

    const gradX = (hx - h0) / delta;
    const gradZ = (hz - h0) / delta;
    const slope = Math.sqrt(gradX * gradX + gradZ * gradZ);
    const angleDeg = (Math.atan(slope) * 180) / Math.PI;

    return {
      angleDeg,
      normalX: slope > 0.001 ? -gradX / slope : 0,
      normalZ: slope > 0.001 ? -gradZ / slope : 0
    };
  }

  /**
   * Solid obstacle collision: prevents walking through cabin walls & enforces 80m perimeter
   */
  resolveObstacles(pos) {
    // Cabin main log structure: X in [19.5, 30.5], Z in [-19.0, -11.0], Y < 6.2
    if (pos.x >= 19.5 && pos.x <= 30.5 && pos.z >= -19.0 && pos.z <= -11.0 && pos.y < 6.2) {
      const dMinX = Math.abs(pos.x - 19.5);
      const dMaxX = Math.abs(pos.x - 30.5);
      const dMinZ = Math.abs(pos.z - (-19.0));
      const dMaxZ = Math.abs(pos.z - (-11.0));

      const minVal = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);
      if (minVal === dMinX) pos.x = 19.45;
      else if (minVal === dMaxX) pos.x = 30.55;
      else if (minVal === dMinZ) pos.z = -19.05;
      else pos.z = -10.95;
    }

    // Lake perimeter soft containment clamp (radius = 80m per Tier 2 spec)
    const dist = Math.hypot(pos.x, pos.z);
    if (dist > 80.0) {
      pos.x = (pos.x / dist) * 80.0;
      pos.z = (pos.z / dist) * 80.0;
    }
  }

  setFlight(active, mode = 'toggle') {
    if (active && this.pixieDust > 0) {
      this.isFlying = true;
      this.flightMode = mode;
      this.isGrounded = false;
      this.coyoteTimer = 0.0;
      this.state = 'flying';
      this.flight.setFlight(true);
      // Upward flight arrest if falling (T3-PAIR-01)
      this.velocity.y = Math.max(this.velocity.y, 4.0);
      if (this.audioSystem) {
        this.audioSystem.playFlightSound();
      }
    } else {
      this.isFlying = false;
      this.flightMode = null;
      this.flight.setFlight(false);
      if (!this.isGrounded && this.state !== 'in_hole') {
        this.state = 'falling';
      }
    }
  }

  triggerSonar() {
    if (this.sonarSystem) {
      const result = this.sonarSystem.trigger();
      if (result) {
        this.ponderTimer = 1.5;
        if (!this.isFlying) {
          this.state = 'pondering';
        }
        return result;
      }
    } else {
      this.ponderTimer = 1.5;
      if (!this.isFlying) {
        this.state = 'pondering';
      }
      return { active: true, radius: 100 };
    }
    return { active: false, radius: 100 };
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.jumpJustPressed = false;
    this.jumpBufferTimer = 0.0;

    // Immediately latch grounded state if placed at or on ground elevation
    const groundY = this.getGroundElevation(x, z);
    this.isGrounded = Math.abs(y - groundY) < 0.2 || y <= groundY;
    this.coyoteTimer = this.isGrounded ? 0.12 : 0.0;
    this.airborneTime = 0.0;

    if (this.isGrounded) {
      if (this.isFlying) {
        this.setFlight(false);
      }
      if (this.state === 'flying' || this.state === 'falling' || this.state === 'jumping') {
        this.state = 'idle';
      }
    }

    this.avatar.group.position.copy(this.position);
    this.thirdPersonCamera.update(0.016, this.position, this.velocity, {
      getGroundY: (gx, gz) => this.getGroundElevation(gx, gz)
    });

    // Tether companion fairy and loose shadow immediately (T1-R2-05-E)
    if (this.fairy) {
      this.fairy.teleportTo(x, y, z);
    }
    if (this.shadow) {
      this.shadow.teleportTo(x, y, z, (sx, sz) => this.getGroundElevation(sx, sz));
    }
  }

  update(dt) {
    if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) {
      return;
    }

    // 0. Subterranean Hole Checks & Kinetics
    if (this.subterraneanSystem) {
      this.subterraneanSystem.checkHoleEntry(this.position, this.velocity);
      this.subterraneanSystem.update(dt);
    }

    // 1. Process Timers (Ponder, Coyote Time, Jump Buffer, Airborne Time)
    if (this.ponderTimer > 0) {
      this.ponderTimer = Math.max(0, this.ponderTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }
    if (this.isGrounded) {
      this.coyoteTimer = 0.12;
      this.airborneTime = 0.0;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      this.airborneTime += dt;
    }

    // 2. Process Input Direction & Normalization
    // Opposing inputs cleanly cancel to zero (T2-BND-21)
    let rawFwd = 0;
    if (this.keys.forward) rawFwd += 1;
    if (this.keys.backward) rawFwd -= 1;

    let rawStrafe = 0;
    if (this.keys.right) rawStrafe += 1;
    if (this.keys.left) rawStrafe -= 1;

    // Normalization of diagonal vector (T2-BND-22)
    const inputLen = Math.hypot(rawStrafe, rawFwd);
    let normStrafe = 0;
    let normFwd = 0;
    if (inputLen > 0) {
      normStrafe = rawStrafe / inputLen;
      normFwd = rawFwd / inputLen;
    }

    // 3. Orthonormal Right-Handed Camera-Relative Movement Basis
    // Camera sits at (+sin(yaw), +cos(yaw)) behind Kevin and looks along (-sin(yaw), -cos(yaw)):
    //   Forward (+W / Up)    => (-sin(yaw), -cos(yaw)) (into the scene, away from camera)
    //   Backward (-S / Down) => (+sin(yaw), +cos(yaw)) (toward camera)
    //   Right (+D / Right)   => (+cos(yaw), -sin(yaw)) (screen right)
    //   Left (-A / Left)     => (-cos(yaw), +sin(yaw)) (screen left)
    const camYaw = this.thirdPersonCamera.yaw;
    const moveX = normStrafe * Math.cos(camYaw) - normFwd * Math.sin(camYaw);
    const moveZ = -normStrafe * Math.sin(camYaw) - normFwd * Math.cos(camYaw);

    const isWading = this.isGrounded && this.position.y < -0.15;
    const wadeFactor = isWading ? 0.82 : 1.0;
    const baseSpeed = this.keys.sprint ? (CONFIG.PHYSICS.RUN_SPEED || 14.0) : (CONFIG.PHYSICS.WALK_SPEED || 8.5);
    const speedTier = baseSpeed * (this.speedMultiplier || 1.0) * wadeFactor;
    const planarSpeed = inputLen > 0 ? speedTier : 0;

    this.velocity.x = moveX * planarSpeed;
    this.velocity.z = moveZ * planarSpeed;

    // Check steep slope sliding (T2-BND-18: steep bluff slopes > 50 deg trigger downward sliding)
    const currentGroundY = this.getGroundElevation(this.position.x, this.position.z);
    const onGround = this.isGrounded || Math.abs(this.position.y - currentGroundY) < 0.2;
    if (onGround && currentGroundY < 21.8) {
      const slope = this.getSlopeAt(this.position.x, this.position.z);
      if (slope.angleDeg > 50.0) {
        const slideForce = (slope.angleDeg / 90.0) * 12.0;
        this.velocity.x += slope.normalX * slideForce;
        this.velocity.z += slope.normalZ * slideForce;
      }
    }

    // O(1) trigonometric heading wrap towards movement vector (prevents T5-NUM-03 while-loop hang)
    if (inputLen > 0.05) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      const angleDiff = Math.atan2(
        Math.sin(targetAngle - this.facingAngle),
        Math.cos(targetAngle - this.facingAngle)
      );
      const nextAngle = this.facingAngle + angleDiff * Math.min(1.0, dt * 14.0);
      this.facingAngle = Math.atan2(Math.sin(nextAngle), Math.cos(nextAngle));
      this.avatar.group.rotation.y = this.facingAngle;
    }

    // 4. Vertical Physics, Jump, Coyote Time & Pixie Dust Flight
    const isInHole = this.state === 'in_hole' || (
      this.subterraneanSystem &&
      this.subterraneanSystem.phase !== 'inactive' &&
      this.subterraneanSystem.phase !== 'rejected'
    );

    if (isInHole) {
      // Subterranean vertical kinetics integrated in subterraneanSystem.update(dt)
      this.jumpJustPressed = false;
      this.jumpBufferTimer = 0.0;
    } else if (this.isFlying) {
      const keepFlying = (this.flightMode === 'hold') ? Boolean(this.keys.jump) : true;
      this.flight.update(dt, this.isGrounded, keepFlying, this.velocity, this.position, {
        descend: Boolean(this.keys.descend)
      });
      this.isFlying = this.flight.isFlying;
      if (!this.isFlying) {
        this.flightMode = null;
        if (!this.isGrounded) {
          this.state = 'falling';
        }
      }
      this.jumpJustPressed = false;
    } else {
      // Normal Gravitational Acceleration
      const gravity = (CONFIG.PHYSICS && CONFIG.PHYSICS.GRAVITY) || -19.6;
      this.velocity.y += gravity * dt;

      // Terminal Velocity Clamp (-25.0 m/s per Tier 2 spec T2-BND-19)
      this.velocity.y = Math.max(-25.0, this.velocity.y);

      // Jump impulse with coyote time & jump buffer
      const wantsJump = this.jumpJustPressed || this.jumpBufferTimer > 0.0;
      const canJump = this.isGrounded || this.coyoteTimer > 0.0;

      if (canJump && wantsJump) {
        const impulse = (CONFIG.PHYSICS && CONFIG.PHYSICS.JUMP_IMPULSE) || 9.0;
        this.velocity.y = impulse;
        this.isGrounded = false;
        this.coyoteTimer = 0.0;
        this.jumpBufferTimer = 0.0;
        this.airborneTime = 0.0;
        if (this.audioSystem) {
          this.audioSystem.playJumpSound();
        }
      } else if (
        !this.isGrounded &&
        this.keys.jump &&
        this.airborneTime >= 0.24 &&
        this.velocity.y <= 4.5 &&
        this.pixieDust > 0
      ) {
        // Holding Space past jump ascent automatically transitions into Peter Pan Pixie Dust glide!
        this.setFlight(true, 'hold');
      }

      this.jumpJustPressed = false;

      // Ground Pixie Dust Recharge
      if (!this.isFlying) {
        this.flight.update(dt, this.isGrounded, false, this.velocity, this.position);
      }
    }

    // 5. Integrate Position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Obstacle avoidance (solid cabin walls & 80m world boundary)
    this.resolveObstacles(this.position);

    // 6. Ground Surface Collision Detection
    if (!isInHole) {
      const groundElevation = this.getGroundElevation(this.position.x, this.position.z);

      // Continuous slope stepping: snap small downward slope drops (<= 0.25m) without micro-bouncing
      if (
        this.isGrounded &&
        !this.isFlying &&
        this.velocity.y <= 0 &&
        this.position.y > groundElevation &&
        (this.position.y - groundElevation) <= 0.25
      ) {
        this.position.y = groundElevation;
      }

      if (this.position.y <= groundElevation) {
        const wasAirborne = !this.isGrounded;
        this.position.y = groundElevation;
        this.velocity.y = 0;
        this.isGrounded = true;

        if (wasAirborne && this.audioSystem) {
          this.audioSystem.playLandSound();
        }

        if (this.isFlying) {
          this.setFlight(false);
        }
      } else {
        this.isGrounded = false;
      }
    }

    // 6b. Subterranean Hole Entry Check (when not already in subterranean mode)
    if (!isInHole && this.subterraneanSystem) {
      this.subterraneanSystem.checkHoleEntry(this.position, this.velocity);
    }

    // 7. Update Avatar Transform & Visual State
    this.avatar.group.position.copy(this.position);

    // Resolve state for HUD & tests
    if (isInHole) {
      this.state = 'in_hole';
    } else if (this.ponderTimer > 0) {
      this.state = 'pondering';
    } else if (this.isFlying) {
      this.state = 'flying';
    } else if (!this.isGrounded) {
      this.state = this.velocity.y > 0 ? 'jumping' : 'falling';
    } else {
      this.state = planarSpeed > 9.0 ? 'running' : (planarSpeed > 0.1 ? 'walking' : 'idle');
    }

    this.avatar.update(dt, this.state, planarSpeed, this.isGrounded, this.ponderTimer > 0);

    // 8. Update Fairy Companion & Runaway Loose Shadow
    if (this.fairy) {
      this.fairy.update(dt, this.position, this.velocity);
    }
    if (this.shadow) {
      this.shadow.update(dt, this.position, (sx, sz) => this.getGroundElevation(sx, sz));
    }

    // 9. Update Third-Person Follow/Orbit Camera with keyboard orbit, chase turn & ground clearance
    this.thirdPersonCamera.update(dt, this.position, this.velocity, {
      keys: this.keys,
      strafeInput: normStrafe,
      fwdInput: normFwd,
      getGroundY: (gx, gz) => this.getGroundElevation(gx, gz)
    });
  }
}
