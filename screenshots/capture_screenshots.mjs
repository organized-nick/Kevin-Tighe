/**
 * screenshots/capture_screenshots.mjs
 * Automated High-Fidelity Gameplay Screenshot Capture for Milestone 4 (R4)
 *
 * Captures:
 * 1. screenshots/01_lakeside_retreat_overview.png - Scenic overview of lake, dock, cabin, bluffs
 * 2. screenshots/02_character_flight_fairy.png - Kevin in orange outfit flying with Pixie Dust & Tinker-Tang fairy
 * 3. screenshots/03_subterranean_descent_gauge.png - Subterranean descent with calibrated depth gauge
 * 4. screenshots/04_holy_grail_50ft_celebration.png - Exact 50.0ft celebration with 600-particle confetti & Golden Fever aura
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8097?autostart=1';
const SCREENSHOTS_DIR = __dirname;

async function captureAllScreenshots() {
  console.log('========================================================================');
  console.log('📸 KEVIN TIGHE: 3D LAKESIDE RETREAT - PLAYWRIGHT SCREENSHOT CAPTURE');
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`Output Directory: ${SCREENSHOTS_DIR}`);
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

  page.on('console', (msg) => {
    console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    console.error(`[Browser PageError]: ${err.stack || err.message}`);
  });

  console.log('Navigating to game and waiting for engine initialization...');
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  await page.waitForFunction(() => {
    return window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready === true;
  }, { timeout: 45000 });

  // Ensure game is started and HUD active
  await page.evaluate(() => {
    const game = window._gameInstance;
    if (game && !game.gameState.started) {
      game.startGame();
    }
    const toast = document.getElementById('toastContainer');
    if (toast) toast.innerHTML = '';
  });

  await page.waitForTimeout(1500);

  // ---------------------------------------------------------------------------
  // 1. Scenic Overview of Lakeside Retreat (Lake, Dock, Cabin, Bluffs)
  // ---------------------------------------------------------------------------
  console.log('\n[1/4] Capturing 01_lakeside_retreat_overview.png...');
  await page.evaluate(() => {
    const game = window._gameInstance;
    const camera = game.engine.camera;
    const ctrl = game.character;

    ctrl.teleport(0.0, 0.85, 12.0);
    ctrl.state = 'idle';
    ctrl.velocity.set(0, 0, 0);

    if (ctrl.thirdPersonCamera) {
      ctrl.thirdPersonCamera.enabled = false;
    }

    camera.position.set(22.0, 14.5, 38.0);
    camera.lookAt(-10.0, 3.5, 2.0);

    game.engine.composer.render();
  });

  await page.waitForTimeout(800);
  const shot1Path = path.join(SCREENSHOTS_DIR, '01_lakeside_retreat_overview.png');
  await page.screenshot({ path: shot1Path, fullPage: false });
  console.log(`  ✅ Saved: ${shot1Path}`);

  // ---------------------------------------------------------------------------
  // 2. Character Flight with Pixie Dust & Tinker-Tang Fairy
  // ---------------------------------------------------------------------------
  console.log('\n[2/4] Capturing 02_character_flight_fairy.png...');
  await page.evaluate(() => {
    const game = window._gameInstance;
    const camera = game.engine.camera;
    const ctrl = game.character;

    ctrl.teleport(2.0, 6.2, 16.0);
    ctrl.setFlight(true);
    ctrl.state = 'flying';
    ctrl.velocity.set(0.0, 0.8, 0.0);
    ctrl.pixieDust = 88.0;

    if (ctrl.flight) {
      ctrl.flight.isFlying = true;
      if (ctrl.flight.particles && typeof ctrl.flight.particles.emitParticle === 'function') {
        for (let i = 0; i < 40; i++) {
          ctrl.flight.particles.emitParticle(ctrl.position.x, ctrl.position.y, ctrl.position.z);
        }
      }
    }

    if (ctrl.fairy) {
      ctrl.fairy.update(0.016, 2.5, ctrl.position);
    }

    if (ctrl.shadow) {
      ctrl.shadow.update(0.016, ctrl.position, 0.85);
    }

    camera.position.set(4.8, 7.8, 21.8);
    camera.lookAt(2.0, 6.5, 16.0);

    game.engine.composer.render();
  });

  await page.waitForTimeout(800);
  const shot2Path = path.join(SCREENSHOTS_DIR, '02_character_flight_fairy.png');
  await page.screenshot({ path: shot2Path, fullPage: false });
  console.log(`  ✅ Saved: ${shot2Path}`);

  // ---------------------------------------------------------------------------
  // 3. Subterranean Descent with Calibrated Depth Gauge
  // ---------------------------------------------------------------------------
  console.log('\n[3/4] Capturing 03_subterranean_descent_gauge.png...');
  await page.evaluate(() => {
    const game = window._gameInstance;
    const sub = game.subterraneanSystem;
    const hud = game.hud;
    const ctrl = game.character;
    const camera = game.engine.camera;

    if (ctrl.thirdPersonCamera) {
      ctrl.thirdPersonCamera.enabled = false;
    }

    sub.enterHole('hole_dockside');

    sub.currentDepthFt = 16.5;
    sub.depthFt = 16.5;
    ctrl.position.set(0.0, -2.8, 20.0);
    ctrl.state = 'in_hole';
    sub.phase = 'descending';

    if (hud && typeof hud.setSubterraneanDepth === 'function') {
      hud.setSubterraneanDepth(true, 16.5, 'sweet_spot');
    }

    camera.position.set(0.0, 2.2, 26.0);
    camera.lookAt(0.0, -2.8, 20.0);

    game.engine.composer.render();
  });

  await page.waitForTimeout(800);
  const shot3Path = path.join(SCREENSHOTS_DIR, '03_subterranean_descent_gauge.png');
  await page.screenshot({ path: shot3Path, fullPage: false });
  console.log(`  ✅ Saved: ${shot3Path}`);

  // ---------------------------------------------------------------------------
  // 4. Exact 50.0ft Holy Grail Celebration (600-particle confetti & Golden Fever aura)
  // ---------------------------------------------------------------------------
  console.log('\n[4/4] Capturing 04_holy_grail_50ft_celebration.png...');
  await page.evaluate(() => {
    try {
      const game = window._gameInstance;
      const sub = game.subterraneanSystem;
      const hud = game.hud;
      const ctrl = game.character;
      const camera = game.engine.camera;

      if (ctrl.thirdPersonCamera) {
        ctrl.thirdPersonCamera.enabled = false;
      }

      sub.phase = 'inactive';
      sub.activeHole = null;
      sub.enterHole('hole_pine_root');

      sub.currentDepthFt = 50.0;
      sub.depthFt = 50.0;
      ctrl.position.set(48.0, -11.7, -45.0);
      ctrl.state = 'in_hole';
      sub.phase = 'geyser_propelled';

      if (game.confettiEmitter) {
        game.confettiEmitter.explode({ x: 48.0, y: -11.0, z: -45.0 });
      }

      if (game.goldenFever) {
        game.goldenFever.activate();
        if (game.goldenFever.auraGroup) {
          game.goldenFever.auraGroup.visible = true;
        }
      }

      if (hud) {
        if (typeof hud.setSubterraneanDepth === 'function') {
          hud.setSubterraneanDepth(true, 50.0, 'sweet_spot');
        }
        if (typeof hud.showGoldenFeverBanner === 'function') {
          hud.showGoldenFeverBanner(15.0);
        }
      }

      const toast = document.getElementById('toastContainer');
      if (toast) {
        toast.innerHTML = `
          <div class="toast-quip grail-toast" style="background: rgba(245, 158, 11, 0.95); border: 2px solid #ffd700; color: #fff; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; box-shadow: 0 0 25px rgba(255, 215, 0, 0.8);">
            ⭐ THE HOLY GRAIL: EXACTLY 50.0 FT PINNACLE! (+2,500 PTS) ⭐
          </div>
        `;
      }

      camera.position.set(48.0, -8.5, -39.0);
      camera.lookAt(48.0, -11.2, -45.0);

      game.engine.composer.render();
    } catch (err) {
      console.error('[Error in Phase 4 evaluate]:', err);
      throw err;
    }
  });

  await page.waitForTimeout(1000);
  const shot4Path = path.join(SCREENSHOTS_DIR, '04_holy_grail_50ft_celebration.png');
  await page.screenshot({ path: shot4Path, fullPage: false });
  console.log(`  ✅ Saved: ${shot4Path}`);

  await browser.close();
  console.log('\n🎉 All 4 screenshots captured successfully!');
}

captureAllScreenshots().catch((err) => {
  console.error('❌ Screenshot capture failed:', err);
  process.exit(1);
});
