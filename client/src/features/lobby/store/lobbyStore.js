import { create } from 'zustand';

/**
 * lobbyStore — client-side state for the lobby and session.
 *
 * Shape:
 *  connected   — WebSocket is active
 *  socketId    — our own socket.id (= playerId in lobby)
 *  playerName  — entered by user on Home screen, kept across route changes
 *  roomId      — current lobby room code
 *  lobby       — full lobby object from server { roomId, hostId, status, players[] }
 *  matchId     — set when match:start received
 *  error       — last lobby error message
 */
const useLobbyStore = create((set) => ({
  connected:  false,
  socketId:   null,
  playerName: '',
  roomId:     null,
  lobby:      null,
  matchId:    null,
  error:      null,

  setConnected:  (connected)  => set({ connected }),
  setSocketId:   (socketId)   => set({ socketId }),
  setPlayerName: (playerName) => set({ playerName }),
  setRoomId:     (roomId)     => set({ roomId }),
  setLobby:      (lobby)      => set({ lobby }),
  setMatchId:    (matchId)    => set({ matchId }),
  setError:      (error)      => set({ error }),
  clearError:    ()           => set({ error: null }),

  reset: () => set({
    roomId:  null,
    lobby:   null,
    matchId: null,
    error:   null,
  }),
}));

export default useLobbyStore;
