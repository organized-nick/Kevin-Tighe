/**
 * src/world/lake.js
 * Sunlit Reflective Lake with Animated Normal Map Ripples & Shoreline Boundary Clamping
 */

import * as THREE from 'three';

export class LakesideLake {
  constructor(scene, textureManager) {
    this.scene = scene;
    this.textures = textureManager;
    this.normalMap = this.textures.get('water_normal', 14, 10);
    this.init();
  }

  init() {
    // Water surface plane at Y = 0.0
    const geom = new THREE.PlaneGeometry(160, 140, 64, 64);
    geom.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7, // Deep crystal alpine blue
      roughness: 0.08,
      metalness: 0.20,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transmission: 0.62,
      ior: 1.333,
      transparent: true,
      opacity: 0.90,
      normalMap: this.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
    });

    // Attach update hook for simple access
    this.material.userData = {
      update: (time) => {
        if (this.normalMap) {
          this.normalMap.offset.x = (time * 0.032) % 1.0;
          this.normalMap.offset.y = (time * 0.018) % 1.0;
        }
      }
    };

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.name = 'SunlitLake';
    this.mesh.position.set(-25, 0.0, 75);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    // Lakebed sandy/pebbled basin beneath water
    const bedGeom = new THREE.PlaneGeometry(160, 140, 16, 16);
    bedGeom.rotateX(-Math.PI / 2);
    const bedMat = new THREE.MeshStandardMaterial({
      map: this.textures.get('earth_color', 10, 10),
      normalMap: this.textures.get('earth_normal', 10, 10),
      roughness: 0.9,
      color: 0x475569
    });
    const bedMesh = new THREE.Mesh(bedGeom, bedMat);
    bedMesh.position.set(-25, -4.8, 75);
    bedMesh.receiveShadow = true;
    this.scene.add(bedMesh);
  }

  update(dt, time) {
    if (this.normalMap) {
      this.normalMap.offset.x = (time * 0.032) % 1.0;
      this.normalMap.offset.y = (time * 0.018) % 1.0;
    }
  }

  /**
   * Shoreline boundary check: detects if a given coordinate is in deep lake water.
   */
  isDeepWater(x, z) {
    return z > 8 && x > -75 && x < 45;
  }

  /**
   * Clamps character from accidentally sinking below water line unless on dock or in hole.
   */
  clampPosition(pos) {
    if (this.isDeepWater(pos.x, pos.z) && pos.y < 0.2) {
      pos.y = 0.2; // Keep afloat
    }
  }
}

export function createLake(scene, textureManager) {
  const lake = new LakesideLake(scene, textureManager);
  return lake.mesh;
}
