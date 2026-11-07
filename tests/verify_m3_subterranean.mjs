/**
 * tests/verify_m3_subterranean.mjs
 * Comprehensive Automated Verification Suite for Milestone 3:
 * Subterranean Hole Challenges & Strict 10ft–50ft Rules (R3)
 */

import { chromium } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const TIMEOUT_MS = 45000;

async function runMilestone3Verification() {
  console.log('========================================================================');
  console.log('🌟 MILESTONE 3: SUBTERRANEAN HOLE CHALLENGES & DEPTH RULES VERIFICATION');
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

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`❌ [Browser Error]: ${msg.text()}`);
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
    // Phase 1: Boot & Ready Contract
    // -------------------------------------------------------------------------
    console.log('[Phase 1] Booting headless game and verifying window.__KEVIN_GAME__.holes API...');
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    assert(response && response.status() === 200, 'HTTP status is 200', 'Phase 1');

    await page.waitForFunction(() => {
      return window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready === true;
    }, { timeout: 45000 });

    const contract = await page.evaluate(() => {
      const g = window.__KEVIN_GAME__;
      const h = g && g.holes;
      return {
        ready: g && g.ready,
        hasHolesApi: !!h,
        hasList: Array.isArray(h && h.list),
        listLength: h && h.list ? h.list.length : 0,
        hasEnterHole: typeof (h && h.enterHole) === 'function',
        hasEscapeMidShaft: typeof (h && h.escapeMidShaft) === 'function',
        hasGoldenFeverActive: typeof (h && h.goldenFeverActive) === 'boolean',
        hasGoldenFeverRemaining: typeof (h && h.goldenFeverRemaining) === 'number',
        hasSubterraneanPhase: typeof (h && h.subterraneanPhase) === 'string',
        holesData: h && h.list ? h.list.map(x => ({
          id: x.id,
          name: x.name,
          tier: x.tier,
          depthFt: x.depthFt,
          radius: x.radius,
          position: x.position,
          landmark: x.landmark
        })) : []
      };
    });

    assert(contract.ready === true, 'window.__KEVIN_GAME__.ready is true', 'Phase 1');
    assert(contract.hasHolesApi === true, 'window.__KEVIN_GAME__.holes API is exposed', 'Phase 1');
    assert(contract.listLength === 4, `Holes list registers exactly 4 landmark holes (actual: ${contract.listLength})`, 'Phase 1');
    assert(contract.hasEnterHole && contract.hasEscapeMidShaft, 'enterHole and escapeMidShaft methods exposed', 'Phase 1');

    // -------------------------------------------------------------------------
    // Phase 2: Hole Registry & 3D Spatial Landmark Geometry
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2] Verifying All 4 Hole Landmark Definitions and 3D Visual Meshes...');
    const hShore = contract.holesData.find(h => h.id === 'hole_shoreline');
    const hDock = contract.holesData.find(h => h.id === 'hole_dockside');
    const hPine = contract.holesData.find(h => h.id === 'hole_pine_root');
    const hBluff = contract.holesData.find(h => h.id === 'hole_bluff_shaft');

    assert(!!hShore && hShore.depthFt === 7.5 && hShore.tier === 'shallow', 'Shoreline Sinkhole: 7.5ft, tier "shallow" (<10ft)', 'Phase 2');
    assert(!!hDock && hDock.depthFt === 22.0 && hDock.tier === 'sweet_spot', 'Dockside Plunge Pit: 22.0ft, tier "sweet_spot" (10-50ft)', 'Phase 2');
    assert(!!hPine && hPine.depthFt === 50.0 && hPine.tier === 'sweet_spot', 'Pine-Root Cavern: 50.0ft Holy Grail, tier "sweet_spot"', 'Phase 2');
    assert(!!hBluff && hBluff.depthFt === 82.0 && hBluff.tier === 'deep', 'Granite Bluff Shaft: 82.0ft, tier "deep" (>50ft)', 'Phase 2');

    // Audit 3D scene meshes
    const sceneAudit = await page.evaluate(() => {
      const scene = (window._gameInstance && window._gameInstance.scene) || (window.__KEVIN_GAME__ && window.__KEVIN_GAME__.scene);
      const holesGroup = scene ? scene.getObjectByName('SubterraneanHolesGroup') : null;
      const meshShore = scene ? scene.getObjectByName('HoleMesh_Shoreline') : null;
      const meshDock = scene ? scene.getObjectByName('HoleMesh_Dockside') : null;
      const meshPine = scene ? scene.getObjectByName('HoleMesh_PineRoot') : null;
      const meshBluff = scene ? scene.getObjectByName('HoleMesh_BluffShaft') : null;

      return {
        hasHolesGroup: !!holesGroup,
        hasMeshShore: !!meshShore,
        hasMeshDock: !!meshDock,
        hasMeshPine: !!meshPine,
        hasMeshBluff: !!meshBluff
      };
    });

    assert(sceneAudit.hasHolesGroup, 'SubterraneanHolesGroup exists in Three.js scene', 'Phase 2');
    assert(sceneAudit.hasMeshShore && sceneAudit.hasMeshDock, 'Shoreline and Dockside 3D hole meshes constructed', 'Phase 2');
    assert(sceneAudit.hasMeshPine && sceneAudit.hasMeshBluff, 'Pine-Root and Bluff Shaft 3D hole meshes constructed', 'Phase 2');

    // -------------------------------------------------------------------------
    // Phase 3: Tier 1 Shallow Rejection (<10ft Hole)
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3] Testing Tier 1 Shallow Hole Rejection (<10ft Shoreline Sinkhole)...');
    const shallowRejection = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Teleport Kevin directly above shoreline sinkhole mouth (12.0, 0.20, 18.0)
      ctrl.teleport(12.0, 0.35, 18.0);
      ctrl.velocity.set(0, -0.5, 0); // descending into mouth

      const stateBefore = ctrl.state;
      const vyBefore = ctrl.velocity.y;

      // Update subterranean system
      sub.checkHoleEntry(ctrl.position, ctrl.velocity);

      const phaseAfter = sub.phase;
      const stateAfter = ctrl.state;
      const vyAfter = ctrl.velocity.y;
      const horizSpeed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      return {
        phaseAfter,
        stateAfter,
        vyBefore,
        vyAfter,
        horizSpeed,
        neverInHole: stateAfter !== 'in_hole',
        recoilUpward: vyAfter >= 8.0,
        recoilOutward: horizSpeed >= 4.0
      };
    });

    assert(shallowRejection.phaseAfter.toLowerCase() === 'rejected', 'Subterranean phase transitions to REJECTED on <10ft hole', 'Phase 3');
    assert(shallowRejection.neverInHole, 'Character state is NOT in_hole (state: ' + shallowRejection.stateAfter + ')', 'Phase 3');
    assert(shallowRejection.recoilUpward, `Rejection imparts strong vertical upward bounce (vy = ${shallowRejection.vyAfter.toFixed(1)} m/s >= 8.0 m/s)`, 'Phase 3');
    assert(shallowRejection.recoilOutward, `Rejection imparts radial horizontal recoil impulse (${shallowRejection.horizSpeed.toFixed(1)} m/s >= 4.0 m/s)`, 'Phase 3');

    // -------------------------------------------------------------------------
    // Phase 4: Tier 2 Sweet Spot (22ft Dockside Plunge Pit) & Geothermal Geyser
    // -------------------------------------------------------------------------
    console.log('\n[Phase 4] Testing Sweet Spot Hole (22ft Dockside Plunge Pit) & Geyser Launch...');
    const docksideDescent = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;
      const initialScore = ctrl ? ctrl.score : game.score;

      // Enter hole programmatically
      window.__KEVIN_GAME__.holes.enterHole('hole_dockside');

      const enterPhase = sub.phase;
      const enterState = ctrl.state;

      // Deterministically step subterranean descent and geyser launch
      let reachedFloor = false;
      let minShaftY = 999;
      let geyserTriggered = false;
      let launchVy = 0;
      let maxAscentY = -999;

      for (let f = 0; f < 180; f++) {
        ctrl.update(0.016);
        minShaftY = Math.min(minShaftY, ctrl.position.y);
        maxAscentY = Math.max(maxAscentY, ctrl.position.y);
        if (sub.phase.toLowerCase() === 'geyser_propelled') {
          geyserTriggered = true;
          launchVy = Math.max(launchVy, ctrl.velocity.y);
        }
        if (geyserTriggered && ctrl.position.y >= 0.80) {
          break;
        }
      }

      const scoreAfter = ctrl ? ctrl.score : game.score;

      return {
        enterPhase,
        enterState,
        minShaftY,
        geyserTriggered,
        launchVy,
        maxAscentY,
        scoreDelta: scoreAfter - initialScore,
        finalPhase: sub.phase
      };
    });

    assert(docksideDescent.enterPhase.toLowerCase() === 'descending', 'Enter hole sets phase to DESCENDING', 'Phase 4');
    assert(docksideDescent.enterState === 'in_hole', 'Character state transitions to "in_hole"', 'Phase 4');
    assert(docksideDescent.minShaftY <= -5.0, `Descent reaches plunge pit floor (lowest Y: ${docksideDescent.minShaftY.toFixed(2)}m <= -5.0m)`, 'Phase 4');
    assert(docksideDescent.geyserTriggered, 'Geothermal geyser erupts at shaft floor (phase = GEYSER_PROPELLED)', 'Phase 4');
    assert(docksideDescent.launchVy >= 18.0, `Geyser launches Kevin upward with high impulse (vy: ${docksideDescent.launchVy.toFixed(1)} m/s >= 18.0 m/s)`, 'Phase 4');
    assert(docksideDescent.maxAscentY >= 0.80, `Geyser propels Kevin completely out of shaft back to surface (apex Y: ${docksideDescent.maxAscentY.toFixed(2)}m >= 0.80m)`, 'Phase 4');
    assert(docksideDescent.scoreDelta >= 500, `Sweet spot exploration awards points (delta: +${docksideDescent.scoreDelta} >= 500)`, 'Phase 4');

    // -------------------------------------------------------------------------
    // Phase 5: The Holy Grail (50.0ft Pine-Root Cavern) & Celebration
    // -------------------------------------------------------------------------
    console.log('\n[Phase 5] Testing The Holy Grail (Exact 50.0ft Pine-Root Cavern) Celebration...');
    const holyGrailAudit = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;
      const fever = game.goldenFeverManager;
      const confetti = game.confettiEmitter;

      const scoreBefore = ctrl ? ctrl.score : game.score;

      // Trigger Holy Grail entry
      window.__KEVIN_GAME__.holes.enterHole('hole_pine_root');

      // Fast-forward descent to trigger the 50.0ft Holy Grail celebration
      let celebrationTriggered = false;
      for (let f = 0; f < 200; f++) {
        ctrl.update(0.016);
        if (fever && fever.isActive) {
          celebrationTriggered = true;
          break;
        }
      }

      const scoreAfter = ctrl ? ctrl.score : game.score;
      const scoreGain = scoreAfter - scoreBefore;
      const feverActive = fever && fever.isActive;
      const feverTimer = fever ? fever.timer : 0;
      const speedMult = fever ? fever.getSpeedMultiplier() : 1.0;
      const confettiActive = confetti && confetti.isActive;
      const bannerVisible = !!document.getElementById('goldenFeverBanner') &&
        document.getElementById('goldenFeverBanner').style.display !== 'none';

      return {
        celebrationTriggered,
        scoreGain,
        feverActive,
        feverTimer,
        speedMult,
        confettiActive,
        bannerVisible
      };
    });

    assert(holyGrailAudit.celebrationTriggered, '50.0ft Holy Grail triggers victory celebration at shaft floor', 'Phase 5');
    assert(holyGrailAudit.scoreGain >= 2500, `Holy Grail awards +2500 victory bonus (awarded: +${holyGrailAudit.scoreGain})`, 'Phase 5');
    assert(holyGrailAudit.feverActive, '15-second Golden Fever mode activated (feverActive = true)', 'Phase 5');
    assert(holyGrailAudit.feverTimer >= 14.0 && holyGrailAudit.feverTimer <= 15.0, `Golden Fever initial timer calibrated to 15.0s (timer: ${holyGrailAudit.feverTimer.toFixed(1)}s)`, 'Phase 5');
    assert(holyGrailAudit.speedMult === 2.0, 'Golden Fever grants 2x locomotion speed multiplier (multiplier: 2.0x)', 'Phase 5');
    assert(holyGrailAudit.confettiActive, 'Confetti fireworks particle emitter actively bursting', 'Phase 5');
    assert(holyGrailAudit.bannerVisible, 'Golden Fever HUD banner visible and glowing on screen', 'Phase 5');

    // -------------------------------------------------------------------------
    // Phase 6: Deep Hazard (>50ft Granite Bluff Shaft), Flight Escape & Laser Breach
    // -------------------------------------------------------------------------
    console.log('\n[Phase 6] Testing Deep Hazard (>50ft Granite Bluff Shaft), Mid-Shaft Flight Escape & Breach...');

    // Test A: Mid-Shaft Flight Escape (Window 0-50ft)
    const midShaftEscape = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Enter bluff deep shaft
      window.__KEVIN_GAME__.holes.enterHole('hole_bluff_shaft');

      // Descend to 35ft depth (within 0-50ft escape window)
      for (let f = 0; f < 40; f++) {
        ctrl.update(0.016);
      }

      const depthDuringDescent = sub.currentDepthFt;

      // Trigger mid-shaft flight escape
      const escapeSuccess = window.__KEVIN_GAME__.holes.escapeMidShaft();
      const phaseAfterEscape = sub.phase;
      const isFlying = ctrl.isFlying;

      return {
        depthDuringDescent,
        escapeSuccess,
        phaseAfterEscape,
        isFlying
      };
    });

    assert(midShaftEscape.escapeSuccess, `Mid-shaft flight escape successfully executed at depth ${midShaftEscape.depthDuringDescent.toFixed(1)}ft`, 'Phase 6');
    assert(midShaftEscape.phaseAfterEscape.toLowerCase() === 'mid_shaft_flight', 'Subterranean phase transitions to MID_SHAFT_FLIGHT', 'Phase 6');
    assert(midShaftEscape.isFlying === true, 'Character engages Pixie Dust flight mode upon mid-shaft escape', 'Phase 6');

    // Test B: Red Laser Barrier Breach (>50ft Penalty & Rim Respawn)
    const laserBreachAudit = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;
      const sub = game.subterraneanSystem;

      // Cleanly reset character state from previous flight test
      if (ctrl) {
        if (typeof ctrl.setFlight === 'function') {
          ctrl.setFlight(false);
        }
        ctrl.isFlying = false;
        if (ctrl.keys) {
          ctrl.keys.jump = false;
          ctrl.keys.forward = false;
          ctrl.keys.backward = false;
          ctrl.keys.left = false;
          ctrl.keys.right = false;
        }
        ctrl.velocity.set(0, -1.0, 0);
        ctrl.score = 2000;
      }
      game.score = 2000;
      const scoreBefore = ctrl ? ctrl.score : game.score;

      // Enter bluff shaft and allow falling past 50ft red laser barrier
      window.__KEVIN_GAME__.holes.enterHole('hole_bluff_shaft');

      let breachDetected = false;
      let breachPhase = '';
      const breachLog = [];
      for (let f = 0; f < 240; f++) {
        ctrl.update(0.016);
        if (f % 20 === 0 || sub.phase.toLowerCase() === 'breach_respawning') {
          breachLog.push({ f, y: Number(ctrl.position.y.toFixed(2)), depthFt: Number(sub.currentDepthFt.toFixed(1)), phase: sub.phase, score: ctrl.score });
        }
        if (sub.phase.toLowerCase() === 'breach_respawning') {
          breachDetected = true;
          breachPhase = sub.phase;
          break;
        }
      }

      // Finish respawn sequence
      for (let f = 0; f < 60; f++) {
        ctrl.update(0.016);
      }

      const scoreAfter = ctrl ? ctrl.score : game.score;
      const scorePenalty = scoreBefore - scoreAfter;
      const respawnPos = { ...ctrl.position };
      const respawnNearRim = Math.hypot(respawnPos.x - (-45.0), respawnPos.z - 0.0) < 5.0 && respawnPos.y >= 21.0;

      return {
        breachDetected,
        breachPhase,
        scorePenalty,
        respawnPos,
        respawnNearRim,
        breachLog
      };
    });

    if (!laserBreachAudit.breachDetected) {
      console.log('    [Debug Breach Log]:', JSON.stringify(laserBreachAudit.breachLog));
    }

    assert(laserBreachAudit.breachDetected, 'Passing below 50.0ft red laser line triggers BREACH_RESPAWNING phase', 'Phase 6');
    assert(laserBreachAudit.scorePenalty >= 500, `Laser breach assesses safety penalty (-${laserBreachAudit.scorePenalty} >= 500 points)`, 'Phase 6');
    assert(laserBreachAudit.respawnNearRim, `Breach safely respawns Kevin back at the shaft collar rim (Y: ${laserBreachAudit.respawnPos.y.toFixed(2)}m >= 21.0m)`, 'Phase 6');

    // -------------------------------------------------------------------------
    // Phase 7: Depth HUD, Sonar Tier Pings & Vertical Camera Alignment
    // -------------------------------------------------------------------------
    console.log('\n[Phase 7] Verifying Depth HUD Needle Scaling, Sonar Holographic Pings & Camera Framing...');
    const hudAndCameraAudit = await page.evaluate(async () => {
      const game = window._gameInstance;
      const hud = game.hud;
      const sonar = game.sonarSystem || game.sonar;
      const cam = game.cameraRig || (game.character && game.character.thirdPersonCamera);

      // Test HUD calibrated depth
      hud.setSubterraneanDepth(true, 50.0, 'sweet_spot');
      const depthText = document.getElementById('liveDepthNum').textContent;
      const depthStatus = document.getElementById('liveDepthStatus').textContent;

      // Test Sonar tier ping color mappings
      const scanResults = sonar.scanLandmarkHoles({ x: 0, y: 1.0, z: 0 });
      const shallowPing = scanResults.find(p => p.tier === 'shallow');
      const sweetPing = scanResults.find(p => p.tier === 'sweet_spot' && p.depthFt === 22.0);
      const grailPing = scanResults.find(p => p.depthFt === 50.0);
      const hazardPing = scanResults.find(p => p.tier === 'deep');

      // Test Camera axial framing in subterranean mode
      cam.setSubterraneanMode(true, { position: { x: 0, y: 0.85, z: 22 }, radius: 1.6, depthFt: 22.0 });
      const camSubActive = cam.subterraneanActive;
      cam.update(0.016, { x: 0, y: -2.0, z: 22 }, { x: 0, y: -5.0, z: 0 }); // descending
      const pitchDescending = cam.pitch;

      cam.update(0.016, { x: 0, y: -2.0, z: 22 }, { x: 0, y: 15.0, z: 0 }); // geyser ascending
      const pitchAscending = cam.pitch;

      cam.setSubterraneanMode(false);

      return {
        depthText,
        depthStatus,
        shallowColor: shallowPing ? shallowPing.colorHex : null,
        sweetColor: sweetPing ? sweetPing.colorHex : null,
        grailColor: grailPing ? grailPing.colorHex : null,
        hazardColor: hazardPing ? hazardPing.colorHex : null,
        camSubActive,
        pitchDescending,
        pitchAscending
      };
    });

    assert(hudAndCameraAudit.depthText.includes('50.0'), `Depth HUD displays live calibrated 50.0 FT depth (actual: "${hudAndCameraAudit.depthText}")`, 'Phase 7');
    assert(hudAndCameraAudit.shallowColor === '#f59e0b', 'Sonar scans shallow hole with Amber color (#f59e0b)', 'Phase 7');
    assert(hudAndCameraAudit.sweetColor === '#ff8800', 'Sonar scans sweet spot hole with Bright Orange color (#ff8800)', 'Phase 7');
    assert(hudAndCameraAudit.grailColor === '#ffd700', 'Sonar scans Holy Grail with Radiant Gold color (#ffd700)', 'Phase 7');
    assert(hudAndCameraAudit.hazardColor === '#ff0055', 'Sonar scans deep hazard hole with Neon Crimson color (#ff0055)', 'Phase 7');
    assert(hudAndCameraAudit.pitchDescending < 0, `Camera tilts downward during descent (pitch: ${hudAndCameraAudit.pitchDescending.toFixed(2)} rad)`, 'Phase 7');
    assert(hudAndCameraAudit.pitchAscending > 0, `Camera tilts upward toward shaft mouth during geyser ascent (pitch: ${hudAndCameraAudit.pitchAscending.toFixed(2)} rad)`, 'Phase 7');

    // -------------------------------------------------------------------------
    // Phase 8: WebGL Health & Multi-Frame Stability
    // -------------------------------------------------------------------------
    console.log('\n[Phase 8] Auditing WebGL Context Health and Multi-Frame Runtime Stability...');
    const webglHealth = await page.evaluate(() => {
      const gl = window._gameInstance.renderer.getContext();
      return {
        contextLost: gl.isContextLost(),
        glError: gl.getError(),
        runtimeErrors: window._gameInstance.errorCount || 0
      };
    });

    assert(!webglHealth.contextLost, 'WebGL context is healthy and NOT lost', 'Phase 8');
    assert(webglHealth.glError === 0, 'WebGL gl.getError() === 0 (NO_ERROR)', 'Phase 8');
    assert(pageErrors.length === 0, `Zero browser page errors (found: ${pageErrors.length})`, 'Phase 8');

  } catch (err) {
    console.error('💥 Fatal error during verification run:', err);
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
    console.log('🏆 VERDICT: APPROVE (100% PASS RATE - MILESTONE 3 COMPLETE)');
  } else {
    console.log('❌ VERDICT: FAIL');
    console.log('Failures:', report.failures);
  }
  console.log('========================================================================\n');

  if (report.failed > 0) {
    process.exit(1);
  }
}

runMilestone3Verification();
