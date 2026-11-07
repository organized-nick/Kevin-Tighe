/**
 * src/core/engine.js
 * Core Three.js Engine: WebGLRenderer, PCFSoftShadowMap, EffectComposer, UnrealBloomPass, ACESFilmic
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from '../config.js';

export class Engine {
  constructor(containerElement, options = {}) {
    if (!containerElement) {
      throw new Error('[Engine] Container element is required for WebGLRenderer mount.');
    }
    this.container = containerElement;
    this.options = Object.assign({
      bloomStrength: 0.38,
      bloomRadius: 0.48,
      bloomThreshold: 0.82,
      exposure: 1.15,
      antialias: true
    }, options);

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Telemetry state
    this.telemetry = {
      fps: 60,
      frameCount: 0,
      lastTime: performance.now(),
      errorCount: 0,
      lastError: null
    };

    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initPostProcessing();
    this.initEnvironmentMap();
    this.initResizeHandler();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.options.antialias,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Shadow Map configuration
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Tone Mapping & Color Management
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.options.exposure;

    // Mount to DOM container
    this.container.appendChild(this.renderer.domElement);
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Lakeside Daylight Atmosphere & Fog
    this.scene.background = new THREE.Color(CONFIG.COLORS.SKY_BLUE);
    this.scene.fog = new THREE.FogExp2(CONFIG.COLORS.FOG_BLUE, 0.0055);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA.FOV,
      this.width / this.height,
      CONFIG.CAMERA.NEAR,
      CONFIG.CAMERA.FAR
    );

    // Initial scenic perspective overlooking dock, lake, and cabin
    this.camera.position.set(0, 8.0, 28.0);
    this.camera.lookAt(0, 1.5, 0);
  }

  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);

    // 1. Scene Render Pass
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // 2. Subtle UnrealBloomPass (Warm atmospheric haze and water specular reflections)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      this.options.bloomStrength,
      this.options.bloomRadius,
      this.options.bloomThreshold
    );
    this.composer.addPass(this.bloomPass);

    // 3. OutputPass (ACESFilmicToneMapping & sRGB color space transfer)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  initEnvironmentMap() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();

      const envScene = new THREE.Scene();

      // Atmospheric Sky dome
      const skySphere = new THREE.Mesh(
        new THREE.SphereGeometry(60, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.BackSide })
      );
      envScene.add(skySphere);

      // Warm Golden Sun sphere
      const sunSphere = new THREE.Mesh(
        new THREE.SphereGeometry(8, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffaa00 })
      );
      sunSphere.position.set(30, 40, 25);
      envScene.add(sunSphere);

      // Deep Forest Earth reflection plane
      const groundPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 120),
        new THREE.MeshBasicMaterial({ color: 0x14532d, side: THREE.DoubleSide })
      );
      groundPlane.rotation.x = Math.PI / 2;
      groundPlane.position.y = -15;
      envScene.add(groundPlane);

      this.scene.environment = pmrem.fromScene(envScene).texture;
      pmrem.dispose();
    } catch (err) {
      console.warn('[Engine] PMREM generation fallback:', err);
    }
  }

  initResizeHandler() {
    this.onResize = () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;

      // Update camera projection
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();

      // Update renderer & composer
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      this.composer.setSize(this.width, this.height);
      this.bloomPass.resolution.set(this.width, this.height);

      // Synchronize 2D FX overlay canvas
      const fxCanvas = document.getElementById('fxCanvas');
      if (fxCanvas) {
        fxCanvas.width = this.width;
        fxCanvas.height = this.height;
      }
    };

    window.addEventListener('resize', this.onResize, false);
    // Align initially
    this.onResize();
  }

  render(dt = 0.016) {
    try {
      this.composer.render();

      // Telemetry update
      this.telemetry.frameCount++;
      const now = performance.now();
      if (now - this.telemetry.lastTime >= 1000) {
        this.telemetry.fps = Math.round((this.telemetry.frameCount * 1000) / (now - this.telemetry.lastTime));
        this.telemetry.frameCount = 0;
        this.telemetry.lastTime = now;
      }
    } catch (err) {
      this.telemetry.errorCount++;
      this.telemetry.lastError = err.message || String(err);
      console.error('[Engine.render] Post-processing error:', err);
      // Fallback direct render if composer fails
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.composer) {
      this.composer.dispose();
    }
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

export function createEngine(container, options) {
  return new Engine(container, options);
}
