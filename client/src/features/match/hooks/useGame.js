/**
 * useGame — React hook that owns the GameEngine lifecycle.
 *
 * Returns live `scores` (updated by engine via onScores callback)
 * so GameCanvas can render the ScoreDisplay HUD.
 */

import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { GameEngine }          from '../../../game/engine/GameEngine.js';
import socketClient            from '../../../infrastructure/socket/SocketClient.js';
import useLobbyStore           from '../../lobby/store/lobbyStore.js';

/**
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef
 * @returns {{ scores: Record<string,number> }}
 */
export function useGame(canvasRef) {
  const { socketId, lobby } = useLobbyStore();
  const navigate            = useNavigate();

  const [scores, setScores] = useState({});

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
      mySocketId: socketId,
      players:    lobby.players,
      onScores:   setScores,
    });

    engine.start();

    return () => engine.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { scores };
}
