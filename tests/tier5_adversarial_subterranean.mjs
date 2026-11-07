/**
 * tests/tier5_adversarial_subterranean.mjs
 * 
 * Phase 2: Tier 5 Adversarial Coverage Hardening
 * White-Box Code Path & Invariant Stress Analysis
 * 
 * Focus Areas:
 * 1. Subterranean Hole Challenges & Rapid Boundary Transitions (crossing 50.0ft multiple times)
 * 2. Depth Kinetics & Variable Framerates (dt = 0.001s to 0.1s, launch impulse conservation)
 * 3. Geyser Particle Emitter Pool Exhaustion & TypedArray Invariants
 * 4. 600-Confetti Fireworks Burst Heap Retention & Golden Fever Stacking
 * 5. HUD Resilience & Needle Clamping Under Adversarial / Out-of-Bounds Depths
 * 6. World Terrain & Water Elevation Invariants (Normal map offset bounds, deep water clamp)
 * 7. WebGL Context Health, Memory Retention (Delta geometries/textures === 0), Zero Telemetry Errors
 */

import { chromium } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const TIMEOUT_MS = 60000;

async function runTier5AdversarialHardening() {
  console.log('========================================================================');
  console.log('🛡️  TIER 5 ADVERSARIAL COVERAGE HARDENING: WHITE-BOX INVARIANT SUITE');
  console.log(`Target URL: ${TARGET_URL}`);
  console.log('========================================================================\n');

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
  page.setDefaultTimeout(60000);

  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
    console.error('❌ [PageError]:', err.message);
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('❌ [ConsoleError]:', msg.text());
    }
  });

  const report = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function assert(condition, message, section = '') {
    report.total++;
    const prefix = section ? `[${section}] ` : '';
    if (condition) {
      report.passed++;
      console.log(`  ✅ [PASS] ${prefix}${message}`);
    } else {
      report.failed++;
      console.error(`  ❌ [FAIL] ${prefix}${message}`);
      report.failures.push(`${prefix}${message}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Initial Boot & Baseline Telemetry
    // -------------------------------------------------------------------------
    console.log('[Setup] Loading game and acquiring baseline renderer telemetry...');
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    assert(response && response.status() === 200, 'HTTP status is 200', 'Setup');

    await page.waitForFunction(() => {
      return window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready === true;
    }, { timeout: 45000 });

    const baseline = await page.evaluate(() => {
      const g = window.__KEVIN_GAME__;
      const r = g.renderer;
      return {
        ready: g.ready,
        geometries: r.info.memory.geometries,
        textures: r.info.memory.textures,
        calls: r.info.render.calls
      };
    });

    assert(baseline.ready === true, 'Engine ready verified', 'Setup');
    console.log(`  Baseline Geometries: ${baseline.geometries}, Textures: ${baseline.textures}`);

    // =========================================================================
    // SUITE 1: BOUNDARY TRANSITIONS & 50.0FT THRESHOLD RAPID OSCILLATION
    // =========================================================================
    console.log('\n========================================================================');
    console.log('🧪 SUITE 1: RAPID 50.0FT BOUNDARY THRESHOLD OSCILLATION & MULTI-ENTRY');
    console.log('========================================================================');

    const suite1Results = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;
      const hole = game.holeManager.getHoleById('hole_bluff_shaft');

      const results = {};

      // 1.1 Rapid depth oscillation across 50.0ft boundary (49.95ft <-> 50.05ft)
      let breachCount = 0;
      let nanEncountered = false;

      // Start in shaft at 49.9ft
      sub.enterHole('hole_bluff_shaft');
      
      for (let i = 0; i < 20; i++) {
        // Toggle depth across 50.0ft boundary:
        // 50ft = 15.24m below hole.position.y (22.0m) => Y = 6.76m
        // 49.9ft => Y = 6.79m
        // 50.1ft => Y = 6.73m
        const targetDepthFt = (i % 2 === 0) ? 49.9 : 50.1;
        const targetY = hole.position.y - (targetDepthFt * 0.3048);
        ctrl.position.y = targetY;
        ctrl.velocity.y = (i % 2 === 0) ? 2.0 : -2.0;

        // Run update cycle
        sub.update(0.016);

        if (sub.phase === 'breach_respawning') {
          breachCount++;
          // Fast-forward respawn timer to allow continued testing
          sub.respawnTimer = 0.0;
          sub.update(0.016);
          // Re-enter to continue stress test
          sub.enterHole('hole_bluff_shaft');
        }

        if (isNaN(ctrl.position.y) || isNaN(ctrl.velocity.y) || isNaN(sub.depthFt)) {
          nanEncountered = true;
        }
      }

      results.breachCount = breachCount;
      results.nanEncountered = nanEncountered;

      // 1.2 Consecutive re-entries immediately post-breach (10 successive breaches)
      ctrl.score = 2000;
      ctrl.oranges = 15;
      let clampedScoreValid = true;
      let clampedOrangesValid = true;

      for (let b = 0; b < 10; b++) {
        sub.enterHole('hole_bluff_shaft');
        // Force past 50ft
        ctrl.position.y = hole.position.y - (52.0 * 0.3048);
        sub.update(0.016);
        if (ctrl.score < 0) clampedScoreValid = false;
        if (ctrl.oranges < 0) clampedOrangesValid = false;
        // Complete respawn
        sub.respawnTimer = 0.0;
        sub.update(0.016);
      }

      results.clampedScoreValid = clampedScoreValid;
      results.clampedOrangesValid = clampedOrangesValid;
      results.finalScore = ctrl.score;
      results.finalOranges = ctrl.oranges;

      // 1.3 Rapid chaotic hole switching across all 4 landmark holes (40 interleaved calls)
      let phaseCorrupted = false;
      const holeIds = ['hole_shoreline', 'hole_dockside', 'hole_pine_root', 'hole_bluff_shaft'];
      for (let k = 0; k < 40; k++) {
        const hid = holeIds[k % holeIds.length];
        sub.enterHole(hid);
        sub.update(0.016);
        if (!['inactive', 'rejected', 'descending', 'geyser_propelled', 'mid_shaft_flight', 'breach_respawning'].includes(sub.phase)) {
          phaseCorrupted = true;
        }
      }

      // Reset cleanly to surface
      sub.completeRespawn(hole);
      results.phaseCorrupted = phaseCorrupted;
      results.finalPhase = sub.phase;

      return results;
    });

    assert(suite1Results.breachCount > 0, `Breach detected accurately on depth crossing (count: ${suite1Results.breachCount})`, 'Suite 1.1');
    assert(!suite1Results.nanEncountered, 'Zero NaN values during rapid 50ft threshold oscillation', 'Suite 1.1');
    assert(suite1Results.clampedScoreValid, `Score remains >= 0 during repeated penalty breaches (score: ${suite1Results.finalScore})`, 'Suite 1.2');
    assert(suite1Results.clampedOrangesValid, `Oranges remain >= 0 during repeated penalty breaches (oranges: ${suite1Results.finalOranges})`, 'Suite 1.2');
    assert(!suite1Results.phaseCorrupted, 'Subterranean phase machine never enters an undefined state during 40-hole chaos switching', 'Suite 1.3');
    assert(suite1Results.finalPhase === 'inactive', `Cleanly returns to inactive phase (current: ${suite1Results.finalPhase})`, 'Suite 1.3');

    // =========================================================================
    // SUITE 2: DEPTH KINETICS & VARIABLE FRAMERATES (dt STRESS)
    // =========================================================================
    console.log('\n========================================================================');
    console.log('⏱️  SUITE 2: DEPTH KINETICS UNDER VARIABLE FRAMERATES (dt EXTREMES)');
    console.log('========================================================================');

    const suite2Results = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;
      const results = { dtTests: [] };

      // Test geyser launch across 5 framerate conditions:
      // 1000 FPS (0.001s), 60 FPS (0.016s), 30 FPS (0.033s), 15 FPS (0.066s), 10 FPS (0.1s)
      const dtList = [0.001, 0.016, 0.033, 0.066, 0.1];

      for (const testDt of dtList) {
        sub.enterHole('hole_dockside');
        const hole = sub.activeHole;
        const bottomY = hole.position.y - (hole.depthFt * 0.3048);

        // Position at bottom to trigger geyser
        ctrl.position.y = bottomY + 0.15;
        ctrl.velocity.y = -1.0;
        sub.update(testDt);

        const geyserTriggered = (sub.phase === 'geyser_propelled');
        const initialLaunchV = ctrl.velocity.y;

        // Simulate flight upward until apex or emergence
        let apexY = ctrl.position.y;
        let surfaced = false;

        for (let step = 0; step < 500; step++) {
          ctrl.update(testDt);
          apexY = Math.max(apexY, ctrl.position.y);
          if (sub.phase === 'inactive' && ctrl.position.y >= hole.position.y) {
            surfaced = true;
            break;
          }
        }

        results.dtTests.push({
          dt: testDt,
          geyserTriggered,
          initialLaunchV,
          apexY,
          rimY: hole.position.y,
          surfaced,
          clearedRim: apexY > hole.position.y
        });
      }

      // High dt step while falling (dt = 0.1s at terminal velocity)
      sub.enterHole('hole_pine_root');
      ctrl.velocity.y = -9.0;
      sub.update(0.1);
      results.highDtFinite = !isNaN(ctrl.position.y) && isFinite(ctrl.position.y) && !isNaN(ctrl.velocity.y);

      // Zero & negative dt immunity test
      sub.update(0.0);
      results.zeroDtFinite = !isNaN(ctrl.position.y) && isFinite(ctrl.position.y);
      sub.update(-0.016);
      results.negativeDtFinite = !isNaN(ctrl.position.y) && isFinite(ctrl.position.y);

      // Clean reset
      sub.phase = 'inactive';
      sub.activeHole = null;

      return results;
    });

    for (const t of suite2Results.dtTests) {
      assert(t.geyserTriggered, `Geyser triggered at dt=${t.dt}s`, 'Suite 2.1');
      assert(t.clearedRim, `Impulse cleared rim at dt=${t.dt}s (Apex: ${t.apexY.toFixed(2)}m > Rim: ${t.rimY.toFixed(2)}m)`, 'Suite 2.1');
      assert(t.surfaced, `Player successfully surfaced and transitioned to inactive at dt=${t.dt}s`, 'Suite 2.1');
    }

    assert(suite2Results.highDtFinite, 'High dt (0.1s) descent step maintains finite position & velocity', 'Suite 2.2');
    assert(suite2Results.zeroDtFinite, 'Zero dt (0.0s) step handled without NaN or division by zero', 'Suite 2.3');
    assert(suite2Results.negativeDtFinite, 'Negative dt step handled without corruption', 'Suite 2.3');

    // =========================================================================
    // SUITE 3: GEYSER PARTICLE EMITTER POOL EXHAUSTION & TYPEDARRAY INTEGRITY
    // =========================================================================
    console.log('\n========================================================================');
    console.log('🫧 SUITE 3: GEYSER PARTICLE EMITTER BUFFER POOL EXHAUSTION STRESS');
    console.log('========================================================================');

    const suite3Results = await page.evaluate(async () => {
      const game = window._gameInstance;
      const emitter = game.geyserEmitter;

      const results = {};

      const initialPosLen = emitter.positions.length;
      const initialVelLen = emitter.velocities.length;
      const initialCapacity = emitter.capacity;

      // Hammer trigger 50 times in rapid succession
      let nanFound = false;
      for (let t = 0; t < 50; t++) {
        emitter.trigger({ x: 0, y: -6.0, z: 22.0 }, 28.0, t % 2 === 0);
        // Step a fraction of a frame
        emitter.update(0.01);
      }

      // Check for NaNs in Float32Arrays
      for (let i = 0; i < emitter.positions.length; i++) {
        if (isNaN(emitter.positions[i])) nanFound = true;
      }
      for (let i = 0; i < emitter.velocities.length; i++) {
        if (isNaN(emitter.velocities[i])) nanFound = true;
      }

      results.initialCapacity = initialCapacity;
      results.currentCapacity = emitter.capacity;
      results.positionsLengthUnchanged = (emitter.positions.length === initialPosLen);
      results.velocitiesLengthUnchanged = (emitter.velocities.length === initialVelLen);
      results.nanFound = nanFound;
      results.activeDuringBurst = emitter.active;

      // Step until all particles exhaust past burstTimer + maxLifetimes (~3.0s)
      for (let s = 0; s < 250; s++) {
        emitter.update(0.016);
      }
      results.cleanlyExhausted = !emitter.active;

      return results;
    });

    assert(suite3Results.positionsLengthUnchanged, 'Float32Array positions buffer length remained constant (zero reallocation)', 'Suite 3.1');
    assert(suite3Results.velocitiesLengthUnchanged, 'Float32Array velocities buffer length remained constant', 'Suite 3.1');
    assert(!suite3Results.nanFound, 'Zero NaN values across all 250 particle positions and velocities', 'Suite 3.1');
    assert(suite3Results.activeDuringBurst, 'Emitter maintained active status during rapid burst hammering', 'Suite 3.1');
    assert(suite3Results.cleanlyExhausted, 'Emitter active flag cleanly returned to false upon particle lifetime depletion', 'Suite 3.2');

    // =========================================================================
    // SUITE 4: 600-CONFETTI BURST HEAP RETENTION & GOLDEN FEVER STACKING
    // =========================================================================
    console.log('\n========================================================================');
    console.log('🎉 SUITE 4: 600-CONFETTI BURST HEAP RETENTION & GOLDEN FEVER STACKING');
    console.log('========================================================================');

    const suite4Results = await page.evaluate(async () => {
      const game = window._gameInstance;
      const confetti = game.confettiEmitter;
      const fever = game.goldenFeverManager;
      const renderer = game.renderer;

      const results = {};

      const geomBefore = renderer.info.memory.geometries;
      const texBefore = renderer.info.memory.textures;

      // 4.1 Trigger 30 consecutive 600-particle confetti explosions
      for (let e = 0; e < 30; e++) {
        confetti.explode({ x: 48.0, y: 3.5, z: -45.0 });
        confetti.update(0.016);
      }

      const geomAfterBursts = renderer.info.memory.geometries;
      const texAfterBursts = renderer.info.memory.textures;

      results.geomDelta = geomAfterBursts - geomBefore;
      results.texDelta = texAfterBursts - texBefore;
      results.confettiActive = confetti.active;

      // Check confetti physics convergence (drag and gravity)
      let confettiNanFound = false;
      for (let i = 0; i < confetti.positions.length; i++) {
        if (isNaN(confetti.positions[i])) confettiNanFound = true;
      }
      for (let i = 0; i < confetti.wobbles.length; i++) {
        if (isNaN(confetti.wobbles[i])) confettiNanFound = true;
      }
      results.confettiNanFound = confettiNanFound;

      // Step until all confetti finishes (~5 seconds)
      for (let s = 0; s < 350; s++) {
        confetti.update(0.016);
      }
      results.confettiEnded = !confetti.active;

      // 4.2 Golden Fever multi-activation stacking torture (25 rapid activations)
      const feverAuraChildrenBefore = fever.auraGroup.children.length;
      for (let a = 0; a < 25; a++) {
        fever.activate();
      }

      const feverAuraChildrenAfter = fever.auraGroup.children.length;
      results.auraChildrenDelta = feverAuraChildrenAfter - feverAuraChildrenBefore;
      results.speedMultiplierClamped = (fever.getSpeedMultiplier() === 2.0);
      results.scoreMultiplierClamped = (fever.getScoreMultiplier() === 2.0);
      results.timerReset = (fever.timer === 15.0);

      // Fast-forward to expiry
      fever.update(15.5);
      results.feverDeactivated = !fever.isActive;
      results.speedReset = (fever.getSpeedMultiplier() === 1.0);
      results.scoreReset = (fever.getScoreMultiplier() === 1.0);
      results.auraHidden = !fever.auraGroup.visible;

      return results;
    });

    assert(suite4Results.geomDelta === 0, `Confetti 30-burst stress added 0 leaked geometries (delta: ${suite4Results.geomDelta})`, 'Suite 4.1');
    assert(suite4Results.texDelta === 0, `Confetti 30-burst stress added 0 leaked textures (delta: ${suite4Results.texDelta})`, 'Suite 4.1');
    assert(!suite4Results.confettiNanFound, 'Zero NaN values in 600-particle confetti buffers and wobbles', 'Suite 4.1');
    assert(suite4Results.confettiEnded, 'Confetti emitter cleanly transitioned to inactive after lifespan', 'Suite 4.1');

    assert(suite4Results.auraChildrenDelta === 0, 'Golden Fever re-activation does not leak duplicate aura meshes/lights into scene graph', 'Suite 4.2');
    assert(suite4Results.speedMultiplierClamped, 'Speed multiplier clamped strictly at 2.0x during repeated activation', 'Suite 4.2');
    assert(suite4Results.scoreMultiplierClamped, 'Score multiplier clamped strictly at 2.0x during repeated activation', 'Suite 4.2');
    assert(suite4Results.timerReset, 'Golden Fever timer cleanly refreshed to 15.0s on re-activation', 'Suite 4.2');
    assert(suite4Results.feverDeactivated, 'Golden Fever cleanly deactivated after duration', 'Suite 4.2');
    assert(suite4Results.speedReset, 'Speed multiplier cleanly reset to 1.0x upon deactivation', 'Suite 4.2');
    assert(suite4Results.scoreReset, 'Score multiplier cleanly reset to 1.0x upon deactivation', 'Suite 4.2');
    assert(suite4Results.auraHidden, 'Aura group is hidden when inactive', 'Suite 4.2');

    // =========================================================================
    // SUITE 5: HUD RESILIENCE & DOM RETENTION UNDER STRESS
    // =========================================================================
    console.log('\n========================================================================');
    console.log('🖥️  SUITE 5: HUD NEEDLE CLAMPING & DOM TOAST RETENTION STRESS');
    console.log('========================================================================');

    const suite5Results = await page.evaluate(async () => {
      const game = window._gameInstance;
      const hud = game.hud;
      const results = {};

      // 5.1 Toast Flood Test & Clean Drain
      // First, wait for any in-flight toasts from previous suites to drain naturally
      const drainStart = Date.now();
      while (hud.elToastContainer && hud.elToastContainer.children.length > 0 && (Date.now() - drainStart) < 6000) {
        await new Promise(r => setTimeout(r, 100));
      }
      const baselineToastCount = hud.elToastContainer ? hud.elToastContainer.children.length : 0;

      // Now flood with 60 high-throughput toasts with 200ms lifespan
      for (let m = 0; m < 60; m++) {
        hud.showToast(`Adversarial stress toast message #${m}`, m % 2 === 0 ? 'bonus' : 'info', 200);
      }
      const peakToastCount = hud.elToastContainer ? hud.elToastContainer.children.length : 0;
      results.peakToastCount = peakToastCount;

      // Wait for all 60 toasts to self-prune via polling drain loop (eliminating timer jitter under load)
      const cleanupStart = Date.now();
      while (hud.elToastContainer && hud.elToastContainer.children.length > 0 && (Date.now() - cleanupStart) < 2500) {
        await new Promise(r => setTimeout(r, 50));
      }
      const postCleanupToastCount = hud.elToastContainer ? hud.elToastContainer.children.length : 0;
      results.cleanedToastCount = postCleanupToastCount;

      // 5.2 Adversarial Depth Gauge Needle Boundary Clamping
      // Needle scale is calibrated 0-90ft
      const needleTestDepths = [
        -25.0,  // Negative depth => clamp to 0%
        0.0,    // Surface => 0%
        7.5,    // Shallow => 8.33%
        22.0,   // Sweet spot => 24.44%
        50.0,   // Holy grail => 55.56%
        82.0,   // Deep bluff => 91.11%
        90.0,   // Max calibrated scale => 100%
        150.0,  // Far abyss => clamp to 100%
        500.0   // Extreme void => clamp to 100%
      ];

      const needleOutputs = [];
      for (const d of needleTestDepths) {
        hud.setSubterraneanDepth(true, d, d <= 50 ? 'sweet_spot' : 'deep');
        const needleTop = hud.elDepthNeedle ? hud.elDepthNeedle.style.top : '';
        const pct = parseFloat(needleTop) || 0;
        needleOutputs.push({ depth: d, needleTop, pct, validClamp: pct >= 0 && pct <= 100 });
      }
      results.needleOutputs = needleOutputs;

      // 5.3 Rapid Toggling of Subterranean HUD (30 toggles)
      for (let t = 0; t < 30; t++) {
        hud.setSubterraneanDepth(t % 2 === 0, 25.0, 'sweet_spot');
      }
      // Leave closed
      hud.setSubterraneanDepth(false);
      results.hudHiddenAtEnd = hud.elSubHud ? hud.elSubHud.classList.contains('hidden') : false;

      return results;
    });

    assert(suite5Results.peakToastCount >= 50, `Toast container accepted high-throughput toasts (peak: ${suite5Results.peakToastCount})`, 'Suite 5.1');
    assert(suite5Results.cleanedToastCount === 0, `All toast DOM elements cleanly removed by self-pruning timer (remaining: ${suite5Results.cleanedToastCount})`, 'Suite 5.1');

    for (const n of suite5Results.needleOutputs) {
      assert(n.validClamp, `Needle percentage clamped strictly in [0%, 100%] at depth ${n.depth}ft (computed: ${n.pct.toFixed(1)}%)`, 'Suite 5.2');
    }
    assert(suite5Results.hudHiddenAtEnd, 'Subterranean HUD cleanly hides after stress toggling', 'Suite 5.3');

    // =========================================================================
    // SUITE 6: WORLD TERRAIN & WATER INVARIANT STRESS
    // =========================================================================
    console.log('\n========================================================================');
    console.log('🌊 SUITE 6: WORLD TERRAIN HEIGHTFIELD & WATER NUMERIC INVARIANTS');
    console.log('========================================================================');

    const suite6Results = await page.evaluate(() => {
      const game = window._gameInstance;
      const terrain = game.worldManager.terrain;
      const lake = game.worldManager.lake;

      const results = {};

      // 6.1 Terrain elevation query across landmark coordinates & extremes
      const testCoords = [
        { x: 0, z: 0, name: 'Center' },
        { x: 25, z: -15, name: 'Cabin Clearing' },
        { x: -30, z: 12, name: 'Chasm Face' },
        { x: -45, z: 0, name: 'Rocky Bluffs' },
        { x: 48, z: -45, name: 'Pine Forest' },
        { x: 0, z: 25, name: 'Lake Basin' },
        { x: -500, z: -500, name: 'Far West Wilderness' },
        { x: 500, z: 500, name: 'Far East Wilderness' }
      ];

      let terrainFinite = true;
      const elevations = [];
      for (const pt of testCoords) {
        const h = terrain.getElevation(pt.x, pt.z);
        if (isNaN(h) || !isFinite(h)) {
          terrainFinite = false;
        }
        elevations.push({ name: pt.name, x: pt.x, z: pt.z, elev: h });
      }

      results.terrainFinite = terrainFinite;
      results.elevations = elevations;

      // 6.2 Water ripple normalMap offset wrapping invariant:
      // In lake.js: (time * 0.032) % 1.0 => offset must strictly remain in [0.0, 1.0)
      const simulatedTimes = [0, 10, 100, 1000, 10000, 86400]; // up to 24 hours of gameplay
      let waterOffsetValid = true;

      for (const t of simulatedTimes) {
        lake.update(0.016, t);
        const ox = lake.normalMap.offset.x;
        const oy = lake.normalMap.offset.y;
        if (isNaN(ox) || isNaN(oy) || ox < 0 || ox >= 1.0 || oy < 0 || oy >= 1.0) {
          waterOffsetValid = false;
        }
      }
      results.waterOffsetValid = waterOffsetValid;

      // 6.3 Deep water boundary clamping
      const waterTestPositions = [
        { x: 0, y: -4.0, z: 25.0 },    // Deep lake water
        { x: -25, y: -2.0, z: 75.0 },  // Center lake water
        { x: 25, y: -1.0, z: -15.0 }   // Cabin dry land (should NOT clamp)
      ];

      const clampedPosResults = [];
      for (const p of waterTestPositions) {
        const v = { x: p.x, y: p.y, z: p.z };
        lake.clampPosition(v);
        clampedPosResults.push({ originalY: p.y, clampedY: v.y });
      }
      results.clampedPosResults = clampedPosResults;

      return results;
    });

    assert(suite6Results.terrainFinite, 'Terrain getElevation returns finite, non-NaN heights across all landmark and extreme coordinates', 'Suite 6.1');
    for (const el of suite6Results.elevations) {
      console.log(`    ${el.name} (${el.x}, ${el.z}): ${el.elev.toFixed(2)}m`);
    }

    assert(suite6Results.waterOffsetValid, 'Lake normalMap texture offset remains strictly in [0.0, 1.0) range across 24h simulated time without numeric drift', 'Suite 6.2');
    assert(suite6Results.clampedPosResults[0].clampedY === 0.2, 'Deep water clamped submerged Y=-4.0m to safe waterline Y=0.2m', 'Suite 6.3');
    assert(suite6Results.clampedPosResults[1].clampedY === 0.2, 'Deep water clamped submerged Y=-2.0m to safe waterline Y=0.2m', 'Suite 6.3');
    assert(suite6Results.clampedPosResults[2].clampedY === -1.0, 'Dry land position untouched by water clamp', 'Suite 6.3');

    // =========================================================================
    // SUITE 7: WEBGL CONTEXT HEALTH, RENDERER LEAKS & TELEMETRY
    // =========================================================================
    console.log('\n========================================================================');
    console.log('🩺 SUITE 7: WEBGL CONTEXT HEALTH, MEMORY LEAKS & TELEMETRY ERROR AUDIT');
    console.log('========================================================================');

    const suite7Results = await page.evaluate(() => {
      const game = window._gameInstance;
      const renderer = game.renderer;
      const gl = renderer.getContext();
      const telemetry = game.telemetry;

      return {
        contextLost: gl.isContextLost(),
        glError: gl.getError(),
        currentGeometries: renderer.info.memory.geometries,
        currentTextures: renderer.info.memory.textures,
        telemetryErrorCount: telemetry.errorCount,
        lastError: telemetry.lastError
      };
    });

    assert(!suite7Results.contextLost, 'WebGL context is healthy and NOT lost', 'Suite 7.1');
    assert(suite7Results.glError === 0, 'WebGL gl.getError() returns NO_ERROR (0)', 'Suite 7.1');

    const totalGeomDelta = suite7Results.currentGeometries - baseline.geometries;
    const totalTexDelta = suite7Results.currentTextures - baseline.textures;
    assert(totalGeomDelta === 0, `Renderer geometry count maintained zero net leak across all stress suites (baseline: ${baseline.geometries}, current: ${suite7Results.currentGeometries}, delta: ${totalGeomDelta})`, 'Suite 7.2');
    assert(totalTexDelta === 0, `Renderer texture count maintained zero net leak across all stress suites (baseline: ${baseline.textures}, current: ${suite7Results.currentTextures}, delta: ${totalTexDelta})`, 'Suite 7.2');

    assert(suite7Results.telemetryErrorCount === 0, `Telemetry error trap recorded zero unhandled exceptions (found: ${suite7Results.telemetryErrorCount})`, 'Suite 7.3');
    assert(suite7Results.lastError === null, `Telemetry lastError is null (value: ${suite7Results.lastError})`, 'Suite 7.3');
    assert(pageErrors.length === 0, `Browser window pageerrors is 0 (found: ${pageErrors.length})`, 'Suite 7.3');
    assert(consoleErrors.length === 0, `Browser console.error messages is 0 (found: ${consoleErrors.length})`, 'Suite 7.3');

  } catch (err) {
    console.error('💥 Fatal error in Tier 5 stress harness:', err);
    report.failed++;
    report.failures.push(`Fatal: ${err.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log(`TIER 5 ADVERSARIAL STRESS SUITE COMPLETE`);
  console.log(`TOTAL ASSERTIONS: ${report.total}`);
  console.log(`PASSED:           ${report.passed}`);
  console.log(`FAILED:           ${report.failed}`);
  if (report.failed === 0) {
    console.log('🏆 VERDICT: GAP_FREE (100% PASS RATE - ZERO BUGS OR INVARIANT GAPS)');
  } else {
    console.log('❌ VERDICT: GAPS_FOUND');
    console.log('Failures:', report.failures);
  }
  console.log('========================================================================\n');

  if (report.failed > 0) {
    process.exit(1);
  }
}

runTier5AdversarialHardening();
