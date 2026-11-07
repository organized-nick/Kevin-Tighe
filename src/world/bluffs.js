/**
 * src/world/bluffs.js
 * Rocky Lakeside Bluffs (+22m Elevation), Granite Strata & Overlook Plateau
 */

import * as THREE from 'three';

export class LakesideBluffs {
  constructor(scene, textureManager, terrain) {
    this.scene = scene;
    this.textures = textureManager;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'RockyBluffs';
    this.overlookPosition = new THREE.Vector3(-45.0, 22.0, 0.0);
    this.init();
  }

  init() {
    const cliffColor = this.textures.get('cliff_color', 4, 8);
    const cliffNormal = this.textures.get('cliff_normal', 4, 8);

    const cliffMat = new THREE.MeshStandardMaterial({
      map: cliffColor,
      normalMap: cliffNormal,
      roughness: 0.85,
      metalness: 0.08,
      normalScale: new THREE.Vector2(1.8, 1.8),
    });

    // 1. Massive Granite Cliff Outcroppings (X: -95 to -30, Z: -40 to 35)
    // Modeled with multi-tiered angular rock monoliths
    const rockTiers = [
      { x: -50, z: -10, y: 11.0, sx: 24, sy: 22, sz: 28 },
      { x: -65, z: 12,  y: 10.0, sx: 28, sy: 20, sz: 26 },
      { x: -40, z: 18,  y: 8.0,  sx: 20, sy: 16, sz: 22 },
      { x: -75, z: -25, y: 12.0, sx: 26, sy: 24, sz: 30 },
      { x: -35, z: -28, y: 7.5,  sx: 18, sy: 15, sz: 20 },
    ];

    rockTiers.forEach((tier, i) => {
      // Angular faceted rock geometry
      const geom = new THREE.DodecahedronGeometry(tier.sx * 0.5, 1);
      const mesh = new THREE.Mesh(geom, cliffMat);
      mesh.position.set(tier.x, tier.y, tier.z);
      mesh.scale.set(1.0, tier.sy / (tier.sx * 0.5), tier.sz / (tier.sx * 0.5));
      mesh.rotation.set(0.2 * i, 0.4 * i, -0.1 * i);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    });

    // 2. Cantilevered Overlook Plateau at +22m elevation!
    const plateauGeom = new THREE.BoxGeometry(10.0, 1.8, 12.0);
    const plateau = new THREE.Mesh(plateauGeom, cliffMat);
    plateau.position.set(-45.0, 21.1, 0.0);
    plateau.castShadow = true;
    plateau.receiveShadow = true;
    this.group.add(plateau);

    // Overlook boundary safety cairns / perimeter boulders
    const cairnGeom = new THREE.DodecahedronGeometry(0.6, 0);
    for (let ang = -Math.PI * 0.5; ang <= Math.PI * 0.5; ang += 0.4) {
      const cairn = new THREE.Mesh(cairnGeom, cliffMat);
      const cx = -45.0 + Math.cos(ang) * 4.8;
      const cz = 0.0 + Math.sin(ang) * 5.5;
      cairn.position.set(cx, 22.4, cz);
      cairn.castShadow = true;
      this.group.add(cairn);
    }

    // 3. Sheer Granite Chasm Wall dropping straight down to lake surface (Y = 0)
    const chasmWallGeom = new THREE.PlaneGeometry(36, 24, 8, 8);
    const chasmWall = new THREE.Mesh(chasmWallGeom, cliffMat);
    chasmWall.position.set(-32.0, 11.0, 14.0);
    chasmWall.rotation.y = -Math.PI * 0.45;
    chasmWall.castShadow = true;
    chasmWall.receiveShadow = true;
    this.group.add(chasmWall);

    this.scene.add(this.group);
  }
}

export function createBluffs(scene, textureManager, terrain) {
  const bluffs = new LakesideBluffs(scene, textureManager, terrain);
  return bluffs.group;
}
