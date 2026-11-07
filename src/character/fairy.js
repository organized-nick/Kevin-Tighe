/**
 * src/character/fairy.js
 * Tinker-Tang: Neverland Fairy Companion in 3D Lissajous Orbit
 * 
 * Features:
 * - Golden glowing orb (0xfbbf24) with warm starlight aura
 * - 3D Lissajous flight path around Kevin with high-frequency wing fluttering
 * - Warm PointLight illuminating Kevin and ground (intensity > 0, distance > 2m)
 * - Trailing slipstream elongation during flight sprint
 * - Instant tethering clamp upon teleportation (<5.0m)
 */

import * as THREE from 'three';

export class FairyCompanion {
  /**
   * @param {THREE.Scene} scene
   * @param {Object} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.time = 0;
    this.baseLag = 0.5;
    this.dynamicLag = 0.5;

    // Contract test properties
    this.glow = {
      intensity: 1.2,
      distance: 6.0,
      color: 0xfbbf24
    };

    this.group = new THREE.Group();
    this.group.name = 'TinkerTangFairy';

    this.initVisuals();

    if (this.scene) {
      this.scene.add(this.group);
    }
  }

  initVisuals() {
    // 1. Glowing Golden Fairy Core Orb (0xfbbf24)
    const coreGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.1
    });
    this.coreMesh = new THREE.Mesh(coreGeom, coreMat);
    this.group.add(this.coreMesh);

    // 2. Translucent Golden Aura Halo
    const auraGeom = new THREE.SphereGeometry(0.24, 14, 14);
    const auraMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xfde047,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.0,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    this.auraMesh = new THREE.Mesh(auraGeom, auraMat);
    this.group.add(this.auraMesh);

    // 3. Delicate Fluttering Fairy Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.18, 0.28);
    wingShape.lineTo(0.04, 0.42);
    wingShape.lineTo(0, 0.22);
    wingShape.closePath();

    const wingGeom = new THREE.ShapeGeometry(wingShape);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.0,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.wingLeft = new THREE.Mesh(wingGeom, wingMat);
    this.wingLeft.position.set(-0.04, 0.02, -0.02);
    this.wingLeft.rotation.y = -Math.PI * 0.2;
    this.group.add(this.wingLeft);

    this.wingRight = new THREE.Mesh(wingGeom, wingMat);
    this.wingRight.position.set(0.04, 0.02, -0.02);
    this.wingRight.rotation.y = Math.PI * 0.2;
    this.wingRight.scale.x = -1; // Mirror horizontally
    this.group.add(this.wingRight);

    // 4. Warm Amber Point Light (T1-R2-05-B: intensity > 0, distance > 2.0)
    this.pointLight = new THREE.PointLight(
      this.glow.color,
      this.glow.intensity,
      this.glow.distance,
      1.8
    );
    this.pointLight.name = 'FairyWarmLight';
    this.pointLight.castShadow = false; // Optimal framerate
    this.group.add(this.pointLight);
  }

  /**
   * Evaluates the canonical 3D Lissajous trajectory offset.
   * Matches test T1-R2-05-A formula.
   */
  getLissajousOffset(t) {
    return {
      x: Math.sin(t * 2.0) * 1.5,
      y: 2.2 + Math.cos(t * 3.0) * 0.4,
      z: Math.cos(t * 2.0) * 1.5
    };
  }

  /**
   * Update fairy position, wing flutter, and slipstream lag.
   * 
   * @param {number} dt - Frame delta time
   * @param {THREE.Vector3|Object} kevinPos - Kevin's world coordinates
   * @param {THREE.Vector3|Object} [kevinVel] - Kevin's current velocity
   */
  update(dt, kevinPos, kevinVel = { x: 0, y: 0, z: 0 }) {
    if (!kevinPos) return;

    this.time += dt * 1.8;

    // 1. High-frequency wing fluttering
    const flutter = Math.sin(this.time * 38.0) * 0.65;
    this.wingLeft.rotation.z = flutter;
    this.wingRight.rotation.z = -flutter;

    // Subtle breathing pulse for core halo
    const pulse = 1.0 + Math.sin(this.time * 5.0) * 0.12;
    this.auraMesh.scale.setScalar(pulse);

    // 2. Base 3D Lissajous curve around Kevin
    const liss = this.getLissajousOffset(this.time);

    // 3. Slipstream dynamic lag during sprint/flight (T3-PAIR-06)
    const horizontalSpeed = Math.sqrt((kevinVel.x || 0) * (kevinVel.x || 0) + (kevinVel.z || 0) * (kevinVel.z || 0));
    this.dynamicLag = this.baseLag + horizontalSpeed * 0.08;

    // Elongate target position behind movement direction
    let lagOffsetX = 0;
    let lagOffsetZ = 0;
    if (horizontalSpeed > 0.5) {
      lagOffsetX = -((kevinVel.x || 0) / horizontalSpeed) * Math.min(2.5, horizontalSpeed * 0.12);
      lagOffsetZ = -((kevinVel.z || 0) / horizontalSpeed) * Math.min(2.5, horizontalSpeed * 0.12);
    }

    const targetX = kevinPos.x + liss.x + lagOffsetX;
    const targetY = kevinPos.y + liss.y;
    const targetZ = kevinPos.z + liss.z + lagOffsetZ;

    // 4. Teleport tether clamp (T1-R2-05-E: distance < 5.0m)
    const currentDist = Math.hypot(
      this.group.position.x - kevinPos.x,
      this.group.position.y - kevinPos.y,
      this.group.position.z - kevinPos.z
    );

    if (currentDist >= 4.8) {
      // Teleport snap: stay tethered immediately
      this.group.position.set(targetX, targetY, targetZ);
    } else {
      // Smooth organic tracking
      const smoothFactor = Math.min(1.0, dt * 8.0);
      this.group.position.x += (targetX - this.group.position.x) * smoothFactor;
      this.group.position.y += (targetY - this.group.position.y) * smoothFactor;
      this.group.position.z += (targetZ - this.group.position.z) * smoothFactor;
    }
  }

  /**
   * Instant snap on Kevin teleport.
   */
  teleportTo(x, y, z) {
    const liss = this.getLissajousOffset(this.time);
    this.group.position.set(x + liss.x, y + liss.y, z + liss.z);
  }

  dispose() {
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
