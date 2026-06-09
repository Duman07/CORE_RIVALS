import { useParams, Link } from 'react-router-dom';
import useLobbyStore from '../../lobby/store/lobbyStore.js';
import { CHARACTER_STATS } from '@core-rivals/shared/constants/GameConstants';

/**
 * MatchPlaceholder — Phase 2 stub.
 * Shows match ID and player list. Game scene implemented in Phase 3+.
 */
export default function MatchPlaceholder() {
  const { matchId }  = useParams();
  const { socketId, lobby } = useLobbyStore();

  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 32,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(46,204,113,0.08) 0%, transparent 65%), var(--bg-deep)',
  };

  const titleStyle = {
    fontFamily: 'var(--font-title)',
    fontSize: 48,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'var(--success)',
    textTransform: 'uppercase',
    textShadow: '0 0 30px rgba(46,204,113,0.35)',
  };

  const cardStyle = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px 36px',
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
  };

  const matchIdStyle = {
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'var(--text-muted)',
    wordBreak: 'break-all',
    marginTop: 8,
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Partida iniciada</h1>

      <div style={cardStyle}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
          Match ID
        </p>
        <p style={matchIdStyle}>{matchId}</p>
      </div>

      <div style={{ ...cardStyle, marginTop: 0 }}>
        <p style={{
          fontFamily: 'var(--font-title)',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--text-primary)',
          marginBottom: 20,
          textTransform: 'uppercase',
        }}>
          Jugadores
        </p>

        {lobby?.players?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lobby.players.map((p) => {
              const charInfo = p.character ? CHARACTER_STATS[p.character] : null;
              const isMe     = p.socketId === socketId;
              return (
                <div key={p.socketId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius)',
                  border: isMe ? '1px solid var(--accent-dim)' : '1px solid var(--border)',
                }}>
                  <span style={{ fontWeight: 600 }}>
                    {p.name}{isMe ? ' (tú)' : ''}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {charInfo ? `${charInfo.displayName} — ${charInfo.role}` : 'Sin personaje'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            (La escena 3D se implementará en la Fase 3)
          </p>
        )}
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
        Fase 3 — Movimiento, cámara y sincronización próximamente.
      </p>

      <Link to="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
        Volver al inicio
      </Link>
    </div>
  );
}
