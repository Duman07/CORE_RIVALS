/**
 * SwingIndicator — HUD overlay for golf swing feedback.
 *
 * Displays only when the local player is holding a club.
 * Shows:
 *   IDLE     — keybind reminder
 *   CHARGING — animated power bar (green → yellow → red)
 *   COOLDOWN — "RECARGANDO" label
 */

export function SwingIndicator({ state, power, holding }) {
  if (!holding) return null;

  const barColor =
    power > 0.8 ? '#e74c3c' :
    power > 0.5 ? '#f39c12' :
    '#2ecc71';

  return (
    <div style={styles.root}>
      {state === 'CHARGING' && (
        <>
          <div style={styles.label}>POTENCIA</div>
          <div style={styles.track}>
            <div style={{ ...styles.bar, width: `${power * 100}%`, background: barColor }} />
          </div>
          <div style={{ ...styles.label, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            suelta [SPACE] para golpear
          </div>
        </>
      )}

      {state === 'COOLDOWN' && (
        <div style={{ ...styles.label, color: '#e74c3c' }}>RECARGANDO…</div>
      )}

      {state === 'IDLE' && (
        <div style={styles.label}>
          [SPACE] swing &nbsp;·&nbsp; [E] soltar
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    position:      'absolute',
    bottom:        90,
    left:          '50%',
    transform:     'translateX(-50%)',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           6,
    pointerEvents: 'none',
    userSelect:    'none',
  },
  label: {
    fontSize:      11,
    fontFamily:    'monospace',
    letterSpacing: '0.08em',
    color:         'rgba(255,255,255,0.5)',
  },
  track: {
    width:        160,
    height:       10,
    background:   'rgba(0,0,0,0.55)',
    borderRadius: 5,
    overflow:     'hidden',
    border:       '1px solid rgba(255,255,255,0.15)',
  },
  bar: {
    height:       '100%',
    borderRadius: 5,
    transition:   'width 0.04s linear, background 0.15s',
  },
};
