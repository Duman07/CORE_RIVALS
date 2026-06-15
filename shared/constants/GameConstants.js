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

/**
 * Atributos base por personaje (escala 1-10, definidos por diseño).
 * De aquí se DERIVAN todos los multiplicadores de juego (ver deriveStats).
 *   precision  → puntería del tiro (menos dispersión)
 *   estrategia → metadato (sistemas futuros: IA, info de mapa)
 *   reaccion   → cadencia de golpe (menor cooldown)
 *   fuerza     → potencia del tiro y del empuje
 *   resistencia→ duración máxima de bloqueo
 *   movilidad  → velocidad de movimiento
 *   competitividad → bonus de empuje (agresividad) + metadato
 */
export const CHARACTER_ATTRIBUTES = {
  moises:    { precision: 9, estrategia: 10, reaccion: 4, fuerza: 3, resistencia: 8, movilidad: 5, competitividad: 8 },
  sebastian: { precision: 9, estrategia: 8,  reaccion: 7, fuerza: 7, resistencia: 4, movilidad: 5, competitividad: 6 },
  duman:     { precision: 7, estrategia: 5,  reaccion: 9, fuerza: 9, resistencia: 7, movilidad: 8, competitividad: 9 },
};

const _clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Multiplicador lineal centrado en el valor 6 (neutral = 1.0).
const _k = (v, perPoint) => 1 + (v - 6) * perPoint;

/** Convierte los atributos 1-10 en multiplicadores de juego. */
export function deriveStats(a) {
  return {
    moveScale:          _clamp(_k(a.movilidad, 0.035), 0.85, 1.20),
    swingPower:         _clamp(_k(a.fuerza, 0.045) * _k(a.precision, 0.010), 0.80, 1.25),
    pushForce:          _clamp(_k(a.fuerza, 0.040) * _k(a.competitividad, 0.015), 0.80, 1.30),
    accuracySpread:     _clamp(0.10 * (1 - (a.precision - 1) / 9), 0, 0.10), // rad σ; prec 10 → ~0
    swingCooldownScale: _clamp(_k(a.reaccion, -0.030), 0.80, 1.20),          // más reacción → menos cooldown
    blockDurationScale: _clamp(_k(a.resistencia, 0.050), 0.70, 1.30),
  };
}

export const CHARACTER_STATS = {
  duman: {
    displayName: 'Duman',
    role: 'El Físico',
    description: 'Fuerza bruta. Reflejos fulminantes y golpes potentes.',
    attributes: CHARACTER_ATTRIBUTES.duman,
    stats:      deriveStats(CHARACTER_ATTRIBUTES.duman),
  },
  moises: {
    displayName: 'Moisés',
    role: 'El Estratega',
    description: 'Precisión técnica. Analítico y resistente mentalmente.',
    attributes: CHARACTER_ATTRIBUTES.moises,
    stats:      deriveStats(CHARACTER_ATTRIBUTES.moises),
  },
  sebastian: {
    displayName: 'Sebastián',
    role: 'El Preciso',
    description: 'Vista de águila. Pulso quirúrgico y buena reacción.',
    attributes: CHARACTER_ATTRIBUTES.sebastian,
    stats:      deriveStats(CHARACTER_ATTRIBUTES.sebastian),
  },
};

// ─── Items ────────────────────────────────────────────────────────────────────
export const PICKUP_RADIUS        = 1.8;   // metres to pick up an item (walk-over auto-pickup)
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
export const MAP_RADIUS           = 34;    // metres (scaled-up golf-course field)
export const CORE_DISTANCE        = 30;    // metres from centre
export const ITEM_SPAWN_DISTANCE  = 12;    // metres from centre

// Perimeter boundary — translucent "glass" the ball bounces off. Shared by the
// server (physics walls) and the client (visual panels) so they always match.
export const WALL_HALF            = 36;    // metres — half-extent of the square boundary
export const WALL_HEIGHT          = 8;     // metres — visible/physical wall height (clears the shot arc)
export const WALL_RESTITUTION     = 0.8;   // bounciness of the boundary

// ─── Ball (Phase 4) ───────────────────────────────────────────────────────────
export const BALL_RADIUS = 0.25;   // metres — visible game ball
export const BALL_SPAWN  = Object.freeze({ x: 0, y: 2, z: 0 });

// ─── Cores (Phase 4) ──────────────────────────────────────────────────────────
export const CORE_RADIUS = 1.5;    // metres — flat distance detection

// Core[i] belongs to the player in slot i+1.
// Equilateral triangle at circumradius 30 m (spawn positions are at 17 m).
export const CORE_POSITIONS = Object.freeze([
  Object.freeze({ x:  0,  y: 0, z: -30 }),
  Object.freeze({ x:  26, y: 0, z:  15 }),
  Object.freeze({ x: -26, y: 0, z:  15 }),
]);

// ─── Movement (Phase 3) ───────────────────────────────────────────────────────
export const MOVE_SPEED    = 5;    // m/s walk
export const SPRINT_SPEED  = 8;    // m/s sprint
export const ARENA_SIZE    = 34;   // half-size — player stays within +-34 m

// Equidistant spawn points (circumradius 17 m, slot index 0-2)
export const SPAWN_POSITIONS = [
  { x:   0,    y: 0, z: -17  },   // slot 1 — north
  { x:  14.72, y: 0, z:   8.5 },  // slot 2 — south-east
  { x: -14.72, y: 0, z:   8.5 },  // slot 3 — south-west
];

// Three.js hex colour per character
export const CHARACTER_COLORS = {
  duman:     0xe74c3c,
  moises:    0x3498db,
  sebastian: 0x9b59b6,
};

// ─── Golf (Phase 5) ──────────────────────────────────────────────────────────
// Club spawn points — between centre and each player spawn (~12 m radius)
export const CLUB_SPAWN_POSITIONS = Object.freeze([
  Object.freeze({ x:   0,    y: 0, z: -12 }),  // near slot 1 (north)
  Object.freeze({ x:  10.39, y: 0, z:   6 }),  // near slot 2 (south-east)
  Object.freeze({ x: -10.39, y: 0, z:   6 }),  // near slot 3 (south-west)
]);

export const SWING_MAX_IMPULSE   = 7.0;  // N·s — total impulse magnitude at full power
export const SWING_LAUNCH_ANGLE  = 0.576; // rad (~33°) — golf loft: ball lifts into an arc then lands and rolls
export const SWING_LOFT_FACTOR   = 1.5;  // (legacy) kept for backward compatibility
export const SWING_REACH         = 3.5;  // m — max player↔ball dist for valid swing
export const SWING_CHARGE_TIME   = 1.5;  // s — time from 0 to full charge (client)
export const SWING_COOLDOWN_SECS = 1.5;  // s — cooldown between swings (server gate + client visual)

// ─── Combat (Phase 6) ────────────────────────────────────────────────────────
// Push displaces target by decaying velocity applied each tick.
// total_displacement = PUSH_BASE_VELOCITY / (TICK_RATE × (1 − PUSH_DECAY_PER_TICK))
//   normal push:  15 / (60 × 0.12) ≈ 2.1 m
//   blocked push: 2.1 × 0.25      ≈ 0.5 m
export const PUSH_MAX_DISTANCE   = 2.5;   // m — maximum push range
export const PUSH_BASE_VELOCITY  = 15;    // m/s — initial push speed applied to target
export const PUSH_DECAY_PER_TICK = 0.88;  // velocity multiplier per server tick
export const PUSH_MIN_VELOCITY   = 0.1;   // m/s — stop threshold
export const PUSH_COOLDOWN_SECS  = 2.0;   // s — between pushes (server-enforced)
export const BLOCK_PUSH_FACTOR   = 0.25;  // push force multiplier when target is blocking
export const BLOCK_MAX_DURATION  = 3.0;   // s — max continuous block (server-enforced)
