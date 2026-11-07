/**
 * tests/challenger_m2_locomotion_physics.mjs
 * Empirical Challenger Adversarial Verification & Stress Test Suite for Milestone 2:
 * Locomotion, Camera, and Collision Physics
 *
 * Specific Tasks Evaluated:
 * 1. Locomotion across all 4 landmarks (dock, cabin porch, terrain, bluffs).
 * 2. Rapid key inputs (W+A+S+D diagonal vector normalization length <= 1.0, opposing key cancellation).
 * 3. Jumping and gravity landing without clipping through surfaces (dock, porch, terrain, terminal fall).
 * 4. Steep slope sliding on cliff faces (>50 degrees).
 * 5. Camera follow and obstacle raycast collision (preventing clipping through walls, pitch clamping).
 * 6. Programmatic setFlight(true) and flight persistence across frames.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const TIMEOUT_MS = 60000;

async function runChallengerLocomotionPhysicsAudit() {
  console.log('========================================================================');
  console.log('⚔️  CHALLENGER M2: EMPIRICAL ADVERSARIAL STRESS TEST & PHYSICS HARNESS');
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
      console.error('❌ [Browser Console Error]:', msg.text());
    }
  });

  const report = {
    timestamp: new Date().toISOString(),
    targetUrl: TARGET_URL,
    sections: {},
    assertions: { total: 0, passed: 0, failed: 0 },
    failures: [],
    verdict: 'PENDING'
  };

  function assert(condition, message, sectionKey) {
    report.assertions.total++;
    if (!report.sections[sectionKey]) {
      report.sections[sectionKey] = { passed: [], failed: [] };
    }
    if (condition) {
      report.assertions.passed++;
      console.log(`  ✅ [PASS] ${message}`);
      report.sections[sectionKey].passed.push(message);
    } else {
      report.assertions.failed++;
      console.error(`  ❌ [FAIL] ${message}`);
      report.failures.push(message);
      report.sections[sectionKey].failed.push(message);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Boot & Live Contract Ready
    // -------------------------------------------------------------------------
    console.log('[Phase 1] Booting headless browser and awaiting ready contract...');
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    assert(response && response.status() === 200, `HTTP status is 200 (received ${response ? response.status() : 'null'})`, 'phase1_boot');

    await page.waitForFunction(() => {
      return window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready === true;
    }, { timeout: 45000 });

    const contractCheck = await page.evaluate(() => {
      const g = window.__KEVIN_GAME__;
      const c = g && g.character;
      return {
        ready: g && g.ready,
        hasCharacter: !!c,
        hasPosition: !!(c && c.position && typeof c.position.x === 'number'),
        hasState: !!(c && typeof c.state === 'string'),
        hasPixieDust: !!(c && typeof c.pixieDust === 'number'),
        hasTeleport: !!(c && typeof c.teleport === 'function'),
        hasSetFlight: !!(c && typeof c.setFlight === 'function'),
        hasTriggerSonar: !!(c && typeof c.triggerSonar === 'function')
      };
    });

    assert(contractCheck.ready === true, 'window.__KEVIN_GAME__.ready === true', 'phase1_boot');
    assert(contractCheck.hasCharacter && contractCheck.hasPosition, 'Character position API exposed and reactive', 'phase1_boot');

    // -------------------------------------------------------------------------
    // Phase 2: Locomotion Across All 4 Landmarks
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2] Stress-Testing Locomotion Across All 4 Landmarks (Dock, Porch, Terrain, Bluffs)...');

    const landmarkLocomotion = await page.evaluate(async () => {
      const game = window._gameInstance;
      const ctrl = game.character;

      // 1. Dock Locomotion (Deck Y = 0.85m, Z in [6, 30])
      ctrl.teleport(0.0, 0.85, 10.0);
      ctrl.update(0.016);
      const dockStartPos = { ...ctrl.position };
      const dockGroundElev = ctrl.getGroundElevation(ctrl.position.x, ctrl.position.z);

      ctrl.keys.forward = true;
      let minDockY = 999;
      for (let i = 0; i < 20; i++) {
        ctrl.update(0.033);
        minDockY = Math.min(minDockY, ctrl.position.y);
      }
      ctrl.keys.forward = false;
      const dockMovedPos = { ...ctrl.position };

      // 2. Cabin Porch Locomotion (Deck Y = 2.35m, X in [20.25, 29.75], Z in [-11.0, -7.8])
      ctrl.teleport(25.0, 2.35, -9.5);
      ctrl.update(0.016);
      const porchGroundElev = ctrl.getGroundElevation(ctrl.position.x, ctrl.position.z);

      ctrl.keys.right = true; // Walk sideways along porch deck
      let minPorchY = 999;
      for (let i = 0; i < 15; i++) {
        ctrl.update(0.033);
        minPorchY = Math.min(minPorchY, ctrl.position.y);
      }
      ctrl.keys.right = false;

      // Walk off porch edge towards lake (+Z, Z > -7.8)
      ctrl.keys.forward = true;
      let steppedDownToTerrain = false;
      let postStepY = ctrl.position.y;
      for (let i = 0; i < 25; i++) {
        ctrl.update(0.033);
        if (ctrl.position.y < 2.1) {
          steppedDownToTerrain = true;
        }
        postStepY = ctrl.position.y;
      }
      ctrl.keys.forward = false;

      // 3. Shoreline & Terrain Following
      ctrl.teleport(10.0, ctrl.getGroundElevation(10.0, 8.0), 8.0);
      ctrl.update(0.016);
      ctrl.keys.forward = true;
      let terrainContinuousMatch = true;
      for (let i = 0; i < 20; i++) {
        ctrl.update(0.033);
        const expectedY = ctrl.getGroundElevation(ctrl.position.x, ctrl.position.z);
        if (Math.abs(ctrl.position.y - expectedY) > 0.08) {
          terrainContinuousMatch = false;
        }
      }
      ctrl.keys.forward = false;

      // Map boundary radius clamp: attempt sprint to +X
      ctrl.teleport(75.0, 2.0, 0.0);
      ctrl.keys.right = true;
      for (let i = 0; i < 30; i++) {
        ctrl.update(0.033);
      }
      ctrl.keys.right = false;
      const clampedBoundaryRadius = Math.hypot(ctrl.position.x, ctrl.position.z);

      // 4. Rocky Bluffs Overlook Plateau (+22m elevation)
      ctrl.teleport(-45.0, 22.0, 0.0);
      ctrl.update(0.016);
      const bluffStartElev = ctrl.position.y;

      ctrl.keys.forward = true;
      let minBluffY = 999;
      for (let i = 0; i < 15; i++) {
        ctrl.update(0.033);
        minBluffY = Math.min(minBluffY, ctrl.position.y);
      }
      ctrl.keys.forward = false;

      return {
        dockGroundElev,
        dockDeltaZ: dockMovedPos.z - dockStartPos.z,
        minDockY,
        porchGroundElev,
        minPorchY,
        steppedDownToTerrain,
        postStepY,
        terrainContinuousMatch,
        clampedBoundaryRadius,
        bluffStartElev,
        minBluffY,
        isGroundedOnBluff: ctrl.isGrounded
      };
    });

    assert(Math.abs(landmarkLocomotion.dockGroundElev - 0.85) < 0.05, `Dock deck elevation detected at Y=0.85m (actual: ${landmarkLocomotion.dockGroundElev.toFixed(2)}m)`, 'phase2_locomotion');
    assert(landmarkLocomotion.dockDeltaZ > 1.5, `Kevin advances forward along dock pier (+${landmarkLocomotion.dockDeltaZ.toFixed(2)}m)`, 'phase2_locomotion');
    assert(landmarkLocomotion.minDockY >= 0.84, `Kevin stays on dock surface, never sinking into lake water (min Y: ${landmarkLocomotion.minDockY.toFixed(3)}m)`, 'phase2_locomotion');

    assert(Math.abs(landmarkLocomotion.porchGroundElev - 2.35) < 0.05, `Cabin porch deck elevation detected at Y=2.35m (actual: ${landmarkLocomotion.porchGroundElev.toFixed(2)}m)`, 'phase2_locomotion');
    assert(landmarkLocomotion.minPorchY >= 2.34, `Kevin remains supported on porch deck while walking sideways (min Y: ${landmarkLocomotion.minPorchY.toFixed(3)}m)`, 'phase2_locomotion');
    assert(landmarkLocomotion.steppedDownToTerrain, `Walking off porch steps down naturally to terrain (final Y: ${landmarkLocomotion.postStepY.toFixed(2)}m)`, 'phase2_locomotion');

    assert(landmarkLocomotion.terrainContinuousMatch, 'Avatar height continuously matches compound terrain elevation map', 'phase2_locomotion');
    assert(landmarkLocomotion.clampedBoundaryRadius <= 80.05, `Lake perimeter soft boundary clamp enforces radius <= 80m (actual: ${landmarkLocomotion.clampedBoundaryRadius.toFixed(2)}m)`, 'phase2_locomotion');

    assert(landmarkLocomotion.bluffStartElev >= 21.0, `Bluffs plateau high elevation confirmed at Y >= 21m (actual: ${landmarkLocomotion.bluffStartElev.toFixed(2)}m)`, 'phase2_locomotion');
    assert(landmarkLocomotion.minBluffY >= 21.0, 'Overlook footing remains stable and solid at +22m elevation', 'phase2_locomotion');

    // -------------------------------------------------------------------------
    // Phase 3: Rapid Key Inputs & Diagonal Normalization
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3] Stress-Testing Rapid Key Inputs & Diagonal Vector Normalization...');

    const inputAudit = await page.evaluate(async () => {
      const ctrl = window._gameInstance.character;
      ctrl.teleport(0, 0.85, 10);
      ctrl.velocity.set(0, 0, 0);

      // Opposing inputs: W + S
      ctrl.keys.forward = true;
      ctrl.keys.backward = true;
      ctrl.keys.left = false;
      ctrl.keys.right = false;
      ctrl.update(0.016);
      const opposingWS_speed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // Opposing inputs: A + D
      ctrl.keys.forward = false;
      ctrl.keys.backward = false;
      ctrl.keys.left = true;
      ctrl.keys.right = true;
      ctrl.update(0.016);
      const opposingAD_speed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // All 4 keys down simultaneously: W + A + S + D
      ctrl.keys.forward = true;
      ctrl.keys.backward = true;
      ctrl.keys.left = true;
      ctrl.keys.right = true;
      ctrl.update(0.016);
      const opposingAll_speed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // Diagonal Normalization: W + D (Walking)
      ctrl.keys.forward = true;
      ctrl.keys.backward = false;
      ctrl.keys.left = false;
      ctrl.keys.right = true;
      ctrl.keys.sprint = false;
      ctrl.update(0.016);
      const diagWD_walkSpeed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // Diagonal Normalization: W + A (Walking)
      ctrl.keys.right = false;
      ctrl.keys.left = true;
      ctrl.update(0.016);
      const diagWA_walkSpeed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // Pure Forward (Walking baseline)
      ctrl.keys.left = false;
      ctrl.update(0.016);
      const pureFwd_walkSpeed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // Diagonal Normalization: W + D (Sprinting)
      ctrl.keys.right = true;
      ctrl.keys.sprint = true;
      ctrl.update(0.016);
      const diagWD_sprintSpeed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // Pure Forward (Sprinting baseline)
      ctrl.keys.right = false;
      ctrl.update(0.016);
      const pureFwd_sprintSpeed = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // Reset keys
      ctrl.keys.forward = false;
      ctrl.keys.backward = false;
      ctrl.keys.left = false;
      ctrl.keys.right = false;
      ctrl.keys.sprint = false;
      ctrl.update(0.016);

      // 60Hz rapid input fuzz test (100 ticks)
      let fuzzedWithoutCrash = true;
      let hasNaNOrInf = false;
      let maxVelocityMag = 0;

      for (let f = 0; f < 100; f++) {
        ctrl.keys.forward = (f % 2 === 0);
        ctrl.keys.backward = (f % 3 === 0);
        ctrl.keys.left = (f % 5 === 0);
        ctrl.keys.right = (f % 7 === 0);
        ctrl.keys.sprint = (f % 4 === 0);
        ctrl.update(0.016);

        const vMag = ctrl.velocity.length();
        maxVelocityMag = Math.max(maxVelocityMag, vMag);

        if (isNaN(ctrl.position.x) || isNaN(ctrl.position.y) || isNaN(ctrl.position.z) ||
            !isFinite(ctrl.position.x) || !isFinite(ctrl.position.y) || !isFinite(ctrl.position.z)) {
          hasNaNOrInf = true;
          fuzzedWithoutCrash = false;
        }
      }

      // Cleanup
      ctrl.keys.forward = false;
      ctrl.keys.backward = false;
      ctrl.keys.left = false;
      ctrl.keys.right = false;
      ctrl.keys.sprint = false;
      ctrl.teleport(0, 0.85, 10);

      return {
        opposingWS_speed,
        opposingAD_speed,
        opposingAll_speed,
        diagWD_walkSpeed,
        diagWA_walkSpeed,
        diagWD_sprintSpeed,
        pureFwd_walkSpeed,
        pureFwd_sprintSpeed,
        fuzzedWithoutCrash,
        hasNaNOrInf,
        maxVelocityMag
      };
    });

    assert(inputAudit.opposingWS_speed === 0, 'Opposing W+S keys cancel velocity to exactly 0', 'phase3_inputs');
    assert(inputAudit.opposingAD_speed === 0, 'Opposing A+D keys cancel velocity to exactly 0', 'phase3_inputs');
    assert(inputAudit.opposingAll_speed === 0, 'Simultaneous W+A+S+D keys cancel velocity to exactly 0', 'phase3_inputs');

    assert(Math.abs(inputAudit.diagWD_walkSpeed - inputAudit.pureFwd_walkSpeed) < 0.01,
      `Diagonal walk speed (${inputAudit.diagWD_walkSpeed.toFixed(2)}) equals forward walk speed (${inputAudit.pureFwd_walkSpeed.toFixed(2)}) without sqrt(2) diagonal overspeed`, 'phase3_inputs');
    assert(Math.abs(inputAudit.diagWD_sprintSpeed - inputAudit.pureFwd_sprintSpeed) < 0.01,
      `Diagonal sprint speed (${inputAudit.diagWD_sprintSpeed.toFixed(2)}) equals forward sprint speed (${inputAudit.pureFwd_sprintSpeed.toFixed(2)}) without diagonal overspeed`, 'phase3_inputs');
    assert(inputAudit.diagWD_walkSpeed <= 8.51, `Diagonal vector length normalized to <= 1.0 (speed: ${inputAudit.diagWD_walkSpeed.toFixed(2)} <= 8.5)`, 'phase3_inputs');

    assert(inputAudit.fuzzedWithoutCrash && !inputAudit.hasNaNOrInf, '100 frames of chaotic 60Hz key thrashing executed with zero NaNs or state corruption', 'phase3_inputs');
    assert(inputAudit.maxVelocityMag <= 30.0, `Kinematic velocity strictly bounded under chaotic inputs (max: ${inputAudit.maxVelocityMag.toFixed(2)} m/s)`, 'phase3_inputs');

    // -------------------------------------------------------------------------
    // Phase 4: Jumping, Gravity & Anti-Tunneling Landing
    // -------------------------------------------------------------------------
    console.log('\n[Phase 4] Stress-Testing Jumping, Gravity & Anti-Tunneling Landing...');

    const jumpAudit = await page.evaluate(async () => {
      const ctrl = window._gameInstance.character;

      // 1. Jump on Dock Deck (Y = 0.85m)
      ctrl.teleport(0, 0.85, 12);
      ctrl.update(0.016);

      ctrl.jumpJustPressed = true;
      ctrl.keys.jump = true;
      ctrl.update(0.016);
      ctrl.keys.jump = false;

      const launchVy = ctrl.velocity.y;
      const stateAtTakeoff = ctrl.state;

      let apexY = ctrl.position.y;
      let minFallY = 999;
      let landedOnDock = false;

      for (let f = 0; f < 60; f++) {
        ctrl.update(0.016);
        apexY = Math.max(apexY, ctrl.position.y);
        minFallY = Math.min(minFallY, ctrl.position.y);
        if (ctrl.isGrounded && ctrl.position.y >= 0.84) {
          landedOnDock = true;
        }
      }

      const dockPostLandY = ctrl.position.y;
      const dockPostLandVy = ctrl.velocity.y;

      // 2. Jump on Cabin Porch (Y = 2.35m)
      ctrl.teleport(25.0, 2.35, -9.5);
      ctrl.update(0.016);

      ctrl.jumpJustPressed = true;
      ctrl.keys.jump = true;
      ctrl.update(0.016);
      ctrl.keys.jump = false;

      let porchApexY = ctrl.position.y;
      let minPorchFallY = 999;
      for (let f = 0; f < 60; f++) {
        ctrl.update(0.016);
        porchApexY = Math.max(porchApexY, ctrl.position.y);
        minPorchFallY = Math.min(minPorchFallY, ctrl.position.y);
      }
      const porchPostLandY = ctrl.position.y;

      // 3. Abyssal Terminal Fall Anti-Tunneling Stress Test
      ctrl.teleport(15.0, 70.0, -10.0);
      ctrl.isGrounded = false;
      const terrainElev = ctrl.getGroundElevation(15.0, -10.0);

      let maxFallSpeedReached = 0;
      let clampedAtMinus25 = false;

      for (let f = 0; f < 225; f++) {
        ctrl.update(0.016);
        maxFallSpeedReached = Math.min(maxFallSpeedReached, ctrl.velocity.y);

        if (Math.abs(ctrl.velocity.y - (-25.0)) < 0.05) {
          clampedAtMinus25 = true;
        }

        if (ctrl.isGrounded) break;
      }

      const finalImpactY = ctrl.position.y;
      const finalImpactVy = ctrl.velocity.y;

      return {
        launchVy,
        stateAtTakeoff,
        apexY,
        minFallY,
        landedOnDock,
        dockPostLandY,
        dockPostLandVy,
        porchApexY,
        minPorchFallY,
        porchPostLandY,
        terrainElev,
        maxFallSpeedReached,
        clampedAtMinus25,
        finalImpactY,
        finalImpactVy
      };
    });

    assert(jumpAudit.launchVy >= 9.0, `Jump vertical impulse vy = ${jumpAudit.launchVy.toFixed(2)} m/s (>= 9.0 m/s)`, 'phase4_jumping');
    assert(jumpAudit.stateAtTakeoff === 'jumping', 'Character state transitions to "jumping" upon takeoff', 'phase4_jumping');
    assert(jumpAudit.apexY > 2.5, `Jump reaches calculated parabolic apex (${jumpAudit.apexY.toFixed(2)}m)`, 'phase4_jumping');
    assert(jumpAudit.minFallY >= 0.84, `Dock jump never clips below 0.85m deck into lake water (lowest Y: ${jumpAudit.minFallY.toFixed(3)}m)`, 'phase4_jumping');
    assert(Math.abs(jumpAudit.dockPostLandY - 0.85) < 0.01, `Landing on dock settles exactly at deck elevation Y=0.85m`, 'phase4_jumping');
    assert(jumpAudit.dockPostLandVy === 0, 'Vertical velocity resets to 0 upon surface landing', 'phase4_jumping');

    assert(jumpAudit.minPorchFallY >= 2.34, `Porch jump never clips below 2.35m deck into cabin base (lowest Y: ${jumpAudit.minPorchFallY.toFixed(3)}m)`, 'phase4_jumping');
    assert(Math.abs(jumpAudit.porchPostLandY - 2.35) < 0.01, `Landing on porch settles exactly at deck elevation Y=2.35m`, 'phase4_jumping');

    assert(jumpAudit.clampedAtMinus25, `Terminal fall velocity clamped strictly at -25.0 m/s during high-altitude descent (reached: ${jumpAudit.maxFallSpeedReached.toFixed(2)} m/s)`, 'phase4_jumping');
    assert(jumpAudit.finalImpactY >= jumpAudit.terrainElev - 0.01, `Zero collision tunnelling: Impact at terminal velocity halts cleanly at terrain surface Y=${jumpAudit.finalImpactY.toFixed(2)}m (terrain: ${jumpAudit.terrainElev.toFixed(2)}m)`, 'phase4_jumping');
    assert(jumpAudit.finalImpactVy === 0, 'Terminal velocity reset cleanly to 0 upon ground collision', 'phase4_jumping');

    // -------------------------------------------------------------------------
    // Phase 5: Steep Slope Sliding on Cliff Faces (>50 degrees)
    // -------------------------------------------------------------------------
    console.log('\n[Phase 5] Stress-Testing Steep Slope Sliding on Cliff Faces (>50 degrees)...');

    const slopeAudit = await page.evaluate(async () => {
      const ctrl = window._gameInstance.character;

      // Find steep slope (>50 degrees) in bluffs
      let steepCoord = null;
      let maxFoundAngle = 0;

      for (let x = -26.0; x >= -45.0; x -= 1.0) {
        for (let z = -20.0; z <= 20.0; z += 2.0) {
          const s = ctrl.getSlopeAt(x, z);
          if (s.angleDeg > maxFoundAngle) {
            maxFoundAngle = s.angleDeg;
          }
          if (s.angleDeg > 50.0 && !steepCoord) {
            steepCoord = { x, z, ...s };
          }
        }
      }

      // Gentle slope test (<45 deg)
      const gentleSlope = ctrl.getSlopeAt(20.0, 0.0);
      ctrl.teleport(20.0, gentleSlope.angleDeg, 0.0);
      ctrl.velocity.set(0, 0, 0);
      ctrl.update(0.016);
      const gentleSlideVelocity = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);

      // Steep slope test (>50 deg)
      let steepSlideTriggered = false;
      let slideVectorLength = 0;
      let driftedDownhill = false;

      if (steepCoord) {
        const yElev = ctrl.getGroundElevation(steepCoord.x, steepCoord.z);
        ctrl.teleport(steepCoord.x, yElev, steepCoord.z);
        ctrl.velocity.set(0, 0, 0);

        ctrl.update(0.033);
        slideVectorLength = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);
        if (slideVectorLength > 0.5) {
          steepSlideTriggered = true;
        }

        const startElev = ctrl.position.y;
        for (let f = 0; f < 20; f++) {
          ctrl.update(0.033);
        }
        if (ctrl.position.y < startElev || Math.hypot(ctrl.position.x - steepCoord.x, ctrl.position.z - steepCoord.z) > 1.0) {
          driftedDownhill = true;
        }
      }

      return {
        maxFoundAngle,
        steepCoord,
        gentleSlope,
        gentleSlideVelocity,
        steepSlideTriggered,
        slideVectorLength,
        driftedDownhill
      };
    });

    assert(slopeAudit.gentleSlideVelocity === 0, `Gentle slope (${slopeAudit.gentleSlope.angleDeg.toFixed(1)}°) provides stable footing with zero passive slide`, 'phase5_slopes');
    assert(slopeAudit.maxFoundAngle > 50.0, `Bluff chasm features slopes exceeding 50 degrees (max detected: ${slopeAudit.maxFoundAngle.toFixed(1)}°)`, 'phase5_slopes');
    assert(slopeAudit.steepSlideTriggered, `Steep slope (${slopeAudit.steepCoord ? slopeAudit.steepCoord.angleDeg.toFixed(1) : 0}°) immediately induces downward sliding force (slide velocity: ${slopeAudit.slideVectorLength.toFixed(2)} m/s)`, 'phase5_slopes');
    assert(slopeAudit.driftedDownhill, 'Player automatically slides down steep bluff face (>50°) without manual input', 'phase5_slopes');

    // -------------------------------------------------------------------------
    // Phase 6: Camera Follow & Obstacle Raycast Collision
    // -------------------------------------------------------------------------
    console.log('\n[Phase 6] Stress-Testing Follow Camera Orbit & Obstacle Raycast Avoidance...');

    const cameraAudit = await page.evaluate(async () => {
      const game = window.__KEVIN_GAME__;
      const ctrl = window._gameInstance.character;
      const cam = ctrl.thirdPersonCamera;

      // 1. Pitch Clamping Stress (Prevent gimbal lock at poles)
      cam.pitch = 0;
      cam.pitch += 10.0;
      cam.update(0.016, ctrl.position);
      const clampedMaxPitch = cam.pitch;

      cam.pitch -= 20.0;
      cam.update(0.016, ctrl.position);
      const clampedMinPitch = cam.pitch;

      cam.pitch = 0.15;

      // 2. Obstacle Raycast Avoidance: Cabin Exterior Wall
      ctrl.teleport(25.0, 2.0, -8.0);
      cam.yaw = 0;
      cam.pitch = 0.05;
      cam.targetDistance = 9.0;
      cam.update(0.016, ctrl.position);

      const unobstructedDist = cam.currentDistance;

      // Orbit camera so camera sits behind cabin wall looking at Kevin
      cam.yaw = Math.PI;
      for (let f = 0; f < 30; f++) {
        cam.update(0.033, ctrl.position);
      }
      const obstructedDist = cam.currentDistance;
      const cameraActualPos = { ...game.camera.position };

      // Check if camera clipped inside cabin bounding box:
      // Cabin box: X in [19.5, 30.5], Z in [-19.0, -11.0], Y < 6.2
      const isInsideCabin = (
        cameraActualPos.x >= 19.5 && cameraActualPos.x <= 30.5 &&
        cameraActualPos.z >= -19.0 && cameraActualPos.z <= -11.0 &&
        cameraActualPos.y < 6.2
      );

      // 3. Obstacle Collision: Prevent Character Walking into Cabin Walls
      ctrl.teleport(25.0, 2.0, -10.5);
      ctrl.keys.backward = false;
      ctrl.keys.forward = true;
      cam.yaw = Math.PI;
      for (let f = 0; f < 25; f++) {
        ctrl.update(0.033);
      }
      ctrl.keys.forward = false;
      const blockedPos = { ...ctrl.position };

      return {
        clampedMinPitch,
        clampedMaxPitch,
        minPitchRad: cam.minPitch,
        maxPitchRad: cam.maxPitch,
        unobstructedDist,
        obstructedDist,
        cameraActualPos,
        isInsideCabin,
        blockedPos
      };
    });

    assert(cameraAudit.clampedMaxPitch <= cameraAudit.maxPitchRad + 0.001, `Camera pitch max clamped to +85° (+1.4835 rad, actual: ${cameraAudit.clampedMaxPitch.toFixed(4)})`, 'phase6_camera');
    assert(cameraAudit.clampedMinPitch >= cameraAudit.minPitchRad - 0.001, `Camera pitch min clamped to -85° (-1.4835 rad, actual: ${cameraAudit.clampedMinPitch.toFixed(4)})`, 'phase6_camera');

    assert(cameraAudit.obstructedDist < 8.5, `Camera obstacle raycaster contracts distance when occluded by cabin wall (contracted to ${cameraAudit.obstructedDist.toFixed(2)}m from 9.0m)`, 'phase6_camera');
    assert(!cameraAudit.isInsideCabin, `Camera is strictly prevented from clipping inside cabin wall interior (pos: ${cameraAudit.cameraActualPos.x.toFixed(1)}, ${cameraAudit.cameraActualPos.y.toFixed(1)}, ${cameraAudit.cameraActualPos.z.toFixed(1)})`, 'phase6_camera');
    assert(cameraAudit.blockedPos.z >= -11.0, `Character solid obstacle avoidance stops Kevin at cabin wall perimeter (Z: ${cameraAudit.blockedPos.z.toFixed(2)} >= -11.0)`, 'phase6_camera');

    // -------------------------------------------------------------------------
    // Phase 7: Adversarial Flight Persistence & Interface Bug Audit
    // -------------------------------------------------------------------------
    console.log('\n[Phase 7] Auditing Programmatic Flight Persistence & State Machine Synchronization...');

    const flightBugAudit = await page.evaluate(async () => {
      const g = window.__KEVIN_GAME__;
      const ctrl = window._gameInstance.character;

      // Test programmatic API flight without holding keyboard Space
      ctrl.keys.jump = false;
      ctrl.pixieDust = 100.0;
      ctrl.teleport(0, 15.0, 10.0);
      ctrl.isGrounded = false;

      // Call API
      g.character.setFlight(true);
      const isFlyingImmediately = ctrl.isFlying;
      const stateImmediately = ctrl.state;

      // Update 1 frame
      ctrl.update(0.033);
      const isFlyingAfterFrame1 = ctrl.isFlying;
      const stateAfterFrame1 = ctrl.state;

      // Check Pixie Dust drain when setFlight(true) called programmatically
      const dustBeforeUpdate = ctrl.pixieDust;
      for (let f = 0; f < 10; f++) {
        ctrl.update(0.05);
      }
      const dustAfter10Updates = ctrl.pixieDust;
      const dustDrained = dustBeforeUpdate - dustAfter10Updates;

      return {
        isFlyingImmediately,
        stateImmediately,
        isFlyingAfterFrame1,
        stateAfterFrame1,
        dustDrained
      };
    });

    console.log('  Flight Bug Audit Data:', flightBugAudit);
    assert(flightBugAudit.isFlyingImmediately === true, 'setFlight(true) immediately activates isFlying = true', 'phase7_flight_bug');
    assert(flightBugAudit.isFlyingAfterFrame1 === true,
      `BUG VERIFICATION: Programmatic setFlight(true) must persist across frame update (isFlying: ${flightBugAudit.isFlyingAfterFrame1}, state: "${flightBugAudit.stateAfterFrame1}")`, 'phase7_flight_bug');
    assert(flightBugAudit.dustDrained > 0.0,
      `BUG VERIFICATION: Pixie Dust must continuously drain while in programmatic flight (drained: ${flightBugAudit.dustDrained.toFixed(2)}%)`, 'phase7_flight_bug');

    // -------------------------------------------------------------------------
    // Phase 8: WebGL Health & Runtime Stability
    // -------------------------------------------------------------------------
    console.log('\n[Phase 8] Auditing WebGL Context Health and Multi-Frame Stability...');

    const stabilityAudit = await page.evaluate(async () => {
      const game = window.__KEVIN_GAME__;
      const gl = game.renderer.getContext();
      return {
        contextLost: gl.isContextLost(),
        glError: gl.getError(),
        errorCount: game.telemetry.errorCount,
        lastError: game.telemetry.lastError
      };
    });

    assert(!stabilityAudit.contextLost, 'WebGL context is healthy and NOT lost', 'phase8_stability');
    assert(stabilityAudit.glError === 0, `WebGL gl.getError() === 0 (NO_ERROR)`, 'phase8_stability');
    assert(stabilityAudit.errorCount === 0, `In-game error trap count === 0`, 'phase8_stability');
    assert(pageErrors.length === 0, `Browser window page errors === 0 (received ${pageErrors.length})`, 'phase8_stability');

    // -------------------------------------------------------------------------
    // Verdict Determination
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`TOTAL ASSERTIONS: ${report.assertions.total}`);
    console.log(`PASSED:           ${report.assertions.passed}`);
    console.log(`FAILED:           ${report.assertions.failed}`);

    if (report.assertions.failed === 0) {
      report.verdict = 'APPROVE';
      console.log('🏆 VERDICT: APPROVE');
    } else {
      report.verdict = 'FAIL';
      console.log('❌ VERDICT: FAIL');
      console.log('Failed Assertions:');
      report.failures.forEach(f => console.log(`  - ${f}`));
    }
    console.log('========================================================================\n');

  } catch (err) {
    console.error('💥 Unhandled exception during challenger execution:', err);
    report.verdict = 'FAIL';
    report.failures.push(err.message || String(err));
  } finally {
    const reportPath = path.resolve('tests/challenger_m2_locomotion_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Report written to ${reportPath}`);
    await browser.close();
  }

  process.exit(report.verdict === 'APPROVE' ? 0 : 1);
}

runChallengerLocomotionPhysicsAudit();
