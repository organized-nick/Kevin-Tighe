/**
 * src/items/pickups.js
 * Kevin Tighe: 3D Lakeside Retreat - Collectibles & "and hmm..." Bonus Pickups
 *
 * Implements:
 * - 22 scattered orange citrus orbs (+1 orange, +50 score, bobbing & spinning animation)
 * - 4 distinct landmark bonus items based on Kevin's 4th obsession (+250 score & quip notification)
 * - Procedural geometries for Cheddar Cheese, Vintage Orange Soda, Traffic Cones, and Peter Pan Caps
 * - Proximity collection check without interrupting airborne flight (T3-PAIR-04)
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export const PICKUP_TYPES = {
  ORANGE: 'orange',
  BONUS: 'bonus'
};

export const BONUS_PRESETS = [
  'Cheddar Cheese Wedges',
  'Orange Cream Soda',
  'Traffic Cones',
  'Peter Pan Feather Caps',
  'High-Top Orange Sneakers'
];

export class PickupManager {
  /**
   * @param {THREE.Scene} scene
   * @param {object} textureManager
   * @param {string} fourthObsession
   */
  constructor(scene, textureManager = null, fourthObsession = 'Cheddar Cheese Wedges') {
    this.scene = scene;
    this.textureManager = textureManager;
    this.fourthObsession = fourthObsession || 'Cheddar Cheese Wedges';

    this.group = new THREE.Group();
    this.group.name = 'pickupsGroup';
    if (this.scene) {
      this.scene.add(this.group);
    }

    this.pickups = [];
    this.time = 0;

    // Common shared materials
    this.initMaterials();

    // Spawn pickups across the 4 Lakeside Retreat landmarks
    this.spawnPickups();
  }

  initMaterials() {
    // Standard Orange Citrus Orb Material (PBR with clearcoat)
    this.matOrange = new THREE.MeshPhysicalMaterial({
      color: CONFIG.COLORS.ORANGE_PRIMARY || 0xff6b1a,
      roughness: 0.35,
      metalness: 0.05,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15
    });

    // Citrus Stem Material
    this.matStem = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.8
    });

    // Citrus Leaf Material
    this.matLeaf = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.4,
      side: THREE.DoubleSide
    });

    // Bonus Halo Ring Material
    this.matHalo = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.2,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
  }

  /**
   * Builds an articulated 3D Orange Citrus Orb mesh
   */
  createOrangeMesh() {
    const orbGroup = new THREE.Group();

    // Main spherical fruit
    const fruitGeo = new THREE.SphereGeometry(0.5, 20, 20);
    const fruitMesh = new THREE.Mesh(fruitGeo, this.matOrange);
    fruitMesh.castShadow = true;
    fruitMesh.receiveShadow = true;
    orbGroup.add(fruitMesh);

    // Woody Stem
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.18, 8);
    const stemMesh = new THREE.Mesh(stemGeo, this.matStem);
    stemMesh.position.set(0, 0.55, 0);
    stemMesh.rotation.z = 0.15;
    stemMesh.castShadow = true;
    orbGroup.add(stemMesh);

    // Green Leaf
    const leafGeo = new THREE.ConeGeometry(0.14, 0.38, 5);
    const leafMesh = new THREE.Mesh(leafGeo, this.matLeaf);
    leafMesh.position.set(0.12, 0.58, 0);
    leafMesh.rotation.z = -Math.PI * 0.35;
    leafMesh.scale.set(1.0, 1.0, 0.25);
    leafMesh.castShadow = true;
    orbGroup.add(leafMesh);

    return orbGroup;
  }

  /**
   * Builds distinct procedural 3D geometries for the "and hmm..." 4th obsession
   */
  createBonusMesh(label) {
    const bonusGroup = new THREE.Group();
    const l = (label || '').toLowerCase();

    if (l.includes('soda') || l.includes('can')) {
      // 1. Vintage Orange Soda Can
      const canGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.95, 24);
      const canMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        metalness: 0.8,
        roughness: 0.2
      });
      const canMesh = new THREE.Mesh(canGeo, canMat);
      canMesh.castShadow = true;
      bonusGroup.add(canMesh);

      const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.1 });
      const topRim = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.08, 24), rimMat);
      topRim.position.y = 0.48;
      bonusGroup.add(topRim);
    } else if (l.includes('cone')) {
      // 2. Reflective Traffic Cone
      const baseMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.08, 0.85),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 })
      );
      baseMesh.position.y = -0.4;
      baseMesh.castShadow = true;
      bonusGroup.add(baseMesh);

      const coneMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 1.1, 16),
        new THREE.MeshStandardMaterial({ color: 0xff4f00, roughness: 0.35 })
      );
      coneMesh.position.y = 0.15;
      coneMesh.castShadow = true;
      bonusGroup.add(coneMesh);

      const bandMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.30, 0.32, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.4 })
      );
      bandMesh.position.y = 0.08;
      bonusGroup.add(bandMesh);
    } else if (l.includes('feather') || l.includes('cap')) {
      // 3. Peter Pan Feather Cap
      const capMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 0.75, 12),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 })
      );
      capMesh.rotation.z = Math.PI * 0.2;
      bonusGroup.add(capMesh);

      const featherMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.5 })
      );
      featherMesh.position.set(-0.35, 0.35, 0);
      featherMesh.rotation.z = Math.PI * 0.45;
      bonusGroup.add(featherMesh);
    } else if (l.includes('sneaker') || l.includes('kick')) {
      // 4. High-Top Orange Sneaker
      const soleMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.14, 0.85),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      soleMesh.position.y = -0.3;
      bonusGroup.add(soleMesh);

      const upperMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.48, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.5 })
      );
      upperMesh.position.y = -0.05;
      bonusGroup.add(upperMesh);
    } else {
      // 5. Default: Sharp Cheddar Cheese Wedge
      const cheeseShape = new THREE.Shape();
      cheeseShape.moveTo(0, 0);
      cheeseShape.lineTo(0.9, 0);
      cheeseShape.lineTo(0.45, 0.9);
      cheeseShape.closePath();

      const extrudeSettings = { depth: 0.45, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
      const cheeseGeo = new THREE.ExtrudeGeometry(cheeseShape, extrudeSettings);
      cheeseGeo.center();

      const cheeseMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.4,
        metalness: 0.1
      });
      const cheeseMesh = new THREE.Mesh(cheeseGeo, cheeseMat);
      cheeseMesh.castShadow = true;
      bonusGroup.add(cheeseMesh);
    }

    // Glowing Golden Halo Thought-Ring
    const haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 12, 32), this.matHalo);
    haloMesh.rotation.x = Math.PI / 2;
    bonusGroup.add(haloMesh);

    return bonusGroup;
  }

  /**
   * Spawns standard oranges and bonus pickups across the 4 landmark regions
   */
  spawnPickups() {
    // 22 Orange Citrus Orb Coordinates (x, y, z)
    const orangeCoords = [
      // 1. Shoreline & Lake Beach (5 orbs)
      { x: 8.0, y: 0.35, z: 12.0 },
      { x: 14.5, y: 0.35, z: 16.0 },
      { x: -12.0, y: 0.35, z: 18.0 },
      { x: 4.0, y: 0.4, z: 8.0 },
      { x: 18.0, y: 0.3, z: 22.0 },

      // 2. Wooden Pier / Dock (4 orbs)
      { x: 0.0, y: 1.45, z: 10.0 },
      { x: -1.2, y: 1.45, z: 16.0 },
      { x: 1.2, y: 1.45, z: 21.0 },
      { x: 0.0, y: 1.45, z: 26.5 },

      // 3. Timber Retreat Cabin & Lawn (4 orbs)
      { x: 22.0, y: 2.3, z: -10.0 },
      { x: 28.0, y: 2.3, z: -12.0 },
      { x: 18.5, y: 2.2, z: -16.0 },
      { x: 31.0, y: 2.3, z: -18.0 },

      // 4. Pine Forest Trails (5 orbs)
      { x: 32.0, y: 3.8, z: -35.0 },
      { x: 42.0, y: 4.2, z: -42.0 },
      { x: 52.0, y: 4.5, z: -55.0 },
      { x: 38.0, y: 3.9, z: -62.0 },
      { x: 62.0, y: 5.0, z: -38.0 },

      // 5. Rocky Bluffs (+22m elevation) (4 orbs)
      { x: -32.0, y: 12.0, z: -8.0 },
      { x: -42.0, y: 18.5, z: 4.0 },
      { x: -46.0, y: 22.4, z: -6.0 },
      { x: -38.0, y: 16.0, z: 15.0 }
    ];

    orangeCoords.forEach((pt, idx) => {
      const mesh = this.createOrangeMesh();
      mesh.position.set(pt.x, pt.y, pt.z);
      this.group.add(mesh);

      this.pickups.push({
        id: `orange_${idx}`,
        type: PICKUP_TYPES.ORANGE,
        mesh: mesh,
        position: pt,
        initialY: pt.y,
        timeOffset: idx * 0.45,
        radius: 1.5,
        orangesValue: 1,
        scoreValue: 50,
        collected: false
      });
    });

    // 4 Distinct "and hmm..." Bonus Pickups (One per landmark)
    const bonusSpots = [
      {
        id: 'bonus_pier_end',
        landmark: 'dock',
        x: 0.0, y: 1.85, z: 29.5,
        quip: `...and hmm, a pristine ${this.fourthObsession} at the edge of the pier! (+250)`
      },
      {
        id: 'bonus_cabin_chimney',
        landmark: 'cabin',
        x: 23.5, y: 6.2, z: -17.5,
        quip: `...and hmm, a radiant ${this.fourthObsession} perched high on the stone chimney! (+250)`
      },
      {
        id: 'bonus_forest_grove',
        landmark: 'forest',
        x: 54.0, y: 4.6, z: -48.0,
        quip: `...and hmm, an exquisite ${this.fourthObsession} hidden deep within the pine needle trails! (+250)`
      },
      {
        id: 'bonus_bluff_overlook',
        landmark: 'bluffs',
        x: -47.0, y: 23.2, z: 2.0,
        quip: `...and hmm, a magnificent ${this.fourthObsession} atop the +22m rocky bluff chasm! (+250)`
      }
    ];

    bonusSpots.forEach((b) => {
      const mesh = this.createBonusMesh(this.fourthObsession);
      mesh.position.set(b.x, b.y, b.z);
      this.group.add(mesh);

      this.pickups.push({
        id: b.id,
        type: PICKUP_TYPES.BONUS,
        mesh: mesh,
        position: { x: b.x, y: b.y, z: b.z },
        initialY: b.y,
        timeOffset: Math.random() * 2.0,
        radius: 1.8,
        orangesValue: 0,
        scoreValue: 250,
        quip: b.quip,
        collected: false
      });
    });
  }

  /**
   * Per-frame animation and proximity collection check
   * @param {number} dt Delta time
   * @param {{x: number, y: number, z: number}} playerPos
   * @param {function} onCollect Callback with reward details
   */
  update(dt, playerPos, onCollect = null) {
    this.time += dt;

    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if (p.collected) continue;

      // 1. Bobbing Animation matching T1-R2-07-D (0.5 + Math.sin(t * 3.0) * 0.15)
      p.mesh.position.y = p.initialY + Math.sin(this.time * 3.0 + p.timeOffset) * 0.15;

      // 2. Rotational Spin matching T1-R2-07-D (rotationY = t * 2.0)
      p.mesh.rotation.y += 2.0 * dt;

      // 3. Proximity Check (Euclidean distance)
      if (playerPos) {
        const dx = p.mesh.position.x - playerPos.x;
        const dy = p.mesh.position.y - playerPos.y;
        const dz = p.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist <= p.radius) {
          p.collected = true;

          // Quick disappearance pop
          p.mesh.visible = false;
          this.group.remove(p.mesh);

          if (onCollect) {
            onCollect({
              id: p.id,
              type: p.type,
              oranges: p.orangesValue,
              score: p.scoreValue,
              quip: p.quip || null,
              position: p.position
            });
          }
        }
      }
    }
  }

  /**
   * Resets all collected pickups (for game restart or test harnesses)
   */
  reset() {
    this.pickups.forEach((p) => {
      p.collected = false;
      p.mesh.visible = true;
      if (!p.mesh.parent) {
        this.group.add(p.mesh);
      }
    });
  }

  dispose() {
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
    [this.matOrange, this.matStem, this.matLeaf, this.matHalo].forEach(m => m && m.dispose());
  }
}
