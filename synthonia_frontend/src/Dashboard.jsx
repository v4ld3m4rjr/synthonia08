// Dashboard.jsx
// Grid de 12 cards clicáveis. Cada card abre uma view de detalhe (modal) com
// gráfico de série temporal (placeholder aqui) + seletor de janela 7/14/21/28
// dias (default 7), funcional em estado React. "Janela de lesão" ganha um dot
// semafórico extra ao lado do valor.
//
// A seção TimeSeriesExplorer no topo é REAL (dados de public.checkins do
// usuário logado) — os 12 cards abaixo continuam com dados mockados até o
// motor de cálculo (metricas_diarias) ser implementado.
import React, { useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING, getSemaphoreColor } from './theme';
import {
  mockDashboardCards,
  mockTimeSeries28d,
  WINDOW_OPTIONS,
} from './mockData';
import TimeSeriesExplorer from './components/TimeSeriesExplorer';

function DashboardCard({ card, onClick }) {
  const [hovered, setHovered] = useState(false);
  const color = card.isSemaphore ? getSemaphoreColor(card.value) : COLORS.textPrimary;

  return (
    <button
      onClick={() => onClick(card)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        boxShadow: hovered ? SHADOW.cardHover : SHADOW.card,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        fontFamily: FONT.family,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 96,
      }}
    >
      <span
        style={{
          fontSize: FONT.size.xs,
          color: COLORS.textSecondary,
          fontWeight: FONT.weight.medium,
        }}
      >
        {card.title}
      </span>
      <span
        style={{
          fontSize: FONT.size.xl,
          fontWeight: FONT.weight.bold,
          color,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {card.value}
        <span style={{ fontSize: FONT.size.sm, fontWeight: FONT.weight.regular, color: COLORS.textTertiary }}>
          {card.unit}
        </span>
        {card.hasExtraDot && (
          <span
            title="Nível de risco atual"
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: getSemaphoreColor(card.value),
              display: 'inline-block',
            }}
          />
        )}
      </span>
    </button>
  );
}

function TimeSeriesPlaceholderChart({ data }) {
  const width = 560;
  const height = 160;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / Math.max(data.length - 1, 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={COLORS.safe}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardDetailModal({ card, onClose }) {
  const [windowDays, setWindowDays] = useState(7);

  const seriesForWindow = useMemo(() => {
    return mockTimeSeries28d.slice(mockTimeSeries28d.length - windowDays);
  }, [windowDays]);

  if (!card) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: COLORS.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.md,
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: RADIUS.lg,
          boxShadow: SHADOW.modal,
          padding: SPACING.lg,
          width: '100%',
          maxWidth: 620,
          fontFamily: FONT.family,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>
              {card.title}
            </div>
            <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginTop: 4, maxWidth: 420 }}>
              {card.description}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: FONT.size.lg,
              cursor: 'pointer',
              color: COLORS.textTertiary,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: `${SPACING.md}px 0`,
          }}
        >
          {WINDOW_OPTIONS.map((opt) => {
            const active = opt === windowDays;
            return (
              <button
                key={opt}
                onClick={() => setWindowDays(opt)}
                style={{
                  border: `1px solid ${active ? COLORS.textPrimary : COLORS.border}`,
                  backgroundColor: active ? COLORS.textPrimary : COLORS.surface,
                  color: active ? '#fff' : COLORS.textSecondary,
                  borderRadius: RADIUS.pill,
                  padding: '6px 14px',
                  fontSize: FONT.size.sm,
                  fontWeight: FONT.weight.medium,
                  cursor: 'pointer',
                }}
              >
                {opt}d
              </button>
            );
          })}
        </div>

        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            padding: SPACING.md,
            backgroundColor: COLORS.background,
          }}
        >
          <TimeSeriesPlaceholderChart data={seriesForWindow} />
          <div
            style={{
              fontSize: FONT.size.xs,
              color: COLORS.textTertiary,
              marginTop: SPACING.sm,
              textAlign: 'center',
            }}
          >
            Últimos {windowDays} dias (dados mockados — gráfico placeholder, substituir por
            biblioteca de charts real na integração com backend)
          </div>
        </div>

        {card.hasExtraDot && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: SPACING.md,
              fontSize: FONT.size.sm,
              color: COLORS.textSecondary,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: getSemaphoreColor(card.value),
                display: 'inline-block',
              }}
            />
            Nível de risco atual: usa os mesmos cortes 0.0–3.4 / 3.5–6.4 / 6.5–10.0.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ embedded = false, userId }) {
  const [selectedCard, setSelectedCard] = useState(null);

  const content = (
    <div>
      {userId && (
        <div style={{ marginBottom: SPACING.md }}>
          <TimeSeriesExplorer userId={userId} />
        </div>
      )}
      {!embedded && (
        <div
          style={{
            fontSize: FONT.size.lg,
            fontWeight: FONT.weight.bold,
            color: COLORS.textPrimary,
            marginBottom: SPACING.md,
            fontFamily: FONT.family,
          }}
        >
          Dashboard
        </div>
      )}
      {embedded && (
        <div
          style={{
            fontSize: FONT.size.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            color: COLORS.textTertiary,
            fontWeight: FONT.weight.semibold,
            marginBottom: SPACING.sm,
            fontFamily: FONT.family,
          }}
        >
          Dashboard
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: SPACING.sm,
        }}
      >
        {mockDashboardCards.map((card) => (
          <DashboardCard key={card.id} card={card} onClick={setSelectedCard} />
        ))}
      </div>
      <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  );

  if (embedded) return content;

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', padding: SPACING.md }}>
      {content}
    </div>
  );
}
