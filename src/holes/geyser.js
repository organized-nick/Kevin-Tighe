/**
 * src/holes/geyser.js
 * Geothermal Geyser Particle Emitter & Surface Launch Propulsion
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

function createBubbleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Radial soft bubble/steam droplet
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.35, 'rgba(125, 211, 252, 0.85)');
  gradient.addColorStop(0.7, 'rgba(56, 189, 248, 0.4)');
  gradient.addColorStop(1, 'rgba(2, 132, 199, 0.0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export class GeyserEmitter {
  constructor(scene, capacity = 250) {
    this.scene = scene;
    this.capacity = capacity;
    this.texture = createBubbleTexture();

    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.velocities = new Float32Array(capacity * 3);
    this.lifetimes = new Float32Array(capacity);
    this.maxLifetimes = new Float32Array(capacity);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.material = new THREE.PointsMaterial({
      size: 0.85,
      map: this.texture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'GeyserParticleEmitter';
    this.points.frustumCulled = false;

    if (this.scene) {
      this.scene.add(this.points);
    }

    this.active = false;
    this.burstTimer = 0.0;
    this.burstOrigin = new THREE.Vector3();
    this.isHolyGrail = false;
  }

  /**
   * Triggers an eruptive geyser plume
   * @param {THREE.Vector3|{x,y,z}} origin Base of the shaft
   * @param {number} launchVelocity Speed of the column
   * @param {boolean} isHolyGrail Whether this is the sacred 50ft golden geyser
   */
  trigger(origin, launchVelocity = 26.0, isHolyGrail = false) {
    this.active = true;
    this.burstTimer = 1.8;
    this.burstOrigin.set(origin.x, origin.y, origin.z);
    this.isHolyGrail = isHolyGrail;

    const baseColor = isHolyGrail ? new THREE.Color(0xffd700) : new THREE.Color(0x38bdf8);
    const highlightColor = isHolyGrail ? new THREE.Color(0xffedd5) : new THREE.Color(0xe0f2fe);

    for (let i = 0; i < this.capacity; i++) {
      const spreadR = 0.2 + Math.random() * 0.9;
      const angle = Math.random() * Math.PI * 2;

      this.positions[i * 3 + 0] = origin.x + Math.cos(angle) * spreadR;
      this.positions[i * 3 + 1] = origin.y + Math.random() * 1.5;
      this.positions[i * 3 + 2] = origin.z + Math.sin(angle) * spreadR;

      this.velocities[i * 3 + 0] = (Math.random() - 0.5) * 2.2;
      this.velocities[i * 3 + 1] = launchVelocity * (0.75 + Math.random() * 0.5);
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 2.2;

      const col = Math.random() > 0.4 ? baseColor : highlightColor;
      this.colors[i * 3 + 0] = col.r;
      this.colors[i * 3 + 1] = col.g;
      this.colors[i * 3 + 2] = col.b;

      const life = 1.0 + Math.random() * 1.2;
      this.lifetimes[i] = life;
      this.maxLifetimes[i] = life;
      this.sizes[i] = 0.6 + Math.random() * 0.6;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  update(dt) {
    if (!this.active) return;

    if (this.burstTimer > 0) {
      this.burstTimer -= dt;
    }

    let aliveCount = 0;
    const gravity = -9.8;

    for (let i = 0; i < this.capacity; i++) {
      if (this.lifetimes[i] <= 0) continue;

      this.lifetimes[i] -= dt;
      aliveCount++;

      // Physics update
      this.velocities[i * 3 + 1] += gravity * dt;

      this.positions[i * 3 + 0] += this.velocities[i * 3 + 0] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;

      // Expand bubble as it ascends
      const progress = 1.0 - (this.lifetimes[i] / this.maxLifetimes[i]);
      this.sizes[i] = 0.6 + progress * 0.8;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    if (aliveCount === 0 && this.burstTimer <= 0) {
      this.active = false;
    }
  }

  dispose() {
    if (this.points && this.points.parent) {
      this.points.parent.remove(this.points);
    }
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}

/**
 * Calculates physics-conserved geyser launch impulse
 * V = sqrt(2 * |g| * (depthMeters + apexBuffer))
 */
export function calculateGeyserImpulse(depthFt, apexBufferMeters = 2.5) {
  const depthMeters = depthFt * CONFIG.M_PER_FT;
  const g = Math.abs(CONFIG.PHYSICS.GRAVITY || 19.6);
  return Math.sqrt(2 * g * (depthMeters + apexBufferMeters));
}
