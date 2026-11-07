/**
 * src/core/textures.js
 * Procedural PBR Texture Generator & Zero-Fail Progressive Asset Pipeline.
 * 
 * Synthesizes high-fidelity 512x512 CanvasTextures synchronously as fallbacks
 * while loading native CC0 PBR textures from ./assets/.
 */

import * as THREE from 'three';

export class TextureManager {
  constructor() {
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.fallbackCanvases = new Map();
    this.initProceduralFallbacks();
  }

  // =========================================================================
  // 1. Procedural Canvas Generators (512x512 Fallbacks)
  // =========================================================================

  initProceduralFallbacks() {
    this.fallbackCanvases.set('wood_color', this.createWoodColorCanvas());
    this.fallbackCanvases.set('wood_normal', this.createWoodNormalCanvas());
    this.fallbackCanvases.set('cliff_color', this.createCliffColorCanvas());
    this.fallbackCanvases.set('cliff_normal', this.createCliffNormalCanvas());
    this.fallbackCanvases.set('grass_color', this.createGrassColorCanvas());
    this.fallbackCanvases.set('grass_normal', this.createGrassNormalCanvas());
    this.fallbackCanvases.set('earth_color', this.createEarthColorCanvas());
    this.fallbackCanvases.set('earth_normal', this.createEarthNormalCanvas());
    this.fallbackCanvases.set('earth_roughness', this.createEarthRoughnessCanvas());
    this.fallbackCanvases.set('water_normal', this.createWaterNormalCanvas());
    this.fallbackCanvases.set('brick_normal', this.createBrickNormalCanvas());
    this.fallbackCanvases.set('metal_color', this.createMetalColorCanvas());
    this.fallbackCanvases.set('metal_normal', this.createMetalNormalCanvas());
    this.fallbackCanvases.set('metal_roughness', this.createMetalRoughnessCanvas());
    this.fallbackCanvases.set('redmetal_color', this.createRedMetalColorCanvas());
    this.fallbackCanvases.set('redmetal_normal', this.createMetalNormalCanvas());
    this.fallbackCanvases.set('citrus_peel_normal', this.createCitrusNormalCanvas());
  }

  createWoodColorCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(0, 0, 512, 512);

    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = '#5c330a';
      ctx.fillRect(0, y, 512, 4);
    }
    for (let i = 0; i < 300; i++) {
      const y = Math.random() * 512;
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(180, 83, 9, 0.25)' : 'rgba(69, 26, 3, 0.2)';
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + (Math.random() - 0.5) * 12, 340, y + (Math.random() - 0.5) * 12, 512, y);
      ctx.stroke();
    }
    for (let k = 0; k < 6; k++) {
      const kx = 60 + Math.random() * 390;
      const ky = 40 + Math.random() * 430;
      ctx.fillStyle = '#3e1804';
      ctx.beginPath();
      ctx.ellipse(kx, ky, 10, 5, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }

  createWoodNormalCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 512, 512);

    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = 'rgb(128, 90, 240)';
      ctx.fillRect(0, y, 512, 2);
      ctx.fillStyle = 'rgb(128, 160, 255)';
      ctx.fillRect(0, y + 2, 512, 2);
    }
    return c;
  }

  createCliffColorCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30, 41, 59, 0.35)' : 'rgba(100, 116, 139, 0.35)';
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const w = 4 + Math.random() * 24;
      const h = 4 + Math.random() * 24;
      ctx.fillRect(x, y, w, h);
    }
    return c;
  }

  createCliffNormalCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(512, 512);
    const d = imgData.data;

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const nx = Math.sin(x * 0.15) * 0.4;
        const ny = Math.cos(y * 0.15) * 0.4;
        d[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        d[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        d[idx + 2] = 255;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return c;
  }

  createGrassColorCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = Math.random() > 0.4 ? 'rgba(34, 197, 94, 0.25)' : 'rgba(21, 128, 61, 0.35)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 4);
    }
    return c;
  }

  createGrassNormalCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 256, 256);
    return c;
  }

  createEarthColorCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5c2c0e';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(120, 53, 15, 0.3)' : 'rgba(39, 16, 2, 0.35)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }
    return c;
  }

  createEarthNormalCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 256, 256);
    return c;
  }

  createEarthRoughnessCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, 0, 256, 256);
    return c;
  }

  createWaterNormalCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(512, 512);
    const d = imgData.data;

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const waveX = Math.sin(x * 0.08) * Math.cos(y * 0.06);
        const waveY = Math.cos(x * 0.06) * Math.sin(y * 0.08);
        d[idx] = Math.floor((waveX * 0.4 + 0.5) * 255);
        d[idx + 1] = Math.floor((waveY * 0.4 + 0.5) * 255);
        d[idx + 2] = 255;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return c;
  }

  createBrickNormalCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 256, 256);

    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = 'rgb(128, 90, 230)';
      ctx.fillRect(0, y, 256, 3);
    }
    return c;
  }

  createMetalColorCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 256, 256);
    return c;
  }

  createMetalNormalCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 256, 256);
    return c;
  }

  createMetalRoughnessCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#666666';
    ctx.fillRect(0, 0, 256, 256);
    return c;
  }

  createRedMetalColorCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(0, 0, 256, 256);
    return c;
  }

  createCitrusNormalCanvas() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(256, 256);
    const d = imgData.data;

    for (let i = 0; i < 256 * 256 * 4; i += 4) {
      d[i] = 128 + Math.floor((Math.random() - 0.5) * 30);
      d[i + 1] = 128 + Math.floor((Math.random() - 0.5) * 30);
      d[i + 2] = 255;
      d[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return c;
  }

  // =========================================================================
  // 2. Texture Acquisition API
  // =========================================================================

  get(name, repeatX = 1, repeatY = 1) {
    const normalizedName = this.normalizeName(name);
    const key = `${normalizedName}_${repeatX}_${repeatY}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const isColor = normalizedName.endsWith('_color');
    const url = `./assets/${normalizedName}.jpg`;

    // Load texture with fallback on failure
    const texture = this.loader.load(
      url,
      (loadedTex) => {
        loadedTex.wrapS = loadedTex.wrapT = THREE.RepeatWrapping;
        loadedTex.repeat.set(repeatX, repeatY);
        if (isColor) loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback: assign procedural canvas
        console.warn(`[TextureManager] Fallback active for: ${normalizedName}`);
        const canvas = this.fallbackCanvases.get(normalizedName) || this.fallbackCanvases.get('wood_color');
        if (canvas) {
          texture.image = canvas;
          texture.needsUpdate = true;
        }
      }
    );

    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    if (isColor) texture.colorSpace = THREE.SRGBColorSpace;

    this.cache.set(key, texture);
    return texture;
  }

  normalizeName(name) {
    return name.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  // Named accessors
  get waterNormal() { return this.get('water_normal', 12, 8); }
  get woodColor() { return this.get('wood_color', 2, 2); }
  get woodNormal() { return this.get('wood_normal', 2, 2); }
  get cliffColor() { return this.get('cliff_color', 4, 4); }
  get cliffNormal() { return this.get('cliff_normal', 4, 4); }
  get grassColor() { return this.get('grass_color', 12, 12); }
  get grassNormal() { return this.get('grass_normal', 12, 12); }
  get earthColor() { return this.get('earth_color', 8, 8); }
  get earthNormal() { return this.get('earth_normal', 8, 8); }
  get earthRoughness() { return this.get('earth_roughness', 8, 8); }
  get brickNormal() { return this.get('brick_normal', 2, 4); }
  get citrusPeelNormal() { return this.get('citrus_peel_normal', 2, 2); }
  get metalColor() { return this.get('metal_color', 1, 1); }
  get metalNormal() { return this.get('metal_normal', 1, 1); }
  get metalRoughness() { return this.get('metal_roughness', 1, 1); }
  get redmetalColor() { return this.get('redmetal_color', 1, 1); }
  get redmetalNormal() { return this.get('redmetal_normal', 1, 1); }
}
