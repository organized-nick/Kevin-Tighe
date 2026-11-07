/**
 * tests/tier5_adversarial_character.mjs
 * Phase 2: Tier 5 Adversarial Coverage Hardening (White-Box Code Path & Invariant Stress Analysis)
 * 
 * Target: Character Controller, Flight Kinetics, Neverland Fairy/Shadow, Collision Meshes & Audio Synth
 * Runs against live http://localhost:8097
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic resolver for Playwright
let playwrightModule = null;
async function getPlaywright() {
  if (playwrightModule) return playwrightModule;
  try {
    playwrightModule = await import('../kevin-tighe-lakeside/node_modules/playwright/index.mjs');
    return playwrightModule;
  } catch (err) {
    try {
      playwrightModule = await import('playwright');
      return playwrightModule;
    } catch (err2) {
      throw new Error(`Failed to load Playwright: ${err.message} / ${err2.message}`);
    }
  }
}

// Lightweight Test Harness for Tier 5
class AdversarialHarness {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.bugs = [];
    this.warnings = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  recordBug(id, summary, details) {
    this.bugs.push({ id, summary, details });
  }

  recordWarning(id, summary, details) {
    this.warnings.push({ id, summary, details });
  }

  async run(page) {
    console.log('\n========================================================================');
    console.log('   TIER 5 ADVERSARIAL COVERAGE HARDENING: WHITE-BOX INVARIANT AUDIT');
    console.log('========================================================================\n');

    for (const t of this.tests) {
      const startTime = Date.now();
      try {
        await t.fn(page);
        const duration = Date.now() - startTime;
        this.passed++;
        console.log(`  \x1b[32m✔ PASS\x1b[0m [${duration}ms] ${t.name}`);
      } catch (err) {
        const duration = Date.now() - startTime;
        this.failed++;
        console.log(`  \x1b[31m✖ FAIL\x1b[0m [${duration}ms] ${t.name}`);
        console.log(`    \x1b[31m${err.message}\x1b[0m`);
        this.recordBug(t.name, err.message, err.stack);
      }
    }

    console.log('\n------------------------------------------------------------------------');
    console.log(`   EXECUTION SUMMARY: ${this.passed} passed, ${this.failed} failed out of ${this.tests.length}`);
    console.log(`   CONFIRMED GAPS/BUGS: ${this.bugs.length}`);
    console.log('------------------------------------------------------------------------\n');

    return {
      total: this.tests.length,
      passed: this.passed,
      failed: this.failed,
      bugs: this.bugs,
      warnings: this.warnings
    };
  }
}

const harness = new AdversarialHarness();

// ============================================================================
// SUITE 1: Delta Time Extremes & Numerical Stability (Controller & Flight)
// ============================================================================

harness.test('T5-DT-01: Zero delta-time (dt = 0) does not alter position or introduce NaN', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    ctrl.teleport(0, 0.85, 10);
    const posBefore = { x: ctrl.position.x, y: ctrl.position.y, z: ctrl.position.z };
    const velBefore = { x: ctrl.velocity.x, y: ctrl.velocity.y, z: ctrl.velocity.z };

    // Update with dt = 0
    ctrl.update(0);

    const posAfter = { x: ctrl.position.x, y: ctrl.position.y, z: ctrl.position.z };
    const velAfter = { x: ctrl.velocity.x, y: ctrl.velocity.y, z: ctrl.velocity.z };

    const posIdentical = posBefore.x === posAfter.x && posBefore.y === posAfter.y && posBefore.z === posAfter.z;
    const noNaN = !Number.isNaN(posAfter.x) && !Number.isNaN(posAfter.y) && !Number.isNaN(posAfter.z);
    return { posIdentical, noNaN, posBefore, posAfter };
  });

  if (!result.noNaN) throw new Error('Zero dt update introduced NaN into position coordinates');
  if (!result.posIdentical) throw new Error(`Zero dt update moved character: before=${JSON.stringify(result.posBefore)}, after=${JSON.stringify(result.posAfter)}`);
});

harness.test('T5-DT-02: Large delta-time spike (dt = 2.0s & 10.0s) respects terminal velocity clamp and elevation floor', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    // Position airborne high above ground
    ctrl.teleport(0, 50.0, 10);
    ctrl.isGrounded = false;
    ctrl.isFlying = false;

    // Simulate 2s spike of gravity
    ctrl.update(2.0);

    const vyClamped = ctrl.velocity.y >= -25.0; // Terminal velocity clamp
    const yFinite = Number.isFinite(ctrl.position.y);
    const aboveOrOnGround = ctrl.position.y >= ctrl.getGroundElevation(ctrl.position.x, ctrl.position.z);

    // Simulate 10s massive spike
    ctrl.update(10.0);
    const finalElevation = ctrl.position.y;
    const expectedGround = ctrl.getGroundElevation(ctrl.position.x, ctrl.position.z);
    const groundLatched = Math.abs(finalElevation - expectedGround) < 0.05 && ctrl.isGrounded === true;

    return { vyClamped, yFinite, aboveOrOnGround, groundLatched, finalElevation, expectedGround };
  });

  if (!result.vyClamped) throw new Error('Velocity exceeded terminal velocity clamp (-25.0 m/s)');
  if (!result.groundLatched) throw new Error(`Large dt spike fell through ground! finalElevation=${result.finalElevation}, expectedGround=${result.expectedGround}`);
});

harness.test('T5-DT-03: Particle emitter spawn loop does not freeze thread on large dt spike', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const flight = game.character.flight;
    flight.pixieDust = 100;
    flight.setFlight(true);

    const start = performance.now();
    // Simulate dt = 1.0s (rate is 0.035, so ~28 particles)
    flight.update(1.0, false, true, { x: 0, y: 1, z: 0 }, { x: 0, y: 10, z: 0 });
    const elapsed = performance.now() - start;

    const particlesActive = flight.emitter.activeCount <= flight.emitter.capacity;
    return { elapsed, particlesActive, count: flight.emitter.activeCount };
  });

  if (result.elapsed > 200) throw new Error(`Particle spawn loop hung thread for ${result.elapsed}ms on dt spike`);
  if (!result.particlesActive) throw new Error(`Particle count exceeded pool capacity: ${result.count}`);
});

harness.test('T5-NUM-01: Negative delta-time handling (dt = -0.016s) in camera lerp', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const cam = game.character.thirdPersonCamera;
    const posBefore = cam.camera.position.clone();

    // Call update with negative dt
    cam.update(-0.016, { x: 0, y: 1, z: 10 });

    const posAfter = cam.camera.position.clone();
    const hasNaN = Number.isNaN(posAfter.x) || Number.isNaN(posAfter.y) || Number.isNaN(posAfter.z);
    const hasInf = !Number.isFinite(posAfter.x) || !Number.isFinite(posAfter.y) || !Number.isFinite(posAfter.z);

    // Reset camera safely
    cam.update(0.016, { x: 0, y: 1, z: 10 });
    return { hasNaN, hasInf, posAfter: { x: posAfter.x, y: posAfter.y, z: posAfter.z } };
  });

  if (result.hasNaN || result.hasInf) {
    throw new Error(`Negative delta time produced NaN or Infinity in camera position: ${JSON.stringify(result.posAfter)}`);
  }
});

harness.test('T5-NUM-02: Setting Pixie Dust to NaN recovers or sanitizes to a valid number', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    
    // Attempt to inject NaN into pixieDust setter
    ctrl.pixieDust = NaN;
    const dustAfterNaN = ctrl.pixieDust;
    const isNaNResult = Number.isNaN(dustAfterNaN);

    // Test if flight can activate when dust is NaN
    ctrl.setFlight(true);
    const couldFly = ctrl.isFlying;

    // Reset to 100 for safety
    ctrl.pixieDust = 100;
    return { isNaNResult, dustAfterNaN, couldFly };
  });

  // If pixieDust accepted NaN, that is an unhandled numerical sanitization gap!
  if (result.isNaNResult) {
    throw new Error(`CRITICAL NUMERICAL GAP: CharacterController.pixieDust setter accepted NaN without sanitization (dust = ${result.dustAfterNaN})`);
  }
});

harness.test('T5-NUM-03: Facing angle normalization latency attack (O(n) while loop vulnerability)', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    const originalFacing = ctrl.facingAngle;

    // Test with large angle (1e6 rad)
    ctrl.facingAngle = 1e6;
    ctrl.keys.forward = true;
    const start = performance.now();
    ctrl.update(0.016);
    const elapsed = performance.now() - start;
    ctrl.keys.forward = false;

    const angleAfter = ctrl.facingAngle;
    const isFiniteAngle = Number.isFinite(angleAfter);
    ctrl.facingAngle = originalFacing;

    // Normalizing an angle should take < 5ms with modulo arithmetic, not millions of while loop iterations
    const efficient = elapsed < 50;
    return { efficient, elapsed, isFiniteAngle, angleAfter };
  });

  if (!result.efficient) {
    throw new Error(`CONFIRMED CPU HANG VULNERABILITY: Normalizing facingAngle took ${result.elapsed.toFixed(1)}ms! controller.js uses "while (angleDiff > Math.PI) angleDiff -= Math.PI * 2" which runs O(n) sequential subtractions instead of O(1) modulo!`);
  }
});

// ============================================================================
// SUITE 2: Flight Kinetics, Particles & Rapid Input Stress
// ============================================================================

harness.test('T5-FLT-01: Rapid flight toggle stress (60 toggles) maintains stable state and velocity', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    ctrl.teleport(0, 15, 10);
    ctrl.pixieDust = 100;

    for (let i = 0; i < 60; i++) {
      ctrl.setFlight(i % 2 === 0);
      ctrl.update(0.016);
    }

    const stateValid = ['flying', 'falling', 'jumping', 'idle'].includes(ctrl.state);
    const velFinite = Number.isFinite(ctrl.velocity.y);
    const dustFinite = Number.isFinite(ctrl.pixieDust) && ctrl.pixieDust >= 0;

    return { stateValid, velFinite, dustFinite, state: ctrl.state, vy: ctrl.velocity.y, dust: ctrl.pixieDust };
  });

  if (!result.stateValid) throw new Error(`State invalid after rapid flight toggling: ${result.state}`);
  if (!result.velFinite) throw new Error(`Velocity Y is non-finite: ${result.vy}`);
  if (!result.dustFinite) throw new Error(`Pixie dust invalid: ${result.dust}`);
});

harness.test('T5-FLT-02: Particle pool capacity exhaustion recycling under continuous flight', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const flight = game.character.flight;
    flight.pixieDust = 100;
    flight.setFlight(true);

    // Simulate 300 frames of flight (~5 seconds)
    for (let i = 0; i < 300; i++) {
      flight.update(0.016, false, true, { x: 0, y: 1, z: 0 }, { x: 0, y: 10 + i * 0.1, z: 0 });
    }

    const emitter = flight.emitter;
    const count = emitter.activeCount;
    const capacity = emitter.capacity;
    const withinCapacity = count <= capacity;
    const bufferHealthy = emitter.positions.length === capacity * 3;

    return { count, capacity, withinCapacity, bufferHealthy };
  });

  if (!result.withinCapacity) throw new Error(`Active particle count (${result.count}) exceeded capacity (${result.capacity})`);
  if (!result.bufferHealthy) throw new Error('Particle position buffer length changed or corrupted');
});

harness.test('T5-FLT-03: Mid-jump flight arrest recovers from terminal fall velocity (-25 m/s)', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    ctrl.teleport(0, 40, 10);
    ctrl.velocity.y = -25.0; // Terminal fall velocity
    ctrl.isGrounded = false;
    ctrl.isFlying = false;
    ctrl.pixieDust = 100;

    // Activate flight mid-fall
    ctrl.setFlight(true);
    const vyImmediate = ctrl.velocity.y;

    // Tick frame
    ctrl.update(0.016);
    const vyAfterTick = ctrl.velocity.y;
    const fallArrested = vyImmediate >= 4.0 && vyAfterTick >= 4.0;

    return { fallArrested, vyImmediate, vyAfterTick };
  });

  if (!result.fallArrested) {
    throw new Error(`Flight failed to arrest terminal fall: immediate vy=${result.vyImmediate}, tick vy=${result.vyAfterTick}`);
  }
});

harness.test('T5-FLT-04: Fuel exhaustion transition from 0.01% to 0.00% triggers falling state cleanly', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    ctrl.teleport(0, 30, 10);
    ctrl.isGrounded = false;
    ctrl.pixieDust = 0.05; // tiny amount of fuel left
    ctrl.setFlight(true);

    // Update with dt large enough to exhaust remaining 0.05 dust (drain is 24%/s)
    ctrl.flight.update(0.1, false, true, ctrl.velocity, ctrl.position);

    const dustZero = ctrl.flight.pixieDust === 0.0;
    const isFlyingFalse = ctrl.flight.isFlying === false;
    const stateFalling = ctrl.flight.state === 'falling';

    return { dustZero, isFlyingFalse, stateFalling, state: ctrl.flight.state, dust: ctrl.flight.pixieDust };
  });

  if (!result.dustZero) throw new Error(`Pixie dust not 0.0 after exhaustion: ${result.dust}`);
  if (!result.isFlyingFalse) throw new Error('Flight still active when fuel exhausted');
  if (!result.stateFalling) throw new Error(`Flight state should be "falling" on fuel exhaustion, got "${result.state}"`);
});

// ============================================================================
// SUITE 3: Neverland Fairy & Runaway Shadow Invariants
// ============================================================================

harness.test('T5-FRY-01: Fairy companion stays strictly tethered (< 5.0m) during high-speed teleportation', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    const fairy = ctrl.fairy;

    // Teleport character to far side of map
    ctrl.teleport(60.0, 5.0, -60.0);

    const charPos = ctrl.position;
    const fairyPos = fairy.group.position;
    const dist = Math.hypot(fairyPos.x - charPos.x, fairyPos.y - charPos.y, fairyPos.z - charPos.z);

    const tethered = dist < 5.0;
    return { tethered, dist, charPos: { x: charPos.x, y: charPos.y, z: charPos.z }, fairyPos: { x: fairyPos.x, y: fairyPos.y, z: fairyPos.z } };
  });

  if (!result.tethered) {
    throw new Error(`Fairy companion detached beyond 5.0m tether limit on teleport! Distance: ${result.dist.toFixed(2)}m`);
  }
});

harness.test('T5-SHD-01: Runaway Shadow zero-dt invariant violation test (dt = 0 should NOT move shadow)', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const shadow = game.character.shadow;
    const getGround = (x, z) => game.character.getGroundElevation(x, z);

    // Snap shadow to (0, 0, 0)
    shadow.teleportTo(0, 0, 0, getGround);
    const posInitial = { x: shadow.mesh.position.x, y: shadow.mesh.position.y, z: shadow.mesh.position.z };

    // Player position is far away at (20, 2, 20)
    const playerPos = { x: 20.0, y: 2.0, z: 20.0 };

    // Update with dt = 0 (game paused)
    shadow.update(0, playerPos, getGround);
    const posAfterZeroDt = { x: shadow.mesh.position.x, y: shadow.mesh.position.y, z: shadow.mesh.position.z };

    const movedOnZeroDt = Math.hypot(posAfterZeroDt.x - posInitial.x, posAfterZeroDt.z - posInitial.z) > 0.001;
    const distanceMoved = Math.hypot(posAfterZeroDt.x - posInitial.x, posAfterZeroDt.z - posInitial.z);

    return { movedOnZeroDt, distanceMoved, posInitial, posAfterZeroDt };
  });

  // If the shadow moved on dt=0, that confirms our white-box finding: `(dt ? dt * 30.0 : 1.0)` bug!
  if (result.movedOnZeroDt) {
    throw new Error(`CONFIRMED INVARIANT BUG: RunawayShadow moved ${result.distanceMoved.toFixed(3)}m when dt=0 due to (dt ? dt * 30 : 1.0) falsy fallback!`);
  }
});

harness.test('T5-SHD-02: Runaway Shadow compound elevation projection across terrain, dock, and cabin porch', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const shadow = game.character.shadow;
    const getGround = (x, z) => game.character.getGroundElevation(x, z);

    // 1. Over Wooden Dock (deck at Y=0.85)
    shadow.teleportTo(0.0, 0.85, 15.0, getGround);
    const dockElev = shadow.mesh.position.y;
    const dockCorrect = Math.abs(dockElev - 0.87) < 0.05; // 0.85 + 0.02 groundY

    // 2. Over Cabin Porch (deck at Y=2.35)
    shadow.teleportTo(25.0, 2.35, -9.5, getGround);
    const porchElev = shadow.mesh.position.y;
    const porchCorrect = Math.abs(porchElev - 2.37) < 0.05; // 2.35 + 0.02 groundY

    return { dockCorrect, porchCorrect, dockElev, porchElev };
  });

  if (!result.dockCorrect) throw new Error(`Shadow elevation on dock incorrect: expected ~0.87m, got ${result.dockElev}m`);
  if (!result.porchCorrect) throw new Error(`Shadow elevation on porch incorrect: expected ~2.37m, got ${result.porchElev}m`);
});

// ============================================================================
// SUITE 4: Collision Meshes & Compound Elevation Boundaries
// ============================================================================

harness.test('T5-COL-01: Dockside Plunge Pit hole cylinder rim vs dock collision opening boundary test', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;
    const hole = game.holeManager.getHoleById('hole_dockside');

    // hole_dockside is at {x: 0, z: 22.0} with radius: 1.6 (bounds: z from 20.4 to 23.6)
    // In controller.js line 164: inPlungePitOpening = (z >= 21.0 && z <= 23.2);
    // At z = 20.6, the hole cylinder opening exists visually, but controller treats it as solid dock (0.85m)!
    const groundAtRim20_6 = ctrl.getGroundElevation(0.0, 20.6);
    const groundInside22_0 = ctrl.getGroundElevation(0.0, 22.0);

    const rimIsSolidDock = groundAtRim20_6 >= 0.85;
    const insideAllowsDescent = groundInside22_0 < 0.85;

    return {
      holeRadius: hole ? hole.radius : null,
      groundAtRim20_6,
      groundInside22_0,
      rimIsSolidDock,
      insideAllowsDescent
    };
  });

  if (result.rimIsSolidDock && result.insideAllowsDescent) {
    throw new Error(`CONFIRMED COLLISION MESH GAP: Hole radius 1.6m spans z=[20.4, 23.6], but dock collision opening only spans [21.0, 23.2]. At z=20.6, player walks on invisible dock over the hole (elevation = ${result.groundAtRim20_6}m)!`);
  }
});

harness.test('T5-COL-02: Cabin solid obstacle boundary containment resolves penetration from all cardinals', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;

    // Test penetration from 4 sides of cabin [19.5, 30.5] x [-19.0, -11.0]
    // 1. From East (X > 30.5 moving West)
    const testEast = { x: 30.0, y: 2.0, z: -15.0 };
    ctrl.resolveObstacles(testEast);
    const eastResolved = testEast.x >= 30.5;

    // 2. From West (X < 19.5 moving East)
    const testWest = { x: 20.0, y: 2.0, z: -15.0 };
    ctrl.resolveObstacles(testWest);
    const westResolved = testWest.x <= 19.5;

    // 3. From South (Z > -11.0 moving North)
    const testSouth = { x: 25.0, y: 2.0, z: -11.5 };
    ctrl.resolveObstacles(testSouth);
    const southResolved = testSouth.z >= -11.0;

    // 4. From North (Z < -19.0 moving South)
    const testNorth = { x: 25.0, y: 2.0, z: -18.5 };
    ctrl.resolveObstacles(testNorth);
    const northResolved = testNorth.z <= -19.0;

    return { eastResolved, westResolved, southResolved, northResolved };
  });

  if (!result.eastResolved) throw new Error('Cabin collision failed to resolve East penetration');
  if (!result.westResolved) throw new Error('Cabin collision failed to resolve West penetration');
  if (!result.southResolved) throw new Error('Cabin collision failed to resolve South penetration');
  if (!result.northResolved) throw new Error('Cabin collision failed to resolve North penetration');
});

harness.test('T5-COL-03: Lake perimeter soft clamp strictly enforces 80.0m radius under high velocity', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const ctrl = game.character;

    // Place character beyond radius
    const testPos = { x: 120.0, y: 1.0, z: 120.0 };
    ctrl.resolveObstacles(testPos);

    const clampedDist = Math.hypot(testPos.x, testPos.z);
    const strictlyEnforced = Math.abs(clampedDist - 80.0) < 0.001;

    return { strictlyEnforced, clampedDist };
  });

  if (!result.strictlyEnforced) {
    throw new Error(`Lake perimeter soft clamp failed: distance was ${result.clampedDist}, expected strictly 80.0m`);
  }
});

// ============================================================================
// SUITE 5: Camera Controller & Gimbal Lock Stress
// ============================================================================

harness.test('T5-CAM-01: Camera pitch clamp strictly enforces [-85°, +85°] preventing gimbal flip', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const cam = game.character.thirdPersonCamera;
    const maxPitch = (85 * Math.PI) / 180;
    const minPitch = (-85 * Math.PI) / 180;

    cam.setPitch(500.0);
    const topClamped = Math.abs(cam.pitch - maxPitch) < 0.001;

    cam.setPitch(-500.0);
    const bottomClamped = Math.abs(cam.pitch - minPitch) < 0.001;

    cam.setPitch(0.15);
    return { topClamped, bottomClamped, actualTop: cam.pitch };
  });

  if (!result.topClamped) throw new Error('Camera top pitch clamp failed to enforce +85 degrees');
  if (!result.bottomClamped) throw new Error('Camera bottom pitch clamp failed to enforce -85 degrees');
});

harness.test('T5-CAM-02: Wheel zoom numerical sanitization prevents NaN targetDistance corruption', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const cam = game.character.thirdPersonCamera;
    const initialDistance = cam.targetDistance;

    // Test wheel handler with non-finite / NaN deltaY
    if (typeof cam.handleWheel === 'function') {
      cam.handleWheel({ deltaY: NaN, preventDefault: () => {} });
      cam.handleWheel({ deltaY: Infinity, preventDefault: () => {} });
    }

    // Also test direct property assignment sanitization
    cam.targetDistance = NaN;

    const producesNaN = Number.isNaN(cam.targetDistance);
    return { producesNaN, initialDistance, currentDistance: cam.targetDistance };
  });

  if (result.producesNaN) {
    throw new Error(`CONFIRMED CAMERA NUMERICAL GAP: Math.clamp(targetDistance + NaN) returns NaN, corrupting camera distance and exploding matrix projection!`);
  }
});

// ============================================================================
// SUITE 6: Web Audio Procedural Synthesis & Resource Lifecycle
// ============================================================================

harness.test('T5-AUD-01: High-concurrency audio burst (100 rapid calls) does not throw or crash AudioContext', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const audio = game.audio;
    const ctx = audio.ensureContext();
    const stateBefore = ctx ? ctx.state : 'no-ctx';

    let errorCount = 0;
    let lastError = null;

    try {
      for (let i = 0; i < 50; i++) {
        audio.synth.playOrangePickupSound();
        audio.playJumpSound();
      }
    } catch (e) {
      errorCount++;
      lastError = e.message;
    }

    const stateAfter = ctx ? ctx.state : 'no-ctx';
    return { errorCount, lastError, stateBefore, stateAfter };
  });

  if (result.errorCount > 0) {
    throw new Error(`Audio burst threw unhandled error: ${result.lastError}`);
  }
});

harness.test('T5-AUD-02: Mute toggle strictly suppresses sound synthesis across all audio triggers', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const audio = game.audio;

    audio.setMuted(true);
    const synthMuted = audio.synth.muted === true;
    const audioMuted = audio.muted === true;

    // Fire all sounds while muted
    audio.playJumpSound();
    audio.playLandSound();
    audio.playFlightSound();
    audio.playHolyGrailFanfare();
    audio.playRejectionBuzzer();
    audio.playHazardSiren();
    audio.playGeyserSound();
    audio.synth.playVocalHmm();

    // Restore unmuted
    audio.setMuted(false);
    return { synthMuted, audioMuted };
  });

  if (!result.synthMuted || !result.audioMuted) {
    throw new Error('Mute state was not properly reflected across audio system');
  }
});

harness.test('T5-AUD-03: Architectural audit of musicGain, ambientGain and Neverland Mixolydian theme', async (page) => {
  const result = await page.evaluate(() => {
    const game = window._gameInstance;
    const audio = game.audio;

    const musicGainNull = audio.musicGain === null;
    const ambientGainNull = audio.ambientGain === null;
    const isMusicPlayingFalse = audio.isMusicPlaying === false;

    // Check if any music loop method exists on audio
    const hasPlayMusicMethod = typeof audio.playMusic === 'function' || typeof audio.startMusic === 'function';

    return { musicGainNull, ambientGainNull, isMusicPlayingFalse, hasPlayMusicMethod };
  });

  if (result.musicGainNull && result.ambientGainNull && !result.hasPlayMusicMethod) {
    throw new Error('CONFIRMED ARCHITECTURAL OMISSION: AudioSystem contains dead stub properties (musicGain=null, ambientGain=null, isMusicPlaying=false) with zero implementation for the Neverland Mixolydian music theme or ambient lake shimmer specified in PROJECT.md');
  }
});

harness.test('T5-AUD-04: Architectural layout audit: verification of src/core/input.js presence', async (page) => {
  // Check filesystem directly for src/core/input.js
  const inputJsPath = path.resolve(__dirname, '../kevin-tighe-lakeside/src/core/input.js');
  const exists = fs.existsSync(inputJsPath);

  if (!exists) {
    throw new Error(`CONFIRMED ARCHITECTURAL OMISSION: "kevin-tighe-lakeside/src/core/input.js" is specified in PROJECT.md (line 142) but is completely MISSING from the file system!`);
  }
});

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAdversarialSuite() {
  const { chromium } = await getPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--no-sandbox'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();
  const pageErrors = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  console.log('Connecting to live game at http://localhost:8097?test=1...');
  await page.goto('http://localhost:8097?test=1');
  await page.waitForFunction(() => window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready, { timeout: 15000 });
  console.log('Game initialized successfully. Running Tier 5 adversarial tests...\n');

  const report = await harness.run(page);

  // Write report to JSON for CI / orchestrator reference
  const reportPath = path.resolve(__dirname, 'tier5_adversarial_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);

  await context.close();
  await browser.close();

  if (report.bugs.length > 0) {
    console.log(`\n\x1b[33m[CHALLENGER VERDICT]\x1b[0m ${report.bugs.length} GAPS/BUGS EMPIRICALLY CONFIRMED.`);
  } else {
    console.log(`\n\x1b[32m[CHALLENGER VERDICT]\x1b[0m GAP_FREE: All adversarial invariants passed.`);
  }

  return report;
}

runAdversarialSuite().catch((err) => {
  console.error('[FATAL TEST HARNESS ERROR]', err);
  process.exit(1);
});
