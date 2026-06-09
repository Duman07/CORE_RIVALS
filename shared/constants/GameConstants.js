// ─── Match ────────────────────────────────────────────────────────────────────
export const MATCH_DURATION       = 480;   // seconds (8 minutes)
export const TICK_RATE            = 60;    // Hz – server simulation
export const BROADCAST_RATE       = 20;    // Hz – state sent to clients
export const MAX_PLAYERS          = 3;

// ─── Scoring ──────────────────────────────────────────────────────────────────
export const POINTS_PER_CORE      = 1;     // each rival receives this on a goal
export const SELF_GOAL_PENALTY    = -1;    // subtracted from the goal's author
export const CORE_DWELL_TIME      = 0.5;   // seconds the sphere must stay inside

// ─── Characters ───────────────────────────────────────────────────────────────
export const CHARACTERS = ['duman', 'moises', 'sebastian'];

export const CHARACTER_STATS = {
  duman: {
    displayName: 'Duman',
    role: 'El Físico',
    description: 'Fuerza bruta. Domina el cuerpo a cuerpo y los golpes potentes.',
    stats: { swingPower: 1.05, arrowSpeed: 0.95, pushForce: 1.08, gripStrength: 0.92, agility: 0.95 },
  },
  moises: {
    displayName: 'Moisés',
    role: 'El Estratega',
    description: 'Precisión técnica. Analítico, resistente mentalmente.',
    stats: { swingPower: 1.00, arrowSpeed: 1.02, pushForce: 0.95, gripStrength: 1.00, agility: 1.00 },
  },
  sebastian: {
    displayName: 'Sebastián',
    role: 'El Precisión',
    description: 'Vista de águila. Reflejos fulminantes y pulso quirúrgico.',
    stats: { swingPower: 0.97, arrowSpeed: 1.05, pushForce: 0.97, gripStrength: 1.05, agility: 1.03 },
  },
};

// ─── Items ────────────────────────────────────────────────────────────────────
export const PICKUP_RADIUS        = 1.2;   // metres to pick up an item
export const DISARM_RADIUS        = 1.0;   // metres to disarm
export const ITEM_RESPAWN_DELAY   = 20;    // seconds

// ─── Physics ──────────────────────────────────────────────────────────────────
export const GRAVITY              = -9.81;
export const SPHERE_MASS          = 0.046;
export const SPHERE_RADIUS        = 0.0214;
export const SPHERE_RESTITUTION   = 0.68;
export const SPHERE_FRICTION      = 0.35;

// ─── Arrow ────────────────────────────────────────────────────────────────────
export const ARROW_MASS           = 0.025;
export const ARROW_MIN_SPEED      = 15;    // m/s
export const ARROW_MAX_SPEED      = 35;    // m/s
export const ARROW_LIFETIME       = 8;     // seconds
export const ARROW_PLAYER_IMPULSE = 0.3;
export const ARROW_MAX_IN_AIR     = 3;

// ─── Combat ───────────────────────────────────────────────────────────────────
export const PUSH_FORCE_BASE      = 8;     // Newtons
export const GRAB_DURATION        = 2.0;   // seconds
export const BLOCK_COOLDOWN       = 3.0;   // seconds
export const DISARM_COOLDOWN      = 2.0;   // seconds

// ─── Map ──────────────────────────────────────────────────────────────────────
export const MAP_RADIUS           = 20;    // metres
export const CORE_DISTANCE        = 10;    // metres from centre
export const ITEM_SPAWN_DISTANCE  = 7;     // metres from centre

// ─── Ball (Phase 4) ───────────────────────────────────────────────────────────
export const BALL_RADIUS = 0.25;   // metres — visible game ball
export const BALL_SPAWN  = Object.freeze({ x: 0, y: 2, z: 0 });

// ─── Cores (Phase 4) ──────────────────────────────────────────────────────────
export const CORE_RADIUS = 1.5;    // metres — flat distance detection

// Core[i] belongs to the player in slot i+1.
// Equilateral triangle at circumradius 18 m (spawn positions are at 10 m).
export const CORE_POSITIONS = Object.freeze([
  Object.freeze({ x:  0,    y: 0, z: -18 }),
  Object.freeze({ x:  15.6, y: 0, z:   9 }),
  Object.freeze({ x: -15.6, y: 0, z:   9 }),
]);

// ─── Movement (Phase 3) ───────────────────────────────────────────────────────
export const MOVE_SPEED    = 5;    // m/s walk
export const SPRINT_SPEED  = 8;    // m/s sprint
export const ARENA_SIZE    = 24;   // half-size — player stays within +-24 m

// Equidistant spawn points (circumradius 10 m, slot index 0-2)
export const SPAWN_POSITIONS = [
  { x:  0,     y: 0, z: -10 },   // slot 1 — north
  { x:  8.66,  y: 0, z:  5  },   // slot 2 — south-east
  { x: -8.66,  y: 0, z:  5  },   // slot 3 — south-west
];

// Three.js hex colour per character
export const CHARACTER_COLORS = {
  duman:     0xe74c3c,
  moises:    0x3498db,
  sebastian: 0x9b59b6,
};
