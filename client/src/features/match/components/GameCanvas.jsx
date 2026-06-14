/**
 * GameCanvas — React wrapper for the Three.js game scene.
 *
 * Renders a full-viewport canvas and mounts the GameEngine via useGame.
 * Phase 4: adds ScoreDisplay HUD fed by live scores from useGame.
 * Phase 6: adds CombatHUD (block indicator, push cooldown bar).
 */

import { useRef, useState, useEffect } from 'react';
import { Navigate }                     from 'react-router-dom';
import { useGame }                      from '../hooks/useGame.js';
import { ScoreDisplay }                 from './ScoreDisplay.jsx';
import { SwingIndicator }               from './SwingIndicator.jsx';
import useLobbyStore                    from '../../lobby/store/lobbyStore.js';

export default function GameCanvas() {
  const { lobby }                              = useLobbyStore();
  const canvasRef                              = useRef(null);
  const [locked, setLocked]                   = useState(false);
  const { scores, swingState, combatState }   = useGame(canvasRef);

  if (!lobby) return <Navigate to="/" replace />;

  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement === canvasRef.current);
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, []);

  const { isBlocking, pushCooldownRatio } = combatState;
  const pushReady = pushCooldownRatio === 0;

  return (
    <div style={styles.root}>
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* Score HUD */}
      <ScoreDisplay players={lobby.players} scores={scores} />

      {/* Golf swing HUD */}
      <SwingIndicator
        state={swingState.state}
        power={swingState.power}
        holding={swingState.holding}
      />

      {/* Combat HUD */}
      <div style={styles.combatHud}>
        <div style={{ ...styles.blockBadge, opacity: isBlocking ? 1 : 0.25 }}>
          BLOQUEANDO
        </div>
        <div style={styles.pushCooldownTrack}>
          <div
            style={{
              ...styles.pushCooldownFill,
              width: `${(1 - pushCooldownRatio) * 100}%`,
              background: pushReady ? '#27ae60' : '#c0392b',
            }}
          />
          <span style={styles.pushLabel}>
            {pushReady ? 'F  EMPUJAR' : 'F  RECARGA...'}
          </span>
        </div>
      </div>

      {/* Pointer lock hint */}
      <div style={styles.hud}>
        {locked ? (
          <span style={styles.hint}>ESC para liberar el mouse</span>
        ) : (
          <span style={{ ...styles.hint, color: '#e8a020', fontWeight: 600 }}>
            Click para capturar el mouse
          </span>
        )}
      </div>

      {/* Controls reminder */}
      <div style={styles.controls}>
        <span>WASD mover</span>
        <span>Mouse camara</span>
        <span>Shift correr</span>
        <span>E recoger/soltar</span>
        <span>SPACE swing</span>
        <span>F empujar</span>
        <span>RMB bloquear</span>
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
  combatHud: {
    position: 'absolute', bottom: 70, right: 20,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
    pointerEvents: 'none', userSelect: 'none',
  },
  blockBadge: {
    fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
    color: '#74b9ff', letterSpacing: '0.06em',
    padding: '3px 8px',
    border: '1px solid #74b9ff44',
    borderRadius: 4,
    background: '#74b9ff18',
    transition: 'opacity 0.1s',
  },
  pushCooldownTrack: {
    position: 'relative', width: 120, height: 18,
    background: '#1a1a2e', borderRadius: 3,
    overflow: 'hidden',
    border: '1px solid #333',
  },
  pushCooldownFill: {
    position: 'absolute', top: 0, left: 0, height: '100%',
    transition: 'width 0.05s linear, background 0.2s',
    borderRadius: 2,
  },
  pushLabel: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
    color: '#eee', letterSpacing: '0.05em',
  },
};
