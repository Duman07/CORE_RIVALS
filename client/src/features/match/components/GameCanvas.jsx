/**
 * GameCanvas — React wrapper for the Three.js game scene.
 *
 * Renders a full-viewport canvas and mounts the GameEngine via useGame.
 * Phase 4: adds ScoreDisplay HUD fed by live scores from useGame.
 */

import { useRef, useState, useEffect } from 'react';
import { Navigate }                     from 'react-router-dom';
import { useGame }                      from '../hooks/useGame.js';
import { ScoreDisplay }                 from './ScoreDisplay.jsx';
import useLobbyStore                    from '../../lobby/store/lobbyStore.js';

export default function GameCanvas() {
  const { lobby }                 = useLobbyStore();
  const canvasRef                 = useRef(null);
  const [locked, setLocked]       = useState(false);
  const { scores }                = useGame(canvasRef);

  if (!lobby) return <Navigate to="/" replace />;

  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement === canvasRef.current);
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, []);

  return (
    <div style={styles.root}>
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* ── Score HUD ── */}
      <ScoreDisplay players={lobby.players} scores={scores} />

      {/* ── Pointer lock hint ── */}
      <div style={styles.hud}>
        {locked ? (
          <span style={styles.hint}>ESC para liberar el mouse</span>
        ) : (
          <span style={{ ...styles.hint, color: '#e8a020', fontWeight: 600 }}>
            Click para capturar el mouse
          </span>
        )}
      </div>

      {/* ── Controls reminder ── */}
      <div style={styles.controls}>
        <span>WASD · mover</span>
        <span>Mouse · cámara</span>
        <span>Shift · correr</span>
      </div>
    </div>
  );
}

const styles = {
  root:    { position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#090c10' },
  canvas:  { display: 'block', width: '100%', height: '100%' },
  hud:     { position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', userSelect: 'none' },
  hint:    { fontSize: 13, fontFamily: 'monospace', color: '#555', letterSpacing: '0.05em' },
  controls: {
    position: 'absolute', top: 16, left: 16,
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: 11, fontFamily: 'monospace', color: '#444',
    pointerEvents: 'none', userSelect: 'none',
  },
};
