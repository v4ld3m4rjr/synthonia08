// components/ProgressBar.jsx
// Barra horizontal genérica — usada para "% Redução sugerida do treino" (0-70%)
// e para a barra de progresso do fluxo de Check-in (1 pergunta por tela).
import React from 'react';
import { COLORS, FONT, RADIUS } from '../theme';

export default function ProgressBar({
  value,
  max = 100,
  color,
  height = 12,
  showLabel = false,
  labelSuffix = '%',
  trackColor = COLORS.border,
}) {
  const pct = Math.max(0, Math.min((value / max) * 100, 100));
  return (
    <div style={{ width: '100%', fontFamily: FONT.family }}>
      <div
        style={{
          width: '100%',
          height,
          backgroundColor: trackColor,
          borderRadius: RADIUS.pill,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: color || COLORS.moderate,
            borderRadius: RADIUS.pill,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      {showLabel && (
        <div
          style={{
            marginTop: 6,
            fontSize: FONT.size.sm,
            color: COLORS.textSecondary,
            fontWeight: FONT.weight.medium,
          }}
        >
          {value}
          {labelSuffix}
        </div>
      )}
    </div>
  );
}
