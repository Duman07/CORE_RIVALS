/**
 * useGame — React hook that owns the GameEngine lifecycle.
 *
 * Returns:
 *   scores      — updated by engine via onScores callback
 *   swingState  — { state, power, holding } for SwingIndicator HUD
 *   combatState — { isBlocking, pushCooldownRatio } for CombatHUD (Phase 6)
 */

import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { GameEngine }          from '../../../game/engine/GameEngine.js';
import socketClient            from '../../../infrastructure/socket/SocketClient.js';
import useLobbyStore           from '../../lobby/store/lobbyStore.js';

/**
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef
 * @returns {{ scores: Record<string,number>, swingState: object, combatState: object }}
 */
export function useGame(canvasRef) {
  const { socketId, lobby } = useLobbyStore();
  const navigate            = useNavigate();

  const [scores,      setScores]      = useState({});
  const [swingState,  setSwingState]  = useState({ state: 'IDLE', power: 0, holding: false });
  const [combatState, setCombatState] = useState({ isBlocking: false, pushCooldownRatio: 0 });

  useEffect(() => {
    if (!lobby || !socketId) {
      navigate('/', { replace: true });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const socket = socketClient.socket;
    if (!socket) {
      console.error('[useGame] Socket not available');
      navigate('/', { replace: true });
      return;
    }

    const engine = new GameEngine(canvas, {
      socket,
      mySocketId:     socketId,
      players:        lobby.players,
      onScores:       setScores,
      onSwingState:   setSwingState,
      onCombatState:  setCombatState,
    });

    engine.start();

    return () => engine.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { scores, swingState, combatState };
}
