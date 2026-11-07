// ==========================================================================
// Kevin Tighe: 3D Lakeside Retreat - Configuration & Game Constants
// ==========================================================================

export const CONFIG = {
  // Coordinate & Units System
  // 1 Three.js unit = 1.0 meter. 1 foot = 0.3048 meters. 1 meter = 3.28084 feet.
  M_PER_FT: 0.3048,
  FT_PER_M: 3.28084,

  // Depth Rules (Strict 10ft to 50ft Enforcement)
  DEPTH_RULES: {
    MIN_LEGAL_FT: 10.0,
    MAX_LEGAL_FT: 50.0,
    HOLY_GRAIL_FT: 50.0,
    // Tolerance window for Holy Grail exact 50ft match (+-0.2 ft)
    HOLY_GRAIL_TOLERANCE_FT: 0.25,
    // Warning threshold for deep shafts
    WARNING_DEPTH_FT: 45.0,
    // Red laser boundary depth
    RED_LASER_DEPTH_FT: 50.0
  },

  // Color Palette & Visual Theming
  COLORS: {
    ORANGE_PRIMARY: 0xff6b1a,
    ORANGE_DARK: 0xc2410c,
    ORANGE_LIGHT: 0xfb923c,
    PETER_PAN_GREEN: 0x15803d,
    PETER_PAN_DARK: 0x14532d,
    FEATHER_GOLD: 0xfacc15,
    SKY_BLUE: 0x7ec0ee,
    FOG_BLUE: 0x99c7e8,
    LAKE_WATER: 0x0284c7,
    LAKE_WATER_DEEP: 0x0369a1,
    EARTH_BROWN: 0x78350f,
    GRASS_GREEN: 0x22c55e,
    CLIFF_GRAY: 0x64748b,
    CABIN_WOOD: 0x92400e,
    CABIN_ROOF: 0x451a03,
    FIRE_LANTERN: 0xffa500,
    HOLY_GRAIL_EMERALD: 0x10b981,
    HAZARD_RED: 0xef4444
  },

  // Landmarks Layout & Spatial Coordinates (Metric)
  LANDMARKS: {
    LAKE: {
      position: { x: -25.0, y: 0.0, z: 75.0 },
      size: { width: 160.0, length: 140.0 }
    },
    DOCK: {
      position: { x: 0.0, y: 0.85, z: 18.0 },
      size: { width: 4.0, length: 24.0, height: 0.35 },
      pilingCount: 14
    },
    CABIN: {
      position: { x: 25.0, y: 2.0, z: -15.0 },
      size: { width: 11.0, height: 4.2, depth: 8.0 }
    },
    FOREST: {
      bounds: { minX: 16.0, maxX: 92.0, minZ: -82.0, maxZ: 4.0 },
      treeCount: 110
    },
    BLUFFS: {
      position: { x: -45.0, y: 0.0, z: 0.0 },
      maxElevation: 22.0,
      size: { width: 65.0, length: 75.0 }
    }
  },

  // 4 Landmark Holes Specification (Covering All 3 Depth Tiers)
  HOLES: [
    {
      id: 'hole_shoreline',
      name: 'Shoreline Sinkhole',
      tier: 'shallow',
      depthFt: 7.5,
      radius: 1.8,
      landmark: 'shoreline',
      position: { x: 12.0, y: 0.2, z: 18.0 },
      color: 0x94a3b8,
      description: 'Too shallow! (7.5ft) Rejects Kevin with buzzer bounce-back.'
    },
    {
      id: 'hole_dockside',
      name: 'Dockside Plunge Pit',
      tier: 'sweet_spot',
      depthFt: 22.0,
      radius: 1.6,
      landmark: 'dockside',
      position: { x: 0.0, y: 0.85, z: 22.0 },
      color: 0x0284c7,
      description: 'Sweet spot water plunge! (22.0ft) Geothermal geyser launch.'
    },
    {
      id: 'hole_pine_root',
      name: 'Pine-Root Cavern',
      tier: 'sweet_spot',
      depthFt: 50.0,
      radius: 2.2,
      landmark: 'pine_root',
      position: { x: 48.0, y: 3.5, z: -45.0 },
      color: 0x10b981,
      description: 'THE HOLY GRAIL! Exactly 50.0ft! Peter Pan crow fanfare!'
    },
    {
      id: 'hole_bluff_shaft',
      name: 'Granite Bluff Shaft',
      tier: 'deep',
      depthFt: 82.0,
      radius: 2.4,
      landmark: 'bluff',
      position: { x: -45.0, y: 22.0, z: 0.0 },
      color: 0xef4444,
      description: 'Too deep! (82.0ft) Red laser barrier at 50ft! Mid-shaft flight escape window.'
    }
  ],

  // Physics & Locomotion Tuning
  PHYSICS: {
    GRAVITY: -19.6, // m/s^2
    WALK_SPEED: 8.5,
    RUN_SPEED: 14.0,
    JUMP_IMPULSE: 9.0,
    FLIGHT_THRUST: 16.5,
    TERMINAL_FALL_VELOCITY: -40.0,
    GEYSER_LAUNCH_IMPULSE: 26.0
  },

  // Pixie Dust Flight Mechanics
  PIXIE_DUST: {
    MAX: 100.0,
    DRAIN_RATE: 24.0, // units per second while flying
    RECHARGE_RATE: 16.0 // units per second on ground
  },

  // Camera Settings
  CAMERA: {
    FOV: 60,
    NEAR: 0.1,
    FAR: 1000,
    DEFAULT_DISTANCE: 9.0,
    MIN_DISTANCE: 3.5,
    MIN_COLLISION_DISTANCE: 0.4,
    MAX_DISTANCE: 22.0,
    HEIGHT_OFFSET: 2.4,
    LOOK_OFFSET_Y: 1.6,
    SMOOTH_FACTOR: 0.12
  }
};
