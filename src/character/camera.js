/**
 * src/character/camera.js
 * Kevin Tighe: 3D Lakeside Retreat - Third-Person Follow/Orbit Camera with Raycast Obstacle Collision
 *
 * Implements:
 * - Smooth chasing, gentle lateral auto-follow, Q/E keyboard orbit, and mouse orbit around Kevin Tighe
 * - Clamped pitch angle between -85 deg and +85 deg (-1.4835 to +1.4835 rad) preventing pole gimbal flip
 * - Surface ground-height clearance clamping preventing camera from dipping underground or underwater
 * - Dynamic raycast obstacle collision detection preventing camera from clipping inside cabin or rocky bluffs
 * - Left/right mouse drag (with contextmenu suppressed), optional pointer lock, and wheel zoom
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class ThirdPersonCamera {
  constructor(camera, domElement, obstacleObjects = []) {
    this.camera = camera;
    this.domElement = domElement || document.body;
    this.obstacles = obstacleObjects;

    // Camera settings from CONFIG
    this.minDistance = (CONFIG.CAMERA && CONFIG.CAMERA.MIN_DISTANCE) || 3.5;
    this.minCollisionDistance = (CONFIG.CAMERA && CONFIG.CAMERA.MIN_COLLISION_DISTANCE) || 0.4;
    this.maxDistance = (CONFIG.CAMERA && CONFIG.CAMERA.MAX_DISTANCE) || 22.0;
    this._targetDistance = (CONFIG.CAMERA && CONFIG.CAMERA.DEFAULT_DISTANCE) || 9.0;
    this.currentDistance = this._targetDistance;

    // Pitch clamped strictly between -85 deg and +85 deg (-1.4835 to +1.4835 rad)
    this.minPitch = (-85 * Math.PI) / 180;
    this.maxPitch = (85 * Math.PI) / 180;
    // Comfortable surface drag pitch floor so mouse-dragging never dives under the terrain
    this.surfaceDragMinPitch = (-8 * Math.PI) / 180;
    this.surfaceDragMaxPitch = (78 * Math.PI) / 180;

    this.yaw = 0.0;
    this.pitch = 0.22; // Elevated scenic third-person angle looking over Kevin's shoulder

    this.lookOffsetY = (CONFIG.CAMERA && CONFIG.CAMERA.LOOK_OFFSET_Y) || 1.6;
    this.smoothFactor = (CONFIG.CAMERA && CONFIG.CAMERA.SMOOTH_FACTOR) || 0.12;

    this.focusPoint = new THREE.Vector3();
    this.idealPosition = new THREE.Vector3();
    this.currentPosition = new THREE.Vector3();

    this.isDragging = false;
    this.enabled = true;
    this.manualOrbitCooldown = 0.0;
    this.previousMousePosition = { x: 0, y: 0 };
    this.mouseSensitivity = 0.0042;
    this.keyOrbitSpeed = 2.1; // rad/s when holding Q or E

    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = (CONFIG.CAMERA && CONFIG.CAMERA.NEAR) || 0.1;

    // Subterranean vertical shaft framing
    this.isSubterranean = false;
    this.subHole = null;
    this.subLookTarget = new THREE.Vector3();

    this.initInputListeners();
  }

  setSubterraneanMode(active, holeData = null) {
    this.isSubterranean = active;
    this.subHole = holeData;
    if (!active && this.pitch < 0.08) {
      this.pitch = 0.22;
    }
  }

  get subterraneanActive() {
    return this.isSubterranean;
  }

  setObstacles(obstacleArray) {
    this.obstacles = obstacleArray || [];
  }

  setPitch(pitchRad) {
    this.pitch = THREE.MathUtils.clamp(pitchRad, this.minPitch, this.maxPitch);
  }

  setYaw(yawRad) {
    if (typeof yawRad === 'number' && Number.isFinite(yawRad)) {
      this.yaw = yawRad;
    }
  }

  togglePointerLock() {
    if (!this.domElement || typeof this.domElement.requestPointerLock !== 'function') return;
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    } else {
      this.domElement.requestPointerLock();
    }
  }

  snapToTarget(targetPosition) {
    if (!targetPosition) return;
    this.focusPoint.set(targetPosition.x, targetPosition.y + this.lookOffsetY, targetPosition.z);
    const cosPitch = Math.cos(this.pitch);
    const dirX = Math.sin(this.yaw) * cosPitch;
    const dirY = Math.sin(this.pitch);
    const dirZ = Math.cos(this.yaw) * cosPitch;
    this.currentDistance = this._targetDistance;
    this.camera.position.set(
      this.focusPoint.x + dirX * this.currentDistance,
      this.focusPoint.y + dirY * this.currentDistance,
      this.focusPoint.z + dirZ * this.currentDistance
    );
    this.camera.lookAt(this.focusPoint);
  }

  initInputListeners() {
    // Prevent browser context menu on right-click orbit
    this.domElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    this.domElement.addEventListener('dblclick', () => {
      this.togglePointerLock();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      const isLocked = document.pointerLockElement === this.domElement;
      if (this.isDragging || isLocked) {
        const deltaX = isLocked
          ? (e.movementX || 0)
          : (e.clientX - this.previousMousePosition.x);
        const deltaY = isLocked
          ? (e.movementY || 0)
          : (e.clientY - this.previousMousePosition.y);

        this.previousMousePosition = { x: e.clientX, y: e.clientY };

        if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
          this.yaw -= deltaX * this.mouseSensitivity;
          // Dragging mouse up tilts view upward; dragging down raises camera overhead; clamped above ground
          this.pitch = THREE.MathUtils.clamp(
            this.pitch + deltaY * this.mouseSensitivity,
            this.surfaceDragMinPitch,
            this.surfaceDragMaxPitch
          );
          this.manualOrbitCooldown = 1.25;
        }
      }
    });

    // Zoom via mouse wheel with NaN/non-finite sanitization
    this.handleWheel = (e) => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      if (!e || typeof e.deltaY !== 'number' || !Number.isFinite(e.deltaY) || Number.isNaN(e.deltaY)) {
        return;
      }
      const zoomStep = e.deltaY * 0.012;
      this.targetDistance = THREE.MathUtils.clamp(
        this.targetDistance + zoomStep,
        this.minDistance,
        this.maxDistance
      );
    };
    this.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  get targetDistance() {
    return this._targetDistance;
  }

  set targetDistance(val) {
    if (typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val)) {
      this._targetDistance = THREE.MathUtils.clamp(val, this.minDistance, this.maxDistance);
    }
  }

  update(dt, targetPosition, targetVelocity = null, options = {}) {
    // Enforce pitch bounds strictly [-85 deg, +85 deg] (-1.4835 to +1.4835 rad)
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
    if (this.enabled === false) return;

    if (!targetPosition) return;
    const safeDt = (typeof dt === 'number' && Number.isFinite(dt) && dt > 0) ? dt : 0;

    if (this.manualOrbitCooldown > 0) {
      this.manualOrbitCooldown = Math.max(0, this.manualOrbitCooldown - safeDt);
    }

    // Subterranean Interior Shaft Framing
    if (this.isSubterranean && this.subHole) {
      const h = this.subHole;
      const isAscending = targetVelocity ? (targetVelocity.y > 0) : (targetPosition.y > this.focusPoint.y);

      const camR = Math.min(0.65, h.radius * 0.35);
      const idealX = h.position.x + Math.sin(this.yaw) * camR;
      const idealZ = h.position.z + Math.cos(this.yaw) * camR;

      let idealY, targetY;
      if (!isAscending) {
        idealY = targetPosition.y + 3.2;
        targetY = targetPosition.y - 1.5;
        this.pitch = -0.45;
      } else {
        idealY = targetPosition.y - 2.6;
        targetY = targetPosition.y + 2.5;
        this.pitch = 0.55;
      }

      this.idealPosition.set(idealX, idealY, idealZ);
      this.subLookTarget.set(h.position.x, targetY, h.position.z);

      const lerpPos = safeDt > 0 ? (1.0 - Math.exp(-10.0 * safeDt)) : 0;
      const lerpTarget = safeDt > 0 ? (1.0 - Math.exp(-12.0 * safeDt)) : 0;

      if (lerpPos > 0) {
        this.camera.position.lerp(this.idealPosition, lerpPos);
        this.focusPoint.lerp(this.subLookTarget, lerpTarget);
      }
      this.camera.lookAt(this.focusPoint);
      return;
    }

    // 0. Keyboard Camera Orbit (Q / E) & Gentle Lateral Chase Follow
    const keys = options.keys || null;
    if (safeDt > 0 && keys) {
      let keyOrbit = 0;
      if (keys.camLeft) keyOrbit += 1;
      if (keys.camRight) keyOrbit -= 1;

      if (keyOrbit !== 0) {
        this.yaw += keyOrbit * this.keyOrbitSpeed * safeDt;
        this.manualOrbitCooldown = 1.0;
      } else if (
        !this.isDragging &&
        document.pointerLockElement !== this.domElement &&
        this.manualOrbitCooldown <= 0 &&
        typeof options.strafeInput === 'number' &&
        Math.abs(options.strafeInput) > 0.05 &&
        typeof options.fwdInput === 'number' &&
        options.fwdInput > 0.05
      ) {
        // Gentle chase alignment when turning forward-diagonally (W+A / W+D); pure A/D strafes cleanly
        this.yaw -= options.strafeInput * 0.85 * safeDt;
      }
    }

    // 1. Compute Focus Point (Kevin's chest/head)
    this.focusPoint.set(
      targetPosition.x,
      targetPosition.y + this.lookOffsetY,
      targetPosition.z
    );

    // 2. Compute Unobstructed Ideal Camera Position from Spherical Coordinates
    // Camera sits at focusPoint + (+sinYaw*cosPitch, +sinPitch, +cosYaw*cosPitch) * dist
    // Therefore camera looks along (-sinYaw, -sinPitch, -cosYaw)
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    const dirX = sinYaw * cosPitch;
    const dirY = sinPitch;
    const dirZ = cosYaw * cosPitch;

    const rayDir = new THREE.Vector3(dirX, dirY, dirZ).normalize();

    // 3. Obstacle Collision Raycast (Prevent clipping into cabin or bluffs)
    let effectiveDist = this.targetDistance;

    if (this.obstacles.length > 0) {
      this.raycaster.set(this.focusPoint, rayDir);
      this.raycaster.far = this.targetDistance;

      const intersects = this.raycaster.intersectObjects(this.obstacles, true);
      if (intersects.length > 0) {
        const hitDist = intersects[0].distance;
        const safeMin = Math.min(this.minCollisionDistance, Math.max(0.02, hitDist * 0.5));
        effectiveDist = Math.max(safeMin, hitDist - 0.35);
      }
    }

    // Smoothly damp current distance
    if (safeDt > 0) {
      this.currentDistance += (effectiveDist - this.currentDistance) * Math.min(1.0, safeDt * 14.0);
    }

    // 4. Calculate actual camera position
    this.idealPosition.copy(this.focusPoint).addScaledVector(rayDir, this.currentDistance);

    // 5. Terrain & Lake Surface Clearance Clamp (never dip underwater or underground)
    if (typeof options.getGroundY === 'function') {
      const groundBeneathCam = options.getGroundY(this.idealPosition.x, this.idealPosition.z);
      const minSurfaceY = Math.max(0.55, groundBeneathCam + 0.65);
      if (this.idealPosition.y < minSurfaceY) {
        this.idealPosition.y = minSurfaceY;
      }
    }

    // Apply position with smooth lerp
    if (safeDt > 0) {
      const lerpRate = 1.0 - Math.exp(-14.0 * safeDt);
      this.camera.position.lerp(this.idealPosition, lerpRate);
    } else if (this.camera.position.lengthSq() === 0) {
      this.camera.position.copy(this.idealPosition);
    }

    // Focus camera directly onto character
    this.camera.lookAt(this.focusPoint);
  }
}
