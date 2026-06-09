/**
 * MovementSystem — thin server-side wrapper around the shared applyMovement util.
 *
 * Keeping this as a separate file preserves the Clean Architecture boundary:
 * the game domain layer calls MovementSystem; MovementSystem delegates the
 * pure math to the shared package. Future physics (Rapier) will replace this
 * wrapper without touching GameSession.
 */

export { applyMovement as MovementSystem } from '@core-rivals/shared/movement/MovementUtils';
