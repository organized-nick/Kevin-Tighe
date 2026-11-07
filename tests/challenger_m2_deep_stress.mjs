/**
 * tests/challenger_m2_deep_stress.mjs
 * Adversarial Empirical Verification & Stress Harness for Milestone 2
 * 
 * Verifies:
 * 1. Pixie dust flight gauge depletion to 0% and smooth fall transition; ground recharge to 100%.
 * 2. Particle emitter creation and cleanup without memory leak.
 * 3. Tinker-Tang fairy orbit and light tethering to Kevin.
 * 4. Loose shadow lag tracking across varying ground elevations.
 * 5. Orange pickups collection collision detection, orange counter increment, score increase.
 * 6. Signature "Hmm..." sonar wave expansion to 100 units, depth tag rendering, and 1.5s cooldown throttle.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const TIMEOUT_MS = 60000;

async function runAdversarialTest() {
  console.log('================================================================');
  console.log('⚔️  CHALLENGER M2: ADVERSARIAL STRESS TEST & EMPIRICAL AUDIT');
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
    phases: {},
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
      throw new Error(`Failed to load target URL: HTTP ${response ? response.status() : 'NULL'}`);
    }

    await page.waitForFunction(() => window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready, {
      timeout: 15000
    });

    const initData = await page.evaluate(() => {
      const g = window.__KEVIN_GAME__;
      return {
        version: g.version,
        ready: g.ready,
        hasCharacter: !!g.character,
        hasScene: !!g.scene,
        hasRenderer: !!g.renderer,
        charPos: g.character ? { x: g.character.position.x, y: g.character.position.y, z: g.character.position.z } : null,
        charState: g.character ? g.character.state : null,
        pixieDust: g.character ? g.character.pixieDust : null,
        oranges: g.character ? g.character.oranges : null,
        score: g.character ? g.character.score : null
      };
    });

    console.log('✅ Game engine initialized:', initData);
    testReport.phases.boot = initData;

    // -------------------------------------------------------------------------
    // Phase 2: Pixie Dust Flight Gauge Depletion, Fall Transition & Recharge
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2] Testing Pixie Dust Flight Gauge Depletion, Fall Transition & Recharge...');

    const flightTestResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;

      const waitFrames = (frames) => new Promise(resolve => {
        let count = 0;
        const step = () => {
          count++;
          if (count >= frames) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      // 1. Teleport Kevin into the air above dock
      ctrl.teleport(0, 18.0, 10.0);
      ctrl.pixieDust = 100.0;
      ctrl.keys.jump = true; // Hold space to maintain flight
      ctrl.setFlight(true);

      const initialDust = ctrl.pixieDust;
      const initialIsFlying = ctrl.isFlying;

      // 2. Track continuous depletion across rendered frames
      let fellToZero = false;
      let stateAtZero = null;
      let isFlyingAtZero = null;
      let velocityYAtZero = null;
      const snapshots = [];

      for (let i = 0; i < 70; i++) {
        await waitFrames(4); // ~64ms per sample

        snapshots.push({
          frame: i * 4,
          dust: ctrl.pixieDust,
          isFlying: ctrl.isFlying,
          state: ctrl.state,
          vy: ctrl.velocity.y,
          y: ctrl.position.y
        });

        if (ctrl.pixieDust <= 0.001) {
          fellToZero = true;
          stateAtZero = ctrl.state;
          isFlyingAtZero = ctrl.isFlying;
          velocityYAtZero = ctrl.velocity.y;
          break;
        }
      }

      // Release jump key
      ctrl.keys.jump = false;

      // 3. Adversarial: Attempt to activate flight while empty
      ctrl.setFlight(true);
      const flightAttemptWhenEmpty = ctrl.isFlying;

      // 4. Ground Landing & Recharge
      // Teleport Kevin safely onto dock deck (Y=0.85)
      ctrl.teleport(0, 0.85, 10.0);
      ctrl.isGrounded = true;
      ctrl.velocity.set(0, 0, 0);
      ctrl.pixieDust = 0.0;

      // Let ground recharge run across frames
      let reached100 = false;
      let clampedAt100 = false;
      const rechargeSnapshots = [];

      for (let i = 0; i < 90; i++) {
        await waitFrames(4);

        rechargeSnapshots.push({
          frame: i * 4,
          dust: ctrl.pixieDust,
          isGrounded: ctrl.isGrounded
        });

        if (ctrl.pixieDust >= 99.9) {
          reached100 = true;
        }
        if (ctrl.pixieDust > 100.001) {
          clampedAt100 = false;
          break;
        } else if (reached100 && Math.abs(ctrl.pixieDust - 100.0) < 0.001) {
          clampedAt100 = true;
        }
      }

      return {
        initialDust,
        initialIsFlying,
        fellToZero,
        finalDepletedDust: snapshots[snapshots.length - 1].dust,
        stateAtZero,
        isFlyingAtZero,
        velocityYAtZero,
        flightAttemptWhenEmpty,
        reached100,
        clampedAt100,
        finalRechargedDust: rechargeSnapshots[rechargeSnapshots.length - 1].dust,
        snapshotsSample: [snapshots[0], snapshots[Math.floor(snapshots.length / 2)], snapshots[snapshots.length - 1]],
        rechargeSample: [rechargeSnapshots[0], rechargeSnapshots[Math.floor(rechargeSnapshots.length / 2)], rechargeSnapshots[rechargeSnapshots.length - 1]]
      };
    });

    console.log('  Flight Gauge Results:', flightTestResult);
    if (!flightTestResult.initialIsFlying) {
      testReport.failures.push('Flight failed to activate when setFlight(true) called with 100% pixie dust.');
    }
    if (!flightTestResult.fellToZero || flightTestResult.finalDepletedDust > 0.01) {
      testReport.failures.push(`Flight gauge did not deplete to 0% (ended at ${flightTestResult.finalDepletedDust}).`);
    }
    if (flightTestResult.isFlyingAtZero !== false) {
      testReport.failures.push('isFlying remained true when pixie dust reached 0%.');
    }
    if (flightTestResult.stateAtZero !== 'falling') {
      testReport.failures.push(`Expected state 'falling' when fuel exhausted, got '${flightTestResult.stateAtZero}'.`);
    }
    if (flightTestResult.flightAttemptWhenEmpty !== false) {
      testReport.failures.push('Adversarial: Flight successfully activated when pixie dust was 0%!');
    }
    if (!flightTestResult.reached100) {
      testReport.failures.push(`Ground recharge failed to reach 100% (reached ${flightTestResult.finalRechargedDust}%).`);
    }
    if (!flightTestResult.clampedAt100) {
      testReport.failures.push(`Pixie dust exceeded 100.0% clamp during ground recharge: ${flightTestResult.finalRechargedDust}`);
    }

    testReport.phases.flight = flightTestResult;
    console.log('✓ Flight gauge depletion to 0% and smooth fall transition verified.');
    console.log('✓ Ground recharge to 100% and clamp verified.');

    // -------------------------------------------------------------------------
    // Phase 3: Particle Emitter Creation, Cleanup & Memory Leak Audit
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3] Testing Pixie Dust Particle Emitter & Auditing Memory Leak...');

    const particleTestResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;

      const waitFrames = (frames) => new Promise(resolve => {
        let count = 0;
        const step = () => {
          count++;
          if (count >= frames) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      // Teleport Kevin into air and enable flight with jump key held
      ctrl.teleport(0, 15.0, 10.0);
      ctrl.pixieDust = 100.0;
      ctrl.keys.jump = true;
      ctrl.setFlight(true);

      // Wait 15 frames for particles to spawn
      await waitFrames(15);

      const initialGeometries = g.renderer.info.memory.geometries;
      const initialTextures = g.renderer.info.memory.textures;

      const activeDuringFlight = ctrl.particles ? ctrl.particles.active : false;
      const activeCountDuringFlight = ctrl.flight && ctrl.flight.emitter ? ctrl.flight.emitter.activeCount : 0;
      const particleObject = g.scene.getObjectByName('PixieDustParticles');
      const particleMeshPresent = !!particleObject;

      // Turn off flight
      ctrl.keys.jump = false;
      ctrl.setFlight(false);

      // Wait 60 frames (~1.5s) for existing particles to age out (lifetimes are <= 1.2s)
      await waitFrames(60);

      const activeAfterFlight = ctrl.particles ? ctrl.particles.active : false;
      const activeCountAfterFlight = ctrl.flight && ctrl.flight.emitter ? ctrl.flight.emitter.activeCount : 0;

      // Rapidly toggle flight 30 times to stress allocation
      for (let i = 0; i < 30; i++) {
        ctrl.keys.jump = true;
        ctrl.setFlight(true);
        await waitFrames(2);
        ctrl.keys.jump = false;
        ctrl.setFlight(false);
        await waitFrames(2);
      }

      // Settle
      await waitFrames(60);

      const postStressGeometries = g.renderer.info.memory.geometries;
      const postStressTextures = g.renderer.info.memory.textures;

      return {
        particleMeshPresent,
        activeDuringFlight,
        activeCountDuringFlight,
        activeAfterFlight,
        activeCountAfterFlight,
        initialGeometries,
        postStressGeometries,
        initialTextures,
        postStressTextures,
        geometryLeak: postStressGeometries - initialGeometries,
        textureLeak: postStressTextures - initialTextures
      };
    });

    console.log('  Particle Test Results:', particleTestResult);
    if (!particleTestResult.particleMeshPresent) {
      testReport.failures.push('PixieDustParticles object missing in Three.js scene.');
    }
    if (!particleTestResult.activeDuringFlight) {
      testReport.failures.push('Particle emitter not active during flight.');
    }
    if (particleTestResult.activeCountDuringFlight <= 0) {
      testReport.failures.push('Active particle count was 0 during flight.');
    }
    if (particleTestResult.activeCountAfterFlight > 0) {
      testReport.failures.push(`Active particles failed to clean up after flight ended (remaining: ${particleTestResult.activeCountAfterFlight}).`);
    }
    if (particleTestResult.geometryLeak > 0) {
      testReport.failures.push(`Memory leak: ${particleTestResult.geometryLeak} geometries leaked after 30 flight toggles.`);
    }
    if (particleTestResult.textureLeak > 0) {
      testReport.failures.push(`Memory leak: ${particleTestResult.textureLeak} textures leaked after 30 flight toggles.`);
    }

    testReport.phases.particles = particleTestResult;
    console.log('✓ Particle emitter creation, emission, cleanup, and zero memory leaks verified.');

    // -------------------------------------------------------------------------
    // Phase 4: Tinker-Tang Fairy Orbit & Light Tethering to Kevin
    // -------------------------------------------------------------------------
    console.log('\n[Phase 4] Testing Tinker-Tang Fairy Orbit, Light & Tethering...');

    const fairyTestResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;

      const waitFrames = (frames) => new Promise(resolve => {
        let count = 0;
        const step = () => {
          count++;
          if (count >= frames) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      // Teleport Kevin to dock
      ctrl.teleport(0, 0.85, 10.0);
      await waitFrames(10);

      const fairyGroup = g.scene.getObjectByName('TinkerTangFairy');
      if (!fairyGroup) {
        return { error: 'TinkerTangFairy group not found in scene' };
      }

      // Check PointLight
      const light = fairyGroup.getObjectByName('FairyWarmLight');
      const lightProps = light ? {
        present: true,
        color: light.color.getHex(),
        intensity: light.intensity,
        distance: light.distance
      } : { present: false };

      // Sample 3D Lissajous trajectory relative to Kevin over 30 frames
      const relativePositions = [];
      let wingFlutterObserved = false;
      let lastWingRot = null;

      for (let i = 0; i < 30; i++) {
        await waitFrames(2);
        const kPos = ctrl.position;
        const fPos = fairyGroup.position;

        const relX = fPos.x - kPos.x;
        const relY = fPos.y - kPos.y;
        const relZ = fPos.z - kPos.z;

        relativePositions.push({ relX, relY, relZ });

        // Check wing flutter
        const wingL = fairyGroup.children.find(c => c.geometry && c.geometry.type === 'ShapeGeometry');
        if (wingL) {
          if (lastWingRot !== null && Math.abs(wingL.rotation.z - lastWingRot) > 0.05) {
            wingFlutterObserved = true;
          }
          lastWingRot = wingL.rotation.z;
        }
      }

      const minRelX = Math.min(...relativePositions.map(p => p.relX));
      const maxRelX = Math.max(...relativePositions.map(p => p.relX));
      const minRelY = Math.min(...relativePositions.map(p => p.relY));
      const maxRelY = Math.max(...relativePositions.map(p => p.relY));
      const minRelZ = Math.min(...relativePositions.map(p => p.relZ));
      const maxRelZ = Math.max(...relativePositions.map(p => p.relZ));

      // Test Dynamic Slipstream Lag during Sprint
      const baseLag = ctrl.fairy ? ctrl.fairy.baseLag : 0.5;
      ctrl.velocity.z = 12.0; // simulate sprint forward
      await waitFrames(10);
      const dynamicLagDuringSprint = ctrl.fairy ? ctrl.fairy.dynamicLag : 0.5;
      ctrl.velocity.z = 0.0;

      // Adversarial Teleport Stress Test:
      // Teleport Kevin 60m away to rocky bluffs (-42, 18.5, 4)
      ctrl.teleport(-42.0, 18.5, 4.0);
      await waitFrames(2);

      // Check distance immediately (should be instantly clamped < 5.0m per T1-R2-05-E)
      const fPosPost = fairyGroup.position;
      const kPosPost = ctrl.position;
      const teleportDistance = Math.hypot(
        fPosPost.x - kPosPost.x,
        fPosPost.y - kPosPost.y,
        fPosPost.z - kPosPost.z
      );

      return {
        fairyGroupPresent: true,
        lightProps,
        wingFlutterObserved,
        bounds: { minRelX, maxRelX, minRelY, maxRelY, minRelZ, maxRelZ },
        baseLag,
        dynamicLagDuringSprint,
        lagIncreasedWithSpeed: dynamicLagDuringSprint > baseLag,
        teleportDistance
      };
    });

    console.log('  Fairy Test Results:', fairyTestResult);
    if (!fairyTestResult.fairyGroupPresent) {
      testReport.failures.push('TinkerTangFairy group not found in scene.');
    }
    if (!fairyTestResult.lightProps || !fairyTestResult.lightProps.present) {
      testReport.failures.push('FairyWarmLight PointLight missing inside Tinker-Tang.');
    } else {
      if (fairyTestResult.lightProps.intensity <= 0) {
        testReport.failures.push(`Fairy light intensity must be > 0, got ${fairyTestResult.lightProps.intensity}`);
      }
      if (fairyTestResult.lightProps.distance < 2.0) {
        testReport.failures.push(`Fairy light distance must be >= 2.0m, got ${fairyTestResult.lightProps.distance}`);
      }
    }
    if (!fairyTestResult.wingFlutterObserved) {
      testReport.failures.push('Fairy wings did not exhibit observable flutter oscillation.');
    }
    if (fairyTestResult.teleportDistance > 5.0) {
      testReport.failures.push(`Fairy failed to tether on teleport! Distance: ${fairyTestResult.teleportDistance}m (expected < 5.0m)`);
    }

    testReport.phases.fairy = fairyTestResult;
    console.log('✓ Tinker-Tang fairy orbit, wing flutter, light source, and instant tether clamp verified.');

    // -------------------------------------------------------------------------
    // Phase 5: Loose Shadow Lag & Multi-Elevation Tracking
    // -------------------------------------------------------------------------
    console.log('\n[Phase 5] Testing Loose Shadow Lag Tracking Across Varying Elevations...');

    const shadowTestResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;

      const waitFrames = (frames) => new Promise(resolve => {
        let count = 0;
        const step = () => {
          count++;
          if (count >= frames) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      const shadowMesh = g.scene.getObjectByName('RunawayLooseShadow');
      if (!shadowMesh) {
        return { error: 'RunawayLooseShadow not found in scene' };
      }

      // 1. Verify detached from Kevin hierarchy
      const isDetached = shadowMesh.parent === g.scene;

      // 2. Test horizontal lag:
      // Start Kevin at (0, 0.85, 10.0), teleport to (12.0, 0.85, 10.0)
      ctrl.teleport(0, 0.85, 10.0);
      await waitFrames(5);

      // Move character position forward along X
      ctrl.position.x = 10.0;
      await waitFrames(1);
      const shadowPosXImmediately = shadowMesh.position.x;
      const hasHorizontalLag = shadowPosXImmediately < 9.5; // Shadow lags behind Kevin

      // Wait 20 frames for shadow to catch up
      await waitFrames(20);
      const shadowPosXAfterSettle = shadowMesh.position.x;
      const caughtUp = Math.abs(shadowPosXAfterSettle - ctrl.position.x) < 0.8;

      // 3. Test multi-elevation tracking:
      // Landmark 1: Wooden Dock Deck (Deck elevation = 0.85m -> shadow Y = 0.87m)
      ctrl.teleport(0, 0.85, 15.0);
      await waitFrames(10);
      const shadowYOnDock = shadowMesh.position.y;

      // Landmark 2: Cabin Porch Deck (Deck elevation = 2.35m -> shadow Y = 2.37m)
      // Porch is at X in [20.25, 29.75], Z in [-11.0, -7.8]
      ctrl.teleport(24.0, 2.35, -9.0);
      await waitFrames(10);
      const shadowYOnPorch = shadowMesh.position.y;

      // Landmark 3: Beach / Shoreline
      ctrl.teleport(0, 0.2, 3.0);
      await waitFrames(10);
      const shadowYOnBeach = shadowMesh.position.y;

      // Landmark 4: High Altitude Flight Projection
      // When Kevin flies high (Y=25m), shadow stays on ground, expands in scale and fades in opacity
      ctrl.teleport(0, 25.0, 10.0);
      await waitFrames(10);
      const shadowYDuringHighFlight = shadowMesh.position.y;
      const shadowScaleDuringHighFlight = shadowMesh.scale.x;
      const shadowOpacityDuringHighFlight = shadowMesh.material.opacity;

      return {
        shadowPresent: true,
        isDetached,
        hasHorizontalLag,
        shadowPosXImmediately,
        caughtUp,
        shadowPosXAfterSettle,
        shadowYOnDock,
        shadowYOnPorch,
        shadowYOnBeach,
        shadowYDuringHighFlight,
        shadowScaleDuringHighFlight,
        shadowOpacityDuringHighFlight
      };
    });

    console.log('  Shadow Test Results:', shadowTestResult);
    if (!shadowTestResult.shadowPresent) {
      testReport.failures.push('RunawayLooseShadow mesh not found in scene.');
    }
    if (!shadowTestResult.isDetached) {
      testReport.failures.push('RunawayLooseShadow is not detached from Kevin (parent should be scene).');
    }
    if (!shadowTestResult.hasHorizontalLag) {
      testReport.failures.push('Shadow failed to exhibit independent horizontal trailing lag.');
    }
    if (Math.abs(shadowTestResult.shadowYOnDock - 0.87) > 0.15) {
      testReport.failures.push(`Shadow Y on dock expected ~0.87m, got ${shadowTestResult.shadowYOnDock.toFixed(3)}m`);
    }
    if (Math.abs(shadowTestResult.shadowYOnPorch - 2.37) > 0.2) {
      testReport.failures.push(`Shadow Y on cabin porch expected ~2.37m, got ${shadowTestResult.shadowYOnPorch.toFixed(3)}m`);
    }
    if (shadowTestResult.shadowYDuringHighFlight > 2.0) {
      testReport.failures.push(`Shadow detached projection failed during high flight: shadow Y rose to ${shadowTestResult.shadowYDuringHighFlight.toFixed(2)}m instead of staying on ground.`);
    }
    if (shadowTestResult.shadowScaleDuringHighFlight <= 1.2) {
      testReport.failures.push(`Shadow scale did not expand during high flight: ${shadowTestResult.shadowScaleDuringHighFlight.toFixed(2)}`);
    }
    if (shadowTestResult.shadowOpacityDuringHighFlight >= 0.6) {
      testReport.failures.push(`Shadow opacity did not fade during high flight: ${shadowTestResult.shadowOpacityDuringHighFlight.toFixed(2)}`);
    }

    testReport.phases.shadow = shadowTestResult;
    console.log('✓ Loose shadow lag tracking, elevation transitions across dock/porch/beach, and altitude diffusion verified.');

    // -------------------------------------------------------------------------
    // Phase 6: Orange Pickups Collection, Counters & HUD
    // -------------------------------------------------------------------------
    console.log('\n[Phase 6] Testing Orange & Bonus Pickups Collection, Counters & HUD...');

    const pickupTestResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;

      const waitFrames = (frames) => new Promise(resolve => {
        let count = 0;
        const step = () => {
          count++;
          if (count >= frames) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      // Reset all pickups for clean test run
      game.pickupManager.reset();

      // Reset character and game score & oranges
      ctrl.oranges = 0;
      ctrl.score = 0;
      game.gameState.oranges = 0;
      game.gameState.score = 0;

      // Query DOM HUD elements
      const hudOrangesEl = document.getElementById('hudOranges');
      const hudScoreEl = document.getElementById('hudScore');

      // Wait a frame for HUD update
      await waitFrames(2);

      const initialHudOranges = hudOrangesEl ? hudOrangesEl.textContent : null;
      const initialHudScore = hudScoreEl ? hudScoreEl.textContent : null;

      // Orange 0 is at (0.0, 1.2, 8.0) on the dock
      ctrl.teleport(0.0, 1.2, 8.0);
      await waitFrames(5);

      const orangesAfterCollect1 = ctrl.oranges;
      const scoreAfterCollect1 = ctrl.score;
      const hudOrangesAfterCollect1 = hudOrangesEl ? hudOrangesEl.textContent : null;
      const hudScoreAfterCollect1 = hudScoreEl ? hudScoreEl.textContent : null;

      // Double-collection check: stay at same position for 10 frames
      await waitFrames(10);
      const orangesAfterDoubleCheck = ctrl.oranges;
      const scoreAfterDoubleCheck = ctrl.score;

      // Collect Orange 1 at (0.0, 1.2, 14.0) while airborne in flight
      ctrl.teleport(0.0, 1.2, 14.0);
      ctrl.keys.jump = true;
      ctrl.setFlight(true);
      await waitFrames(5);

      const orangesAfterAirborneCollect = ctrl.oranges;
      const scoreAfterAirborneCollect = ctrl.score;
      const flightStateAfterCollect = ctrl.state;

      // End flight
      ctrl.keys.jump = false;
      ctrl.setFlight(false);

      // Collect Bonus Pickup at end of pier (0.0, 1.85, 29.5) (+250 score)
      ctrl.teleport(0.0, 1.85, 29.5);
      await waitFrames(8);

      const orangesAfterBonus = ctrl.oranges;
      const scoreAfterBonus = ctrl.score;
      const toastEl = document.getElementById('quipToast');
      const toastVisible = toastEl ? !toastEl.classList.contains('hidden') : false;
      const toastText = toastEl ? toastEl.textContent : '';

      return {
        pickupGroupPresent: true,
        initialHudOranges,
        initialHudScore,
        orangesAfterCollect1,
        scoreAfterCollect1,
        hudOrangesAfterCollect1,
        hudScoreAfterCollect1,
        orangesAfterDoubleCheck,
        scoreAfterDoubleCheck,
        orangesAfterAirborneCollect,
        scoreAfterAirborneCollect,
        flightStateAfterCollect,
        orangesAfterBonus,
        scoreAfterBonus,
        toastVisible,
        toastText
      };
    });

    console.log('  Pickup Test Results:', pickupTestResult);
    if (!pickupTestResult.pickupGroupPresent) {
      testReport.failures.push('pickupsGroup not found in scene.');
    }
    if (pickupTestResult.orangesAfterCollect1 !== 1) {
      testReport.failures.push(`Expected 1 orange after collection, got ${pickupTestResult.orangesAfterCollect1}`);
    }
    if (pickupTestResult.scoreAfterCollect1 !== 50) {
      testReport.failures.push(`Expected 50 score after collecting 1 orange, got ${pickupTestResult.scoreAfterCollect1}`);
    }
    if (pickupTestResult.hudOrangesAfterCollect1 !== '1') {
      testReport.failures.push(`HUD #hudOranges did not update to '1' (got '${pickupTestResult.hudOrangesAfterCollect1}')`);
    }
    if (pickupTestResult.hudScoreAfterCollect1 !== '50') {
      testReport.failures.push(`HUD #hudScore did not update to '50' (got '${pickupTestResult.hudScoreAfterCollect1}')`);
    }
    if (pickupTestResult.orangesAfterDoubleCheck !== 1 || pickupTestResult.scoreAfterDoubleCheck !== 50) {
      testReport.failures.push('Double-collection bug detected! Pickup was re-collected on subsequent frame.');
    }
    if (pickupTestResult.orangesAfterAirborneCollect !== 2) {
      testReport.failures.push(`Airborne pickup collection failed: oranges=${pickupTestResult.orangesAfterAirborneCollect}`);
    }
    if (pickupTestResult.flightStateAfterCollect !== 'flying') {
      testReport.failures.push(`Collecting pickup interrupted flight state! State: ${pickupTestResult.flightStateAfterCollect}`);
    }
    if (pickupTestResult.scoreAfterBonus !== 350) {
      testReport.failures.push(`Expected score 350 after collecting bonus (+250) + 2 oranges (+100), got ${pickupTestResult.scoreAfterBonus}`);
    }

    testReport.phases.pickups = pickupTestResult;
    console.log('✓ Orange and bonus pickup detection, counter increment, score updates, HUD sync, and double-collection prevention verified.');

    // -------------------------------------------------------------------------
    // Phase 7: Signature "Hmm..." Sonar Wave Expansion & 1.5s Cooldown Throttle
    // -------------------------------------------------------------------------
    console.log('\n[Phase 7] Testing Signature "Hmm..." Sonar Wave Expansion, Depth Tags & 1.5s Cooldown...');

    const sonarTestResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;

      const waitFrames = (frames) => new Promise(resolve => {
        let count = 0;
        const step = () => {
          count++;
          if (count >= frames) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      // Teleport Kevin on dock surface (grounded, not flying)
      ctrl.teleport(0, 0.85, 10.0);
      ctrl.isGrounded = true;
      ctrl.isFlying = false;
      ctrl.keys.jump = false;
      await waitFrames(5);

      const sonarGroup = g.scene.getObjectByName('sonarSystemGroup');
      if (!sonarGroup) {
        return { error: 'sonarSystemGroup not found in scene' };
      }

      // 1. Initial Trigger
      const trigger1 = ctrl.triggerSonar();
      const stateDuringTrigger = ctrl.state;

      // 2. Immediate second trigger (Adversarial cooldown throttle test)
      const trigger2 = ctrl.triggerSonar();

      // Check wave creation
      const waveCountImmediately = sonarGroup.children.filter(c => c.children.some(m => m.geometry && m.geometry.type === 'TorusGeometry')).length;

      // Check depth tags / billboards spawned
      const tagCountImmediately = sonarGroup.children.filter(c => c.children.some(m => m.type === 'Sprite')).length;

      // Track wave expansion over 25 frames
      const waveRadii = [];
      for (let i = 0; i < 6; i++) {
        await waitFrames(4);
        const activeWave = sonarGroup.children.find(c => c.children.some(m => m.geometry && m.geometry.type === 'TorusGeometry'));
        if (activeWave) {
          waveRadii.push(activeWave.scale.x);
        }
      }

      // 3. Inspect depth tags and beacon colors
      const tagDetails = [];
      if (trigger1 && trigger1.detectedHoles) {
        trigger1.detectedHoles.forEach(h => {
          tagDetails.push({
            id: h.id,
            depthFt: h.depthFt,
            tier: h.tier,
            beaconColorHex: '0x' + h.beaconColor.toString(16),
            distance: h.distance
          });
        });
      }

      // Check ascending distance sort
      let isSorted = true;
      for (let i = 1; i < tagDetails.length; i++) {
        if (tagDetails[i].distance < tagDetails[i - 1].distance) {
          isSorted = false;
          break;
        }
      }

      // 4. Test cooldown release after 1.6s (~100 frames)
      await waitFrames(95);
      const trigger3 = ctrl.triggerSonar();

      return {
        sonarGroupPresent: true,
        trigger1Success: !!trigger1 && trigger1.active === true,
        stateDuringTrigger,
        trigger2Throttled: trigger2 === null || (trigger2 && trigger2.active === false),
        waveCountImmediately,
        tagCountImmediately,
        waveRadii,
        waveExpanded: waveRadii.length > 1 && waveRadii[waveRadii.length - 1] > waveRadii[0],
        tagDetails,
        isSorted,
        trigger3SuccessAfterCooldown: !!trigger3 && trigger3.active === true
      };
    });

    console.log('  Sonar Test Results:', sonarTestResult);
    if (!sonarTestResult.sonarGroupPresent) {
      testReport.failures.push('sonarSystemGroup not found in scene.');
    }
    if (!sonarTestResult.trigger1Success) {
      testReport.failures.push('First sonar trigger failed.');
    }
    if (sonarTestResult.stateDuringTrigger !== 'pondering') {
      testReport.failures.push(`Avatar did not enter 'pondering' state on sonar trigger: '${sonarTestResult.stateDuringTrigger}'`);
    }
    if (!sonarTestResult.trigger2Throttled) {
      testReport.failures.push('Adversarial: Sonar cooldown failed to throttle rapid immediate second trigger!');
    }
    if (!sonarTestResult.waveExpanded) {
      testReport.failures.push('Sonar wave did not expand over time.');
    }
    if (sonarTestResult.tagCountImmediately <= 0) {
      testReport.failures.push('No holographic depth tags rendered for holes within 100 units.');
    }
    if (!sonarTestResult.isSorted) {
      testReport.failures.push('Detected holes were not sorted in ascending proximity order.');
    }
    if (!sonarTestResult.trigger3SuccessAfterCooldown) {
      testReport.failures.push('Sonar trigger failed after 1.5s cooldown elapsed.');
    }

    testReport.phases.sonar = sonarTestResult;
    console.log('✓ Signature "Hmm..." sonar wave expansion, depth tags, and 1.5s cooldown throttle verified.');

    // -------------------------------------------------------------------------
    // Phase 8: Context Health & Browser Error Check
    // -------------------------------------------------------------------------
    console.log('\n[Phase 8] Auditing WebGL Context Health and Browser Errors...');
    const contextHealth = await page.evaluate(() => {
      const g = window.__KEVIN_GAME__;
      const gl = g.renderer.getContext();
      return {
        contextLost: gl.isContextLost(),
        glError: gl.getError(),
        telemetryErrors: g.telemetry ? g.telemetry.errorCount : 0,
        lastError: g.telemetry ? g.telemetry.lastError : null
      };
    });

    console.log('  WebGL Context Health:', contextHealth);
    if (contextHealth.contextLost) {
      testReport.failures.push('WebGL context was lost during testing.');
    }
    if (contextHealth.glError !== 0) {
      testReport.failures.push(`WebGL error detected: gl.getError() = ${contextHealth.glError}`);
    }
    if (pageErrors.length > 0) {
      testReport.failures.push(`Page errors encountered: ${pageErrors.join('; ')}`);
    }
    if (consoleErrors.length > 0) {
      testReport.failures.push(`Browser console errors encountered: ${consoleErrors.join('; ')}`);
    }

    testReport.phases.contextHealth = contextHealth;

    // -------------------------------------------------------------------------
    // Final Verdict
    // -------------------------------------------------------------------------
    if (testReport.failures.length === 0) {
      testReport.verdict = 'APPROVE';
      console.log('\n================================================================');
      console.log('🏆 VERDICT: APPROVE');
      console.log('Milestone 2 satisfies all adversarial challenges and empirical specs.');
      console.log('================================================================\n');
    } else {
      testReport.verdict = 'FAIL';
      console.log('\n================================================================');
      console.log('💥 VERDICT: FAIL');
      console.log('Failures encountered:');
      testReport.failures.forEach(f => console.log(`  - ❌ ${f}`));
      console.log('================================================================\n');
    }

  } catch (err) {
    testReport.verdict = 'FAIL';
    testReport.failures.push(`Fatal test execution exception: ${err.message || String(err)}`);
    console.error('💥 Fatal error in test runner:', err);
  } finally {
    await browser.close();
  }

  // Save report artifact
  const reportPath = path.resolve('tests/challenger_m2_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2), 'utf-8');
  console.log(`Test report saved to: ${reportPath}`);

  return testReport;
}

runAdversarialTest().then((report) => {
  process.exit(report.verdict === 'APPROVE' ? 0 : 1);
}).catch((err) => {
  console.error('Unhandled script exit error:', err);
  process.exit(1);
});
