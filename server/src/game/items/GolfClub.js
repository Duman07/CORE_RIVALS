import { WorldItem } from './WorldItem.js';

/**
 * GolfClub — a pickable golf club WorldItem.
 *
 * The owning player can charge a swing (GAME_SWING event) to apply a
 * physics impulse to the ball via PhysicsWorld.applyBallImpulse().
 */
export class GolfClub extends WorldItem {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  constructor(x, y, z) {
    super({ type: 'golf_club', x, y, z });
  }
}
