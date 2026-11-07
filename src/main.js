/**
 * src/main.js
 * Kevin Tighe: 3D Lakeside Retreat - Main Bootstrap & window.__KEVIN_GAME__ Contract
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Engine } from './core/engine.js';
import { TextureManager } from './core/textures.js';
import { AudioSystem } from './core/audio.js';
import { LightingSystem } from './world/lighting.js';
import { WorldManager } from './world/landmarks.js';
import { CharacterController } from './character/controller.js';
import { SonarSystem } from './character/sonar.js';
import { PickupManager } from './items/pickups.js';
import { HUDManager } from './ui/hud.js';
import { HoleManager } from './holes/holeManager.js';
import { SubterraneanSystem } from './holes/subterranean.js';
import { GeyserEmitter } from './holes/geyser.js';
import { ConfettiFireworksEmitter, GoldenFeverManager } from './holes/celebrations.js';

class Game {
  constructor() {
    this.container = document.getElementById('webglContainer') || document.body;
    this.clock = new THREE.Clock();

    // Telemetry state with corrected context scoping
    const self = this;
    this.telemetry = {
      fps: 60,
      frameCount: 0,
      lastTime: performance.now(),
      errorCount: 0,
      lastError: null,
      get drawCalls() {
        const eng = self.engine || (self.telemetry && self.telemetry._engine);
        return eng && eng.renderer ? eng.renderer.info.render.calls : 0;
      },
      get triangles() {
        const eng = self.engine || (self.telemetry && self.telemetry._engine);
        return eng && eng.renderer ? eng.renderer.info.render.triangles : 0;
      }
    };

    // Attach global error traps
    this.initErrorTraps();

    // 1. Initialize Core Three.js Engine
    this.engine = new Engine(this.container);
    this.telemetry._engine = this.engine;

    // 2. Initialize Texture Manager
    this.textures = new TextureManager();

    // 3. Initialize Audio System
    this.audio = new AudioSystem();

    // 4. Initialize Dynamic Lighting & Shadows
    this.lighting = new LightingSystem(this.engine.scene);

    // 5. Initialize 4 Distinct World Landmarks & Shoreline
    this.worldManager = new WorldManager(this.engine.scene, this.textures);

    // 6. Game State
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
      muted: false,
      sonarCooldownRemaining: 0
    };

    // 7. Initialize HUD Manager
    this.hud = new HUDManager();

    // 7b. Initialize 4 Landmark Subterranean Holes & Emitters
    this.holeManager = new HoleManager(this.engine.scene, this.textures);
    this.geyserEmitter = new GeyserEmitter(this.engine.scene);
    this.confettiEmitter = new ConfettiFireworksEmitter(this.engine.scene);

    // 7c. Initialize Subterranean System
    this.subterranean = new SubterraneanSystem(
      null,
      this.hud,
      this.audio,
      {
        holeManager: this.holeManager,
        geyserEmitter: this.geyserEmitter
      }
    );

    // 8. Initialize "Hmm..." Sonar System
    this.sonar = new SonarSystem({
      scene: this.engine.scene,
      camera: this.engine.camera,
      getOrigin: () => (this.character ? this.character.position : this.gameState.playerPos),
      isFlying: () => (this.character ? this.character.isFlying : this.gameState.isFlying),
      setCharacterState: (st) => {
        if (this.character) this.character.state = st;
        this.gameState.characterState = st;
      },
      triggerChinStroke: () => {
        if (this.character && this.character.avatar) {
          this.character.ponderTimer = 1.5;
        }
      },
      holes: this.holeManager.getHolesList(),
      synth: this.audio.synth,
      onTrigger: (scan) => {
        if (this.hud) {
          this.hud.showSonarPingNotification(scan);
        }
      }
    });

    // 9. Initialize Character Controller (Kevin avatar, locomotion, jump, flight, companion, shadow, camera)
    this.character = new CharacterController(
      this.engine,
      this.worldManager,
      this.textures,
      {
        sonarSystem: this.sonar,
        audioSystem: this.audio,
        subterraneanSystem: this.subterranean
      }
    );
    this.subterranean.controller = this.character;

    // 9b. Initialize Golden Fever Manager & Attach Celebrations
    this.goldenFever = new GoldenFeverManager(this.engine.scene, this.character, this.hud);
    this.celebrations = {
      confetti: this.confettiEmitter,
      goldenFever: this.goldenFever
    };
    this.subterranean.setCelebrations(this.celebrations);

    // Direct instance references for inspectability and tests
    this.scene = this.engine.scene;
    this.camera = this.engine.camera;
    this.renderer = this.engine.renderer;
    this.subterraneanSystem = this.subterranean;
    this.goldenFeverManager = this.goldenFever;
    this.sonarSystem = this.sonar;
    this.cameraRig = this.character ? this.character.thirdPersonCamera : null;

    // 10. Initialize Pickups (22 citrus orbs + 4 landmark bonus items)
    this.pickupManager = new PickupManager(
      this.engine.scene,
      this.textures,
      this.gameState.fourthObsession
    );

    // 11. UI & Contract Initialization
    this.initUI();
    this.initTestContract();

    // Check URL parameters (e.g. ?autostart=1 or ?test=1 for headless E2E runs)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1' || urlParams.get('test') === '1') {
      this.startGame();
    }

    // 12. Start Animation Loop
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
          if (this.pickupManager) {
            this.pickupManager.dispose();
            this.pickupManager = new PickupManager(
              this.engine.scene,
              this.textures,
              this.gameState.fourthObsession
            );
          }
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
        if (this.audio) {
          this.audio.setMuted(this.gameState.muted);
        }
        muteBtn.textContent = this.gameState.muted ? '🔇' : '🔊';
      });
    }
  }

  startGame() {
    if (this.gameState.started) return;
    this.gameState.started = true;

    if (this.audio) {
      this.audio.ensureContext();
    }

    const startOverlay = document.getElementById('startOverlay');
    if (startOverlay) startOverlay.classList.add('hidden');

    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');

    const hmmInput = document.getElementById('hmmInput');
    if (hmmInput && hmmInput.value.trim()) {
      const val = hmmInput.value.trim();
      if (val !== this.gameState.fourthObsession) {
        this.gameState.fourthObsession = val;
        if (this.pickupManager) {
          this.pickupManager.dispose();
          this.pickupManager = new PickupManager(
            this.engine.scene,
            this.textures,
            this.gameState.fourthObsession
          );
        }
      }
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

      // 3. Update Character Controller, locomotion, flight, camera
      if (this.character) {
        this.character.update(dt);
      }

      // 4. Update Pickups & Proximity Collection
      if (this.pickupManager) {
        const playerPos = this.character ? this.character.position : this.gameState.playerPos;
        this.pickupManager.update(dt, playerPos, (reward) => {
          if (reward.oranges) {
            if (this.character) this.character.oranges += reward.oranges;
            this.gameState.oranges += reward.oranges;
          }
          if (reward.score) {
            if (this.character) this.character.score += reward.score;
            this.gameState.score += reward.score;
          }
          if (this.audio) {
            if (reward.type === 'bonus') this.audio.synth.playBonusPickupSound();
            else this.audio.synth.playOrangePickupSound();
          }
          if (reward.quip && this.hud) {
            this.hud.showToast(reward.quip, 'bonus');
          }
        });
      }

      // 5. Update Sonar Wave Rings & Holographic 3D Tags
      if (this.sonar) {
        this.sonar.update(dt);
      }

      // 5b. Update Subterranean Systems & Celebrations
      if (this.holeManager) {
        this.holeManager.update(dt);
      }
      if (this.geyserEmitter) {
        this.geyserEmitter.update(dt);
      }
      if (this.confettiEmitter) {
        this.confettiEmitter.update(dt);
      }
      if (this.goldenFever) {
        this.goldenFever.update(dt);
      }

      // 6. Synchronize Game State & Update HUD
      if (this.character) {
        this.gameState.playerPos = this.character.position;
        this.gameState.characterState = this.character.state;
        this.gameState.isFlying = this.character.isFlying;
        this.gameState.pixieDust = this.character.pixieDust;
        this.gameState.oranges = this.character.oranges;
        this.gameState.score = this.character.score;
      }
      if (this.sonar) {
        this.gameState.sonarCooldownRemaining = this.sonar.getCooldownRemaining();
      }
      if (this.hud) {
        this.hud.update(this.gameState);
      }

      // 7. Render Three.js Scene via EffectComposer
      this.engine.render(dt);

      // 8. Update Telemetry
      this.telemetry.frameCount++;
      const now = performance.now();
      if (now - this.telemetry.lastTime >= 1000) {
        this.telemetry.fps = Math.round((this.telemetry.frameCount * 1000) / (now - this.telemetry.lastTime));
        this.telemetry.frameCount = 0;
        this.telemetry.lastTime = now;
      }

      // 9. Signal ready state on first rendered frame
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

    const self = this;

    window.__KEVIN_GAME__ = {
      version: '1.0.0-m2',
      ready: false,
      scene: this.engine.scene,
      camera: this.engine.camera,
      renderer: this.engine.renderer,
      composer: this.engine.composer,

      // Character API (M2 Fully Articulated & Reactive)
      character: {
        get position() { return self.character ? self.character.position : self.gameState.playerPos; },
        set position(p) {
          if (self.character) self.character.teleport(p.x, p.y, p.z);
          else self.gameState.playerPos = p;
        },
        get state() { return self.character ? self.character.state : self.gameState.characterState; },
        set state(s) {
          if (self.character) self.character.state = s;
          self.gameState.characterState = s;
        },
        get isFlying() { return self.character ? self.character.isFlying : self.gameState.isFlying; },
        set isFlying(f) {
          if (self.character) self.character.setFlight(f);
          self.gameState.isFlying = f;
        },
        get isGrounded() { return self.character ? self.character.isGrounded : true; },
        set isGrounded(g) {
          if (self.character) self.character.isGrounded = g;
        },
        get pixieDust() { return self.character ? self.character.pixieDust : self.gameState.pixieDust; },
        set pixieDust(d) {
          if (self.character) self.character.pixieDust = d;
          self.gameState.pixieDust = d;
        },
        get oranges() { return self.character ? self.character.oranges : self.gameState.oranges; },
        set oranges(o) {
          if (self.character) self.character.oranges = o;
          self.gameState.oranges = o;
        },
        get score() { return self.character ? self.character.score : self.gameState.score; },
        set score(s) {
          if (self.character) self.character.score = s;
          self.gameState.score = s;
        },
        get flight() {
          return self.character ? self.character.flight : null;
        },
        get particles() {
          return self.character ? self.character.particles : { active: false, color: 0xffd700, count: 50 };
        },
        triggerSonar: () => {
          if (self.character) return self.character.triggerSonar();
          return self.sonar.trigger();
        },
        setFlight: (active) => {
          if (self.character) self.character.setFlight(active);
          self.gameState.isFlying = active;
        },
        teleport: (x, y, z) => {
          if (self.character) self.character.teleport(x, y, z);
          else {
            self.gameState.playerPos.x = x;
            self.gameState.playerPos.y = y;
            self.gameState.playerPos.z = z;
            self.engine.camera.position.set(x, y + 6, z + 16);
            self.engine.camera.lookAt(x, y + 1, z);
          }
        }
      },

      // World & Landmarks API
      world: {
        landmarks: landmarks,
        lights: lights
      },

      // Subterranean Holes API (Integrated with Holy Grail and Tiers)
      holes: {
        list: this.holeManager.getHolesList(),
        get activeHole() {
          return self.subterranean ? self.subterranean.activeHole : null;
        },
        get subterraneanPhase() {
          return self.subterranean ? self.subterranean.phase : 'inactive';
        },
        get currentDepthFt() {
          return self.subterranean ? self.subterranean.depthFt : 0.0;
        },
        get goldenFeverActive() {
          return self.goldenFever ? self.goldenFever.isActive : false;
        },
        get goldenFeverRemaining() {
          return self.goldenFever ? self.goldenFever.timer : 0.0;
        },
        escapeMidShaft: () => {
          if (self.subterranean) {
            return self.subterranean.escapeMidShaft();
          }
          return false;
        },
        enterHole: (holeId) => {
          if (self.subterranean) {
            return self.subterranean.enterHole(holeId);
          }
          return null;
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
