/**
 * tests/verify_m1_lighting_contract.mjs
 * Milestone 1 Automated Verification Script: Lighting, Shadows, Landmarks & window.__KEVIN_GAME__
 */

import { chromium } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const TIMEOUT_MS = 30000;

async function runVerification() {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting Milestone 1 Headless WebGL Verification`);
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`======================================================\n`);

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
  const errors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', message: err.message, stack: err.stack });
    console.error(`❌ [PageError]:`, err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
      console.error(`❌ [Console Error]:`, msg.text());
    } else {
      console.log(`ℹ️ [Browser Console]:`, msg.text());
    }
  });

  try {
    // 1. Connect to local server
    console.log(`[Step 1] Navigating to ${TARGET_URL}...`);
    const response = await page.goto(TARGET_URL, { waitUntil: 'load', timeout: TIMEOUT_MS });
    if (!response || response.status() !== 200) {
      throw new Error(`Failed to load ${TARGET_URL}, HTTP status: ${response ? response.status() : 'No response'}`);
    }
    console.log(`✅ HTTP 200 OK received.`);

    // 2. Wait for window.__KEVIN_GAME__.ready
    console.log(`[Step 2] Waiting for window.__KEVIN_GAME__.ready === true...`);
    await page.waitForFunction(() => {
      return window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready === true;
    }, { timeout: 15000 });
    console.log(`✅ window.__KEVIN_GAME__.ready is true.`);

    // 3. Inspect window.__KEVIN_GAME__ and Three.js scene graph
    console.log(`[Step 3] Inspecting scene graph, lighting, shadows and landmarks...`);
    const inspection = await page.evaluate(() => {
      const game = window.__KEVIN_GAME__;
      const scene = game.scene;
      const renderer = game.renderer;

      // Check Shadow Maps
      const shadowMapEnabled = renderer.shadowMap.enabled === true;
      const shadowMapType = renderer.shadowMap.type;

      // Find shadow casting lights
      const shadowCastingLights = [];
      scene.traverse((obj) => {
        if (obj.isLight && obj.castShadow === true) {
          shadowCastingLights.push({
            type: obj.type,
            name: obj.name,
            color: obj.color ? obj.color.getHexString() : null,
            intensity: obj.intensity,
            mapSize: obj.shadow ? { width: obj.shadow.mapSize.width, height: obj.shadow.mapSize.height } : null,
            bias: obj.shadow ? obj.shadow.bias : null,
            normalBias: obj.shadow ? obj.shadow.normalBias : null,
            frustum: obj.shadow && obj.shadow.camera ? {
              left: obj.shadow.camera.left,
              right: obj.shadow.camera.right,
              top: obj.shadow.camera.top,
              bottom: obj.shadow.camera.bottom,
              near: obj.shadow.camera.near,
              far: obj.shadow.camera.far
            } : null
          });
        }
      });

      // Check ambient fill and point lights
      const ambientLight = game.world && game.world.lights ? game.world.lights.ambient : null;
      const porchLantern = game.world && game.world.lights ? game.world.lights.porchLantern : null;
      const dockLantern = game.world && game.world.lights ? game.world.lights.dockLantern : null;

      // Check distinct landmarks
      const requiredLandmarks = ['lake', 'dock', 'cabin', 'forest', 'bluffs', 'shoreline'];
      const verifiedLandmarks = {};
      const landmarksDict = (game.world && game.world.landmarks) || game.landmarks || {};

      requiredLandmarks.forEach((key) => {
        const obj = landmarksDict[key];
        if (obj) {
          let meshCount = 0;
          let pbrCount = 0;
          let shadowReceiverCount = 0;
          let shadowCasterCount = 0;

          obj.traverse((child) => {
            if (child.isMesh) {
              meshCount++;
              const mat = child.material;
              if (mat) {
                const isPbr = mat.type === 'MeshStandardMaterial' || mat.type === 'MeshPhysicalMaterial' || mat.type === 'ShaderMaterial';
                if (isPbr) pbrCount++;
                if (child.receiveShadow) shadowReceiverCount++;
                if (child.castShadow) shadowCasterCount++;
              }
            }
          });

          verifiedLandmarks[key] = {
            found: true,
            meshCount,
            pbrCount,
            shadowReceiverCount,
            shadowCasterCount
          };
        } else {
          verifiedLandmarks[key] = { found: false };
        }
      });

      // Check telemetry
      const tel = game.telemetry || {};

      return {
        version: game.version,
        shadowMapEnabled,
        shadowMapType,
        shadowCastingLightsCount: shadowCastingLights.length,
        shadowCastingLights,
        ambientLight: ambientLight ? { type: ambientLight.type, intensity: ambientLight.intensity } : null,
        porchLantern: porchLantern ? { type: porchLantern.type, intensity: porchLantern.intensity } : null,
        dockLantern: dockLantern ? { type: dockLantern.type, intensity: dockLantern.intensity } : null,
        verifiedLandmarks,
        telemetry: {
          fps: tel.fps,
          errorCount: tel.errorCount,
          lastError: tel.lastError,
          drawCalls: tel.drawCalls,
          triangles: tel.triangles
        }
      };
    });

    console.log('\n--- Inspection Report ---');
    console.log(JSON.stringify(inspection, null, 2));

    // 4. Assertions
    const failures = [];

    if (!inspection.shadowMapEnabled) failures.push('Renderer shadowMap.enabled is false');
    if (inspection.shadowCastingLightsCount < 1) failures.push('Zero active shadow-casting lights found in scene');
    
    // Sun checks
    const sun = inspection.shadowCastingLights[0];
    if (sun) {
      if (sun.mapSize.width < 2048 || sun.mapSize.height < 2048) {
        failures.push(`Sun shadow map size ${sun.mapSize.width}x${sun.mapSize.height} is less than 2048x2048`);
      }
      if (sun.frustum.left > -70 || sun.frustum.right < 70) {
        failures.push(`Sun shadow camera frustum does not cover world bounds`);
      }
    }

    // Ambient fill check
    if (!inspection.ambientLight) failures.push('Ambient HemisphereLight is missing from world.lights');
    if (!inspection.porchLantern) failures.push('Porch lantern point light is missing from world.lights');

    // Landmarks check
    let foundLandmarks = 0;
    for (const [name, info] of Object.entries(inspection.verifiedLandmarks)) {
      if (info.found && info.meshCount > 0 && info.pbrCount > 0) {
        foundLandmarks++;
      } else {
        failures.push(`Landmark "${name}" is missing or lacks PBR meshes (found: ${info.found})`);
      }
    }
    if (foundLandmarks < 5) {
      failures.push(`Expected at least 5 distinct landmarks with PBR meshes, found ${foundLandmarks}`);
    }

    // Telemetry & Error Check
    if (errors.length > 0) failures.push(`${errors.length} uncaught page errors recorded`);
    if (consoleErrors.length > 0) failures.push(`${consoleErrors.length} console error logs recorded`);
    if (inspection.telemetry.errorCount > 0) failures.push(`Telemetry errorCount is ${inspection.telemetry.errorCount}`);

    // Wait a brief moment for scene rendering to stabilize
    await page.waitForTimeout(1000);

    // Take verification screenshot
    await page.screenshot({ path: 'screenshots/m1_lakeside_preview.png' });
    console.log('📸 Screenshot saved to screenshots/m1_lakeside_preview.png');

    if (failures.length > 0) {
      console.error('\n❌ Milestone 1 Verification FAILED with the following issues:');
      failures.forEach((f) => console.error(`  - ${f}`));
      process.exit(1);
    } else {
      console.log('\n🎉 ALL MILESTONE 1 VERIFICATION CHECKS PASSED PERFECTLY!');
      console.log(`- 5+ Distinct Landmarks verified with PBR materials (Lake, Dock, Cabin, Forest, Bluffs, Shoreline)`);
      console.log(`- Active 2048x2048 Directional Sun shadow casting verified`);
      console.log(`- Ambient HemisphereLight and Porch Lantern PointLight verified`);
      console.log(`- window.__KEVIN_GAME__ contract and telemetry verified`);
      console.log(`- Zero runtime errors recorded\n`);
    }

  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
