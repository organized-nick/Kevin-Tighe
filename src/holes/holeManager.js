/**
 * src/holes/holeManager.js
 * 3D Spatial Hole Layout, Landmark Meshes, Colliders & Triggers
 * 
 * Implements the 4 canonical landmark holes:
 * 1. Shoreline Sinkhole (<10ft, 7.5ft): Wet rock ring, shallow pool, signpost
 * 2. Dockside Plunge Pit (10-50ft, 22.0ft): Pier conduit, submerged oranges, spring pad
 * 3. Pine-Root Cavern (50.0ft Holy Grail): Root mound, 50ft shaft, 5 oranges, golden altar
 * 4. Granite Bluff Shaft (>50ft, 82.0ft): Bedrock chasm, 50ft red laser hazard line
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class HoleManager {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.group = new THREE.Group();
    this.group.name = 'SubterraneanHolesGroup';

    this.holes = CONFIG.HOLES.map((h) => ({
      ...h,
      depthMeters: h.depthFt * CONFIG.M_PER_FT,
      floorY: h.position.y - (h.depthFt * CONFIG.M_PER_FT)
    }));

    this.shaftOranges = [];
    this.pulsingLights = [];
    this.beaconCrowns = [];

    this.initMeshes();

    if (this.scene) {
      this.scene.add(this.group);
    }
  }

  getHolesList() {
    return this.holes;
  }

  getHoleById(id) {
    return this.holes.find((h) => h.id === id) || null;
  }

  initMeshes() {
    this.buildShorelineHole();
    this.buildDocksideHole();
    this.buildPineRootHole();
    this.buildBluffHole();
    this.buildWaypointBeacons();
  }

  /**
   * Subtle vertical light pillars & floating crowns so players can orient to all 4 holes from across the lake.
   */
  buildWaypointBeacons() {
    const beaconSpecs = [
      { id: 'hole_shoreline', color: 0xf59e0b, height: 7.0, radius: 0.22, opacity: 0.16 },
      { id: 'hole_dockside',  color: 0xff7a18, height: 9.0, radius: 0.26, opacity: 0.20 },
      { id: 'hole_pine_root', color: 0xffd700, height: 22.0, radius: 0.42, opacity: 0.24, crown: true },
      { id: 'hole_bluff_shaft', color: 0xef4444, height: 14.0, radius: 0.34, opacity: 0.20 }
    ];

    beaconSpecs.forEach((spec) => {
      const hole = this.getHoleById(spec.id);
      if (!hole) return;

      const bGroup = new THREE.Group();
      bGroup.position.set(hole.position.x, hole.position.y, hole.position.z);
      bGroup.name = `HoleBeacon_${spec.id}`;

      const beamGeo = new THREE.CylinderGeometry(spec.radius * 0.55, spec.radius * 1.35, spec.height, 16, 1, true);
      beamGeo.translate(0, spec.height * 0.5 + 0.2, 0);
      const beamMat = new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.color,
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: spec.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        roughness: 0.3
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      bGroup.add(beamMesh);

      if (spec.crown) {
        const crownGeo = new THREE.OctahedronGeometry(0.85, 0);
        const crownMat = new THREE.MeshStandardMaterial({
          color: 0xfff08a,
          emissive: 0xffd700,
          emissiveIntensity: 1.6,
          roughness: 0.18,
          metalness: 0.75
        });
        const crownMesh = new THREE.Mesh(crownGeo, crownMat);
        crownMesh.position.y = spec.height + 1.2;
        bGroup.add(crownMesh);
        this.beaconCrowns.push(crownMesh);
      }

      this.group.add(bGroup);
    });
  }

  // -------------------------------------------------------------------------
  // 1. Shoreline Sinkhole (7.5ft, Tier 1 Shallow)
  // -------------------------------------------------------------------------
  buildShorelineHole() {
    const hole = this.getHoleById('hole_shoreline');
    if (!hole) return;

    const group = new THREE.Group();
    group.position.set(hole.position.x, hole.position.y, hole.position.z);
    group.name = 'HoleMesh_Shoreline';

    const cliffMat = (this.textures && this.textures.getCliffMaterial)
      ? this.textures.getCliffMaterial()
      : new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });

    // Wet rock rim: 10 faceted dodecahedron boulders arranged at radius 1.8m
    const boulderGeo = new THREE.DodecahedronGeometry(0.42, 1);
    const boulderMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.35,
      metalness: 0.15
    });

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const bMesh = new THREE.Mesh(boulderGeo, boulderMat);
      bMesh.position.set(Math.cos(angle) * 1.8, 0.15, Math.sin(angle) * 1.8);
      bMesh.scale.set(0.9 + Math.sin(i) * 0.2, 0.7 + Math.cos(i) * 0.2, 0.9);
      bMesh.rotation.set(i * 0.5, i * 0.8, 0);
      bMesh.castShadow = true;
      group.add(bMesh);
    }

    // Outer Torus Lip
    const torusGeo = new THREE.TorusGeometry(1.8, 0.22, 12, 32);
    torusGeo.rotateX(Math.PI / 2);
    const lipMesh = new THREE.Mesh(torusGeo, boulderMat);
    lipMesh.position.y = 0.05;
    group.add(lipMesh);

    // Tapered shallow cylinder depression (depth 2.29m = 7.5ft)
    const shaftGeo = new THREE.CylinderGeometry(1.75, 1.2, 2.29, 24, 4, true);
    shaftGeo.translate(0, -1.145, 0);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.95,
      side: THREE.BackSide
    });
    const shaftMesh = new THREE.Mesh(shaftGeo, earthMat);
    group.add(shaftMesh);

    // Muddy water disc at bottom (Y = -2.086m)
    const waterGeo = new THREE.CircleGeometry(1.2, 24);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      roughness: 0.2,
      transmission: 0.5,
      opacity: 0.88,
      transparent: true
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = -2.10;
    group.add(waterMesh);

    // Weathered Driftwood Warning Signpost
    const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(1.95, 0.75, 0.4);
    post.rotation.z = -0.12;

    const boardGeo = new THREE.BoxGeometry(0.75, 0.35, 0.06);
    const board = new THREE.Mesh(boardGeo, woodMat);
    board.position.set(1.95, 1.35, 0.4);
    board.rotation.y = 0.35;
    group.add(post, board);

    this.group.add(group);
  }

  // -------------------------------------------------------------------------
  // 2. Dockside Plunge Pit (22.0ft, Tier 2 Sweet Spot)
  // -------------------------------------------------------------------------
  buildDocksideHole() {
    const hole = this.getHoleById('hole_dockside');
    if (!hole) return;

    const group = new THREE.Group();
    group.position.set(hole.position.x, hole.position.y, hole.position.z);
    group.name = 'HoleMesh_Dockside';

    // Deck curb timbers at sides (X = -1.3 and X = +1.3)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
    const curbGeo = new THREE.BoxGeometry(0.2, 0.2, 2.4);
    const curbLeft = new THREE.Mesh(curbGeo, woodMat);
    curbLeft.position.set(-1.3, 0.1, 0.0);
    const curbRight = new THREE.Mesh(curbGeo, woodMat);
    curbRight.position.set(1.3, 0.1, 0.0);
    group.add(curbLeft, curbRight);

    // Submerged cylindrical conduit descending 6.71m (22ft) to floor at Y = -5.86m
    const conduitGeo = new THREE.CylinderGeometry(1.4, 1.4, 6.71, 24, 8, true);
    conduitGeo.translate(0, -3.355, 0);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e, // patinated bronze/copper
      roughness: 0.35,
      metalness: 0.65,
      side: THREE.DoubleSide
    });
    const conduitMesh = new THREE.Mesh(conduitGeo, metalMat);
    group.add(conduitMesh);

    // Floor Launch Dais (at Y = -6.71m relative to dock deck)
    const floorGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.3, 24);
    const floorMesh = new THREE.Mesh(floorGeo, metalMat);
    floorMesh.position.y = -6.71;
    group.add(floorMesh);

    // Bubbling thermal spring vent ring
    const ventRingGeo = new THREE.TorusGeometry(1.1, 0.18, 12, 24);
    ventRingGeo.rotateX(Math.PI / 2);
    const ventRing = new THREE.Mesh(ventRingGeo, metalMat);
    ventRing.position.y = -6.55;

    const springPoolGeo = new THREE.CircleGeometry(1.0, 24);
    springPoolGeo.rotateX(-Math.PI / 2);
    const springPoolMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85
    });
    const springPool = new THREE.Mesh(springPoolGeo, springPoolMat);
    springPool.position.y = -6.54;
    group.add(ventRing, springPool);

    // Submerged Shaft Oranges at depths 6ft, 12ft, 18ft
    const orangeDepths = [6.0, 12.0, 18.0];
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xff6b1a,
      emissive: 0xff4500,
      emissiveIntensity: 0.3,
      roughness: 0.3
    });
    const orangeGeo = new THREE.SphereGeometry(0.3, 16, 16);

    orangeDepths.forEach((dFt, idx) => {
      const dMeters = dFt * CONFIG.M_PER_FT;
      const orangeMesh = new THREE.Mesh(orangeGeo, orangeMat);
      const angle = idx * 1.9;
      orangeMesh.position.set(Math.cos(angle) * 0.7, -dMeters, Math.sin(angle) * 0.7);
      group.add(orangeMesh);

      this.shaftOranges.push({
        holeId: 'hole_dockside',
        mesh: orangeMesh,
        depthFt: dFt,
        worldY: hole.position.y - dMeters,
        collected: false
      });
    });

    this.group.add(group);
  }

  // -------------------------------------------------------------------------
  // 3. Pine-Root Cavern (50.0ft, Holy Grail Pinnacle)
  // -------------------------------------------------------------------------
  buildPineRootHole() {
    const hole = this.getHoleById('hole_pine_root');
    if (!hole) return;

    const group = new THREE.Group();
    group.position.set(hole.position.x, hole.position.y, hole.position.z);
    group.name = 'HoleMesh_PineRoot';

    // Mossy Pine Root Mound & Rim Lip
    const rootMat = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.92
    });

    // 8 Gnarled Pine Root Tubes weaving around rim
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rootGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.2, 8);
      rootGeo.rotateZ(Math.PI / 2.3);
      const rootMesh = new THREE.Mesh(rootGeo, rootMat);
      rootMesh.position.set(Math.cos(angle) * 2.2, 0.15, Math.sin(angle) * 2.2);
      rootMesh.rotation.y = angle + 0.4;
      rootMesh.castShadow = true;
      group.add(rootMesh);
    }

    // Outer rim collar torus
    const rimTorus = new THREE.TorusGeometry(2.2, 0.35, 12, 32);
    rimTorus.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimTorus, rootMat);
    rimMesh.position.y = 0.1;
    group.add(rimMesh);

    // 15.24m (exact 50.0ft) deep vertical cavern cylinder down to -11.74m
    const cavernGeo = new THREE.CylinderGeometry(2.1, 2.6, 15.24, 32, 16, true);
    cavernGeo.translate(0, -7.62, 0);
    const cavernMat = new THREE.MeshStandardMaterial({
      color: 0x27190f,
      roughness: 0.95,
      side: THREE.BackSide
    });
    const cavernMesh = new THREE.Mesh(cavernGeo, cavernMat);
    group.add(cavernMesh);

    // 4 Stratified root rings inside shaft at depths 12ft, 24ft, 36ft, 44ft
    const ringDepths = [12.0, 24.0, 36.0, 44.0];
    ringDepths.forEach((dFt) => {
      const dM = dFt * CONFIG.M_PER_FT;
      const ringGeo = new THREE.TorusGeometry(2.15, 0.12, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, rootMat);
      ringMesh.position.y = -dM;
      group.add(ringMesh);
    });

    // 5 Shaft Orange Pickups at depths 10ft, 20ft, 30ft, 40ft, 48ft
    const orangeDepths = [10.0, 20.0, 30.0, 40.0, 48.0];
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xff6b1a,
      emissive: 0xff4500,
      emissiveIntensity: 0.4,
      roughness: 0.25
    });
    const orangeGeo = new THREE.SphereGeometry(0.35, 16, 16);

    orangeDepths.forEach((dFt, idx) => {
      const dMeters = dFt * CONFIG.M_PER_FT;
      const orangeMesh = new THREE.Mesh(orangeGeo, orangeMat);
      const angle = idx * 1.45;
      orangeMesh.position.set(Math.cos(angle) * 1.1, -dMeters, Math.sin(angle) * 1.1);
      group.add(orangeMesh);

      this.shaftOranges.push({
        holeId: 'hole_pine_root',
        mesh: orangeMesh,
        depthFt: dFt,
        worldY: hole.position.y - dMeters,
        collected: false
      });
    });

    // Sacred Hexagonal Stone Altar Dais at bottom (Y = -15.24m)
    const daisGeo = new THREE.CylinderGeometry(1.8, 2.1, 0.6, 6);
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8
    });
    const daisMesh = new THREE.Mesh(daisGeo, daisMat);
    daisMesh.position.y = -15.24;
    group.add(daisMesh);

    // Radiant Golden Thermal Geyser Pool
    const poolGeo = new THREE.CircleGeometry(1.4, 24);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xffd700,
      emissiveIntensity: 1.3
    });
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.position.y = -14.93;
    group.add(poolMesh);

    // Golden Quill Trophy floating above the altar
    const quillGeo = new THREE.ConeGeometry(0.12, 0.9, 8);
    quillGeo.rotateZ(Math.PI * 0.15);
    const quillMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8
    });
    this.quillMesh = new THREE.Mesh(quillGeo, quillMat);
    this.quillMesh.position.set(0, -14.2, 0);
    group.add(this.quillMesh);

    // Radiant Golden Light illuminating entire subterranean shaft
    const grailLight = new THREE.PointLight(0xffd700, 3.2, 18.0);
    grailLight.position.set(0, -13.5, 0);
    group.add(grailLight);

    this.group.add(group);
  }

  // -------------------------------------------------------------------------
  // 4. Granite Bluff Shaft (82.0ft, Tier 3 Deep Hazard)
  // -------------------------------------------------------------------------
  buildBluffHole() {
    const hole = this.getHoleById('hole_bluff_shaft');
    if (!hole) return;

    const group = new THREE.Group();
    group.position.set(hole.position.x, hole.position.y, hole.position.z);
    group.name = 'HoleMesh_BluffShaft';

    // Octagonal Chiselled Granite Collar
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.88
    });

    const collarTorus = new THREE.TorusGeometry(2.4, 0.35, 8, 8);
    collarTorus.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarTorus, collarMat);
    collarMesh.position.y = 0.15;
    group.add(collarMesh);

    // Alternating hazard caution stripe blocks around rim
    const chevronGeo = new THREE.BoxGeometry(0.55, 0.1, 0.2);
    const chevronOrange = new THREE.MeshStandardMaterial({ color: 0xff6b1a, roughness: 0.4 });
    const chevronBlack = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const cMesh = new THREE.Mesh(chevronGeo, i % 2 === 0 ? chevronOrange : chevronBlack);
      cMesh.position.set(Math.cos(angle) * 2.5, 0.3, Math.sin(angle) * 2.5);
      cMesh.rotation.y = angle + Math.PI / 2;
      group.add(cMesh);
    }

    // 25m sheer cylindrical borehole (depth 82.0ft) down to -2.994m
    const chasmGeo = new THREE.CylinderGeometry(2.3, 2.1, 25.0, 32, 24, true);
    chasmGeo.translate(0, -12.5, 0);
    const chasmMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.92,
      side: THREE.BackSide
    });
    const chasmMesh = new THREE.Mesh(chasmGeo, chasmMat);
    group.add(chasmMesh);

    // Bedrock floor at bottom
    const floorGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.5, 24);
    const floorMesh = new THREE.Mesh(floorGeo, chasmMat);
    floorMesh.position.y = -25.0;
    group.add(floorMesh);

    // -----------------------------------------------------------------------
    // Exact 50.0ft Red Laser Hazard Boundary Line (at depth 15.24m / Y = -15.24m)
    // -----------------------------------------------------------------------
    const laserY = -15.24;

    // Glowing Red Perimeter Torus
    const laserTorusGeo = new THREE.TorusGeometry(2.2, 0.08, 12, 32);
    laserTorusGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.92
    });
    const laserTorus = new THREE.Mesh(laserTorusGeo, laserMat);
    laserTorus.position.y = laserY;
    group.add(laserTorus);

    // Cross-hatch red laser grid beams
    const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 4.4, 8);
    beamGeo.rotateZ(Math.PI / 2);
    const beam1 = new THREE.Mesh(beamGeo, laserMat);
    beam1.position.y = laserY;
    const beam2 = new THREE.Mesh(beamGeo, laserMat);
    beam2.position.y = laserY;
    beam2.rotation.y = Math.PI / 2;
    group.add(beam1, beam2);

    // Pulsing Red Hazard Light
    this.hazardLight = new THREE.PointLight(0xef4444, 2.5, 12.0);
    this.hazardLight.position.set(0, laserY + 0.4, 0);
    group.add(this.hazardLight);
    this.pulsingLights.push(this.hazardLight);

    this.group.add(group);
  }

  /**
   * Collision carve-out for CharacterController.getGroundElevation
   * Ensures Kevin doesn't snap to solid plateau or surface terrain at hole mouths
   */
  getGroundOverride(x, z, groundY, currentY = 999) {
    // 1. Bluff Shaft opening check at (-45.0, 0.0)
    const distBluff = Math.hypot(x - (-45.0), z - 0.0);
    if (distBluff < 2.35) {
      // If player is already inside the borehole (below surface), floor is bedrock (-2.994m)
      if (currentY < 21.5) {
        return -2.994;
      }
      // On the overlook plateau surface, maintain solid footing at 22.0m
      return groundY;
    }

    // 2. Pine Root Cavern opening check at (48.0, -45.0)
    const distPine = Math.hypot(x - 48.0, z - (-45.0));
    if (distPine < 2.15) {
      if (currentY < 3.2) {
        return -11.74;
      }
      return groundY;
    }

    // 3. Dockside Plunge Pit opening at (0.0, 22.0)
    const distDock = Math.hypot(x - 0.0, z - 22.0);
    if (distDock < 1.55) {
      // Carve out dock deck down to submerged floor (-5.86m)
      return -5.856;
    }

    // 4. Shoreline Sinkhole at (12.0, 18.0)
    const distShore = Math.hypot(x - 12.0, z - 18.0);
    if (distShore < 1.8) {
      if (currentY < 0.1) {
        return -2.086;
      }
      return groundY;
    }

    return groundY;
  }

  update(dt) {
    // Rotate quill trophy
    if (this.quillMesh) {
      this.quillMesh.rotation.y += dt * 1.5;
    }

    // Pulse red hazard light
    if (this.hazardLight) {
      const pulse = 1.8 + 1.2 * Math.sin(Date.now() * 0.008);
      this.hazardLight.intensity = pulse;
    }

    // Spin shaft oranges
    this.shaftOranges.forEach((item) => {
      if (!item.collected && item.mesh) {
        item.mesh.rotation.y += dt * 2.0;
      }
    });

    // Spin waypoint crowns
    this.beaconCrowns.forEach((crown) => {
      crown.rotation.y += dt * 1.4;
    });
  }

  resetPickups() {
    this.shaftOranges.forEach((item) => {
      item.collected = false;
      if (item.mesh) item.mesh.visible = true;
    });
  }

  dispose() {
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
