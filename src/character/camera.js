/**
 * src/character/camera.js
 * Kevin Tighe: 3D Lakeside Retreat - Third-Person Follow/Orbit Camera with Raycast Obstacle Collision
 *
 * Implements:
 * - Smooth chasing and orbital rotation around Kevin Tighe
 * - Clamped pitch angle between -85 deg and +85 deg (-1.4835 to +1.4835 rad) preventing pole gimbal flip
 * - Smooth damping interpolation (lerp factor ~0.08 - 0.14)
 * - Dynamic raycast obstacle collision detection preventing camera from clipping inside cabin or rocky bluffs
 * - Mouse drag orbiting, pointer lock compatibility, and wheel zoom
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class ThirdPersonCamera {
  constructor(camera, domElement, obstacleObjects = []) {
    this.camera = camera;
    this.domElement = domElement || document.body;
    this.obstacles = obstacleObjects;

    // Camera settings from CONFIG
    this.minDistance = (CONFIG.CAMERA && CONFIG.CAMERA.MIN_DISTANCE) || 3.5; // 3.5m unobstructed zoom limit
    this.minCollisionDistance = (CONFIG.CAMERA && CONFIG.CAMERA.MIN_COLLISION_DISTANCE) || 0.4; // 0.4m obstacle contraction limit
    this.maxDistance = (CONFIG.CAMERA && CONFIG.CAMERA.MAX_DISTANCE) || 22.0; // 22.0m
    this.targetDistance = (CONFIG.CAMERA && CONFIG.CAMERA.DEFAULT_DISTANCE) || 9.0; // 9.0m
    this.currentDistance = this.targetDistance;

    // Pitch clamped strictly between -85 deg and +85 deg (-1.4835 to +1.4835 rad)
    this.minPitch = (-85 * Math.PI) / 180;
    this.maxPitch = (85 * Math.PI) / 180;

    this.yaw = 0.0;
    this.pitch = 0.15; // slightly looking down at Kevin

    this.lookOffsetY = (CONFIG.CAMERA && CONFIG.CAMERA.LOOK_OFFSET_Y) || 1.6; // Head/chest focus
    this.smoothFactor = (CONFIG.CAMERA && CONFIG.CAMERA.SMOOTH_FACTOR) || 0.12;

    this.focusPoint = new THREE.Vector3();
    this.idealPosition = new THREE.Vector3();
    this.currentPosition = new THREE.Vector3();

    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.mouseSensitivity = 0.0035;

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
    this.yaw = yawRad;
  }

  initInputListeners() {
    this.domElement.addEventListener('mousedown', (e) => {
      // Right click or left click drag
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging || document.pointerLockElement === this.domElement) {
        const deltaX = e.movementX !== undefined ? e.movementX : (e.clientX - this.previousMousePosition.x);
        const deltaY = e.movementY !== undefined ? e.movementY : (e.clientY - this.previousMousePosition.y);

        this.previousMousePosition = { x: e.clientX, y: e.clientY };

        this.yaw -= deltaX * this.mouseSensitivity;
        this.pitch = THREE.MathUtils.clamp(
          this.pitch - deltaY * this.mouseSensitivity,
          this.minPitch,
          this.maxPitch
        );
      }
    });

    // Zoom via mouse wheel
    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomStep = e.deltaY * 0.015;
      this.targetDistance = THREE.MathUtils.clamp(
        this.targetDistance + zoomStep,
        this.minDistance,
        this.maxDistance
      );
    }, { passive: false });
  }

  update(dt, targetPosition, targetVelocity = null) {
    // Enforce pitch bounds strictly [-85 deg, +85 deg] (-1.4835 to +1.4835 rad)
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);

    if (!targetPosition) return;

    // Subterranean Interior Shaft Framing
    if (this.isSubterranean && this.subHole) {
      const h = this.subHole;
      const isAscending = targetVelocity ? (targetVelocity.y > 0) : (targetPosition.y > this.focusPoint.y);

      // Clamped interior radial offset inside cylinder
      const camR = Math.min(0.65, h.radius * 0.35);
      const idealX = h.position.x + Math.sin(this.yaw) * camR;
      const idealZ = h.position.z + Math.cos(this.yaw) * camR;

      let idealY, targetY;
      if (!isAscending) {
        // Descent Framing: Camera above Kevin, looking downward along descent
        idealY = targetPosition.y + 3.2;
        targetY = targetPosition.y - 1.5;
        this.pitch = -0.45;
      } else {
        // Ascent Framing: Camera below Kevin, looking upward toward sky opening
        idealY = targetPosition.y - 2.6;
        targetY = targetPosition.y + 2.5;
        this.pitch = 0.55;
      }

      this.idealPosition.set(idealX, idealY, idealZ);
      this.subLookTarget.set(h.position.x, targetY, h.position.z);

      const lerpPos = 1.0 - Math.exp(-10.0 * dt);
      const lerpTarget = 1.0 - Math.exp(-12.0 * dt);

      this.camera.position.lerp(this.idealPosition, lerpPos);
      this.focusPoint.lerp(this.subLookTarget, lerpTarget);
      this.camera.lookAt(this.focusPoint);
      return;
    }

    // 1. Compute Focus Point (Kevin's chest/head)
    this.focusPoint.set(
      targetPosition.x,
      targetPosition.y + this.lookOffsetY,
      targetPosition.z
    );

    // 2. Compute Unobstructed Ideal Camera Position from Spherical Coordinates
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
        // Nearest solid hit with a 0.35m safety margin, contracting down to safe collision minimum
        const hitDist = intersects[0].distance;
        const safeMin = Math.min(this.minCollisionDistance, Math.max(0.02, hitDist * 0.5));
        effectiveDist = Math.max(safeMin, hitDist - 0.35);
      }
    }

    // Smoothly damp current distance
    this.currentDistance += (effectiveDist - this.currentDistance) * Math.min(1.0, dt * 14.0);

    // 4. Calculate actual camera position
    this.idealPosition.copy(this.focusPoint).addScaledVector(rayDir, this.currentDistance);

    // Apply position with smooth lerp
    const lerpRate = 1.0 - Math.exp(-12.0 * dt);
    this.camera.position.lerp(this.idealPosition, lerpRate);

    // Focus camera directly onto character
    this.camera.lookAt(this.focusPoint);
  }
}
