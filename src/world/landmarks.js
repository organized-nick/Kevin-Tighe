/**
 * src/world/landmarks.js
 * Unified Landmark Factory & Spatial Registry for Lakeside Retreat 3D
 */

import { LakesideTerrain } from './terrain.js';
import { LakesideLake } from './lake.js';
import { LakesideDock } from './dock.js';
import { LakesideCabin } from './cabin.js';
import { LakesideForest } from './forest.js';
import { LakesideBluffs } from './bluffs.js';

export class WorldManager {
  constructor(scene, textureManager) {
    this.scene = scene;
    this.textures = textureManager;

    this.terrain = new LakesideTerrain(this.scene, this.textures);
    this.lake = new LakesideLake(this.scene, this.textures);
    this.dock = new LakesideDock(this.scene, this.textures);
    this.cabin = new LakesideCabin(this.scene, this.textures);
    this.forest = new LakesideForest(this.scene, this.textures, this.terrain);
    this.bluffs = new LakesideBluffs(this.scene, this.textures, this.terrain);

    // Dictionary with both canonical and descriptive alias keys
    this.landmarks = {
      lake: this.lake.mesh,
      lakeWater: this.lake.mesh,
      dock: this.dock.group,
      dockPier: this.dock.group,
      cabin: this.cabin.group,
      timberCabin: this.cabin.group,
      forest: this.forest.group,
      pineForest: this.forest.group,
      bluffs: this.bluffs.group,
      shoreline: this.terrain.mesh
    };
  }

  update(dt, time) {
    if (this.lake) {
      this.lake.update(dt, time);
    }
  }
}

export function createWorldLandmarks(scene, textureManager) {
  const world = new WorldManager(scene, textureManager);
  return world;
}
