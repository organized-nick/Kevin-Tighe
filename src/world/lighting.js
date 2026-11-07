/**
 * src/world/lighting.js
 * Dynamic Lighting & Shadow Casting System for Kevin Tighe: Lakeside Retreat 3D
 */

import * as THREE from 'three';

export class LightingSystem {
  /**
   * @param {THREE.Scene} scene - Active Three.js scene
   * @param {Object} [options] - Configuration overrides
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = Object.assign({
      sunColor: 0xfff3db,
      sunIntensity: 2.2,
      sunPosition: new THREE.Vector3(55, 75, 40),
      sunTarget: new THREE.Vector3(0, 0, 0),
      shadowMapSize: 2048,
      shadowFrustumSize: 90,
      shadowBias: -0.0004,
      shadowNormalBias: 0.04,
      ambientSkyColor: 0xbae6fd,
      ambientGroundColor: 0x365314,
      ambientIntensity: 0.75,
      porchLanternPosition: new THREE.Vector3(25.0, 4.7, -9.4),
      dockLanternPosition: new THREE.Vector3(-1.85, 2.7, 29.5)
    }, options);

    this.sun = null;
    this.ambient = null;
    this.porchLantern = null;
    this.dockLantern = null;
    this.lanternFlickerTime = 0;

    this.init();
  }

  init() {
    // 1. Primary Directional Sunlight with Soft Shadows
    this.sun = new THREE.DirectionalLight(
      this.options.sunColor,
      this.options.sunIntensity
    );
    this.sun.name = 'DirectionalSunLight';
    this.sun.position.copy(this.options.sunPosition);
    this.sun.target.position.copy(this.options.sunTarget);
    this.scene.add(this.sun.target);

    // Shadow Map Configuration (2048x2048)
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = this.options.shadowMapSize;
    this.sun.shadow.mapSize.height = this.options.shadowMapSize;

    // Orthographic shadow camera frustum covering all 4 landmarks
    const f = this.options.shadowFrustumSize;
    this.sun.shadow.camera.left = -f;
    this.sun.shadow.camera.right = f;
    this.sun.shadow.camera.top = f;
    this.sun.shadow.camera.bottom = -f;
    this.sun.shadow.camera.near = 1.0;
    this.sun.shadow.camera.far = 250.0;
    this.sun.shadow.camera.updateProjectionMatrix();

    // Biasing to eliminate shadow acne on bluffs and shoreline
    this.sun.shadow.bias = this.options.shadowBias;
    this.sun.shadow.normalBias = this.options.shadowNormalBias;
    this.sun.shadow.radius = 2.0;

    this.scene.add(this.sun);

    // 2. Atmospheric HemisphereLight Ambient Fill (Sky blue + evergreen earth)
    this.ambient = new THREE.HemisphereLight(
      this.options.ambientSkyColor,
      this.options.ambientGroundColor,
      this.options.ambientIntensity
    );
    this.ambient.name = 'HemisphereAmbientFill';
    this.ambient.position.set(0, 50, 0);
    this.scene.add(this.ambient);

    // 3. Cabin Porch Lantern (Warm Amber Point Light)
    this.porchLantern = new THREE.PointLight(0xf59e0b, 1.4, 18, 1.5);
    this.porchLantern.name = 'CabinPorchLantern';
    this.porchLantern.position.copy(this.options.porchLanternPosition);
    this.porchLantern.castShadow = false; // Preserves 60+ FPS performance
    this.scene.add(this.porchLantern);

    // 4. Wooden Dock Pier Lantern (Warm Golden Point Light)
    this.dockLantern = new THREE.PointLight(0xfbbf24, 1.1, 14, 1.5);
    this.dockLantern.name = 'DockPierLantern';
    this.dockLantern.position.copy(this.options.dockLanternPosition);
    this.dockLantern.castShadow = false;
    this.scene.add(this.dockLantern);

    // 5. Cool Rim Light from lake back-angle
    this.rimLight = new THREE.DirectionalLight(0x60a5fa, 0.7);
    this.rimLight.name = 'RimBackLight';
    this.rimLight.position.set(-35, 25, -40);
    this.scene.add(this.rimLight);
  }

  /**
   * Called each frame in the render loop.
   * Modulates subtle lantern flicker for organic atmosphere.
   * @param {number} delta - Frame delta in seconds
   */
  update(delta = 0.016) {
    this.lanternFlickerTime += delta * 4.0;
    if (this.porchLantern) {
      const flicker = 1.35 + Math.sin(this.lanternFlickerTime * 3.7) * 0.05 +
                             Math.sin(this.lanternFlickerTime * 7.1) * 0.03;
      this.porchLantern.intensity = flicker;
    }
    if (this.dockLantern) {
      const flicker = 1.05 + Math.cos(this.lanternFlickerTime * 4.2) * 0.04;
      this.dockLantern.intensity = flicker;
    }
  }

  dispose() {
    if (this.sun) {
      this.scene.remove(this.sun);
      this.scene.remove(this.sun.target);
      if (this.sun.shadow && this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
      }
    }
    if (this.ambient) this.scene.remove(this.ambient);
    if (this.porchLantern) this.scene.remove(this.porchLantern);
    if (this.dockLantern) this.scene.remove(this.dockLantern);
    if (this.rimLight) this.scene.remove(this.rimLight);
  }
}

export function createLighting(scene, options) {
  return new LightingSystem(scene, options);
}
