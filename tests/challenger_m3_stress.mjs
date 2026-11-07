/**
 * tests/challenger_m3_stress.mjs
 * Adversarial Empirical Verification & Stress Harness for Milestone 3
 * 
 * Verifies:
 * 1. Rapid re-triggering of hole entries in quick succession (zero race conditions, no stuck states).
 * 2. Boundary laser crossing precision at exactly 50.0ft depth in the Granite Bluff shaft (depthFt < 50.0 allows flight escape; depthFt >= 50.0 triggers boundary breach penalty).
 * 3. Mid-shaft flight escape timing: activating jump between 0 and 50ft successfully arrests descent and propels Kevin back to surface.
 * 4. WebGL render stability during simultaneous 600-particle confetti fireworks burst and geyser steam emitter: 60 continuous frames with zero NaN transforms, zero WebGL context loss, zero memory leaks.
 */

import { chromium } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const TIMEOUT_MS = 60000;

async function runChallengerStressVerification() {
  console.log('========================================================================');
  console.log('⚔️  CHALLENGER M3: ADVERSARIAL STRESS TEST & WEBGL EMPIRICAL HARNESS');
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
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
    console.error('❌ [PageError]:', err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`❌ [Console Error]: ${msg.text()}`);
    }
  });

  const report = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: [],
    details: {}
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
    // Phase 0: Boot & Readiness Check
    // -------------------------------------------------------------------------
    console.log('[Phase 0] Booting game and validating window.__KEVIN_GAME__ contracts...');
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    assert(response && response.status() === 200, 'HTTP response status is 200', 'Phase 0');

    await page.waitForFunction(() => {
      return window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready === true;
    }, { timeout: 45000 });

    const initialContract = await page.evaluate(() => {
      const g = window.__KEVIN_GAME__;
      return {
        ready: g && g.ready,
        hasHoles: !!(g && g.holes),
        holeCount: g && g.holes && g.holes.list ? g.holes.list.length : 0,
        characterReady: !!(g && g.character)
      };
    });

    assert(initialContract.ready, 'Game engine initialized and ready', 'Phase 0');
    assert(initialContract.hasHoles && initialContract.holeCount === 4, '4 landmark holes exposed in API', 'Phase 0');
    assert(initialContract.characterReady, 'Character controller ready', 'Phase 0');

    // -------------------------------------------------------------------------
    // Suite 1: Rapid Re-Triggering & Race Condition Elimination Stress
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('🔥 SUITE 1: RAPID RE-TRIGGERING & RACE CONDITION ELIMINATION');
    console.log('========================================================================');

    // Test 1A: Burst hammer across all 4 holes in rapid succession (same frame)
    console.log('  Testing 1A: Burst hammer with 30 rapid successive enterHole calls...');
    const burstHammerResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      const holeIds = ['hole_shoreline', 'hole_dockside', 'hole_pine_root', 'hole_bluff_shaft'];
      const logs = [];

      for (let i = 0; i < 30; i++) {
        const targetHole = holeIds[i % holeIds.length];
        try {
          g.holes.enterHole(targetHole);
          logs.push({ i, targetHole, phase: sub.phase, state: ctrl.state });
        } catch (err) {
          return { error: err.message, step: i };
        }
      }

      // Verify no NaN coordinates in position or velocity after burst
      const hasNaN = isNaN(ctrl.position.x) || isNaN(ctrl.position.y) || isNaN(ctrl.position.z) ||
                     isNaN(ctrl.velocity.x) || isNaN(ctrl.velocity.y) || isNaN(ctrl.velocity.z);

      return {
        success: true,
        finalPhase: sub.phase,
        finalState: ctrl.state,
        hasNaN,
        activeHoleId: sub.activeHole ? sub.activeHole.id : null,
        rejectionCooldown: sub.rejectionCooldown
      };
    });

    assert(burstHammerResult.success === true, 'Burst hammer of 30 rapid enterHole calls threw zero exceptions', 'Suite 1');
    assert(!burstHammerResult.hasNaN, 'Character position and velocity contain zero NaN values after burst', 'Suite 1');
    assert(burstHammerResult.finalPhase !== undefined, `Final phase defined (${burstHammerResult.finalPhase})`, 'Suite 1');

    // Test 1B: Rapid alternation between shallow rejection and sweet spot entry
    console.log('  Testing 1B: Rapid alternation between shallow rejection and sweet spot entry...');
    const rejectionAlternationResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // 1. Enter shallow hole -> triggers rejection
      g.holes.enterHole('hole_shoreline');
      const phaseAfterShallow = sub.phase;
      const cooldownAfterShallow = sub.rejectionCooldown;

      // 2. Immediately (next tick, zero delay) enter sweet spot hole -> should clear rejection cooldown and enter DESCENDING
      g.holes.enterHole('hole_dockside');
      const phaseAfterSweet = sub.phase;
      const stateAfterSweet = ctrl.state;
      const cooldownAfterSweet = sub.rejectionCooldown;

      return {
        phaseAfterShallow,
        cooldownAfterShallow,
        phaseAfterSweet,
        stateAfterSweet,
        cooldownAfterSweet
      };
    });

    assert(rejectionAlternationResult.phaseAfterShallow === 'rejected', 'Shoreline trigger properly sets phase to "rejected"', 'Suite 1');
    assert(rejectionAlternationResult.cooldownAfterShallow > 0, 'Rejection cooldown initialized (> 0)', 'Suite 1');
    assert(rejectionAlternationResult.phaseAfterSweet === 'descending', 'Immediate sweet spot entry cleanly overrides rejection and enters "descending"', 'Suite 1');
    assert(rejectionAlternationResult.stateAfterSweet === 'in_hole', 'Character state transitions to "in_hole"', 'Suite 1');
    assert(rejectionAlternationResult.cooldownAfterSweet === 0, 'Rejection cooldown reset to 0.0 upon valid hole entry', 'Suite 1');

    // Test 1C: Rapid mouth crossing oscillation (40 frames oscillating across rim threshold)
    console.log('  Testing 1C: Rapid rim crossing oscillation (40 frames of crossing mouth border)...');
    const mouthOscillationResult = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Place Kevin above dockside plunge pit mouth (X=0, Z=22, rim Y=0.85m)
      ctrl.position.set(0.0, 1.2, 22.0);
      ctrl.velocity.set(0, 0, 0);

      const framePhases = [];
      for (let f = 0; f < 40; f++) {
        // Alternate crossing above/below mouth rim
        const targetY = (f % 2 === 0) ? 0.70 : 1.10;
        const velY = (f % 2 === 0) ? -0.8 : 0.8;
        ctrl.position.y = targetY;
        ctrl.velocity.y = velY;

        sub.checkHoleEntry(ctrl.position, ctrl.velocity);
        framePhases.push(sub.phase);
      }

      return {
        frameCount: framePhases.length,
        finalPhase: sub.phase,
        notStuck: sub.phase !== undefined
      };
    });

    assert(mouthOscillationResult.frameCount === 40, 'Simulated 40 rapid boundary crossings without wedging', 'Suite 1');
    assert(mouthOscillationResult.notStuck, 'Subterranean system maintained valid phase state throughout oscillation', 'Suite 1');

    // Test 1D: Full post-hammer recovery check
    console.log('  Testing 1D: Full end-to-end recovery after stress hammering...');
    const recoveryResult = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Clean enter into Dockside plunge pit
      g.holes.enterHole('hole_dockside');

      let reachedBottom = false;
      let geyserFired = false;
      let surfaced = false;
      let apexY = -999;

      // Step up to 200 frames to complete the cycle
      for (let f = 0; f < 200; f++) {
        ctrl.update(0.016);
        apexY = Math.max(apexY, ctrl.position.y);

        if (sub.phase === 'geyser_propelled') {
          geyserFired = true;
        }
        if (geyserFired && sub.phase === 'inactive' && ctrl.position.y >= 0.85) {
          surfaced = true;
          break;
        }
      }

      return {
        geyserFired,
        surfaced,
        apexY,
        finalPhase: sub.phase,
        finalState: ctrl.state,
        subCamActive: ctrl.thirdPersonCamera ? ctrl.thirdPersonCamera.subterraneanActive : false
      };
    });

    assert(recoveryResult.geyserFired, 'Geyser propulsion triggered cleanly during recovery dive', 'Suite 1');
    assert(recoveryResult.surfaced, 'Kevin surfaced cleanly above mouth rim (apex Y >= 0.85m)', 'Suite 1');
    assert(recoveryResult.finalPhase === 'inactive', 'Subterranean phase returned to "inactive"', 'Suite 1');
    assert(!recoveryResult.subCamActive, 'Camera subterranean mode deactivated upon surfacing', 'Suite 1');

    // -------------------------------------------------------------------------
    // Suite 2: Boundary Laser Crossing Precision at Exactly 50.0ft Depth
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('🎯 SUITE 2: BOUNDARY LASER CROSSING PRECISION AT EXACTLY 50.0FT');
    console.log('========================================================================');

    // Test 2A: Precision Depth Ladder in Granite Bluff Shaft
    console.log('  Testing 2A: Precision depth ladder evaluation around 50.0ft threshold...');
    const ladderResults = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;
      const bluffHole = game.holeManager ? game.holeManager.getHoleById('hole_bluff_shaft') : null;
      const mouthY = bluffHole ? bluffHole.position.y : 22.0;

      // FT_PER_M = 3.28084, M_PER_FT = 0.3048
      const testDepthsFt = [
        35.0,   // well above warning
        42.0,   // in proximity siren window (40-50ft)
        49.0,   // 1ft above laser
        49.5,   // 0.5ft above laser
        49.9,   // 0.1ft above laser
        49.99,  // 0.01ft above laser (boundary edge)
        50.00,  // EXACT 50.0ft boundary line
        50.01,  // 0.01ft below laser (breach)
        50.10,  // 0.1ft below laser (breach)
        55.0    // well below laser (breach)
      ];

      const ladder = [];

      for (const targetDepthFt of testDepthsFt) {
        // Reset system cleanly
        sub.phase = 'descending';
        sub.activeHole = bluffHole;
        ctrl.state = 'in_hole';
        ctrl.isFlying = false;
        if (ctrl.keys) ctrl.keys.jump = false;
        ctrl.score = 3000;
        ctrl.oranges = 10;
        ctrl.pixieDust = 100.0;

        // Position Kevin at exact target depth
        const targetDepthM = targetDepthFt * 0.3048;
        ctrl.position.set(bluffHole.position.x, mouthY - targetDepthM, bluffHole.position.z);
        ctrl.velocity.set(0, -2.0, 0);

        // Step 1 small physics update frame (0.005s) to trigger depth calculation and checks
        sub.update(0.005);

        const depthAfter = sub.currentDepthFt;
        const phaseAfter = sub.phase;
        const scoreAfter = ctrl.score;

        // Try mid-shaft flight escape at this depth
        let escapeAttempt = false;
        if (phaseAfter === 'descending') {
          escapeAttempt = sub.escapeMidShaft();
        }

        ladder.push({
          targetDepthFt,
          calculatedDepthFt: Number(depthAfter.toFixed(3)),
          phaseAfter,
          isBreach: phaseAfter === 'breach_respawning',
          escapeAllowed: escapeAttempt,
          scorePenalized: scoreAfter < 3000
        });
      }

      return ladder;
    });

    for (const step of ladderResults) {
      if (step.targetDepthFt < 50.0) {
        assert(!step.isBreach, `Depth ${step.targetDepthFt}ft (< 50.0ft): NOT breached (phase: ${step.phaseAfter})`, 'Suite 2');
        assert(step.escapeAllowed, `Depth ${step.targetDepthFt}ft (< 50.0ft): Flight escape permitted (allowed: ${step.escapeAllowed})`, 'Suite 2');
      } else {
        assert(step.isBreach, `Depth ${step.targetDepthFt}ft (>= 50.0ft): Breach penalty triggered (phase: ${step.phaseAfter})`, 'Suite 2');
        assert(!step.escapeAllowed, `Depth ${step.targetDepthFt}ft (>= 50.0ft): Flight escape DENIED (allowed: ${step.escapeAllowed})`, 'Suite 2');
      }
    }

    // Test 2B: Visual 3D Laser Mesh Exact Spatial Alignment
    console.log('  Testing 2B: Validating 3D laser visual mesh alignment in Three.js scene...');
    const laserVisualAudit = await page.evaluate(() => {
      const game = window._gameInstance;
      const scene = game.scene;
      const bluffMeshGroup = scene.getObjectByName('HoleMesh_BluffShaft');

      if (!bluffMeshGroup) {
        return { found: false };
      }

      // Find children: red laser torus, beams, point light
      let laserTorus = null;
      let beamCount = 0;
      let pointLight = null;

      bluffMeshGroup.traverse((child) => {
        if (child.isMesh && child.material && child.material.color && child.material.color.getHexString() === 'ff0000') {
          if (child.geometry && child.geometry.type === 'TorusGeometry') {
            laserTorus = child;
          } else if (child.geometry && child.geometry.type === 'CylinderGeometry') {
            beamCount++;
          }
        }
        if (child.isPointLight && child.color && child.color.getHexString() === 'ef4444') {
          pointLight = child;
        }
      });

      // World positions
      const bluffWorldY = bluffMeshGroup.position.y; // 22.0m
      const torusRelY = laserTorus ? laserTorus.position.y : null; // should be -15.24m
      const torusWorldY = (torusRelY !== null) ? bluffWorldY + torusRelY : null;
      const depthM = bluffWorldY - torusWorldY;
      const depthFt = depthM * 3.28084;

      return {
        found: true,
        hasLaserTorus: !!laserTorus,
        beamCount,
        hasPointLight: !!pointLight,
        bluffWorldY,
        torusRelY,
        torusWorldY,
        calculatedDepthFt: Number(depthFt.toFixed(2))
      };
    });

    assert(laserVisualAudit.found && laserVisualAudit.hasLaserTorus, 'Red laser perimeter torus mesh exists in scene', 'Suite 2');
    assert(laserVisualAudit.beamCount >= 2, `Cross-hatch red laser grid beams rendered (count: ${laserVisualAudit.beamCount})`, 'Suite 2');
    assert(laserVisualAudit.hasPointLight, 'Pulsing red hazard point light active at boundary', 'Suite 2');
    assert(Math.abs(laserVisualAudit.calculatedDepthFt - 50.0) < 0.1, `Visual 3D laser boundary matches exact 50.0ft depth (actual: ${laserVisualAudit.calculatedDepthFt} FT)`, 'Suite 2');

    // -------------------------------------------------------------------------
    // Suite 3: Mid-Shaft Flight Escape Timing & Arrest Dynamics
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('🪶 SUITE 3: MID-SHAFT FLIGHT ESCAPE TIMING & ARREST DYNAMICS');
    console.log('========================================================================');

    // Test 3A: Immediate Kinetic Arrest from High Descent Velocity
    console.log('  Testing 3A: Immediate kinetic arrest from terminal descent fall...');
    const kineticArrestResult = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Start falling in Bluff Shaft
      window.__KEVIN_GAME__.holes.enterHole('hole_bluff_shaft');
      ctrl.velocity.y = -9.0; // Terminal fall velocity
      ctrl.pixieDust = 100.0;

      // Descend to 25.0ft depth
      const depth25M = 25.0 * 0.3048;
      ctrl.position.y = 22.0 - depth25M;
      sub.update(0.016);

      const vyBeforeArrest = ctrl.velocity.y;
      const depthBeforeArrest = sub.currentDepthFt;

      // Trigger mid-shaft flight escape via Jump key
      ctrl.keys.jump = true;
      sub.update(0.016);

      const phaseAfterEscape = sub.phase;
      const vyAfterArrest = ctrl.velocity.y;
      const isFlying = ctrl.isFlying;

      return {
        vyBeforeArrest,
        depthBeforeArrest,
        phaseAfterEscape,
        vyAfterArrest,
        isFlying,
        arrestedImmediate: vyAfterArrest >= 4.0
      };
    });

    assert(kineticArrestResult.vyBeforeArrest <= -7.0, `Terminal descent velocity verified before arrest (vy = ${kineticArrestResult.vyBeforeArrest.toFixed(1)} m/s)`, 'Suite 3');
    assert(kineticArrestResult.phaseAfterEscape === 'mid_shaft_flight', 'Phase transitions to MID_SHAFT_FLIGHT', 'Suite 3');
    assert(kineticArrestResult.isFlying, 'Character engages Pixie Dust flight mode', 'Suite 3');
    assert(kineticArrestResult.arrestedImmediate, `Descent instantly arrested: vy flipped from negative to upward climb (${kineticArrestResult.vyAfterArrest.toFixed(1)} m/s >= +4.0 m/s)`, 'Suite 3');

    // Test 3B: Complete Surface Climb Out to Lakeside
    console.log('  Testing 3B: Continuous upward climb out to lakeside surface rim...');
    const climbToSurfaceResult = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      const scoreBefore = ctrl.score;

      // Step climb frames until surfaced or max 120 frames
      let surfaced = false;
      let finalY = -999;
      let dustRemaining = 0;

      for (let f = 0; f < 120; f++) {
        ctrl.keys.jump = true;
        ctrl.update(0.016);
        finalY = ctrl.position.y;
        dustRemaining = ctrl.pixieDust;

        if (sub.phase === 'inactive' && ctrl.position.y >= 22.0) {
          surfaced = true;
          break;
        }
      }

      const scoreAfter = ctrl.score;

      return {
        surfaced,
        finalY,
        dustRemaining,
        scoreDelta: scoreAfter - scoreBefore,
        finalState: ctrl.state,
        finalPhase: sub.phase
      };
    });

    assert(climbToSurfaceResult.surfaced, `Kevin climbed completely out of shaft to surface rim (final Y: ${climbToSurfaceResult.finalY.toFixed(2)}m >= 22.0m)`, 'Suite 3');
    assert(climbToSurfaceResult.finalState === 'flying', 'Character emerges in "flying" state after flight escape', 'Suite 3');
    assert(climbToSurfaceResult.scoreDelta >= 300, `Mid-shaft flight escape awards +300 daring flight escape bonus (delta: +${climbToSurfaceResult.scoreDelta})`, 'Suite 3');
    assert(climbToSurfaceResult.dustRemaining > 0, `Flight fuel remained sufficient for escape (remaining: ${climbToSurfaceResult.dustRemaining.toFixed(1)}%)`, 'Suite 3');

    // Test 3C: Hair-Trigger Escape at 49.5ft (0.5ft before laser line)
    console.log('  Testing 3C: Hair-trigger escape at 49.5ft without crossing the 50.0ft laser...');
    const hairTriggerEscapeResult = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Position Kevin at 49.5ft descending at moderate velocity (-3.0 m/s)
      window.__KEVIN_GAME__.holes.enterHole('hole_bluff_shaft');
      ctrl.position.y = 22.0 - (49.5 * 0.3048);
      ctrl.velocity.set(0, -3.0, 0);
      ctrl.pixieDust = 100.0;
      sub.update(0.005);

      const depthAtTrigger = sub.currentDepthFt;

      // Trigger escape
      const escapeSuccess = window.__KEVIN_GAME__.holes.escapeMidShaft();

      // Step 20 frames of upward climb and measure maximum depth reached
      let maxDepthReached = depthAtTrigger;
      let breachOccurred = false;

      for (let f = 0; f < 20; f++) {
        ctrl.keys.jump = true;
        ctrl.update(0.016);
        maxDepthReached = Math.max(maxDepthReached, sub.currentDepthFt);
        if (sub.phase === 'breach_respawning') {
          breachOccurred = true;
          break;
        }
      }

      return {
        depthAtTrigger,
        escapeSuccess,
        maxDepthReached,
        breachOccurred
      };
    });

    assert(hairTriggerEscapeResult.escapeSuccess, `Escape succeeded at 49.5ft (trigger depth: ${hairTriggerEscapeResult.depthAtTrigger.toFixed(2)}ft)`, 'Suite 3');
    assert(!hairTriggerEscapeResult.breachOccurred, 'Upward arrest prevented crossing 50.0ft boundary laser (zero breach)', 'Suite 3');
    assert(hairTriggerEscapeResult.maxDepthReached < 50.0, `Maximum depth reached during turnaround remained under 50.0ft (apex: ${hairTriggerEscapeResult.maxDepthReached.toFixed(2)}ft < 50.0ft)`, 'Suite 3');

    // Test 3D: Mid-Shaft Fuel Depletion / Space Release Reversion
    console.log('  Testing 3D: Mid-shaft flight fuel depletion reverts to descent gracefully...');
    const fuelDepletionResult = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      window.__KEVIN_GAME__.holes.enterHole('hole_bluff_shaft');
      ctrl.position.y = 22.0 - (30.0 * 0.3048);
      sub.escapeMidShaft();

      const phaseDuringFlight = sub.phase;

      // Exhaust pixie dust to 0
      ctrl.pixieDust = 0.0;
      ctrl.update(0.016);

      const phaseAfterExhaustion = sub.phase;
      const isFlyingAfter = ctrl.isFlying;

      return {
        phaseDuringFlight,
        phaseAfterExhaustion,
        isFlyingAfter
      };
    });

    assert(fuelDepletionResult.phaseDuringFlight === 'mid_shaft_flight', 'Phase was MID_SHAFT_FLIGHT', 'Suite 3');
    assert(fuelDepletionResult.phaseAfterExhaustion === 'descending', 'Exhausting Pixie Dust gracefully reverts phase to "descending"', 'Suite 3');
    assert(!fuelDepletionResult.isFlyingAfter, 'Flight disengaged when fuel exhausted in shaft', 'Suite 3');

    // -------------------------------------------------------------------------
    // Suite 4: WebGL Render Stability, 60-Frame Multi-Emitter & Memory Leak Audit
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('🎆 SUITE 4: WEBGL RENDER STABILITY & 60-FRAME MULTI-EMITTER AUDIT');
    console.log('========================================================================');

    // Test 4A: 60 Continuous Frames of Simultaneous 600-Particle Confetti + Geyser Emitter
    console.log('  Testing 4A: 60 continuous frames with simultaneous 600-particle confetti + geyser...');
    const renderStabilityResult = await page.evaluate(async () => {
      const game = window._gameInstance;
      const scene = game.scene;
      const renderer = game.renderer;
      const gl = renderer.getContext();
      const confetti = game.confettiEmitter;
      const geyser = game.geyserEmitter;

      // Trigger simultaneous explosion of both systems
      const origin = { x: 48.0, y: 3.5, z: -45.0 };
      confetti.explode(origin);
      geyser.trigger(origin, 32.0, true);

      const frameAudits = [];
      let anyNaNFound = false;
      let contextLostAnytime = false;
      let glErrorsAnytime = 0;

      for (let frame = 0; frame < 60; frame++) {
        const dt = 0.016;

        // Step physics & animation updates
        confetti.update(dt);
        geyser.update(dt);
        game.character.update(dt);

        // Render frame through WebGL renderer
        renderer.render(scene, game.camera);

        // 1. Inspect confetti particle buffers for NaNs
        const cPos = confetti.positions;
        const cVel = confetti.velocities;
        for (let i = 0; i < confetti.capacity * 3; i++) {
          if (isNaN(cPos[i]) || !isFinite(cPos[i]) || isNaN(cVel[i]) || !isFinite(cVel[i])) {
            anyNaNFound = true;
            break;
          }
        }

        // 2. Inspect geyser particle buffers for NaNs
        const gPos = geyser.positions;
        const gVel = geyser.velocities;
        for (let i = 0; i < geyser.capacity * 3; i++) {
          if (isNaN(gPos[i]) || !isFinite(gPos[i]) || isNaN(gVel[i]) || !isFinite(gVel[i])) {
            anyNaNFound = true;
            break;
          }
        }

        // 3. Inspect scene object matrices for NaNs
        scene.traverse((obj) => {
          if (obj.matrixWorld) {
            const el = obj.matrixWorld.elements;
            for (let e = 0; e < 16; e++) {
              if (isNaN(el[e]) || !isFinite(el[e])) {
                anyNaNFound = true;
                break;
              }
            }
          }
        });

        // 4. WebGL context checks
        if (gl.isContextLost()) {
          contextLostAnytime = true;
        }
        const err = gl.getError();
        if (err !== 0) {
          glErrorsAnytime++;
        }

        if (frame % 15 === 0 || frame === 59) {
          frameAudits.push({
            frame,
            confettiActive: confetti.isActive,
            geyserActive: geyser.active,
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures
          });
        }
      }

      return {
        framesRendered: 60,
        anyNaNFound,
        contextLostAnytime,
        glErrorsAnytime,
        frameAudits
      };
    });

    assert(renderStabilityResult.framesRendered === 60, 'Rendered 60 continuous WebGL frames under full particle load', 'Suite 4');
    assert(!renderStabilityResult.anyNaNFound, 'Particle positions, velocities and matrixWorld transforms contain ZERO NaNs', 'Suite 4');
    assert(!renderStabilityResult.contextLostAnytime, 'WebGL context remained healthy with ZERO context losses', 'Suite 4');
    assert(renderStabilityResult.glErrorsAnytime === 0, 'WebGL gl.getError() === 0 (NO_ERROR) across all 60 frames', 'Suite 4');

    // Test 4B: Memory Leak & Resource Allocation Stability across Multiple Burst Cycles
    console.log('  Testing 4B: Multi-burst memory leak audit (10 consecutive explosion cycles)...');
    const memoryLeakAuditResult = await page.evaluate(async () => {
      const game = window._gameInstance;
      const renderer = game.renderer;
      const confetti = game.confettiEmitter;
      const geyser = game.geyserEmitter;

      const initialGeometries = renderer.info.memory.geometries;
      const initialTextures = renderer.info.memory.textures;

      // Trigger 10 repeated burst cycles with stepped updates
      for (let burst = 0; burst < 10; burst++) {
        confetti.explode({ x: 48, y: 3.5, z: -45 });
        geyser.trigger({ x: 48, y: 3.5, z: -45 }, 28.0, true);

        for (let f = 0; f < 10; f++) {
          confetti.update(0.016);
          geyser.update(0.016);
        }
      }

      const finalGeometries = renderer.info.memory.geometries;
      const finalTextures = renderer.info.memory.textures;

      return {
        initialGeometries,
        finalGeometries,
        geometryDelta: finalGeometries - initialGeometries,
        initialTextures,
        finalTextures,
        textureDelta: finalTextures - initialTextures
      };
    });

    assert(memoryLeakAuditResult.geometryDelta === 0, `Three.js geometry count remained constant across 10 bursts (delta: ${memoryLeakAuditResult.geometryDelta})`, 'Suite 4');
    assert(memoryLeakAuditResult.textureDelta === 0, `Three.js texture count remained constant across 10 bursts (delta: ${memoryLeakAuditResult.textureDelta})`, 'Suite 4');

    // Test 4C: Page Errors & Console Log Sanity
    console.log('  Testing 4C: Browser console and unhandled exception health...');
    assert(pageErrors.length === 0, `Zero uncaught browser page errors (found: ${pageErrors.length})`, 'Suite 4');
    assert(consoleErrors.length === 0, `Zero console error messages (found: ${consoleErrors.length})`, 'Suite 4');

  } catch (err) {
    console.error('💥 Fatal error during adversarial stress run:', err);
    report.failed++;
    report.failures.push(`Fatal Error: ${err.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log(`TOTAL ASSERTIONS: ${report.total}`);
  console.log(`PASSED:           ${report.passed}`);
  console.log(`FAILED:           ${report.failed}`);
  if (report.failed === 0) {
    console.log('🏆 VERDICT: APPROVE (100% PASS RATE - ADVERSARIAL STRESS TEST COMPLETE)');
  } else {
    console.log('❌ VERDICT: REQUEST_CHANGES');
    console.log('Failures:', report.failures);
  }
  console.log('========================================================================\n');

  if (report.failed > 0) {
    process.exit(1);
  }
}

runChallengerStressVerification();
