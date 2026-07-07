// components/SemaphoreRing.jsx
// Anel grande 0-10 usado na Home para Prontidão. Reaproveitável para qualquer
// métrica 0-10 que precise do mesmo tratamento visual semafórico.
import React from 'react';
import { COLORS, FONT, getSemaphoreColor, getSemaphoreLabel } from '../theme';

export default function SemaphoreRing({
  value,
  max = 10,
  size = 180,
  strokeWidth = 16,
  label,
  showScaleLabel = true,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.max(0, Math.min(value ?? 0, max));
  const progress = (safeValue / max) * circumference;
  const color = getSemaphoreColor(safeValue);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={COLORS.border}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: FONT.size.display,
              fontWeight: FONT.weight.bold,
              color: COLORS.textPrimary,
              fontFamily: FONT.family,
              lineHeight: 1,
            }}
          >
            {value != null ? safeValue.toFixed(1) : '--'}
          </span>
          {label ? (
            <span
              style={{
                fontSize: FONT.size.sm,
                color: COLORS.textSecondary,
                fontFamily: FONT.family,
                marginTop: 4,
              }}
            >
              {label}
            </span>
          ) : null}
        </div>
      </div>
      {showScaleLabel && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: FONT.family,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: color,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, fontWeight: FONT.weight.medium }}>
            {getSemaphoreLabel(safeValue)}
          </span>
        </div>
      )}
    </div>
  );
}
