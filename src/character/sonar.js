/**
 * src/character/sonar.js
 * Kevin Tighe: 3D Lakeside Retreat - Signature "Hmm..." Ponder Sonar & Holographic Depth Tags
 *
 * Implements:
 * - Signature "Hmm..." ability ('H', 'E', Shift triggers)
 * - Cooldown throttle (1500ms) matching T2-BND-29
 * - Chin-stroke pose on avatar & vocal formant synthesis
 * - Expanding 3D spherical sonar wave ring expanding to 100 units
 * - Floating holographic 3D depth tags over nearby hole coordinates with color-coded beacons
 *   (shallow red 0xff4444, sweet spot orange 0xff8800, exact 50ft gold 0xffd700, deep hazard 0xef4444)
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { HmmSynthesizer } from '../core/audio.js';

export const HOLE_TIERS = {
  SHALLOW: 'shallow',      // < 10.0 ft
  SWEET_SPOT: 'sweet_spot',// 10.0 ft <= depth <= 50.0 ft
  DEEP: 'deep'             // > 50.0 ft
};

export { HmmSynthesizer };

/**
 * Authoritative mathematical evaluation of holes within sonar radius
 * (Directly adheres to test contract in fixtures.js)
 */
export function evaluateSonarScan(origin, holes, scanRadius = 100.0) {
  const detected = [];
  const holeList = holes || CONFIG.HOLES || [];

  for (const hole of holeList) {
    const pos = hole.position || { x: 0, y: 0, z: 0 };
    const dx = pos.x - origin.x;
    const dy = pos.y - origin.y;
    const dz = pos.z - origin.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Exact boundary inclusion dist <= scanRadius (T2-BND-26 and T2-BND-27)
    if (dist <= scanRadius) {
      let beaconColor = 0xff8800; // Sweet spot orange default
      if (Math.abs(hole.depthFt - 50.0) < 0.001) {
        beaconColor = 0xffd700; // 50ft Holy Grail radiant gold
      } else if (hole.tier === HOLE_TIERS.SHALLOW || hole.depthFt < 10.0) {
        beaconColor = 0xff4444; // Shallow red warning
      } else if (hole.tier === HOLE_TIERS.DEEP || hole.depthFt > 50.0) {
        beaconColor = 0xef4444; // Too deep hazard red
      }

      detected.push({
        ...hole,
        distance: dist,
        beaconColor
      });
    }
  }

  // Nearest-first ascending proximity sorting (T2-BND-28)
  return detected.sort((a, b) => a.distance - b.distance);
}

/**
 * SonarSystem: Manages cooldown, expanding 3D wave ring, and holographic 3D depth tags
 */
export class SonarSystem {
  constructor(options = {}) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.getOrigin = options.getOrigin || (() => ({ x: 0, y: 0, z: 0 }));
    this.isFlying = options.isFlying || (() => false);
    this.setCharacterState = options.setCharacterState || (() => {});
    this.triggerChinStroke = options.triggerChinStroke || (() => {});
    this.holes = options.holes || CONFIG.HOLES || [];
    this.onTrigger = options.onTrigger || null;

    // Cooldown throttle: 1500ms (T2-BND-29)
    this.lastTriggerTime = -99999;
    this.cooldownMs = 1500;

    // Synthesizer
    this.synth = options.synth || new HmmSynthesizer();

    // Active visual wave and tag instances
    this.activeWaves = [];
    this.activeBillboards = [];

    // Group for 3D sonar visuals
    this.group = new THREE.Group();
    this.group.name = 'sonarSystemGroup';
    if (this.scene) {
      this.scene.add(this.group);
    }
  }

  /**
   * Can sonar be triggered right now?
   */
  canTrigger(currentTime = Date.now()) {
    return currentTime - this.lastTriggerTime >= this.cooldownMs;
  }

  /**
   * Remaining cooldown in milliseconds
   */
  getCooldownRemaining(currentTime = Date.now()) {
    return Math.max(0, this.cooldownMs - (currentTime - this.lastTriggerTime));
  }

  /**
   * Main trigger action
   */
  trigger() {
    const now = Date.now();
    if (!this.canTrigger(now)) {
      return null;
    }
    this.lastTriggerTime = now;

    // 1. Shift character state to 'pondering' (unless actively flying, per T3-PAIR-02)
    if (!this.isFlying()) {
      this.setCharacterState('pondering');
      this.triggerChinStroke();
      // Revert after chin-stroke duration
      setTimeout(() => {
        if (!this.isFlying()) {
          this.setCharacterState('idle');
        }
      }, 1200);
    }

    // 2. Play Web Audio vocal "Hmm..." formant
    if (this.synth) {
      this.synth.playVocalHmm();
    }

    // 3. Obtain player origin position
    const origin = this.getOrigin();

    // 4. Create expanding 3D sonar pulse wave ring
    this.createSonarWaveRing(origin);

    // 5. Evaluate holes within 100-unit spherical radius
    const detected = evaluateSonarScan(origin, this.holes, 100.0);

    // 6. Spawn floating holographic 3D depth tags over detected holes
    this.spawnHolographicTags(detected);

    const result = {
      active: true,
      radius: 100,
      detectedHoles: detected,
      timestamp: now
    };

    if (this.onTrigger) {
      this.onTrigger(result);
    }

    return result;
  }

  /**
   * Creates expanding 3D spherical sonar wave ring expanding to 100 units
   */
  createSonarWaveRing(origin) {
    if (!this.scene) return;

    const waveGroup = new THREE.Group();
    waveGroup.position.set(origin.x, origin.y + 0.2, origin.z);

    // Primary Horizontal Torus Ring
    const torusGeo = new THREE.TorusGeometry(1, 0.08, 16, 64);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff8800,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.rotation.x = Math.PI / 2;
    waveGroup.add(torusMesh);

    // Expanding Hemispherical Sonar Dome
    const domeGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xffa500,
      emissiveIntensity: 0.5,
      roughness: 0.5,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
      side: THREE.DoubleSide
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    waveGroup.add(domeMesh);

    this.group.add(waveGroup);

    this.activeWaves.push({
      group: waveGroup,
      torusMat,
      domeMat,
      torusGeo,
      domeGeo,
      radius: 1.0,
      maxRadius: 100.0,
      expansionSpeed: 58.0 // units per second (~1.7s total duration)
    });
  }

  /**
   * Spawns floating 3D holographic depth tags with auto-billboarding
   */
  spawnHolographicTags(detectedHoles) {
    if (!this.scene) return;

    // Clear previous billboards
    this.clearBillboards();

    detectedHoles.forEach((hole) => {
      const pos = hole.position || { x: 0, y: 0, z: 0 };
      const tagGroup = new THREE.Group();
      tagGroup.position.set(pos.x, pos.y + 4.8, pos.z);

      // Vertical Glowing Light Beam
      const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.0, 8);
      const beamMat = new THREE.MeshStandardMaterial({
        color: hole.beaconColor,
        emissive: hole.beaconColor,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.5
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.y = -2.5;
      tagGroup.add(beamMesh);

      // Dynamic Canvas Texture for Holographic Text Readout
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const hexColor = '#' + hole.beaconColor.toString(16).padStart(6, '0');

      // Card Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = hexColor;
      ctx.lineWidth = 8;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(16, 16, 480, 224, 24);
      } else {
        ctx.rect(16, 16, 480, 224);
      }
      ctx.fill();
      ctx.stroke();

      // Top Header / Hole Name
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hole.name || 'Lakeside Hole', 256, 54);

      // Center Depth Readout (Large)
      ctx.fillStyle = hexColor;
      ctx.font = '900 64px monospace';
      const depthText = `${hole.depthFt.toFixed(1)} FT`;
      ctx.fillText(depthText, 256, 126);

      // Status Pill / Rule Tag
      ctx.font = 'bold 24px sans-serif';
      if (Math.abs(hole.depthFt - 50.0) < 0.001) {
        ctx.fillStyle = '#ffd700';
        ctx.fillText('⭐ 50ft HOLY GRAIL PINNACLE! ⭐', 256, 186);
      } else if (hole.depthFt < 10.0) {
        ctx.fillStyle = '#f87171';
        ctx.fillText('TOO SHALLOW! (<10ft REJECTED)', 256, 186);
      } else if (hole.depthFt <= 50.0) {
        ctx.fillStyle = '#34d399';
        ctx.fillText('SWEET SPOT (10-50ft LEGAL)', 256, 186);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('DANGER! (>50ft HAZARD)', 256, 186);
      }

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(7.5, 3.75, 1.0);
      tagGroup.add(sprite);

      this.group.add(tagGroup);

      this.activeBillboards.push({
        group: tagGroup,
        spriteMat,
        texture,
        beamGeo,
        beamMat,
        life: 4.8, // seconds visible
        initialLife: 4.8
      });
    });
  }

  /**
   * Update active wave rings and holographic billboards
   */
  update(dt) {
    // 1. Update expanding wave rings (T1-R2-06-E)
    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const wave = this.activeWaves[i];
      wave.radius += wave.expansionSpeed * dt;

      // Scale up ring & dome
      wave.group.scale.set(wave.radius, wave.radius * 0.45, wave.radius);

      // Fade out opacity smoothly as radius approaches maxRadius
      const progress = Math.min(1.0, wave.radius / wave.maxRadius);
      const opacity = Math.max(0, 1.0 - progress);
      wave.torusMat.opacity = opacity * 0.85;
      wave.domeMat.opacity = opacity * 0.35;

      // Clean disposal at termination to prevent memory leaks
      if (wave.radius >= wave.maxRadius) {
        this.group.remove(wave.group);
        wave.torusGeo.dispose();
        wave.torusMat.dispose();
        wave.domeGeo.dispose();
        wave.domeMat.dispose();
        this.activeWaves.splice(i, 1);
      }
    }

    // 2. Update holographic billboards
    for (let i = this.activeBillboards.length - 1; i >= 0; i--) {
      const b = this.activeBillboards[i];
      b.life -= dt;

      // Gentle floating bob
      b.group.position.y += Math.sin(Date.now() * 0.004) * 0.003;

      // Fade out in final second
      if (b.life < 1.0) {
        const op = Math.max(0, b.life);
        b.spriteMat.opacity = op;
        b.beamMat.opacity = op * 0.5;
      }

      if (b.life <= 0) {
        this.group.remove(b.group);
        b.spriteMat.dispose();
        b.texture.dispose();
        b.beamGeo.dispose();
        b.beamMat.dispose();
        this.activeBillboards.splice(i, 1);
      }
    }
  }

  clearBillboards() {
    this.activeBillboards.forEach((b) => {
      this.group.remove(b.group);
      b.spriteMat.dispose();
      b.texture.dispose();
      b.beamGeo.dispose();
      b.beamMat.dispose();
    });
    this.activeBillboards = [];
  }

  dispose() {
    this.clearBillboards();
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
