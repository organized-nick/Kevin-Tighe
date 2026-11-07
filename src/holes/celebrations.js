/**
 * src/holes/celebrations.js
 * 50.0ft Holy Grail Victory Celebration:
 * - 600-particle Confetti Fireworks Cannon
 * - 15-second Golden Fever Mode (Aura, 2x Speed, 2x Score)
 */

import * as THREE from 'three';

function createConfettiTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Rectangular confetti ribbon with crisp edges and inner starlight sheen
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 16, 48, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(18, 22, 28, 20);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export class ConfettiFireworksEmitter {
  constructor(scene, capacity = 600) {
    this.scene = scene;
    this.capacity = capacity;
    this.texture = createConfettiTexture();

    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.velocities = new Float32Array(capacity * 3);
    this.lifetimes = new Float32Array(capacity);
    this.maxLifetimes = new Float32Array(capacity);
    this.wobbles = new Float32Array(capacity);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.material = new THREE.PointsMaterial({
      size: 0.55,
      map: this.texture,
      transparent: true,
      vertexColors: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      opacity: 1.0
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'HolyGrailConfettiEmitter';
    this.points.frustumCulled = false;

    if (this.scene) {
      this.scene.add(this.points);
    }

    // 7 Festive Celebration Palette Colors
    this.colorPalette = [
      new THREE.Color(0xffd700), // Radiant Gold
      new THREE.Color(0xff6b1a), // Kevin Signature Orange
      new THREE.Color(0x10b981), // Peter Pan Emerald Green
      new THREE.Color(0xef4444), // Crimson Red
      new THREE.Color(0x0284c7), // Sky Blue
      new THREE.Color(0xec4899), // Neon Pink/Magenta
      new THREE.Color(0xffffff)  // Starlight White
    ];

    this.active = false;
  }

  get isActive() {
    return this.active;
  }

  /**
   * Explodes celebratory confetti fireworks from origin
   * @param {THREE.Vector3|{x,y,z}} origin Burst center
   */
  explode(origin = { x: 48.0, y: 3.5, z: -45.0 }) {
    this.active = true;

    for (let i = 0; i < this.capacity; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.PI * 0.12 + Math.random() * (Math.PI * 0.45); // upward conical spread
      const speed = 12.0 + Math.random() * 20.0;

      this.positions[i * 3 + 0] = origin.x + (Math.random() - 0.5) * 2.0;
      this.positions[i * 3 + 1] = origin.y + 0.8 + Math.random() * 1.2;
      this.positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 2.0;

      this.velocities[i * 3 + 0] = Math.cos(theta) * Math.sin(phi) * speed;
      this.velocities[i * 3 + 1] = Math.cos(phi) * speed + 6.0; // strong upward pop
      this.velocities[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * speed;

      const col = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
      this.colors[i * 3 + 0] = col.r;
      this.colors[i * 3 + 1] = col.g;
      this.colors[i * 3 + 2] = col.b;

      const life = 2.5 + Math.random() * 1.8;
      this.lifetimes[i] = life;
      this.maxLifetimes[i] = life;
      this.sizes[i] = 0.5 + Math.random() * 0.45;
      this.wobbles[i] = Math.random() * Math.PI * 2;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  update(dt) {
    if (!this.active) return;

    let hasActive = false;
    const gravity = -9.8;
    const drag = Math.pow(0.88, dt * 60);

    for (let i = 0; i < this.capacity; i++) {
      if (this.lifetimes[i] <= 0) continue;

      this.lifetimes[i] -= dt;
      hasActive = true;

      // Air resistance and gravity
      this.velocities[i * 3 + 0] *= drag;
      this.velocities[i * 3 + 2] *= drag;
      this.velocities[i * 3 + 1] += gravity * dt;

      // Fluttering wobble
      this.wobbles[i] += dt * 6.0;
      const wobbleOffsetX = Math.sin(this.wobbles[i]) * 0.8 * dt;

      this.positions[i * 3 + 0] += this.velocities[i * 3 + 0] * dt + wobbleOffsetX;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;

      // Tumbling paper slip animation
      this.sizes[i] = 0.45 + 0.25 * Math.sin(this.wobbles[i] * 1.5);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    if (!hasActive) {
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
 * 15s Golden Fever Mode:
 * - Golden glowing translucent energy aura around Kevin Tighe
 * - Point light casting radiant 0xffd700 gold illumination
 * - 2x Walking & Running speed kinetics (17.0 m/s / 28.0 m/s)
 * - 2x Score multiplier for all pickups & hole rewards
 * - Dynamic HUD countdown timer & progress bar
 */
export class GoldenFeverManager {
  constructor(scene, characterController, hudManager) {
    this.scene = scene;
    this.character = characterController;
    this.hud = hudManager;

    this.active = false;
    this.duration = 15.0;
    this.timeRemaining = 0.0;
    this.speedMultiplier = 2.0;
    this.scoreMultiplier = 2.0;

    // 3D Golden Glow Aura Rig
    this.auraGroup = new THREE.Group();
    this.auraGroup.name = 'GoldenFeverAura';

    // 1. Translucent Pulsing Sphere Mesh
    const sphereGeo = new THREE.SphereGeometry(1.35, 24, 24);
    this.sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.38,
      wireframe: true,
      blending: THREE.AdditiveBlending
    });
    this.sphereMesh = new THREE.Mesh(sphereGeo, this.sphereMat);
    this.auraGroup.add(this.sphereMesh);

    // 2. Radiant Golden Point Light
    this.auraLight = new THREE.PointLight(0xffd700, 3.5, 8.0);
    this.auraLight.position.set(0, 1.0, 0);
    this.auraGroup.add(this.auraLight);

    this.auraGroup.visible = false;

    if (this.character && this.character.avatar && this.character.avatar.group) {
      this.character.avatar.group.add(this.auraGroup);
    } else if (this.scene) {
      this.scene.add(this.auraGroup);
    }
  }

  attachToCharacter(character) {
    this.character = character;
    if (this.character && this.character.avatar && this.character.avatar.group) {
      if (this.auraGroup.parent) {
        this.auraGroup.parent.remove(this.auraGroup);
      }
      this.character.avatar.group.add(this.auraGroup);
    }
  }

  activate() {
    this.active = true;
    this.timeRemaining = this.duration;
    this.auraGroup.visible = true;

    // Set speed multiplier in character controller
    if (this.character) {
      this.character.speedMultiplier = this.speedMultiplier;
      this.character.scoreMultiplier = this.scoreMultiplier;
    }

    if (this.hud && typeof this.hud.showGoldenFeverBanner === 'function') {
      this.hud.showGoldenFeverBanner(this.duration);
    }
  }

  get isActive() {
    return this.active;
  }

  get timer() {
    return this.timeRemaining;
  }

  getSpeedMultiplier() {
    return this.active ? this.speedMultiplier : 1.0;
  }

  getScoreMultiplier() {
    return this.active ? this.scoreMultiplier : 1.0;
  }

  update(dt) {
    if (!this.active) return;

    this.timeRemaining -= dt;

    // Breathing pulse animation for aura
    const pulse = 1.0 + 0.15 * Math.sin(Date.now() * 0.009);
    this.sphereMesh.scale.set(pulse, pulse, pulse);
    this.sphereMat.opacity = 0.3 + 0.15 * Math.sin(Date.now() * 0.006);

    if (this.hud && typeof this.hud.updateGoldenFeverProgress === 'function') {
      this.hud.updateGoldenFeverProgress(this.timeRemaining, this.duration);
    }

    if (this.timeRemaining <= 0) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.timeRemaining = 0.0;
    this.auraGroup.visible = false;

    if (this.character) {
      this.character.speedMultiplier = 1.0;
      this.character.scoreMultiplier = 1.0;
    }

    if (this.hud && typeof this.hud.hideGoldenFeverBanner === 'function') {
      this.hud.hideGoldenFeverBanner();
    }
  }

  dispose() {
    if (this.auraGroup && this.auraGroup.parent) {
      this.auraGroup.parent.remove(this.auraGroup);
    }
    this.sphereMesh.geometry.dispose();
    this.sphereMat.dispose();
  }
}
