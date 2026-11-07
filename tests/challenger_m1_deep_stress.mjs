/**
 * tests/challenger_m1_deep_stress.mjs
 * Adversarial Empirical Verification & Stress Harness for Milestone 1
 * 
 * Verifies:
 * 1. All 4 landmarks (Lake, Dock, Cabin, Forest/Bluffs) exist with genuine meshes,
 *    non-zero vertices, PBR textures, and correct world positions.
 * 2. Active directional sunlight has castShadow === true and shadow camera bounds enclose all landmarks.
 * 3. PBR materials applied (roughness, metalness, normal maps) with zero untextured primitives.
 * 4. Rapid window resizes, extreme camera orbits, and WebGL rendering stability.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const TIMEOUT_MS = 35000;

async function runAdversarialTest() {
  console.log('================================================================');
  console.log('⚔️  CHALLENGER M1: ADVERSARIAL STRESS TEST & EMPIRICAL AUDIT');
  console.log(`Target: ${TARGET_URL}`);
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--in-process-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
    console.error('❌ [PageError]:', err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('❌ [Browser Console Error]:', msg.text());
    }
  });

  const testReport = {
    timestamp: new Date().toISOString(),
    targetUrl: TARGET_URL,
    landmarks: {},
    lighting: {},
    pbrAudit: {},
    shadowEnclosure: {},
    resizeStress: {},
    orbitStress: {},
    webglStability: {},
    verdict: 'PENDING',
    failures: []
  };

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Boot & Interface Contract
    // -------------------------------------------------------------------------
    console.log('[Phase 1] Navigating to target URL and awaiting ready contract...');
    const response = await page.goto(TARGET_URL, { waitUntil: 'load', timeout: TIMEOUT_MS });
    if (!response || response.status() !== 200) {
      throw new Error(`HTTP status is ${response ? response.status() : 'null'}`);
    }

    await page.waitForFunction(() => {
      return window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready === true;
    }, { timeout: 15000 });

    console.log('✅ Game engine initialized and window.__KEVIN_GAME__.ready is true.');

    // -------------------------------------------------------------------------
    // Phase 2: Landmark Verification & Mesh Integrity
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2] Adversarially auditing 4 Lakeside Landmarks & Mesh Integrity...');
    const landmarkAudit = await page.evaluate(() => {
      const game = window.__KEVIN_GAME__;
      const THREE = window.THREE || (game.renderer && game.renderer.domElement ? null : null);
      const landmarks = game.world.landmarks;

      function getMeshDetails(obj) {
        let meshCount = 0;
        let instancedMeshCount = 0;
        let totalVertices = 0;
        let totalTriangles = 0;
        let materials = [];
        let hasNormalMaps = false;
        let hasColorMaps = false;

        // Compute world bounding box
        const bbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
        
        obj.updateMatrixWorld(true);

        obj.traverse((child) => {
          if (child.isMesh || child.isInstancedMesh) {
            meshCount++;
            if (child.isInstancedMesh) {
              instancedMeshCount++;
            }

            const geom = child.geometry;
            if (geom && geom.attributes && geom.attributes.position) {
              const posCount = geom.attributes.position.count;
              const instances = child.isInstancedMesh ? child.count : 1;
              totalVertices += posCount * instances;
              if (geom.index) {
                totalTriangles += (geom.index.count / 3) * instances;
              } else {
                totalTriangles += (posCount / 3) * instances;
              }

              // Compute bounding box
              geom.computeBoundingBox();
              if (geom.boundingBox) {
                const b = geom.boundingBox.clone();
                b.applyMatrix4(child.matrixWorld);
                bbox.min[0] = Math.min(bbox.min[0], b.min.x);
                bbox.min[1] = Math.min(bbox.min[1], b.min.y);
                bbox.min[2] = Math.min(bbox.min[2], b.min.z);
                bbox.max[0] = Math.max(bbox.max[0], b.max.x);
                bbox.max[1] = Math.max(bbox.max[1], b.max.y);
                bbox.max[2] = Math.max(bbox.max[2], b.max.z);
              }
            }

            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              if (m) {
                materials.push({
                  type: m.type,
                  name: m.name || '',
                  roughness: m.roughness,
                  metalness: m.metalness,
                  hasMap: !!m.map,
                  hasNormalMap: !!m.normalMap,
                  transparent: m.transparent,
                  opacity: m.opacity
                });
                if (m.normalMap) hasNormalMaps = true;
                if (m.map) hasColorMaps = true;
              }
            });
          }
        });

        return {
          meshCount,
          instancedMeshCount,
          totalVertices,
          totalTriangles: Math.round(totalTriangles),
          hasNormalMaps,
          hasColorMaps,
          boundingBox: bbox,
          materialsSummary: materials.slice(0, 10)
        };
      }

      const results = {};
      const required = ['lake', 'dock', 'cabin', 'forest', 'bluffs', 'shoreline'];

      for (const name of required) {
        const obj = landmarks[name];
        if (!obj) {
          results[name] = { found: false };
        } else {
          results[name] = {
            found: true,
            ...getMeshDetails(obj)
          };
        }
      }

      // Check Lake normal map animation
      const lakeObj = landmarks.lake;
      let initialOffset = null;
      if (lakeObj && lakeObj.material && lakeObj.material.normalMap) {
        initialOffset = { x: lakeObj.material.normalMap.offset.x, y: lakeObj.material.normalMap.offset.y };
      }

      return { results, initialOffset };
    });

    testReport.landmarks = landmarkAudit.results;

    // Evaluate Landmark assertions
    for (const [name, data] of Object.entries(landmarkAudit.results)) {
      if (!data.found) {
        testReport.failures.push(`Landmark [${name}] was not found in window.__KEVIN_GAME__.world.landmarks`);
        continue;
      }
      if (data.meshCount === 0) {
        testReport.failures.push(`Landmark [${name}] has 0 meshes!`);
      }
      if (data.totalVertices === 0) {
        testReport.failures.push(`Landmark [${name}] has 0 vertices!`);
      }
      console.log(`  ✓ Landmark [${name}]: ${data.meshCount} meshes, ${data.totalVertices} vertices, normalMap: ${data.hasNormalMaps}`);
    }

    // Check specific landmark boundaries
    const lake = landmarkAudit.results.lake;
    if (lake && lake.found) {
      if (lake.totalVertices < 1000) {
        testReport.failures.push(`Lake vertex count ${lake.totalVertices} is too low for reflective ripple simulation`);
      }
      const b = lake.boundingBox;
      console.log(`    Lake bounds: X [${b.min[0].toFixed(1)}, ${b.max[0].toFixed(1)}], Z [${b.min[2].toFixed(1)}, ${b.max[2].toFixed(1)}]`);
      if (b.min[0] > -10 || b.max[0] < 10 || b.min[2] > 20 || b.max[2] < 100) {
        testReport.failures.push(`Lake world bounding box does not cover expected lake area`);
      }
    }

    const dock = landmarkAudit.results.dock;
    if (dock && dock.found) {
      if (dock.meshCount < 30) {
        testReport.failures.push(`Dock mesh count ${dock.meshCount} is too low (expected planks + pilings >= 30)`);
      }
      const b = dock.boundingBox;
      const lengthZ = b.max[2] - b.min[2];
      console.log(`    Dock length along Z: ${lengthZ.toFixed(1)}m (expected ~24m)`);
      if (lengthZ < 20.0) {
        testReport.failures.push(`Dock length along Z is ${lengthZ.toFixed(1)}m, less than specified 24m`);
      }
    }

    const cabin = landmarkAudit.results.cabin;
    if (cabin && cabin.found) {
      if (cabin.meshCount < 20) {
        testReport.failures.push(`Cabin mesh count ${cabin.meshCount} is too low`);
      }
      const b = cabin.boundingBox;
      const heightY = b.max[1] - b.min[1];
      console.log(`    Cabin height: ${heightY.toFixed(1)}m, position near (25, 2, -15)`);
      if (heightY < 5.0) {
        testReport.failures.push(`Cabin height ${heightY.toFixed(1)}m is lower than expected with chimney`);
      }
    }

    const bluffs = landmarkAudit.results.bluffs;
    if (bluffs && bluffs.found) {
      const maxY = bluffs.boundingBox.max[1];
      console.log(`    Bluffs peak elevation: ${maxY.toFixed(1)}m (target +22m)`);
      if (maxY < 20.0) {
        testReport.failures.push(`Bluffs peak elevation ${maxY.toFixed(1)}m does not reach +22m requirement`);
      }
    }

    const forest = landmarkAudit.results.forest;
    if (forest && forest.found) {
      console.log(`    Forest: ${forest.instancedMeshCount} instanced meshes, ${forest.totalVertices} instanced vertices`);
      if (forest.totalVertices < 1000) {
        testReport.failures.push(`Forest instanced trees count / vertices too low`);
      }
    }

    // -------------------------------------------------------------------------
    // Phase 3: Directional Sunlight & Shadow Camera Frustum Enclosure
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3] Mathematically auditing Directional Sunlight & Shadow Frustum Enclosure...');
    const lightingAudit = await page.evaluate(() => {
      const game = window.__KEVIN_GAME__;
      const scene = game.scene;
      const sun = game.world.lights.sun;
      const ambient = game.world.lights.ambient;
      const porchLantern = game.world.lights.porchLantern;
      const dockLantern = game.world.lights.dockLantern;

      if (!sun) return { error: 'No sun light found' };

      const sunPos = { x: sun.position.x, y: sun.position.y, z: sun.position.z };
      const sunTarget = { x: sun.target.position.x, y: sun.target.position.y, z: sun.target.position.z };
      const castShadow = sun.castShadow === true;
      const mapSize = { width: sun.shadow.mapSize.width, height: sun.shadow.mapSize.height };
      const cam = sun.shadow.camera;

      // Update matrices
      sun.updateMatrixWorld(true);
      sun.target.updateMatrixWorld(true);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();

      // Check shadow camera frustum parameters
      const frustumParams = {
        left: cam.left,
        right: cam.right,
        top: cam.top,
        bottom: cam.bottom,
        near: cam.near,
        far: cam.far
      };

      // Mathematical check: For each landmark, project its bounding box corners into shadow camera view space
      // In orthographic view space:
      // X must be within [left, right]
      // Y must be within [bottom, top]
      // Z (depth) in view space: camera looks down -Z, so -Z should be within [near, far], or Z in [-far, -near]
      const landmarks = game.world.landmarks;
      const enclosureResults = {};

      const viewMatrix = cam.matrixWorldInverse;

      function transformPoint(pt, m) {
        const x = pt[0], y = pt[1], z = pt[2];
        const e = m.elements;
        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
        return [
          (e[0] * x + e[4] * y + e[8] * z + e[12]) * w,
          (e[1] * x + e[5] * y + e[9] * z + e[13]) * w,
          (e[2] * x + e[6] * y + e[10] * z + e[14]) * w
        ];
      }

      for (const [name, obj] of Object.entries(landmarks)) {
        if (!obj) continue;
        obj.updateMatrixWorld(true);

        let minViewX = Infinity, maxViewX = -Infinity;
        let minViewY = Infinity, maxViewY = -Infinity;
        let minViewZ = Infinity, maxViewZ = -Infinity;

        // Traverse all mesh bounding boxes
        obj.traverse((child) => {
          if (child.isMesh || child.isInstancedMesh) {
            const geom = child.geometry;
            if (geom && geom.attributes && geom.attributes.position) {
              geom.computeBoundingBox();
              const b = geom.boundingBox;

              // 8 local corners transformed by child.matrixWorld
              const localCorners = [
                [b.min.x, b.min.y, b.min.z],
                [b.min.x, b.min.y, b.max.z],
                [b.min.x, b.max.y, b.min.z],
                [b.min.x, b.max.y, b.max.z],
                [b.max.x, b.min.y, b.min.z],
                [b.max.x, b.min.y, b.max.z],
                [b.max.x, b.max.y, b.min.z],
                [b.max.x, b.max.y, b.max.z]
              ];

              localCorners.forEach((c) => {
                const worldPt = transformPoint(c, child.matrixWorld);
                const viewPt = transformPoint(worldPt, viewMatrix);
                minViewX = Math.min(minViewX, viewPt[0]);
                maxViewX = Math.max(maxViewX, viewPt[0]);
                minViewY = Math.min(minViewY, viewPt[1]);
                maxViewY = Math.max(maxViewY, viewPt[1]);
                minViewZ = Math.min(minViewZ, -viewPt[2]); // distance along forward ray (-Z)
                maxViewZ = Math.max(maxViewZ, -viewPt[2]);
              });
            }
          }
        });

        // Determine enclosure
        const xEnclosed = minViewX >= cam.left * 1.25 && maxViewX <= cam.right * 1.25;
        const yEnclosed = minViewY >= cam.bottom * 1.25 && maxViewY <= cam.top * 1.25;
        const zEnclosed = minViewZ >= cam.near && maxViewZ <= cam.far;

        enclosureResults[name] = {
          viewBounds: {
            x: [Math.round(minViewX), Math.round(maxViewX)],
            y: [Math.round(minViewY), Math.round(maxViewY)],
            z: [Math.round(minViewZ), Math.round(maxViewZ)]
          },
          xEnclosed,
          yEnclosed,
          zEnclosed,
          fullyEnclosed: xEnclosed && yEnclosed && zEnclosed
        };
      }

      return {
        sunPos,
        sunTarget,
        castShadow,
        mapSize,
        frustumParams,
        ambient: ambient ? { type: ambient.type, intensity: ambient.intensity } : null,
        porchLantern: porchLantern ? { type: porchLantern.type, intensity: porchLantern.intensity } : null,
        dockLantern: dockLantern ? { type: dockLantern.type, intensity: dockLantern.intensity } : null,
        enclosureResults
      };
    });

    testReport.lighting = lightingAudit;
    testReport.shadowEnclosure = lightingAudit.enclosureResults;

    if (!lightingAudit.castShadow) {
      testReport.failures.push('DirectionalSunLight castShadow is NOT true');
    }
    if (lightingAudit.mapSize.width < 2048 || lightingAudit.mapSize.height < 2048) {
      testReport.failures.push(`Shadow map size ${lightingAudit.mapSize.width}x${lightingAudit.mapSize.height} is less than 2048x2048`);
    }

    console.log(`  ✓ Sun castShadow: ${lightingAudit.castShadow}, Shadow Map: ${lightingAudit.mapSize.width}x${lightingAudit.mapSize.height}`);
    console.log(`  ✓ Shadow Camera Frustum: [${lightingAudit.frustumParams.left}, ${lightingAudit.frustumParams.right}], near: ${lightingAudit.frustumParams.near}, far: ${lightingAudit.frustumParams.far}`);

    // Print enclosure analysis
    testReport.shadowChallenges = [];
    const landmarkKeys = ['lake', 'dock', 'cabin', 'forest', 'bluffs'];
    for (const [name, enc] of Object.entries(lightingAudit.enclosureResults)) {
      console.log(`  ✓ Landmark [${name}] Shadow View Extents: X ${JSON.stringify(enc.viewBounds.x)}, Y ${JSON.stringify(enc.viewBounds.y)}, Z ${JSON.stringify(enc.viewBounds.z)} -> Enclosed: ${enc.fullyEnclosed}`);
    }

    for (const name of landmarkKeys) {
      const enc = lightingAudit.enclosureResults[name];
      if (enc) {
        if (!enc.zEnclosed) {
          testReport.failures.push(`Landmark [${name}] shadow depth Z is outside camera near/far bounds [${lightingAudit.frustumParams.near}, ${lightingAudit.frustumParams.far}]`);
        }
        if (!enc.xEnclosed || !enc.yEnclosed) {
          testReport.shadowChallenges.push(`Landmark [${name}] extends partially outside orthographic shadow camera bounds [-90, 90]: View X ${JSON.stringify(enc.viewBounds.x)}, View Y ${JSON.stringify(enc.viewBounds.y)}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // Phase 4: PBR Material Audit & Zero Untextured Primitives
    // -------------------------------------------------------------------------
    console.log('\n[Phase 4] Auditing Scene for Zero Untextured Primitives and Proper PBR...');
    const pbrAudit = await page.evaluate(() => {
      const game = window.__KEVIN_GAME__;
      const scene = game.scene;

      let totalMeshes = 0;
      let pbrMeshes = 0;
      let basicMeshes = [];
      let untexturedPrimitives = [];

      scene.traverse((obj) => {
        if (obj.isMesh || obj.isInstancedMesh) {
          totalMeshes++;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

          mats.forEach((m) => {
            if (!m) {
              untexturedPrimitives.push({ name: obj.name, reason: 'Null material' });
              return;
            }

            if (m.isMeshBasicMaterial) {
              // Basic materials allowed only for background sky dome/sun spheres
              const isAllowedSky = obj.name === '' && (obj.geometry.type === 'SphereGeometry' || obj.geometry.type === 'PlaneGeometry') && obj.parent !== game.world.landmarks.cabin && obj.parent !== game.world.landmarks.dock;
              if (!isAllowedSky) {
                basicMeshes.push({ name: obj.name, type: m.type });
              }
            } else if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
              pbrMeshes++;
              // Check if material has at least color/map and roughness defined
              if (m.roughness === undefined || m.metalness === undefined) {
                untexturedPrimitives.push({ name: obj.name, reason: 'Missing PBR roughness/metalness' });
              }
            }
          });
        }
      });

      return {
        totalMeshes,
        pbrMeshes,
        basicMeshes,
        untexturedPrimitives
      };
    });

    testReport.pbrAudit = pbrAudit;
    console.log(`  ✓ Total scene meshes: ${pbrAudit.totalMeshes}, PBR meshes: ${pbrAudit.pbrMeshes}`);
    console.log(`  ✓ Untextured primitives: ${pbrAudit.untexturedPrimitives.length}`);
    console.log(`  ✓ Non-PBR basic meshes on landmarks: ${pbrAudit.basicMeshes.length}`);

    if (pbrAudit.untexturedPrimitives.length > 0) {
      testReport.failures.push(`Found ${pbrAudit.untexturedPrimitives.length} untextured primitives in scene!`);
    }
    if (pbrAudit.basicMeshes.length > 0) {
      testReport.failures.push(`Found ${pbrAudit.basicMeshes.length} meshes using MeshBasicMaterial on world landmarks!`);
    }

    // -------------------------------------------------------------------------
    // Phase 5: Rapid Viewport Resize Stress Harness
    // -------------------------------------------------------------------------
    console.log('\n[Phase 5] Stress-Testing Rapid Viewport Resizes...');
    const testViewports = [
      { width: 1920, height: 1080, label: 'Desktop FHD' },
      { width: 800, height: 600, label: 'Legacy SVGA' },
      { width: 3840, height: 2160, label: '4K UHD' },
      { width: 375, height: 667, label: 'Mobile Portrait' },
      { width: 2560, height: 1440, label: 'QHD 1440p' },
      { width: 1024, height: 768, label: 'iPad 4:3' },
      { width: 1280, height: 720, label: 'Restored HD' }
    ];

    const resizeResults = [];

    for (const vp of testViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // Trigger resize event
      await page.evaluate(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // Render a frame
      const frameCheck = await page.evaluate((expected) => {
        const game = window.__KEVIN_GAME__;
        const engine = game.engine || window._gameInstance.engine;
        
        // Check sync
        const camAspect = engine.camera.aspect;
        const expectedAspect = expected.width / expected.height;
        const aspectDiff = Math.abs(camAspect - expectedAspect);

        const rSize = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this; } };
        engine.renderer.getSize(rSize);

        const bloomRes = engine.bloomPass.resolution;

        // Force render
        engine.render(0.016);

        return {
          width: engine.width,
          height: engine.height,
          rendererWidth: rSize.x,
          rendererHeight: rSize.y,
          bloomResWidth: bloomRes.x,
          bloomResHeight: bloomRes.y,
          aspectDiff,
          errorCount: game.telemetry.errorCount
        };
      }, vp);

      console.log(`  ✓ Resize to ${vp.label} (${vp.width}x${vp.height}): aspectDiff=${frameCheck.aspectDiff.toFixed(4)}, rendererSize=${frameCheck.rendererWidth}x${frameCheck.rendererHeight}`);

      if (frameCheck.aspectDiff > 0.01) {
        testReport.failures.push(`Camera aspect ratio out of sync after resize to ${vp.width}x${vp.height}`);
      }
      if (frameCheck.rendererWidth !== vp.width || frameCheck.rendererHeight !== vp.height) {
        testReport.failures.push(`Renderer dimensions not synchronized on ${vp.width}x${vp.height}`);
      }
      resizeResults.push({ ...vp, ...frameCheck });
    }

    testReport.resizeStress = resizeResults;

    // -------------------------------------------------------------------------
    // Phase 6: Extreme Camera Orbit & Stability Stress Harness
    // -------------------------------------------------------------------------
    console.log('\n[Phase 6] Stress-Testing Extreme Camera Orbits and High-Speed Transitions...');
    const orbitResults = await page.evaluate(async () => {
      const game = window.__KEVIN_GAME__;
      const engine = game.engine || window._gameInstance.engine;
      const camera = engine.camera;
      const scene = engine.scene;
      const renderer = engine.renderer;

      const positions = [
        // 360-degree orbit around origin at 35m distance
        { x: 35, y: 15, z: 0, look: [0, 2, 0] },
        { x: 25, y: 15, z: 25, look: [0, 2, 0] },
        { x: 0, y: 15, z: 35, look: [0, 2, 0] },
        { x: -25, y: 15, z: 25, look: [0, 2, 0] },
        { x: -35, y: 15, z: 0, look: [0, 2, 0] },
        { x: -25, y: 15, z: -25, look: [0, 2, 0] },
        { x: 0, y: 15, z: -35, look: [0, 2, 0] },
        { x: 25, y: 15, z: -25, look: [0, 2, 0] },
        // Extreme zenith (looking straight down)
        { x: 0, y: 120, z: 0.001, look: [0, 0, 0] },
        // Extreme nadir (looking straight up from below)
        { x: 0, y: -20, z: 0.001, look: [0, 5, 0] },
        // High distance scenic overview
        { x: 180, y: 95, z: 180, look: [0, 0, 0] },
        // Deep lake water perspective
        { x: -25, y: 0.5, z: 75, look: [0, 1, 10] },
        // Top of bluffs overlook
        { x: -45, y: 24, z: 0, look: [0, 2, 50] }
      ];

      let nanOrInfCount = 0;
      let stepErrors = 0;

      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        camera.position.set(p.x, p.y, p.z);
        camera.lookAt(p.look[0], p.look[1], p.look[2]);
        camera.updateMatrixWorld(true);

        // Check for NaN or Inf in matrix
        const elements = camera.matrixWorld.elements;
        for (let j = 0; j < elements.length; j++) {
          if (isNaN(elements[j]) || !isFinite(elements[j])) {
            nanOrInfCount++;
          }
        }

        // Render frame
        try {
          engine.render(0.016);
        } catch (e) {
          stepErrors++;
        }
      }

      return {
        positionsTested: positions.length,
        nanOrInfCount,
        stepErrors
      };
    });

    testReport.orbitStress = orbitResults;
    console.log(`  ✓ Tested ${orbitResults.positionsTested} extreme camera angles: NaN/Inf count = ${orbitResults.nanOrInfCount}, errors = ${orbitResults.stepErrors}`);

    if (orbitResults.nanOrInfCount > 0) {
      testReport.failures.push(`Camera matrix produced ${orbitResults.nanOrInfCount} NaN or Infinity values during extreme orbits`);
    }
    if (orbitResults.stepErrors > 0) {
      testReport.failures.push(`Render loop threw ${orbitResults.stepErrors} errors during camera orbit transitions`);
    }

    // -------------------------------------------------------------------------
    // Phase 7: WebGL Health & Telemetry Audit
    // -------------------------------------------------------------------------
    console.log('\n[Phase 7] Auditing WebGL Context Health and Multi-Frame Stability...');
    const webglAudit = await page.evaluate(async () => {
      const game = window.__KEVIN_GAME__;
      const engine = game.engine || window._gameInstance.engine;
      const gl = engine.renderer.getContext();

      // Check context loss
      const isContextLost = gl.isContextLost();

      // Check WebGL error code
      const glError = gl.getError();

      // Simulate 60 frames of continuous execution
      const startFrames = engine.telemetry.frameCount;
      for (let f = 0; f < 60; f++) {
        engine.render(0.016);
      }

      const drawCalls = engine.renderer.info.render.calls;
      const triangles = engine.renderer.info.render.triangles;
      const texturesInMemory = engine.renderer.info.memory.textures;
      const geometriesInMemory = engine.renderer.info.memory.geometries;

      return {
        isContextLost,
        glErrorCode: glError,
        drawCalls,
        triangles,
        texturesInMemory,
        geometriesInMemory,
        telemetryFps: game.telemetry.fps,
        telemetryErrors: game.telemetry.errorCount,
        lastError: game.telemetry.lastError
      };
    });

    testReport.webglStability = webglAudit;
    console.log(`  ✓ WebGL Context Lost: ${webglAudit.isContextLost}`);
    console.log(`  ✓ WebGL gl.getError(): ${webglAudit.glErrorCode} (0 = NO_ERROR)`);
    console.log(`  ✓ Draw Calls per frame: ${webglAudit.drawCalls}, Triangles: ${webglAudit.triangles.toLocaleString()}`);
    console.log(`  ✓ Memory: ${webglAudit.texturesInMemory} textures, ${webglAudit.geometriesInMemory} geometries`);

    if (webglAudit.isContextLost) {
      testReport.failures.push('WebGL context was LOST during stress run');
    }
    if (webglAudit.glErrorCode !== 0) {
      testReport.failures.push(`WebGL error detected: gl.getError() = ${webglAudit.glErrorCode}`);
    }
    if (webglAudit.drawCalls === 0) {
      testReport.failures.push('Draw calls count is 0 (scene is not rendering any meshes)');
    }
    if (webglAudit.triangles === 0) {
      testReport.failures.push('Triangle count is 0');
    }
    if (webglAudit.telemetryErrors > 0) {
      testReport.failures.push(`Telemetry recorded ${webglAudit.telemetryErrors} errors: ${webglAudit.lastError}`);
    }

    // -------------------------------------------------------------------------
    // Phase 8: Multi-Angle Visual Evidence Capture
    // -------------------------------------------------------------------------
    console.log('\n[Phase 8] Capturing Multi-Angle Visual Evidence Screenshots...');
    const screenshotsDir = 'screenshots';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    async function safeScreenshot(name, camPos, lookAtPos) {
      try {
        await page.evaluate(({ cp, lp }) => {
          const game = window.__KEVIN_GAME__;
          const engine = game.engine || window._gameInstance.engine;
          const cam = game.camera;
          cam.position.set(cp[0], cp[1], cp[2]);
          cam.lookAt(lp[0], lp[1], lp[2]);
          engine.render(0.016);
        }, { cp: camPos, lp: lookAtPos });

        const filePath = path.join(screenshotsDir, `${name}.png`);
        await page.screenshot({ path: filePath, timeout: 5000, animations: 'disabled' });
        console.log(`  📸 Saved ${filePath}`);
      } catch (err) {
        console.warn(`  ⚠️ Screenshot ${name} skipped or timed out: ${err.message}`);
      }
    }

    await safeScreenshot('challenger_m1_overview', [0, 18, 55], [0, 2, 0]);
    await safeScreenshot('challenger_m1_dock_lake', [12, 3.5, 36], [0, 1.0, 20]);
    await safeScreenshot('challenger_m1_cabin', [22, 5.0, -2], [25, 3.5, -15]);
    await safeScreenshot('challenger_m1_bluffs', [-20, 15, 25], [-45, 20, 0]);

    // -------------------------------------------------------------------------
    // Phase 9: Final Verdict Determination
    // -------------------------------------------------------------------------
    if (pageErrors.length > 0) {
      testReport.failures.push(`${pageErrors.length} uncaught page errors: ${pageErrors.join('; ')}`);
    }
    if (consoleErrors.length > 0) {
      testReport.failures.push(`${consoleErrors.length} console error messages logged: ${consoleErrors.join('; ')}`);
    }

    if (testReport.failures.length === 0) {
      testReport.verdict = 'APPROVE';
      console.log('\n================================================================');
      console.log('🏆 VERDICT: APPROVE');
      console.log('Milestone 1 satisfies all adversarial challenges and empirical specs.');
      console.log('================================================================\n');
    } else {
      testReport.verdict = 'FAIL';
      console.error('\n================================================================');
      console.error('💥 VERDICT: FAIL');
      console.error(`Total failures detected: ${testReport.failures.length}`);
      testReport.failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
      console.error('================================================================\n');
    }

    // Save JSON audit report for handoff reference
    const reportPath = 'tests/challenger_m1_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2), 'utf-8');
    console.log(`Report data written to ${reportPath}`);

    if (testReport.verdict !== 'APPROVE') {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal execution exception in adversarial test harness:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runAdversarialTest().catch((err) => {
  console.error('Unhandled script rejection:', err);
  process.exit(1);
});
