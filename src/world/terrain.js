/**
 * src/world/terrain.js
 * Multi-elevation terrain heightfield for Kevin Tighe: Lakeside Retreat 3D
 */

import * as THREE from 'three';

export class LakesideTerrain {
  constructor(scene, textureManager) {
    this.scene = scene;
    this.textures = textureManager;
    this.init();
  }

  init() {
    const size = 260;
    const segs = 96;
    const geom = new THREE.PlaneGeometry(size, size, segs, segs);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getElevation(x, z);
      pos.setY(i, y);
    }
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.get('grass_color', 24, 24),
      normalMap: this.textures.get('grass_normal', 24, 24),
      roughness: 0.85,
      metalness: 0.05,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.name = 'LakesideTerrain';
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  /**
   * Continuous procedural elevation function matching all 4 landmarks.
   * Can be queried synchronously by character, camera, and props.
   */
  getElevation(x, z) {
    // 1. Sheer Granite Chasm Cliff Face (X in [-36, -24], Z in [4, 22])
    // Monotonic steep granite drop (~56 deg slope) into lake water edge
    // Satisfies Tier 2 spec T2-BND-18 for steep bluff sliding (> 50 deg)
    if (x >= -36 && x <= -24 && z >= 4 && z <= 22) {
      const cliffT = THREE.MathUtils.clamp((x - (-36)) / 12.0, 0, 1);
      // Drops from 18.0m down to 0.2m over 12m span (avg gradient ~1.48 => ~56 deg)
      const cliffElev = THREE.MathUtils.lerp(18.0, 0.2, cliffT);
      const chasmNoise = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.25;
      return cliffElev + chasmNoise;
    }

    // 2. Lake Basin: In front of shoreline (Z > 5, X in [-24, 55])
    if (z > 5 && x >= -24 && x < 55) {
      const shoreDist = Math.min(1.0, (z - 5) / 18);
      return -4.5 * shoreDist;
    }

    // 3. Rocky Bluffs: High granite ridge on the west (X < -25)
    if (x < -25) {
      const bluffFactor = THREE.MathUtils.clamp((-x - 25) / 45, 0, 1);
      const ridgeNoise = Math.sin(x * 0.12) * Math.cos(z * 0.08) * 2.5;
      return bluffFactor * 22.0 + ridgeNoise;
    }

    // 4. Cabin Clearing Terrace (X in [12, 38], Z in [-26, -4])
    if (x >= 12 && x <= 38 && z >= -26 && z <= -4) {
      return 2.0; // Flat stable clearing for cabin
    }

    // 5. Pine Forest Highlands: Rolling hills to the north & east
    if (x > 38 || z < -26) {
      const hillX = Math.sin(x * 0.06) * 2.2;
      const hillZ = Math.cos(z * 0.06) * 2.0;
      return 2.5 + hillX + hillZ;
    }

    // 6. Shoreline gentle slope transitioning to lake
    const t = THREE.MathUtils.clamp((z + 5) / 10, 0, 1);
    return THREE.MathUtils.lerp(1.8, 0.0, t);
  }
}

export function createTerrain(scene, textureManager) {
  const terrain = new LakesideTerrain(scene, textureManager);
  return terrain.mesh;
}
