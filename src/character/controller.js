/**
 * src/character/controller.js
 * Kevin Tighe: 3D Lakeside Retreat - Locomotion, Jump Physics, Ground Collision, Flight & Sonar
 *
 * Implements:
 * - Full character state machine: 'idle', 'walking', 'running', 'jumping', 'flying', 'pondering', 'falling', 'in_hole'
 * - WASD locomotion with camera-relative movement and normalized diagonal vectors
 * - Jump physics with gravity (-19.6 m/s^2), jump impulse (vy = 9.5 m/s), and terminal fall clamp (-25.0 m/s)
 * - Multi-elevation compound ground collision: Terrain heightmap + Wooden Dock (Y=0.85) + Cabin Porch (Y=2.35)
 * - Steep slope sliding for angles > 50 degrees (T2-BND-18)
 * - Peter Pan Pixie Dust flight integration with mid-jump fall arrest and trailing particles
 * - Tinker-Tang fairy companion in 3D Lissajous orbit with slipstream lag
 * - Detached runaway loose shadow projected onto surfaces with playful lag
 * - Third-person follow camera with obstacle raycast collision against cabin & bluffs
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { KevinAvatar } from './kevin.js';
import { ThirdPersonCamera } from './camera.js';
import { FlightSystem } from './flight.js';
import { FairyCompanion } from './fairy.js';
import { RunawayShadow } from './shadow.js';

export class CharacterController {
  constructor(engine, worldManager, textureManager, options = {}) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.worldManager = worldManager;
    this.textures = textureManager;

    // 1. Initialize Avatar Rig
    this.avatar = new KevinAvatar(this.scene, this.textures);

    // 2. Position & Physics State
    this.position = new THREE.Vector3(0.0, 0.85, 10.0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.facingAngle = 0.0;

    this.isGrounded = true;
    this.isFlying = false;
    this.oranges = 0;
    this.score = 0;
    this.state = 'idle';

    this.ponderTimer = 0.0;
    this.jumpJustPressed = false;
    this.sonarSystem = options.sonarSystem || null;
    this.audioSystem = options.audioSystem || null;

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

    // 5. Initialize Orbit Follow Camera
    this.thirdPersonCamera = new ThirdPersonCamera(
      this.camera,
      engine.renderer.domElement,
      collidables
    );

    // 6. Input State
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };

    this.initInputListeners();
  }

  get pixieDust() {
    return this.flight ? this.flight.pixieDust : 100.0;
  }

  set pixieDust(val) {
    if (this.flight) {
      this.flight.pixieDust = Math.max(0, Math.min(100.0, val));
    }
  }

  initInputListeners() {
    window.addEventListener('keydown', (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.sprint = true;

      if (code === 'Space') {
        e.preventDefault();
        if (!this.keys.jump) {
          this.jumpJustPressed = true;
        }
        this.keys.jump = true;

        // Space held while airborne activates Peter Pan flight
        if (!this.isGrounded && this.pixieDust > 0) {
          this.setFlight(true);
        }
      }

      if (code === 'KeyH' || code === 'KeyE') {
        this.triggerSonar();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.keys.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.keys.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.sprint = false;

      if (code === 'Space') {
        this.keys.jump = false;
        if (this.isFlying) {
          this.setFlight(false);
        }
      }
    });
  }

  /**
   * Continuous multi-elevation ground detection:
   * Combines terrain, 24m wooden dock, and cabin porch.
   */
  getGroundElevation(x, z) {
    let groundY = -10.0;

    // 1. Terrain elevation baseline
    if (this.worldManager.terrain && typeof this.worldManager.terrain.getElevation === 'function') {
      groundY = this.worldManager.terrain.getElevation(x, z);
    }

    // 2. Wooden Dock Collision
    // Dock extends at X in [-2.0, 2.0], Z in [6.0, 30.0], Deck elevation = 0.85m
    if (x >= -2.0 && x <= 2.0 && z >= 6.0 && z <= 30.0) {
      // Opening for M3 Dockside Plunge Pit (Z in [21.0, 23.2])
      const inPlungePitOpening = (z >= 21.0 && z <= 23.2);
      if (!inPlungePitOpening) {
        groundY = Math.max(groundY, 0.85);
      }
    }

    // 3. Cabin Porch Collision
    // Cabin sits at (25.0, 2.0, -15.0). Porch spans X in [20.25, 29.75], Z in [-11.0, -7.8]
    // Porch deck elevation = 2.35m
    if (x >= 20.25 && x <= 29.75 && z >= -11.0 && z <= -7.8) {
      groundY = Math.max(groundY, 2.35);
    }

    // 4. Bluffs Overlook Plateau Collision (+22m elevation)
    // Modeled in src/world/bluffs.js at (-45.0, 21.1, 0.0), top deck at Y = 22.0m
    // Bounds: width 10m (X: -50 to -40), depth 12m (Z: -6 to 6)
    if (x >= -50.0 && x <= -40.0 && z >= -6.0 && z <= 6.0) {
      groundY = Math.max(groundY, 22.0);
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
   * Solid obstacle collision: prevents walking through cabin walls
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

  setFlight(active) {
    if (active && this.pixieDust > 0) {
      this.isFlying = true;
      this.isGrounded = false; // Disengage ground state to prevent frame-1 cancellation in grounded takeoffs
      this.state = 'flying';
      this.flight.setFlight(true);
      // Upward flight arrest if falling (T3-PAIR-01)
      this.velocity.y = Math.max(this.velocity.y, 4.0);
      if (this.audioSystem) {
        this.audioSystem.playFlightSound();
      }
    } else {
      this.isFlying = false;
      this.flight.setFlight(false);
      if (!this.isGrounded) {
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
      this.ponderTimer = 1.5; // 1.5s chin-stroke ponder
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

    // Immediately latch grounded state if placed at or on ground elevation
    const groundY = this.getGroundElevation(x, z);
    this.isGrounded = Math.abs(y - groundY) < 0.2 || y <= groundY;
    if (this.isGrounded) {
      if (this.isFlying) {
        this.setFlight(false);
      }
      if (this.state === 'flying' || this.state === 'falling' || this.state === 'jumping') {
        this.state = 'idle';
      }
    }

    this.avatar.group.position.copy(this.position);
    this.thirdPersonCamera.update(0.016, this.position);

    // Tether companion fairy and loose shadow immediately (T1-R2-05-E)
    if (this.fairy) {
      this.fairy.teleportTo(x, y, z);
    }
    if (this.shadow) {
      this.shadow.teleportTo(x, y, z, (sx, sz) => this.getGroundElevation(sx, sz));
    }
  }

  update(dt) {
    // 1. Process Ponder Sonar Timer
    if (this.ponderTimer > 0) {
      this.ponderTimer -= dt;
      if (this.ponderTimer <= 0) {
        this.ponderTimer = 0;
      }
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

    // 3. Camera-Relative Movement Trajectory
    const camYaw = this.thirdPersonCamera.yaw;
    const moveX = normStrafe * Math.cos(camYaw) + normFwd * Math.sin(camYaw);
    const moveZ = -normStrafe * Math.sin(camYaw) + normFwd * Math.cos(camYaw);

    const speedTier = this.keys.sprint ? (CONFIG.PHYSICS.RUN_SPEED || 14.0) : (CONFIG.PHYSICS.WALK_SPEED || 8.5);
    const planarSpeed = inputLen > 0 ? speedTier : 0;

    this.velocity.x = moveX * planarSpeed;
    this.velocity.z = moveZ * planarSpeed;

    // Check steep slope sliding (T2-BND-18: steep bluff slopes > 50 deg trigger downward sliding)
    const currentGroundY = this.getGroundElevation(this.position.x, this.position.z);
    const onGround = this.isGrounded || Math.abs(this.position.y - currentGroundY) < 0.2;
    if (onGround) {
      const slope = this.getSlopeAt(this.position.x, this.position.z);
      if (slope.angleDeg > 50.0) {
        const slideForce = (slope.angleDeg / 90.0) * 12.0;
        this.velocity.x += slope.normalX * slideForce;
        this.velocity.z += slope.normalZ * slideForce;
      }
    }

    // Smooth mesh heading rotation towards movement vector
    if (inputLen > 0.05) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      let angleDiff = targetAngle - this.facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.facingAngle += angleDiff * Math.min(1.0, dt * 12.0);
      this.avatar.group.rotation.y = this.facingAngle;
    }

    // 4. Vertical Physics, Jump & Pixie Dust Flight
    if (this.isFlying) {
      this.flight.update(dt, this.isGrounded, (this.keys.jump || this.isFlying), this.velocity, this.position);
      this.isFlying = this.flight.isFlying;

      if (!this.isFlying && !this.isGrounded) {
        this.state = 'falling';
      }
    } else {
      // Normal Gravitational Acceleration
      const gravity = (CONFIG.PHYSICS && CONFIG.PHYSICS.GRAVITY) || -19.6;
      this.velocity.y += gravity * dt;

      // Terminal Velocity Clamp (-25.0 m/s per Tier 2 spec T2-BND-19)
      this.velocity.y = Math.max(-25.0, this.velocity.y);

      // Jump impulse (vy = 9.0 m/s >= 7.0 required by T1-R2-03-B)
      if (this.isGrounded && this.jumpJustPressed) {
        const impulse = (CONFIG.PHYSICS && CONFIG.PHYSICS.JUMP_IMPULSE) || 9.0;
        this.velocity.y = impulse;
        this.isGrounded = false;
        if (this.audioSystem) {
          this.audioSystem.playJumpSound();
        }
      }
      this.jumpJustPressed = false;

      // Ground Pixie Dust Recharge
      this.flight.update(dt, this.isGrounded, false, this.velocity, this.position);
    }

    // 5. Integrate Position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Obstacle avoidance (solid cabin walls & 80m world boundary)
    this.resolveObstacles(this.position);

    // 6. Ground Surface Collision Detection
    const groundElevation = this.getGroundElevation(this.position.x, this.position.z);

    // Continuous slope stepping: snap small ground drops (<= 0.15m) when grounded and moving downward
    if (this.isGrounded && !this.isFlying && this.velocity.y <= 0 && this.position.y > groundElevation && (this.position.y - groundElevation) <= 0.15) {
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

    // 7. Update Avatar Transform & Visual State
    this.avatar.group.position.copy(this.position);

    // Resolve state for HUD & tests
    if (this.ponderTimer > 0) {
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

    // 9. Update Third-Person Follow/Orbit Camera
    this.thirdPersonCamera.update(dt, this.position);
  }
}
