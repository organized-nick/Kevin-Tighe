/**
 * src/world/dock.js
 * 24m Wooden Pier / Boardwalk Extending Over Water with Mooring Posts & Plunge Pit Opening
 */

import * as THREE from 'three';

export class LakesideDock {
  constructor(scene, textureManager) {
    this.scene = scene;
    this.textures = textureManager;
    this.group = new THREE.Group();
    this.group.name = 'WoodenDock';
    this.deckElevation = 0.85; // Deck sits at Y = 0.85m above water
    this.init();
  }

  init() {
    const woodColor = this.textures.get('wood_color', 2, 2);
    const woodNormal = this.textures.get('wood_normal', 2, 2);

    const plankMat = new THREE.MeshStandardMaterial({
      map: woodColor,
      normalMap: woodNormal,
      roughness: 0.74,
      metalness: 0.04,
    });

    const pilingMat = new THREE.MeshStandardMaterial({
      map: woodColor,
      normalMap: woodNormal,
      color: 0x5c3a21,
      roughness: 0.86,
    });

    // 1. Deck Planks: 24m total length from Z = 6.0 to Z = 30.0 at X = 0
    const plankWidth = 4.0;
    const plankLength = 0.44;
    const plankDepth = 0.12;
    const plankCount = 48;
    const plankGeom = new THREE.BoxGeometry(plankWidth, plankDepth, plankLength);

    for (let i = 0; i < plankCount; i++) {
      const zPos = 6.2 + i * 0.50;
      // Leave opening at Z = 22 for the M3 Dockside Plunge Pit
      if (zPos >= 21.0 && zPos <= 23.2) continue;

      const plank = new THREE.Mesh(plankGeom, plankMat);
      plank.position.set(0, this.deckElevation, zPos);
      plank.castShadow = true;
      plank.receiveShadow = true;
      this.group.add(plank);
    }

    // 1a. Shoreward Approach Ramp Planks (Z = 4.35 to Z = 5.85 sloping up to Y = 0.85m)
    for (let r = 0; r < 4; r++) {
      const rz = 4.4 + r * 0.48;
      const ry = THREE.MathUtils.lerp(0.22, this.deckElevation, (r + 0.5) / 4.0);
      const rampPlank = new THREE.Mesh(plankGeom, plankMat);
      rampPlank.position.set(0, ry, rz);
      rampPlank.rotation.x = -0.34;
      rampPlank.castShadow = true;
      rampPlank.receiveShadow = true;
      this.group.add(rampPlank);
    }

    // 1b. Side Catwalk Stringer Planks flanking the Z = 22 Plunge Pit (|X| in [1.6, 2.0])
    const sideWalkGeom = new THREE.BoxGeometry(0.42, plankDepth, 2.6);
    const sideLeft = new THREE.Mesh(sideWalkGeom, plankMat);
    sideLeft.position.set(-1.79, this.deckElevation, 22.0);
    sideLeft.castShadow = true;
    sideLeft.receiveShadow = true;
    const sideRight = new THREE.Mesh(sideWalkGeom, plankMat);
    sideRight.position.set(1.79, this.deckElevation, 22.0);
    sideRight.castShadow = true;
    sideRight.receiveShadow = true;
    this.group.add(sideLeft, sideRight);

    // 2. Heavy Timber Pilings driven into lakebed
    const pilingGeom = new THREE.CylinderGeometry(0.20, 0.24, 5.0, 12);
    for (let z = 7.0; z <= 29.5; z += 3.8) {
      // Left piling
      const pLeft = new THREE.Mesh(pilingGeom, pilingMat);
      pLeft.position.set(-1.85, -1.0, z);
      pLeft.castShadow = true;
      pLeft.receiveShadow = true;
      this.group.add(pLeft);

      // Right piling
      const pRight = new THREE.Mesh(pilingGeom, pilingMat);
      pRight.position.set(1.85, -1.0, z);
      pRight.castShadow = true;
      pRight.receiveShadow = true;
      this.group.add(pRight);
    }

    // 3. Side Stringer Beams running along the 24m length
    const stringerGeom = new THREE.BoxGeometry(0.2, 0.35, 24.0);
    const sLeft = new THREE.Mesh(stringerGeom, plankMat);
    sLeft.position.set(-1.9, this.deckElevation - 0.22, 18.0);
    sLeft.castShadow = true;
    this.group.add(sLeft);

    const sRight = new THREE.Mesh(stringerGeom, plankMat);
    sRight.position.set(1.9, this.deckElevation - 0.22, 18.0);
    sRight.castShadow = true;
    this.group.add(sRight);

    // 4. Mooring Bollards on outer edges
    const bollardGeom = new THREE.CylinderGeometry(0.12, 0.14, 0.45, 8);
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0x292524, metalness: 0.6, roughness: 0.3 });
    for (let bz = 8.5; bz <= 28.5; bz += 5.0) {
      const b1 = new THREE.Mesh(bollardGeom, bollardMat);
      b1.position.set(-1.85, this.deckElevation + 0.25, bz);
      this.group.add(b1);

      const b2 = new THREE.Mesh(bollardGeom, bollardMat);
      b2.position.set(1.85, this.deckElevation + 0.25, bz);
      this.group.add(b2);
    }

    // 5. Dock Lantern Posts
    this.addDockLantern(1.85, 17.0);
    this.addDockLantern(-1.85, 29.5);

    // 6. Dockside Plunge Pit Opening Frame (M3 Landmark Hole Opening)
    const frameGeom = new THREE.BoxGeometry(2.4, 0.2, 0.2);
    const fTop = new THREE.Mesh(frameGeom, plankMat);
    fTop.position.set(0, this.deckElevation, 20.9);
    const fBot = new THREE.Mesh(frameGeom, plankMat);
    fBot.position.set(0, this.deckElevation, 23.3);
    this.group.add(fTop, fBot);

    // 7. Orange Life Preserver Ring at Dock Head
    const ringGeom = new THREE.TorusGeometry(0.55, 0.16, 12, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff6b1a,
      roughness: 0.35,
      metalness: 0.1
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.set(0, this.deckElevation + 0.35, 29.4);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    this.group.add(ring);

    this.scene.add(this.group);
  }

  addDockLantern(x, z) {
    const postGeom = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x44403c });
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(x, this.deckElevation + 0.9, z);
    this.group.add(post);

    const lampGeom = new THREE.BoxGeometry(0.3, 0.4, 0.3);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
    });
    const lamp = new THREE.Mesh(lampGeom, lampMat);
    lamp.position.set(x, this.deckElevation + 1.85, z);
    this.group.add(lamp);
  }

  /**
   * Test whether (x, z) is walking on top of the dock.
   */
  isOnDock(x, z) {
    return x >= -2.1 && x <= 2.1 && z >= 5.8 && z <= 30.2;
  }
}

export function createDock(scene, textureManager) {
  const dock = new LakesideDock(scene, textureManager);
  return dock.group;
}
