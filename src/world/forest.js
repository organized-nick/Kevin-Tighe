/**
 * src/world/forest.js
 * Pine Forest Trails with High-Performance Instanced Pine Trees & Needle Cover
 */

import * as THREE from 'three';

export class LakesideForest {
  constructor(scene, textureManager, terrain) {
    this.scene = scene;
    this.textures = textureManager;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'PineForestTrails';
    this.treeCount = 110;
    this.init();
  }

  init() {
    const woodColor = this.textures.get('wood_color', 1, 3);
    const trunkMat = new THREE.MeshStandardMaterial({
      map: woodColor,
      roughness: 0.85,
    });

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x14532d, // Deep evergreen pine
      roughness: 0.80,
      metalness: 0.05,
    });

    // 1. Compound Geometries for Instanced Trees
    const trunkGeom = new THREE.CylinderGeometry(0.22, 0.35, 3.8, 8);
    trunkGeom.translate(0, 1.9, 0);

    const fullFoliageGeom = new THREE.ConeGeometry(2.4, 4.8, 8);
    fullFoliageGeom.translate(0, 4.8, 0);

    this.trunkMesh = new THREE.InstancedMesh(trunkGeom, trunkMat, this.treeCount);
    this.trunkMesh.castShadow = true;
    this.trunkMesh.receiveShadow = true;

    this.foliageMesh = new THREE.InstancedMesh(fullFoliageGeom, foliageMat, this.treeCount);
    this.foliageMesh.castShadow = true;
    this.foliageMesh.receiveShadow = true;

    // Distribute pine trees throughout forest highlands: X in [16, 92], Z in [-82, 4]
    const dummy = new THREE.Object3D();
    let idx = 0;
    
    // Seeded pseudo-random placement
    for (let i = 0; i < this.treeCount * 3 && idx < this.treeCount; i++) {
      const rx = 16 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 76;
      const rz = -82 + (Math.cos(i * 78.233) * 0.5 + 0.5) * 86;

      // Exclude cabin clearing (X: 14 to 36, Z: -26 to -4)
      if (rx >= 14 && rx <= 36 && rz >= -26 && rz <= -4) continue;
      // Exclude lake water (Z > 4)
      if (rz > 4) continue;

      const ry = this.terrain ? this.terrain.getElevation(rx, rz) : 2.5;
      const scale = 0.85 + ((Math.sin(i * 3.1415) * 0.5 + 0.5) * 0.45);

      dummy.position.set(rx, ry, rz);
      dummy.rotation.y = (i * 0.77) % (Math.PI * 2);
      dummy.rotation.x = Math.sin(i) * 0.04; // slight natural lean
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      this.trunkMesh.setMatrixAt(idx, dummy.matrix);
      this.foliageMesh.setMatrixAt(idx, dummy.matrix);
      idx++;
    }

    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.foliageMesh.instanceMatrix.needsUpdate = true;

    // Disable frustum culling on instanced mesh to prevent camera clip-out
    this.trunkMesh.frustumCulled = false;
    this.foliageMesh.frustumCulled = false;

    this.group.add(this.trunkMesh);
    this.group.add(this.foliageMesh);

    // 2. Fallen Mossy Logs along trail
    const logGeom = new THREE.CylinderGeometry(0.28, 0.32, 5.5, 8);
    logGeom.rotateZ(Math.PI / 2);
    const fallenLog = new THREE.Mesh(logGeom, trunkMat);
    const logY = this.terrain ? this.terrain.getElevation(34, -32) : 3.0;
    fallenLog.position.set(34, logY + 0.2, -32);
    fallenLog.castShadow = true;
    this.group.add(fallenLog);

    // 3. Ancient Twin Pine Root Arch (Framing M3 Pine-Root Cavern Holy Grail Hole)
    const archTree1 = new THREE.Mesh(trunkGeom, trunkMat);
    const arch1Y = this.terrain ? this.terrain.getElevation(45, -45) : 3.5;
    archTree1.position.set(45, arch1Y, -45);
    archTree1.rotation.z = -0.22;
    this.group.add(archTree1);

    const archTree2 = new THREE.Mesh(trunkGeom, trunkMat);
    const arch2Y = this.terrain ? this.terrain.getElevation(51, -45) : 3.5;
    archTree2.position.set(51, arch2Y, -45);
    archTree2.rotation.z = 0.22;
    this.group.add(archTree2);

    this.scene.add(this.group);
  }
}

export function createForest(scene, textureManager, terrain) {
  const forest = new LakesideForest(scene, textureManager, terrain);
  return forest.group;
}
