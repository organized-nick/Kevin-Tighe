/**
 * src/world/terrain.js
 * Multi-elevation continuous terrain heightfield for Kevin Tighe: Lakeside Retreat 3D
 *
 * Sculpted features:
 * - Sheer Granite Chasm Cliff Face (X in [-36, -24], Z in [4, 22]) at ~56° for steep-slope sliding
 * - Walkable Northwest Bluff Switchback Trail (X in [-42, -14], Z in [-16, -6.5]) rising smoothly to +22.0m Overlook
 * - Walkable Golden Sandbar Spit extending to (12.0, 18.0) at Y = +0.20m flush with Shoreline Sinkhole
 * - Cabin Clearing Terrace at Y = +2.00m
 * - Mossy Pine-Root Hillock at (48.0, -45.0) peaking at Y = +3.50m flush with the 50.0ft Holy Grail Cavern
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
    const segs = 160;
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
   * Base regional heightfield prior to the Northwest Bluff Trail blend.
   */
  _getBaseElevation(x, z) {
    // 1. Sheer Granite Chasm Cliff Face (X in [-36, -24], Z in [4, 22])
    // Monotonic steep granite drop (~56 deg slope) into lake water edge (Tier 2 spec T2-BND-18)
    if (x >= -36 && x <= -24 && z >= 4 && z <= 22) {
      const cliffT = THREE.MathUtils.clamp((x - (-36)) / 12.0, 0, 1);
      const cliffElev = THREE.MathUtils.lerp(18.0, 0.2, cliffT);
      const chasmNoise = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.25;
      return cliffElev + chasmNoise;
    }

    // 2. Lake Basin: In front of shoreline (Z > 5, X in [-24, 55])
    if (z > 5 && x >= -24 && x < 55) {
      const shoreDist = Math.min(1.0, (z - 5) / 18);
      const lakeBed = -4.5 * shoreDist;

      // Walkable Golden Sandbar Spit connecting shore (12, 4.5) to Shoreline Sinkhole (12, 18) at Y = 0.20m
      const closestZ = THREE.MathUtils.clamp(z, 4.5, 18.0);
      const distToSpit = Math.hypot(x - 12.0, z - closestZ);
      if (distToSpit <= 2.6) {
        return 0.20;
      }
      if (distToSpit < 7.2) {
        const u = (distToSpit - 2.6) / 4.6;
        const s = u * u * (3.0 - 2.0 * u);
        return THREE.MathUtils.lerp(0.20, lakeBed, s);
      }

      return lakeBed;
    }

    // 3. Rocky Bluffs: High granite ridge on the west (X < -25)
    if (x < -25) {
      const bluffFactor = THREE.MathUtils.clamp((-x - 25) / 45, 0, 1);
      const ridgeNoise = Math.sin(x * 0.12) * Math.cos(z * 0.08) * 2.5;
      return bluffFactor * 22.0 + ridgeNoise;
    }

    // 4. Cabin Clearing Terrace (X in [12, 38], Z in [-26, -4])
    if (x >= 12 && x <= 38 && z >= -26 && z <= -4) {
      return 2.0;
    }

    // 5. Pine Forest Highlands: Rolling hills to the north & east
    if (x > 38 || z < -26) {
      const hillX = Math.sin(x * 0.06) * 2.2;
      const hillZ = Math.cos(z * 0.06) * 2.0;
      const baseHill = 2.5 + hillX + hillZ;

      // Smooth Mossy Hillock flush with the 50.0ft Pine-Root Cavern rim at (48.0, 3.50, -45.0)
      const distPine = Math.hypot(x - 48.0, z - (-45.0));
      if (distPine <= 3.0) {
        return 3.50;
      }
      if (distPine < 14.0) {
        const u = (distPine - 3.0) / 11.0;
        const s = u * u * (3.0 - 2.0 * u);
        return THREE.MathUtils.lerp(3.50, baseHill, s);
      }

      return baseHill;
    }

    // 6. Shoreline gentle slope transitioning to lake (with C1-continuous sandbar spit tie-in)
    const t = THREE.MathUtils.clamp((z + 5) / 10, 0, 1);
    const shoreBase = THREE.MathUtils.lerp(1.8, 0.0, t);

    if (z >= 2.0) {
      const distX = Math.abs(x - 12.0);
      if (distX < 7.2) {
        const u = THREE.MathUtils.clamp((distX - 2.6) / 4.6, 0, 1);
        const s = u * u * (3.0 - 2.0 * u);
        const spitTie = THREE.MathUtils.lerp(0.20, shoreBase, s);
        return Math.max(shoreBase, spitTie);
      }
    }

    return shoreBase;
  }

  /**
   * Continuous procedural elevation function matching all 4 landmarks & hole rims.
   * Can be queried synchronously by character, camera, and props.
   */
  getElevation(x, z) {
    const baseElev = this._getBaseElevation(x, z);

    // Walkable Northwest Bluff Trail rising smoothly (~36° < 50°) from (-14, -10) to +22.0m Overlook (-42, -10)
    if (x < -14.0 && z < 3.5 && z > -32.0) {
      const southFade = 1.0 - THREE.MathUtils.smoothstep(z, -6.5, 3.5);
      const northFade = 1.0 - THREE.MathUtils.smoothstep(-z, 16.0, 32.0);
      const trailMask = southFade * northFade;
      if (trailMask > 0.001) {
        const trailAlongX = THREE.MathUtils.clamp((-x - 14.0) / 28.0, 0, 1);
        const trailElev = THREE.MathUtils.lerp(1.8, 22.0, trailAlongX);
        return THREE.MathUtils.lerp(baseElev, Math.max(baseElev, trailElev), trailMask);
      }
    }

    return baseElev;
  }
}

export function createTerrain(scene, textureManager) {
  const terrain = new LakesideTerrain(scene, textureManager);
  return terrain.mesh;
}
