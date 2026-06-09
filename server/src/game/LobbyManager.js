import { MAX_PLAYERS, CHARACTERS } from '@core-rivals/shared/constants/GameConstants';

// ─── Room ID generator ────────────────────────────────────────────────────────
const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit O,0,I,1 (ambiguous)

function generateRoomId() {
  return Array.from(
    { length: 6 },
    () => ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)]
  ).join('');
}

// ─── LobbyManager ─────────────────────────────────────────────────────────────
/**
 * In-memory lobby store for Phase 2.
 * Interface designed for future migration to Redis (Phase 3+).
 *
 * Lobby shape:
 * {
 *   roomId:    string,
 *   hostId:    string,          // socketId of host
 *   status:    'waiting' | 'starting',
 *   players:   PlayerSlot[],
 *   createdAt: number,
 * }
 *
 * PlayerSlot shape:
 * {
 *   socketId:  string,
 *   name:      string,
 *   character: string | null,   // 'duman' | 'moises' | 'sebastian' | null
 *   ready:     boolean,
 *   slot:      number,          // 1 | 2 | 3
 * }
 */
export class LobbyManager {
  constructor() {
    /** @type {Map<string, object>} roomId → lobby */
    this._lobbies = new Map();
    /** @type {Map<string, string>} socketId → roomId */
    this._playerRooms = new Map();
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  createLobby(socketId, playerName) {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (this._lobbies.has(roomId));

    const lobby = {
      roomId,
      hostId: socketId,
      status: 'waiting',
      players: [
        { socketId, name: playerName, character: null, ready: false, slot: 1 },
      ],
      createdAt: Date.now(),
    };

    this._lobbies.set(roomId, lobby);
    this._playerRooms.set(socketId, roomId);
    return lobby;
  }

  // ─── Join ────────────────────────────────────────────────────────────────────

  joinLobby(roomId, socketId, playerName) {
    const lobby = this._lobbies.get(roomId);

    if (!lobby) return { error: 'Sala no encontrada. Verifica el código.' };
    if (lobby.status !== 'waiting') return { error: 'La partida ya ha comenzado.' };
    if (lobby.players.length >= MAX_PLAYERS) return { error: 'La sala está llena.' };
    if (this._playerRooms.has(socketId)) return { error: 'Ya estás en una sala.' };

    const usedSlots = lobby.players.map((p) => p.slot);
    const nextSlot = [1, 2, 3].find((s) => !usedSlots.includes(s));

    lobby.players.push({ socketId, name: playerName, character: null, ready: false, slot: nextSlot });
    this._playerRooms.set(socketId, roomId);
    return { lobby };
  }

  // ─── Character selection ──────────────────────────────────────────────────────

  selectCharacter(socketId, character) {
    if (!CHARACTERS.includes(character)) {
      return { error: `Personaje no válido: ${character}` };
    }

    const lobby = this._getLobbyBySocket(socketId);
    if (!lobby) return { error: 'No estás en ninguna sala.' };

    const takenBy = lobby.players.find(
      (p) => p.character === character && p.socketId !== socketId
    );
    if (takenBy) return { error: `${character} ya está elegido por otro jugador.` };

    const player = lobby.players.find((p) => p.socketId === socketId);
    if (!player) return { error: 'Jugador no encontrado en la sala.' };

    // Selecting the same character again de-selects it
    player.character = player.character === character ? null : character;
    // Reset ready if character changes
    player.ready = false;

    return { lobby };
  }

  // ─── Ready toggle ─────────────────────────────────────────────────────────────

  setReady(socketId) {
    const lobby = this._getLobbyBySocket(socketId);
    if (!lobby) return { error: 'No estás en ninguna sala.' };

    const player = lobby.players.find((p) => p.socketId === socketId);
    if (!player) return { error: 'Jugador no encontrado.' };
    if (!player.character) return { error: 'Debes seleccionar un personaje antes de estar listo.' };

    player.ready = !player.ready;

    const allReady =
      lobby.players.length === MAX_PLAYERS &&
      lobby.players.every((p) => p.ready);

    if (allReady) lobby.status = 'starting';

    return { lobby, shouldStart: allReady };
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────────

  removePlayer(socketId) {
    const roomId = this._playerRooms.get(socketId);
    if (!roomId) return { lobby: null, wasLastPlayer: false };

    const lobby = this._lobbies.get(roomId);
    if (!lobby) {
      this._playerRooms.delete(socketId);
      return { lobby: null, wasLastPlayer: false };
    }

    lobby.players = lobby.players.filter((p) => p.socketId !== socketId);
    this._playerRooms.delete(socketId);

    if (lobby.players.length === 0) {
      this._lobbies.delete(roomId);
      return { lobby: null, wasLastPlayer: true, roomId };
    }

    // If host left, reassign to next player
    if (lobby.hostId === socketId) {
      lobby.hostId = lobby.players[0].socketId;
    }

    // If match was starting, revert to waiting (player left before launch)
    if (lobby.status === 'starting') {
      lobby.status = 'waiting';
      lobby.players.forEach((p) => (p.ready = false));
    }

    return { lobby, wasLastPlayer: false, roomId };
  }

  // ─── Queries ──────────────────────────────────────────────────────────────────

  getLobby(roomId) {
    return this._lobbies.get(roomId) ?? null;
  }

  getRoomId(socketId) {
    return this._playerRooms.get(socketId) ?? null;
  }

  deleteLobby(roomId) {
    const lobby = this._lobbies.get(roomId);
    if (lobby) {
      lobby.players.forEach((p) => this._playerRooms.delete(p.socketId));
      this._lobbies.delete(roomId);
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _getLobbyBySocket(socketId) {
    const roomId = this._playerRooms.get(socketId);
    return roomId ? this._lobbies.get(roomId) : null;
  }
}
