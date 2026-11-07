/**
 * src/character/shadow.js
 * Peter Pan Runaway Loose Shadow
 * 
 * Features:
 * - Decoupled dark circular shadow projected onto terrain/surfaces (detached: true)
 * - Ground-clamped elevation (groundY = 0.02)
 * - Playful horizontal trailing lag (lagFactor = 0.2)
 * - Smooth vertical elevation transitions between terrain, dock (Y=0.85), and porch (Y=2.35)
 * - Height-based expansion and opacity fade when Kevin flies high into the air
 */

import * as THREE from 'three';

/**
 * Creates soft procedural circular shadow texture with radial alpha falloff.
 */
function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0.0, 'rgba(8, 14, 24, 0.82)');
  gradient.addColorStop(0.55, 'rgba(10, 16, 28, 0.55)');
  gradient.addColorStop(0.85, 'rgba(12, 18, 30, 0.18)');
  gradient.addColorStop(1.0, 'rgba(12, 18, 30, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export class RunawayShadow {
  /**
   * @param {THREE.Scene} scene
   * @param {Object} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;

    // Test contract requirements (T1-R2-05-C, T1-R2-05-D)
    this.detached = true;
    this.groundY = 0.02; // Offset above ground to prevent z-fighting
    this.lagFactor = 0.2; // Independent movement lag

    this.baseRadius = 0.55;
    this.currentElevation = 0.0;
    this.time = 0;

    this.texture = createShadowTexture();

    // Horizontal ground plane circle
    const geom = new THREE.PlaneGeometry(1.1, 1.1);
    geom.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 1.0,
      metalness: 0.0
    });

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.name = 'RunawayLooseShadow';
    this.mesh.renderOrder = 2; // Renders over ground surfaces cleanly

    // Add directly to scene (detached from Kevin's hierarchy)
    if (this.scene) {
      this.scene.add(this.mesh);
    }
  }

  /**
   * Determine ground surface elevation at (x, z) taking dock and cabin into account.
   */
  sampleSurfaceHeight(x, z, terrainElevationFn) {
    // 1. Check wooden dock bounds (deck at Y=0.85)
    if (x >= -2.1 && x <= 2.1 && z >= 5.8 && z <= 30.2) {
      return 0.85;
    }

    // 2. Check cabin porch bounds (deck at Y=2.35)
    if (x >= 20.0 && x <= 30.0 && z >= -11.0 && z <= -7.8) {
      return 2.35;
    }

    // 3. Fallback to analytical terrain height
    if (typeof terrainElevationFn === 'function') {
      return terrainElevationFn(x, z);
    }

    return 0.0;
  }

  /**
   * Frame tick updating trailing horizontal position and vertical surface projection.
   * 
   * @param {number} dt - Delta time in seconds
   * @param {THREE.Vector3|Object} kevinPos - Kevin's world coordinates
   * @param {Function} [terrainElevationFn] - Function(x, z) => height
   */
  update(dt, kevinPos, terrainElevationFn) {
    if (!kevinPos || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;

    this.time += dt;

    // 1. Playful horizontal position lag (T1-R2-05-D: shadowPos += (charPos - shadowPos) * lag)
    const lagStep = Math.min(1.0, this.lagFactor * dt * 30.0);
    this.mesh.position.x += (kevinPos.x - this.mesh.position.x) * lagStep;
    this.mesh.position.z += (kevinPos.z - this.mesh.position.z) * lagStep;

    // 2. Raycast surface projection & smooth elevation transition (T3-PAIR-07)
    const targetSurfaceY = this.sampleSurfaceHeight(
      this.mesh.position.x,
      this.mesh.position.z,
      terrainElevationFn
    );

    const targetY = targetSurfaceY + this.groundY;

    // Smooth elevation interpolation across dock planks and beach
    const elevationStep = Math.min(1.0, 0.5 * dt * 30.0);
    this.mesh.position.y += (targetY - this.mesh.position.y) * elevationStep;

    // 3. Altitude-dependent scale & opacity scaling
    const altitude = Math.max(0, kevinPos.y - this.mesh.position.y);

    // As Kevin flies high, shadow expands and diffuses
    const scaleFactor = 1.0 + Math.min(2.5, altitude * 0.09);
    this.mesh.scale.set(scaleFactor, 1.0, scaleFactor);

    // Fade opacity with altitude
    const opacity = Math.max(0.12, 0.72 - altitude * 0.04);
    this.material.opacity = opacity;

    // Subtle playful shadow sway when nearly stopped
    const sway = Math.sin(this.time * 2.5) * 0.015;
    this.mesh.position.x += sway * dt;
  }

  /**
   * Instant snap on Kevin teleport.
   */
  teleportTo(x, y, z, terrainElevationFn) {
    const groundY = this.sampleSurfaceHeight(x, z, terrainElevationFn);
    this.mesh.position.set(x, groundY + this.groundY, z);
  }

  dispose() {
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.material) this.material.dispose();
    if (this.texture) this.texture.dispose();
  }
}
