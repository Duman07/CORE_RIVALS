/**
 * PhysicsWorld — Rapier physics world for one GameSession.
 *
 * Phase 5 balance pass:
 *   - Collision groups isolate ball from player bodies.
 *     The ONLY way to move the ball is via applyBallImpulse() (GAME_SWING).
 *     Player capsules no longer generate contact forces on the ball collider.
 *   - Ball density raised 5× (mass ≈ 0.33 kg) → Δv ≈ 7.6 m/s at full swing.
 *   - linearDamping raised → ball decelerates faster, stays in arena.
 *   - angularDamping raised → less rolling, more predictable stop.
 *   - restitution lowered → less erratic wall bouncing.
 *
 * Collision group encoding (Rapier InteractionGroups):
 *   bits 16-31 = membership  (which group this collider belongs to)
 *   bits  0-15 = filter      (which memberships this collider collides WITH)
 *   Contact generated only when (A.filter & B.membership) AND (B.filter & A.membership).
 */

import RAPIER from '@dimforge/rapier3d-compat';
import {
  BALL_RADIUS,
  BALL_SPAWN,
} from '@core-rivals/shared/constants/GameConstants';
import {
  terrainHeight,
  TERRAIN_SIZE,
  TERRAIN_SEGMENTS,
} from '@core-rivals/shared/terrain/TerrainUtils';

// ─── Collision groups ────────────────────────────────────────────────────────
const GRP_PLAYER = 0x0001; // bit 0
const GRP_BALL   = 0x0002; // bit 1
const GRP_WORLD  = 0x0004; // bit 2

/** Player capsule: belongs to PLAYER, collides with WORLD + PLAYER — NOT ball */
const CGRP_PLAYER = (GRP_PLAYER << 16) | (GRP_WORLD | GRP_PLAYER);
/** Ball: belongs to BALL, collides with WORLD only — NOT players */
const CGRP_BALL   = (GRP_BALL   << 16) | GRP_WORLD;
/** Floor/Walls: belongs to WORLD, collides with PLAYER + BALL */
const CGRP_WORLD  = (GRP_WORLD  << 16) | (GRP_PLAYER | GRP_BALL);

// ─── Player capsule dimensions ───────────────────────────────────────────────
const CAPSULE_HALF_HEIGHT = 0.45;   // cylinder half-length
const CAPSULE_RADIUS      = 0.40;   // sphere radius
const PLAYER_Y            = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS; // 0.85 — capsule centre above the feet

export class PhysicsWorld {
  constructor() {
    this._world        = null;
    this._playerBodies = new Map(); // socketId → RigidBody
    this._ballBody     = null;
    this._ready        = false;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async init() {
    await RAPIER.init();

    this._world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    this._buildFloor();
    this._buildWalls();
    this._buildBall();

    this._ready = true;
    console.log('[PhysicsWorld] Initialised (balance pass: collision groups active)');
  }

  // ─── Player bodies ──────────────────────────────────────────────────────────

  /**
   * Register a player kinematic body at spawn position.
   * Capsule uses CGRP_PLAYER — will NOT contact the ball collider.
   */
  addPlayer(socketId, x, z) {
    if (!this._ready) return;
    const desc = RAPIER.RigidBodyDesc
      .kinematicPositionBased()
      .setTranslation(x, terrainHeight(x, z) + PLAYER_Y, z);
    const body = this._world.createRigidBody(desc);
    this._world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
        .setCollisionGroups(CGRP_PLAYER),
      body,
    );
    this._playerBodies.set(socketId, body);
  }

  movePlayer(socketId, x, z) {
    const body = this._playerBodies.get(socketId);
    if (!body) return;
    body.setNextKinematicTranslation({ x, y: terrainHeight(x, z) + PLAYER_Y, z });
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

  // ─── Impulse ────────────────────────────────────────────────────────────────

  /**
   * Apply an instant impulse to the ball (N·s).
   * Call BEFORE world.step() so Rapier incorporates it this tick.
   */
  applyBallImpulse(fx, fy, fz) {
    if (!this._ballBody) return;
    this._ballBody.applyImpulse({ x: fx, y: fy, z: fz }, true);
  }

  // ─── Step ───────────────────────────────────────────────────────────────────

  step() {
    this._world.step();
  }

  // ─── Private builders ───────────────────────────────────────────────────────

  _buildFloor() {
    // Heightfield collider sampling the SHARED terrainHeight() so the ball rolls
    // on exactly the same relief the client renders. Index mapping verified
    // empirically: heights[r*(N+1)+c], x = row axis, z = column axis, scale.y = 1.
    const N    = TERRAIN_SEGMENTS;
    const SIZE = TERRAIN_SIZE;
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
    // [cx, cy, cz, hx, hy, hz] — perimeter at ±36 m, tall enough to clear the relief
    const walls = [
      [  0, 2.5,  36, 38, 3, 0.5],   // north
      [  0, 2.5, -36, 38, 3, 0.5],   // south
      [ 36, 2.5,   0, 0.5, 3, 38],   // east
      [-36, 2.5,   0, 0.5, 3, 38],   // west
    ];
    for (const [cx, cy, cz, hx, hy, hz] of walls) {
      const body = this._world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz),
      );
      this._world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz)
          .setCollisionGroups(CGRP_WORLD),
        body,
      );
    }
  }

  _buildBall() {
    // Phase 5 balance pass:
    //   density 5.0  → mass ≈ 0.33 kg (default 1.0 → 0.065 kg was too light)
    //   linearDamping 1.0  → ~63% velocity loss per second; ball stops in ~7-8 m
    //   angularDamping 1.5 → less rolling
    //   restitution 0.35   → less erratic bouncing off walls
    const desc = RAPIER.RigidBodyDesc
      .dynamic()
      .setTranslation(BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z)
      .setLinearDamping(1.0)
      .setAngularDamping(1.5);
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
