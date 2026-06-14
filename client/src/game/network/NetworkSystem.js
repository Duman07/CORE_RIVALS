/**
 * NetworkSystem — client-side prediction buffer, input dispatch, and reconciliation.
 *
 * Responsibilities:
 *   1. Send inputs to the server at SEND_RATE Hz (not every frame).
 *   2. Keep a buffer of unacknowledged inputs for reconciliation.
 *   3. When a server snapshot arrives:
 *        a. Remove acknowledged inputs from the buffer.
 *        b. Invoke onServerState callback with local + remote data
 *           so GameEngine can reconcile LocalPlayer and update RemotePlayers.
 */

import { GAME_INPUT, MATCH_STATE } from '@core-rivals/shared/constants/SocketEvents';

const SEND_RATE     = 30;               // Hz — input packets per second
const SEND_INTERVAL = 1 / SEND_RATE;   // seconds between sends

export class NetworkSystem {
  /**
   * @param {import('socket.io-client').Socket} socket
   * @param {string} localPlayerId — our socket.id
   */
  constructor(socket, localPlayerId) {
    this._socket  = socket;
    this._localId = localPlayerId;
    this._seq     = 0;

    /** Unacknowledged inputs (seq > lastProcessed on server) */
    this._inputBuffer = [];

    this._sendAccumulator = 0;

    /** @type {((data: ServerStateEvent) => void) | null} */
    this._onServerStateCb = null;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Subscribe to MATCH_STATE from server. Call once after construction. */
  listen() {
    this._socket.on(MATCH_STATE, (snapshot) => this._handleSnapshot(snapshot));
  }

  /** Unsubscribe (call on dispose). */
  unlisten() {
    this._socket.off(MATCH_STATE);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register the callback invoked when a server snapshot arrives.
   * @param {(data: ServerStateEvent) => void} cb
   */
  onServerState(cb) {
    this._onServerStateCb = cb;
  }

  /**
   * Called every frame. Accumulates time and flushes an input packet at SEND_RATE.
   *
   * @param {{ dx:number, dz:number, sprint:boolean, yaw:number }} input
   * @param {number} dt — frame delta-time in seconds
   * @returns {object|null} the sent packet, or null if nothing was sent
   */
  update(input, dt) {
    this._sendAccumulator += dt;
    if (this._sendAccumulator < SEND_INTERVAL) return null;

    const packetDt        = this._sendAccumulator;
    this._sendAccumulator = 0;

    const packet = {
      seq:    this._seq++,
      dx:     input.dx,
      dz:     input.dz,
      sprint: input.sprint,
      yaw:    input.yaw,
      dt:     packetDt,
    };

    // Keep a copy in the prediction buffer before sending
    this._inputBuffer.push({ ...packet });
    this._socket.emit(GAME_INPUT, packet);
    return packet;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _handleSnapshot(snapshot) {
    const localData  = snapshot.players.find((p) => p.id === this._localId) ?? null;
    const remoteData = snapshot.players.filter((p) => p.id !== this._localId);

    if (localData !== null) {
      // Discard inputs the server has already processed
      this._inputBuffer = this._inputBuffer.filter(
        (inp) => inp.seq > localData.lastInputSeq,
      );
    }

    if (this._onServerStateCb) {
      this._onServerStateCb({
        tick:           snapshot.tick,
        local:          localData,
        remote:         remoteData,
        bufferedInputs: [...this._inputBuffer],
        ball:           snapshot.ball   ?? null,
        scores:         snapshot.scores ?? null,
        items:          snapshot.items  ?? null,  // Phase 5: club positions + ownership
      });
    }
  }
}

/**
 * @typedef {{
 *   tick: number,
 *   local: { id:string, x:number, y:number, z:number, yaw:number, lastInputSeq:number } | null,
 *   remote: Array<{ id:string, x:number, y:number, z:number, yaw:number }>,
 *   bufferedInputs: object[],
 * }} ServerStateEvent
 */
