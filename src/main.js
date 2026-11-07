/**
 * src/main.js
 * Kevin Tighe: 3D Lakeside Retreat - Main Bootstrap & window.__KEVIN_GAME__ Contract
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Engine } from './core/engine.js';
import { TextureManager } from './core/textures.js';
import { LightingSystem } from './world/lighting.js';
import { WorldManager } from './world/landmarks.js';

class Game {
  constructor() {
    this.container = document.getElementById('webglContainer') || document.body;
    this.clock = new THREE.Clock();

    // Telemetry state
    this.telemetry = {
      fps: 60,
      frameCount: 0,
      lastTime: performance.now(),
      errorCount: 0,
      lastError: null,
      get drawCalls() { return this.engine && this.engine.renderer ? this.engine.renderer.info.render.calls : 0; },
      get triangles() { return this.engine && this.engine.renderer ? this.engine.renderer.info.render.triangles : 0; }
    };

    // Attach global error traps
    this.initErrorTraps();

    // 1. Initialize Core Three.js Engine
    this.engine = new Engine(this.container);

    // 2. Initialize Texture Manager
    this.textures = new TextureManager();

    // 3. Initialize Dynamic Lighting & Shadows
    this.lighting = new LightingSystem(this.engine.scene);

    // 4. Initialize 4 Distinct World Landmarks & Shoreline
    this.worldManager = new WorldManager(this.engine.scene, this.textures);

    // 5. Game State
    this.gameState = {
      started: false,
      score: 0,
      oranges: 0,
      legalHolesConquered: 0,
      pixieDust: 100.0,
      isFlying: false,
      playerPos: { x: 0, y: 0.85, z: 10.0 },
      characterState: 'idle',
      fourthObsession: 'Cheddar Cheese Wedges',
      muted: false
    };

    // 6. UI & Contract Initialization
    this.initUI();
    this.initTestContract();

    // Check URL parameters (e.g. ?autostart=1 or ?test=1 for headless E2E runs)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1' || urlParams.get('test') === '1') {
      this.startGame();
    }

    // 7. Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initErrorTraps() {
    window.addEventListener('error', (event) => {
      this.telemetry.errorCount++;
      this.telemetry.lastError = event.message || (event.error ? event.error.message : 'Unknown script error');
      console.error('[KevinGame Error Trap]', event.error || event.message);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.telemetry.errorCount++;
      this.telemetry.lastError = event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled Promise Rejection';
      console.error('[KevinGame Promise Error Trap]', event.reason);
    });
  }

  initUI() {
    const startOverlay = document.getElementById('startOverlay');
    const startBtn = document.getElementById('startBtn');
    const hud = document.getElementById('hud');
    const hmmInput = document.getElementById('hmmInput');
    const presetBtns = document.querySelectorAll('.preset-btn');

    // 4th Obsession preset selection
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (hmmInput) {
          hmmInput.value = btn.dataset.val;
          this.gameState.fourthObsession = btn.dataset.val;
        }
      });
    });

    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }

    // Spacebar starts game if on start overlay
    window.addEventListener('keydown', (e) => {
      if (!this.gameState.started && e.code === 'Space') {
        e.preventDefault();
        this.startGame();
      }
    });

    // Mute toggle button
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.gameState.muted = !this.gameState.muted;
        muteBtn.textContent = this.gameState.muted ? '🔇' : '🔊';
      });
    }
  }

  startGame() {
    if (this.gameState.started) return;
    this.gameState.started = true;

    const startOverlay = document.getElementById('startOverlay');
    if (startOverlay) startOverlay.classList.add('hidden');

    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');

    const hmmInput = document.getElementById('hmmInput');
    if (hmmInput && hmmInput.value.trim()) {
      this.gameState.fourthObsession = hmmInput.value.trim();
    }

    console.log('⚡ [KevinGame] 3D Lakeside Retreat started. 4th Obsession:', this.gameState.fourthObsession);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    try {
      // 1. Update lighting shimmer
      if (this.lighting) {
        this.lighting.update(dt);
      }

      // 2. Update water ripples
      if (this.worldManager) {
        this.worldManager.update(dt, elapsedTime);
      }

      // 3. Render Three.js Scene via EffectComposer
      this.engine.render(dt);

      // 4. Update Telemetry
      this.telemetry.frameCount++;
      const now = performance.now();
      if (now - this.telemetry.lastTime >= 1000) {
        this.telemetry.fps = Math.round((this.telemetry.frameCount * 1000) / (now - this.telemetry.lastTime));
        this.telemetry.frameCount = 0;
        this.telemetry.lastTime = now;
      }

      // 5. Signal ready state on first rendered frame
      if (window.__KEVIN_GAME__ && !window.__KEVIN_GAME__.ready) {
        window.__KEVIN_GAME__.ready = true;
        window.dispatchEvent(new CustomEvent('kevin-game-ready', {
          detail: window.__KEVIN_GAME__
        }));
        console.log('✅ [KevinGame] window.__KEVIN_GAME__.ready is true.');
      }
    } catch (err) {
      this.telemetry.errorCount++;
      this.telemetry.lastError = err.message || String(err);
      console.error('[KevinGame Animation Error]', err);
    }
  }

  // =========================================================================
  // Official window.__KEVIN_GAME__ Interface Contract per PROJECT.md
  // =========================================================================
  initTestContract() {
    const landmarks = this.worldManager.landmarks;
    const lights = {
      sun: this.lighting.sun,
      ambient: this.lighting.ambient,
      porchLantern: this.lighting.porchLantern,
      dockLantern: this.lighting.dockLantern,
      rim: this.lighting.rimLight
    };

    window.__KEVIN_GAME__ = {
      version: '1.0.0-m1',
      ready: false,
      scene: this.engine.scene,
      camera: this.engine.camera,
      renderer: this.engine.renderer,
      composer: this.engine.composer,

      // Character API (M1 baseline, ready for M2 character controller)
      character: {
        position: this.gameState.playerPos,
        state: this.gameState.characterState,
        pixieDust: this.gameState.pixieDust,
        oranges: this.gameState.oranges,
        score: this.gameState.score,
        triggerSonar: () => console.log('[Contract Hook] Sonar triggered'),
        setFlight: (active) => { this.gameState.isFlying = active; },
        teleport: (x, y, z) => {
          this.gameState.playerPos.x = x;
          this.gameState.playerPos.y = y;
          this.gameState.playerPos.z = z;
          this.engine.camera.position.set(x, y + 6, z + 16);
          this.engine.camera.lookAt(x, y + 1, z);
        }
      },

      // World & Landmarks API
      world: {
        landmarks: landmarks,
        lights: lights
      },

      // Subterranean Holes API (M1 baseline, ready for M3 mechanics)
      holes: {
        list: CONFIG.HOLES,
        enterHole: async (holeId) => {
          const hole = CONFIG.HOLES.find(h => h.id === holeId) || CONFIG.HOLES[0];
          let status = 'completed';
          if (hole.tier === 'shallow') status = 'rejected';
          else if (hole.tier === 'deep') status = 'boundary_breach';
          return { status, depth: hole.depthFt };
        }
      },

      // Live Telemetry
      telemetry: this.telemetry,

      // Top-level aliases for universal test runner compatibility
      landmarks: landmarks,
      lights: lights,

      // Controls
      startGame: () => this.startGame()
    };
  }
}

// Auto-instantiate when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._gameInstance = new Game();
  });
} else {
  window._gameInstance = new Game();
}
