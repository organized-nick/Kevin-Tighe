/**
 * tests/run-lakeside-tests.mjs
 * Unified Test Runner for Kevin Tighe: 3D Lakeside Retreat
 *
 * Runs the complete automated test suite across all milestones:
 * - Milestone 1: Lighting, Shadows, PBR Materials & Landmark Contracts
 * - Milestone 3: Subterranean Hole Challenges, Depth Rules & Holy Grail
 * - Challenger M3: Adversarial Stress, 50.0ft Boundary Precision & WebGL Emitter Stability
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUITES = [
  {
    name: 'Milestone 1: 3D Lakeside Environment & Lighting Contract',
    script: path.join(__dirname, 'verify_m1_lighting_contract.mjs')
  },
  {
    name: 'Milestone 3: Subterranean Hole Challenges & Depth Rules',
    script: path.join(__dirname, 'verify_m3_subterranean.mjs')
  },
  {
    name: 'Challenger M3: Adversarial Stress & 50.0ft Boundary Enforcement',
    script: path.join(__dirname, 'challenger_m3_stress.mjs')
  }
];

async function runCommand(name, scriptPath) {
  console.log(`\n========================================================================`);
  console.log(`🏃 RUNNING SUITE: ${name}`);
  console.log(`Script: ${scriptPath}`);
  console.log(`========================================================================`);

  return new Promise((resolve) => {
    // Quote script path or invoke without shell to handle spaces in directory names cleanly
    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      env: process.env,
      shell: false
    });

    child.on('close', (code) => {
      resolve({ name, code });
    });

    child.on('error', (err) => {
      console.error(`❌ Process execution error for ${name}:`, err);
      resolve({ name, code: 1, error: err });
    });
  });
}

async function main() {
  console.log('========================================================================');
  console.log('🌟 KEVIN TIGHE: 3D LAKESIDE RETREAT — COMPLETE TEST SUITE RUNNER');
  console.log('========================================================================');

  const startTime = Date.now();
  const results = [];

  for (const suite of SUITES) {
    const res = await runCommand(suite.name, suite.script);
    results.push(res);
    if (res.code !== 0) {
      console.error(`\n❌ [FAILED] Suite: ${res.name} (exit code ${res.code})`);
    } else {
      console.log(`\n✅ [PASSED] Suite: ${res.name}`);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalPassed = results.filter(r => r.code === 0).length;
  const totalFailed = results.filter(r => r.code !== 0).length;

  console.log('\n========================================================================');
  console.log('📊 TEST EXECUTION SUMMARY');
  console.log('========================================================================');
  results.forEach(r => {
    const statusIcon = r.code === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${statusIcon} — ${r.name}`);
  });
  console.log(`\nTotal Suites: ${results.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
  console.log(`Elapsed Time: ${durationSec}s`);

  if (totalFailed > 0) {
    console.error('\n💥 VERDICT: TEST SUITE FAILED');
    process.exit(1);
  } else {
    console.log('\n🏆 VERDICT: ALL TEST SUITES PASSED CLEANLY (100% SUCCESS)');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
