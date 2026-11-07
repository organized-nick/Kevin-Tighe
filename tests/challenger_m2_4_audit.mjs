import { chromium } from 'playwright';

async function verifyWebGLAndFrameStability() {
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

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('Browser Error:', msg.text());
  });

  await page.goto('http://localhost:8097?autostart=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__KEVIN_GAME__ && window.__KEVIN_GAME__.ready, { timeout: 30000 });

  const audit = await page.evaluate(async () => {
    const game = window._gameInstance;
    const renderer = game.engine.renderer;
    const gl = renderer.getContext();
    const isContextLost = gl.isContextLost();

    // Check WebGL context parameters
    const vendor = gl.getParameter(gl.VENDOR);
    const rendererStr = gl.getParameter(gl.RENDERER);

    // Multi-frame stability test: run 60 frames and check stats
    const startRenderInfo = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures
    };

    // Verify programmatic flight persistence across frame updates
    const char = game.character;
    char.teleport(0, 15, 10);
    char.isGrounded = false;
    char.keys.jump = false;
    char.pixieDust = 100.0;
    char.setFlight(true);
    const flightBefore = char.isFlying;

    // Simulate 60 updates
    let minDustDrain = 100;
    for (let f = 0; f < 60; f++) {
      char.update(1 / 60);
    }
    const flightAfter60Frames = char.isFlying;
    const dustAfter1Sec = char.pixieDust; // should have drained ~24%
    const expectedDustDrain = 100 - dustAfter1Sec;

    // Verify shadow tracking across varied elevations
    const shadow = char.shadow;
    const dockGround = shadow.sampleSurfaceHeight(0, 10.0, () => 0); // dock deck
    const plungeGround = shadow.sampleSurfaceHeight(0, 22.0, () => 0); // plunge hole
    const porchGround = shadow.sampleSurfaceHeight(25.0, -9.5, () => 0); // cabin porch
    const lakeGround = shadow.sampleSurfaceHeight(0, 0, () => 0); // lake

    // Verify sonar cooldown
    const sonar1 = char.triggerSonar();
    const cooldown1 = game.sonar.getCooldownRemaining();
    const sonar2 = char.triggerSonar(); // immediate 2nd trigger
    game.sonar.update(1.6); // advance past 1.5s cooldown
    const cooldown2 = game.sonar.getCooldownRemaining();
    const sonar3 = char.triggerSonar(); // 3rd trigger after cooldown expires

    // Post-multi-frame stability
    const endRenderInfo = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures
    };

    return {
      isContextLost,
      vendor,
      rendererStr,
      startRenderInfo,
      endRenderInfo,
      flightBefore,
      flightAfter60Frames,
      expectedDustDrain,
      shadowElevations: {
        dockGround,
        plungeGround,
        porchGround,
        lakeGround
      },
      sonarTest: {
        sonar1Active: !!sonar1,
        cooldown1,
        sonar2Blocked: !sonar2,
        cooldown2,
        sonar3Active: !!sonar3
      }
    };
  });

  await browser.close();
  console.log('RESULTS:', JSON.stringify(audit, null, 2));
}

verifyWebGLAndFrameStability().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
