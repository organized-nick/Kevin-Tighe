/**
 * src/world/cabin.js
 * Timber Retreat Cabin: Log Walls, Pitched Roof, Stone Chimney, Porch & Warm Amber Lantern
 */

import * as THREE from 'three';

export class LakesideCabin {
  constructor(scene, textureManager) {
    this.scene = scene;
    this.textures = textureManager;
    this.group = new THREE.Group();
    this.group.name = 'RetreatCabin';
    this.position = new THREE.Vector3(25.0, 2.0, -15.0);
    this.group.position.copy(this.position);
    this.init();
  }

  init() {
    const woodColor = this.textures.get('wood_color', 3, 2);
    const woodNormal = this.textures.get('wood_normal', 3, 2);
    const cliffColor = this.textures.get('cliff_color', 2, 4);
    const brickNormal = this.textures.get('brick_normal', 2, 4);

    const logMat = new THREE.MeshStandardMaterial({
      map: woodColor,
      normalMap: woodNormal,
      roughness: 0.72,
    });

    const roofMat = new THREE.MeshStandardMaterial({
      map: woodColor,
      normalMap: woodNormal,
      color: 0x451a03, // Dark cedar shake shingles
      roughness: 0.85,
    });

    const stoneMat = new THREE.MeshStandardMaterial({
      map: cliffColor,
      normalMap: brickNormal,
      roughness: 0.88,
    });

    // 1. Interlocking Timber Log Walls: 11m wide (X) x 8m deep (Z) x 4.2m high
    const wallGeom = new THREE.BoxGeometry(11.0, 4.2, 8.0);
    const walls = new THREE.Mesh(wallGeom, logMat);
    walls.position.y = 2.1;
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.group.add(walls);

    // Decorative notched corner log extensions
    const logRadius = 0.22;
    const cornerLogGeom = new THREE.CylinderGeometry(logRadius, logRadius, 4.4, 8);
    cornerLogGeom.rotateX(Math.PI / 2);
    const corners = [
      [-5.6, 4.1], [5.6, 4.1],
      [-5.6, -4.1], [5.6, -4.1]
    ];
    corners.forEach(([cx, cz]) => {
      for (let ly = 0.4; ly < 4.2; ly += 0.5) {
        const cLog = new THREE.Mesh(cornerLogGeom, logMat);
        cLog.position.set(cx, ly, cz);
        cLog.castShadow = true;
        this.group.add(cLog);
      }
    });

    // 2. Peaked Gabled A-Frame Roof
    const roofSlopeGeom = new THREE.BoxGeometry(7.2, 0.25, 9.6);
    // Left roof pitch
    const roofLeft = new THREE.Mesh(roofSlopeGeom, roofMat);
    roofLeft.position.set(-3.2, 5.5, 0);
    roofLeft.rotation.z = Math.PI * 0.18;
    roofLeft.castShadow = true;
    this.group.add(roofLeft);

    // Right roof pitch
    const roofRight = new THREE.Mesh(roofSlopeGeom, roofMat);
    roofRight.position.set(3.2, 5.5, 0);
    roofRight.rotation.z = -Math.PI * 0.18;
    roofRight.castShadow = true;
    this.group.add(roofRight);

    // Gable triangular facades
    const gableGeom = new THREE.ConeGeometry(5.6, 2.5, 4);
    gableGeom.rotateY(Math.PI / 4);
    const gableFront = new THREE.Mesh(gableGeom, logMat);
    gableFront.position.set(0, 5.2, 3.9);
    gableFront.scale.set(1, 1, 0.1);
    this.group.add(gableFront);

    // 3. Stone Chimney on the East Wall
    const chimneyBaseGeom = new THREE.BoxGeometry(2.0, 7.8, 2.0);
    const chimney = new THREE.Mesh(chimneyBaseGeom, stoneMat);
    chimney.position.set(5.8, 3.9, 0.5);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    this.group.add(chimney);

    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 2.4), stoneMat);
    chimneyCap.position.set(5.8, 7.9, 0.5);
    this.group.add(chimneyCap);

    // 4. Covered Front Porch facing the lake (South, +Z)
    const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.3, 3.2), logMat);
    porchDeck.position.set(0, 0.2, 5.6);
    porchDeck.receiveShadow = true;
    this.group.add(porchDeck);

    // Porch posts
    const postGeom = new THREE.BoxGeometry(0.24, 2.8, 0.24);
    [-4.4, 4.4].forEach(px => {
      const post = new THREE.Mesh(postGeom, logMat);
      post.position.set(px, 1.5, 7.0);
      post.castShadow = true;
      this.group.add(post);
    });

    // Porch shed roof
    const pRoof = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.2, 3.6), roofMat);
    pRoof.position.set(0, 3.1, 5.6);
    pRoof.rotation.x = Math.PI * 0.06;
    pRoof.castShadow = true;
    this.group.add(pRoof);

    // Porch stairs down to ground
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.18, 0.4), logMat);
      step.position.set(0, 0.18 * (2 - s) - 0.1, 7.3 + s * 0.35);
      step.receiveShadow = true;
      this.group.add(step);
    }

    // 5. Warm Porch Lantern Mesh
    const lanternMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.45, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.9,
      })
    );
    lanternMesh.position.set(0, 2.7, 6.4);
    this.group.add(lanternMesh);

    // 6. Windows with warm interior glow
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
    });
    const winGeom = new THREE.BoxGeometry(1.6, 1.4, 0.1);
    const winFrontLeft = new THREE.Mesh(winGeom, winMat);
    winFrontLeft.position.set(-2.8, 2.2, 4.05);
    const winFrontRight = new THREE.Mesh(winGeom, winMat);
    winFrontRight.position.set(2.8, 2.2, 4.05);
    this.group.add(winFrontLeft, winFrontRight);

    this.scene.add(this.group);
  }
}

export function createCabin(scene, textureManager) {
  const cabin = new LakesideCabin(scene, textureManager);
  return cabin.group;
}
