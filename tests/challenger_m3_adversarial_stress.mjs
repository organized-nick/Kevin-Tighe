/**
 * tests/challenger_m3_adversarial_stress.mjs
 * Empirical Challenger Adversarial Verification & Stress Test Harness for Milestone 3:
 * Subterranean Hole Challenges, Strict 10ft–50ft Rules, Geyser Launches & Holy Grail Celebration
 */

import { chromium } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const TIMEOUT_MS = 60000;

async function runChallengerSubterraneanStress() {
  console.log('========================================================================');
  console.log('⚔️  CHALLENGER M3: ADVERSARIAL STRESS TEST & BOUNDARY HARNESS');
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
    // Stress Phase 1: Boot & Interface Contract Integrity
    // -------------------------------------------------------------------------
    console.log('[Stress Phase 1] Booting game and asserting window.__KEVIN_GAME__.holes API contract...');
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    assert(response && response.status() === 200, 'HTTP status is 200', 'Phase 1');

    await page.waitForFunction(() => {
      return window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready === true;
    }, { timeout: 45000 });

    const contractAudit = await page.evaluate(() => {
      const g = window.__KEVIN_GAME__;
      const h = g && g.holes;
      return {
        ready: g && g.ready,
        hasList: Array.isArray(h && h.list),
        holeCount: h && h.list ? h.list.length : 0,
        holes: h && h.list ? h.list.map(x => ({ id: x.id, tier: x.tier, depthFt: x.depthFt })) : []
      };
    });

    assert(contractAudit.ready === true, 'Engine ready signal verified', 'Phase 1');
    assert(contractAudit.holeCount === 4, `Exactly 4 landmark holes registered (found: ${contractAudit.holeCount})`, 'Phase 1');

    // -------------------------------------------------------------------------
    // Stress Phase 2: Tier 1 Rejection Boundary & Recoil Impulse Dynamics (<10ft)
    // -------------------------------------------------------------------------
    console.log('\n[Stress Phase 2] Adversarial Stress: Shallow Hole Rejection & Recoil (<10ft)...');
    const shallowStress = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Test A: Direct vertical drop rejection (0 horiz speed)
      ctrl.teleport(12.0, 0.25, 18.0);
      ctrl.velocity.set(0, -0.6, 0);
      sub.checkHoleEntry(ctrl.position, ctrl.velocity);
      const verticalDropRecoil = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);
      const verticalDropBounce = ctrl.velocity.y;
      const phaseA = sub.phase;
      const stateA = ctrl.state;

      // Test B: Multi-frame chaotic entry attempts
      let statesInHoleCount = 0;
      let nanVelocityCount = 0;

      for (let i = 0; i < 15; i++) {
        // Reset rejection cooldown to test repeated rapid hits
        sub.rejectionCooldown = 0;
        sub.phase = 'inactive';
        ctrl.teleport(12.0 + (Math.random() - 0.5) * 0.4, 0.25, 18.0 + (Math.random() - 0.5) * 0.4);
        ctrl.velocity.set(0, -0.6, 0);

        sub.checkHoleEntry(ctrl.position, ctrl.velocity);

        if (ctrl.state === 'in_hole') statesInHoleCount++;
        if (isNaN(ctrl.velocity.x) || isNaN(ctrl.velocity.y) || isNaN(ctrl.velocity.z)) nanVelocityCount++;

        ctrl.update(0.016);
      }

      return {
        phaseA,
        stateA,
        verticalDropRecoil,
        verticalDropBounce,
        statesInHoleCount,
        nanVelocityCount
      };
    });

    assert(shallowStress.phaseA === 'rejected', 'Subterranean phase transitions to REJECTED on <10ft hole', 'Phase 2');
    assert(shallowStress.stateA !== 'in_hole', 'Character state remains jumping/falling and NOT "in_hole"', 'Phase 2');
    assert(shallowStress.verticalDropBounce >= 8.0, `Upward bounce impulse applied (vy = ${shallowStress.verticalDropBounce.toFixed(1)} m/s >= 8.0 m/s)`, 'Phase 2');
    assert(shallowStress.verticalDropRecoil >= 4.0, `Radial outward recoil impulse applied on drop (speed: ${shallowStress.verticalDropRecoil.toFixed(1)} m/s >= 4.0 m/s)`, 'Phase 2');
    assert(shallowStress.statesInHoleCount === 0, 'Zero "in_hole" states across 15 repeated rejection attacks', 'Phase 2');
    assert(shallowStress.nanVelocityCount === 0, 'Zero NaN velocities during repeated rejections', 'Phase 2');

    // -------------------------------------------------------------------------
    // Stress Phase 3: Shaft Cylinder Containment Under 60Hz Chaotic Inputs
    // -------------------------------------------------------------------------
    console.log('\n[Stress Phase 3] Shaft Radial Cylinder Wall Clamping Under Rapid WASD Input Thrashing...');
    const cylinderContainment = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Enter sweet spot hole (Dockside Plunge Pit, radius = 1.6m)
      window.__KEVIN_GAME__.holes.enterHole('hole_dockside');
      const hole = sub.activeHole;
      const maxAllowedRadius = hole.radius;

      let maxObservedRadius = 0;
      let breachRadialWall = false;

      // Simulate 60 frames of violent diagonal lateral inputs while falling
      for (let f = 0; f < 60; f++) {
        ctrl.keys.left = f % 2 === 0;
        ctrl.keys.right = f % 2 !== 0;
        ctrl.keys.forward = f % 4 < 2;
        ctrl.keys.backward = f % 4 >= 2;

        ctrl.update(0.016);

        const r = Math.hypot(ctrl.position.x - hole.position.x, ctrl.position.z - hole.position.z);
        maxObservedRadius = Math.max(maxObservedRadius, r);
        if (r > maxAllowedRadius + 0.05) {
          breachRadialWall = true;
        }
      }

      // Clear keys
      ctrl.keys.left = false;
      ctrl.keys.right = false;
      ctrl.keys.forward = false;
      ctrl.keys.backward = false;

      return {
        holeRadius: hole.radius,
        maxObservedRadius,
        breachRadialWall
      };
    });

    assert(!cylinderContainment.breachRadialWall, `Lateral player position remains bounded within shaft bore (max radius: ${cylinderContainment.maxObservedRadius.toFixed(2)}m <= ${cylinderContainment.holeRadius}m)`, 'Phase 3');

    // -------------------------------------------------------------------------
    // Stress Phase 4: Sweet Spot Geyser Physics & Surface Restoration
    // -------------------------------------------------------------------------
    console.log('\n[Stress Phase 4] Testing Geyser Propulsion Physics & Clean Surface Clearance...');
    const geyserPhysics = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      window.__KEVIN_GAME__.holes.enterHole('hole_dockside');
      const hole = sub.activeHole;

      let geyserPhaseHit = false;
      let maxAscentY = -999;
      let settledGrounded = false;

      for (let f = 0; f < 250; f++) {
        ctrl.update(0.016);
        if (sub.phase === 'geyser_propelled') {
          geyserPhaseHit = true;
        }
        maxAscentY = Math.max(maxAscentY, ctrl.position.y);
        if (geyserPhaseHit && ctrl.isGrounded && ctrl.position.y >= hole.position.y - 0.1) {
          settledGrounded = true;
          break;
        }
      }

      return {
        geyserPhaseHit,
        maxAscentY,
        holeRimY: hole.position.y,
        settledGrounded,
        finalState: ctrl.state,
        finalY: ctrl.position.y
      };
    });

    assert(geyserPhysics.geyserPhaseHit, 'Geyser propulsion triggered at plunge pit floor', 'Phase 4');
    assert(geyserPhysics.maxAscentY > geyserPhysics.holeRimY + 0.1, `Geyser propels Kevin above surface rim (apex: ${geyserPhysics.maxAscentY.toFixed(2)}m > rim: ${geyserPhysics.holeRimY.toFixed(2)}m)`, 'Phase 4');

    // -------------------------------------------------------------------------
    // Stress Phase 5: Holy Grail 50.0ft Victory & Golden Fever Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[Stress Phase 5] Stress-Testing Holy Grail Celebration & Golden Fever Full Lifecycle...');
    const goldenFeverLifecycle = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;
      const fever = game.goldenFeverManager;

      window.__KEVIN_GAME__.holes.enterHole('hole_pine_root');

      for (let f = 0; f < 200; f++) {
        ctrl.update(0.016);
        if (fever.isActive) break;
      }

      const activeImmediately = fever.isActive;
      const initialTimer = fever.timer;
      const initialSpeedMult = fever.getSpeedMultiplier();
      const initialScoreMult = fever.getScoreMultiplier();
      const auraVisible1 = fever.auraGroup.visible;

      // Test re-triggering Holy Grail while already active
      fever.activate();
      const refreshedTimer = fever.timer;
      const stackedSpeedMult = fever.getSpeedMultiplier();

      // Fast forward past 15.0 seconds (e.g. 15.5s)
      for (let s = 0; s < 16; s++) {
        fever.update(1.0);
      }

      const expiredActive = fever.isActive;
      const expiredTimer = fever.timer;
      const expiredSpeedMult = fever.getSpeedMultiplier();
      const expiredScoreMult = fever.getScoreMultiplier();
      const auraVisibleAfterExpiry = fever.auraGroup.visible;

      return {
        activeImmediately,
        initialTimer,
        initialSpeedMult,
        initialScoreMult,
        auraVisible1,
        refreshedTimer,
        stackedSpeedMult,
        expiredActive,
        expiredTimer,
        expiredSpeedMult,
        expiredScoreMult,
        auraVisibleAfterExpiry
      };
    });

    assert(goldenFeverLifecycle.activeImmediately, 'Golden Fever activated on 50.0ft Holy Grail dive', 'Phase 5');
    assert(goldenFeverLifecycle.initialSpeedMult === 2.0, '2x speed multiplier applied during Golden Fever', 'Phase 5');
    assert(goldenFeverLifecycle.initialScoreMult === 2.0, '2x score multiplier applied during Golden Fever', 'Phase 5');
    assert(goldenFeverLifecycle.auraVisible1, 'Golden glow aura group is visible', 'Phase 5');
    assert(goldenFeverLifecycle.refreshedTimer === 15.0, 'Re-activation cleanly refreshes timer to 15.0s', 'Phase 5');
    assert(goldenFeverLifecycle.stackedSpeedMult === 2.0, 'Re-activation does NOT stack multiplier beyond 2.0x', 'Phase 5');
    assert(!goldenFeverLifecycle.expiredActive, 'Golden Fever cleanly expires after 15 seconds (isActive = false)', 'Phase 5');
    assert(goldenFeverLifecycle.expiredSpeedMult === 1.0, 'Speed multiplier cleanly resets to 1.0x upon expiry', 'Phase 5');
    assert(goldenFeverLifecycle.expiredScoreMult === 1.0, 'Score multiplier cleanly resets to 1.0x upon expiry', 'Phase 5');
    assert(!goldenFeverLifecycle.auraVisibleAfterExpiry, 'Aura group is hidden upon expiry', 'Phase 5');

    // -------------------------------------------------------------------------
    // Stress Phase 6: Deep Hazard (>50ft) Boundary Breach, Score Penalty & Overlook Footing
    // -------------------------------------------------------------------------
    console.log('\n[Stress Phase 6] Deep Hazard (>50ft Granite Bluff Shaft) Breach Penalty & Overlook Plateau Footing...');
    const hazardBreachAndFooting = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;
      const holeMgr = game.holeManager;

      // Inspect hazard elements inside HoleMesh_BluffShaft group
      const scene = game.scene;
      const bluffHoleGroup = scene ? scene.getObjectByName('HoleMesh_BluffShaft') : null;
      let hasHazardLight = false;
      let hasLaserGeometry = false;

      if (bluffHoleGroup) {
        bluffHoleGroup.traverse((child) => {
          if (child.isPointLight && child.color.getHex() === 0xef4444) {
            hasHazardLight = true;
          }
          if (child.isMesh && child.material && child.material.color && child.material.color.getHex() === 0xff0000) {
            hasLaserGeometry = true;
          }
        });
      }

      // Reset character safely
      ctrl.setFlight(false);
      ctrl.score = 1500;
      ctrl.oranges = 5;

      const scoreBefore = ctrl.score;
      const orangesBefore = ctrl.oranges;

      // Enter deep bluff shaft and dive straight into the hazard abyss
      window.__KEVIN_GAME__.holes.enterHole('hole_bluff_shaft');

      let breachHit = false;
      for (let f = 0; f < 300; f++) {
        ctrl.update(0.016);
        if (sub.phase === 'breach_respawning') {
          breachHit = true;
          break;
        }
      }

      // Step until respawn finishes
      for (let f = 0; f < 60; f++) {
        ctrl.update(0.016);
      }

      const scoreAfter = ctrl.score;
      const orangesAfter = ctrl.oranges;
      const respawnY = ctrl.position.y;
      const isRespawnGrounded = ctrl.isGrounded;

      // Verify overlook plateau collision: walk on overlook rim
      ctrl.keys.forward = true;
      let plateauMinY = 999;
      for (let f = 0; f < 60; f++) {
        ctrl.update(0.016);
        plateauMinY = Math.min(plateauMinY, ctrl.position.y);
      }
      ctrl.keys.forward = false;

      return {
        hasHazardLight,
        hasLaserGeometry,
        breachHit,
        scorePenalty: scoreBefore - scoreAfter,
        orangesDeducted: orangesBefore - orangesAfter,
        respawnY,
        isRespawnGrounded,
        plateauMinY
      };
    });

    assert(hazardBreachAndFooting.hasLaserGeometry, 'Red 50ft hazard boundary laser meshes exist within Bluff Shaft group', 'Phase 6');
    assert(hazardBreachAndFooting.hasHazardLight, 'Pulsing red hazard point light exists within Bluff Shaft group', 'Phase 6');
    assert(hazardBreachAndFooting.breachHit, 'Passing below 50ft triggers boundary breach respawn', 'Phase 6');
    assert(hazardBreachAndFooting.scorePenalty === 500, `Boundary breach assesses exactly -500 penalty (deducted: ${hazardBreachAndFooting.scorePenalty})`, 'Phase 6');
    assert(hazardBreachAndFooting.orangesDeducted === 3, `Boundary breach assesses orange loss penalty (-${hazardBreachAndFooting.orangesDeducted} oranges)`, 'Phase 6');
    assert(hazardBreachAndFooting.respawnY >= 21.5, `Kevin respawns on elevated overlook collar rim (Y: ${hazardBreachAndFooting.respawnY.toFixed(2)}m >= 21.5m)`, 'Phase 6');
    assert(hazardBreachAndFooting.plateauMinY >= 21.0, `Overlook plateau footing remains solid along +22m plateau topography (min Y: ${hazardBreachAndFooting.plateauMinY.toFixed(2)}m >= 21.0m)`, 'Phase 6');

    // -------------------------------------------------------------------------
    // Stress Phase 7: Zero-Fuel Mid-Shaft Escape Edge Case
    // -------------------------------------------------------------------------
    console.log('\n[Stress Phase 7] Testing Mid-Shaft Escape Rejection When Pixie Dust = 0...');
    const zeroFuelEscape = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      window.__KEVIN_GAME__.holes.enterHole('hole_bluff_shaft');

      ctrl.pixieDust = 0;
      ctrl.keys.jump = true;

      ctrl.update(0.016);
      const phaseWithZeroFuel = sub.phase;

      ctrl.keys.jump = false;

      return {
        phaseWithZeroFuel
      };
    });

    assert(zeroFuelEscape.phaseWithZeroFuel === 'descending', 'Mid-shaft flight escape is rejected when Pixie Dust is 0 (stays in DESCENDING)', 'Phase 7');

    // -------------------------------------------------------------------------
    // Stress Phase 8: WebGL Error & Resource Health
    // -------------------------------------------------------------------------
    console.log('\n[Stress Phase 8] Auditing WebGL Context Health and Browser Errors...');
    const webglAudit = await page.evaluate(() => {
      const gl = window._gameInstance.renderer.getContext();
      return {
        contextLost: gl.isContextLost(),
        glError: gl.getError(),
        errorCount: window._gameInstance.errorCount || 0
      };
    });

    assert(!webglAudit.contextLost, 'WebGL context is alive and NOT lost', 'Phase 8');
    assert(webglAudit.glError === 0, 'WebGL error flag is NO_ERROR (0)', 'Phase 8');
    assert(pageErrors.length === 0, `Zero page errors during stress testing (found: ${pageErrors.length})`, 'Phase 8');

  } catch (err) {
    console.error('💥 Fatal error in stress suite:', err);
    report.failed++;
    report.failures.push(`Fatal: ${err.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log(`TOTAL ADVERSARIAL STRESS ASSERTIONS: ${report.total}`);
  console.log(`PASSED:                              ${report.passed}`);
  console.log(`FAILED:                              ${report.failed}`);
  if (report.failed === 0) {
    console.log('🏆 VERDICT: APPROVE (100% PASS RATE ON ADVERSARIAL STRESS SUITE)');
  } else {
    console.log('❌ VERDICT: FAIL');
    console.log('Failures:', report.failures);
  }
  console.log('========================================================================\n');

  if (report.failed > 0) {
    process.exit(1);
  }
}

runChallengerSubterraneanStress();
