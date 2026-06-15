/**
 * PhysicsWorld — Rapier physics world for one GameSession.
 *
 * - Heightfield floor from the shared terrainHeight (ball + players follow relief).
 * - Solid obstacles (funnel walls + columns) and a bouncy translucent perimeter,
 *   all in the SOLID group so the ball bounces off them and players collide.
 * - Players are kinematic and moved through a KinematicCharacterController so they
 *   slide along obstacles/walls instead of passing through.
 * - Ball roll depends on the ground surface (sand slows, metal rolls far).
 *
 * Collision group encoding (Rapier InteractionGroups):
 *   bits 16-31 = membership, bits 0-15 = filter.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import {
  BALL_RADIUS,
  BALL_SPAWN,
  WALL_HALF,
  WALL_HEIGHT,
  WALL_RESTITUTION,
} from '@core-rivals/shared/constants/GameConstants';
import {
  terrainHeight,
  TERRAIN_SIZE,
  TERRAIN_SEGMENTS,
} from '@core-rivals/shared/terrain/TerrainUtils';
import {
  getObstacles,
  surfaceAt,
  SURFACE_DAMPING,
} from '@core-rivals/shared/arena/ArenaLayout';

// ─── Collision groups ────────────────────────────────────────────────────────
const GRP_PLAYER = 0x0001;
const GRP_BALL   = 0x0002;
const GRP_WORLD  = 0x0004; // heightfield floor
const GRP_SOLID  = 0x0008; // walls + obstacles (queried by the character controller)

const CGRP_PLAYER = (GRP_PLAYER << 16) | (GRP_WORLD | GRP_PLAYER | GRP_SOLID);
const CGRP_BALL   = (GRP_BALL   << 16) | (GRP_WORLD | GRP_SOLID);
const CGRP_WORLD  = (GRP_WORLD  << 16) | (GRP_PLAYER | GRP_BALL);
const CGRP_SOLID  = ((GRP_WORLD | GRP_SOLID) << 16) | (GRP_PLAYER | GRP_BALL);
// Character-controller query: collide only with SOLID (NOT the heightfield).
const SOLID_FILTER = (0xFFFF << 16) | GRP_SOLID;

// ─── Player capsule dimensions ───────────────────────────────────────────────
const CAPSULE_HALF_HEIGHT = 0.45;
const CAPSULE_RADIUS      = 0.40;
const PLAYER_Y            = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS; // 0.85

const AIR_DAMPING = 0.25; // ball linear damping while airborne (smooth flight)

export class PhysicsWorld {
  constructor() {
    this._world           = null;
    this._playerBodies    = new Map(); // socketId → RigidBody
    this._playerColliders = new Map(); // socketId → Collider
    this._ballBody        = null;
    this._charCtrl        = null;
    this._ready           = false;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async init() {
    await RAPIER.init();
    this._world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    this._buildFloor();
    this._buildWalls();
    this._buildObstacles();
    this._buildBall();

    // Character controller for kinematic players (slide along obstacles/walls).
    this._charCtrl = this._world.createCharacterController(0.05);
    this._charCtrl.enableSnapToGround(0.5);

    this._ready = true;
    console.log('[PhysicsWorld] Initialised (heightfield + obstacles + character controller)');
  }

  // ─── Player bodies ──────────────────────────────────────────────────────────

  addPlayer(socketId, x, z) {
    if (!this._ready) return;
    const desc = RAPIER.RigidBodyDesc
      .kinematicPositionBased()
      .setTranslation(x, terrainHeight(x, z) + PLAYER_Y, z);
    const body = this._world.createRigidBody(desc);
    const col  = this._world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
        .setCollisionGroups(CGRP_PLAYER),
      body,
    );
    this._playerBodies.set(socketId, body);
    this._playerColliders.set(socketId, col);
  }

  /**
   * Move a player toward (x, z) with obstacle/wall collision resolution.
   * The character controller slides the capsule along solids; the heightfield
   * is excluded (vertical placement comes from terrainHeight analytically).
   */
  movePlayer(socketId, x, z) {
    const body = this._playerBodies.get(socketId);
    const col  = this._playerColliders.get(socketId);
    if (!body || !col) return;

    const cur = body.translation();
    const desired = { x: x - cur.x, y: 0, z: z - cur.z };
    this._charCtrl.computeColliderMovement(col, desired, undefined, SOLID_FILTER);
    const mv = this._charCtrl.computedMovement();

    const nx = cur.x + mv.x;
    const nz = cur.z + mv.z;
    body.setNextKinematicTranslation({ x: nx, y: terrainHeight(nx, nz) + PLAYER_Y, z: nz });
  }

  getPlayerTranslation(socketId) {
    const body = this._playerBodies.get(socketId);
    return body ? body.translation() : null;
  }

  removePlayer(socketId) {
    const body = this._playerBodies.get(socketId);
    if (!body) return;
    this._world.removeRigidBody(body);
    this._playerBodies.delete(socketId);
    this._playerColliders.delete(socketId);
  }

  // ─── Ball ───────────────────────────────────────────────────────────────────

  getBallState() {
    const t = this._ballBody.translation();
    const v = this._ballBody.linvel();
    return { x: t.x, y: t.y, z: t.z, vx: v.x, vy: v.y, vz: v.z };
  }

  resetBall() {
    this._ballBody.setTranslation({ x: BALL_SPAWN.x, y: BALL_SPAWN.y, z: BALL_SPAWN.z }, true);
    this._ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this._ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  applyBallImpulse(fx, fy, fz) {
    if (!this._ballBody) return;
    this._ballBody.applyImpulse({ x: fx, y: fy, z: fz }, true);
  }

  // ─── Step ───────────────────────────────────────────────────────────────────

  step() {
    // Surface-dependent roll: sand slows the ball, metal lets it roll far.
    if (this._ballBody) {
      const t        = this._ballBody.translation();
      const airborne = (t.y - terrainHeight(t.x, t.z)) > 0.5;
      const damping  = airborne
        ? AIR_DAMPING
        : (SURFACE_DAMPING[surfaceAt(t.x, t.z)] ?? SURFACE_DAMPING.grass);
      this._ballBody.setLinearDamping(damping);
    }
    this._world.step();
  }

  // ─── Private builders ───────────────────────────────────────────────────────

  _buildFloor() {
    const N = TERRAIN_SEGMENTS, SIZE = TERRAIN_SIZE;
    const heights = new Float32Array((N + 1) * (N + 1));
    for (let r = 0; r <= N; r++) {
      const x = -SIZE / 2 + (r / N) * SIZE;
      for (let c = 0; c <= N; c++) {
        const z = -SIZE / 2 + (c / N) * SIZE;
        heights[r * (N + 1) + c] = terrainHeight(x, z);
      }
    }
    const body = this._world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this._world.createCollider(
      RAPIER.ColliderDesc.heightfield(N, N, heights, { x: SIZE, y: 1, z: SIZE })
        .setFriction(0.6)
        .setCollisionGroups(CGRP_WORLD),
      body,
    );
  }

  _buildWalls() {
    const h = WALL_HALF, hy = WALL_HEIGHT / 2, cy = WALL_HEIGHT / 2 - 1, span = WALL_HALF + 2;
    const walls = [
      [  0, cy,  h, span, hy, 0.5],
      [  0, cy, -h, span, hy, 0.5],
      [  h, cy,  0, 0.5,  hy, span],
      [ -h, cy,  0, 0.5,  hy, span],
    ];
    for (const [cx, cyy, cz, hx, hhy, hz] of walls) {
      const body = this._world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cyy, cz));
      this._world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hhy, hz)
          .setRestitution(WALL_RESTITUTION)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
          .setCollisionGroups(CGRP_SOLID),
        body,
      );
    }
  }

  _buildObstacles() {
    // Obstacles arrive pre-anchored to the relief (o.cy = resolved centre Y).
    for (const o of getObstacles()) {
      if (o.kind === 'wall') {
        const body = this._world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(o.x, o.cy, o.z)
            .setRotation({ x: 0, y: Math.sin(o.yaw / 2), z: 0, w: Math.cos(o.yaw / 2) }),
        );
        this._world.createCollider(
          RAPIER.ColliderDesc.cuboid(o.hw, o.hh, o.hd)
            .setRestitution(0.6)
            .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
            .setCollisionGroups(CGRP_SOLID),
          body,
        );
      } else {
        const body = this._world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(o.x, o.cy, o.z));
        this._world.createCollider(
          RAPIER.ColliderDesc.cylinder(o.hh, o.radius)
            .setRestitution(0.5)
            .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
            .setCollisionGroups(CGRP_SOLID),
          body,
        );
      }
    }
  }

  _buildBall() {
    const desc = RAPIER.RigidBodyDesc
      .dynamic()
      .setTranslation(BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z)
      .setLinearDamping(SURFACE_DAMPING.grass)
      .setAngularDamping(0.8);
    this._ballBody = this._world.createRigidBody(desc);
    this._world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setDensity(5.0)
        .setRestitution(0.35)
        .setFriction(0.5)
        .setCollisionGroups(CGRP_BALL),
      this._ballBody,
    );
  }
}
