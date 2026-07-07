// Calendar.jsx
// Calendário mensal — célula por dia colorida pela faixa de prontidão.
// Dias sem check-in: cinza hachurado (#E0E0E0), NUNCA cor semafórica.
// Dia futuro: cinza claro, sem número. Clique abre detalhe do dia.
import React, { useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING, getSemaphoreColor, getSemaphoreLabel } from './theme';
import { mockCalendarJuly2026, mockDayDetail } from './mockData';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
// Mock simplificado: assumimos que dia 1 de julho/2026 cai numa quarta-feira (índice 3).
const FIRST_DAY_OFFSET = 3;

function HatchedPattern() {
  // Padrão de hachura SVG reutilizável para dias sem check-in.
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <pattern id="noCheckinHatch" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
          <rect width={6} height={6} fill={COLORS.noCheckinGray} />
          <line x1={0} y1={0} x2={0} y2={6} stroke={COLORS.noCheckinGrayHatchLine} strokeWidth={2} />
        </pattern>
      </defs>
    </svg>
  );
}

function DayCell({ dayData, onSelect }) {
  const { day, isFuture, prontidao, hasCheckin } = dayData;

  if (isFuture) {
    return (
      <div
        style={{
          aspectRatio: '1 / 1',
          borderRadius: RADIUS.sm,
          backgroundColor: COLORS.futureGray,
        }}
        aria-label="Dia futuro"
      />
    );
  }

  const bgColor = hasCheckin ? getSemaphoreColor(prontidao) : null;

  return (
    <button
      onClick={() => onSelect(dayData)}
      style={{
        aspectRatio: '1 / 1',
        borderRadius: RADIUS.sm,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: hasCheckin ? bgColor : 'transparent',
        backgroundImage: hasCheckin ? 'none' : 'url(#noCheckinHatch)',
        color: hasCheckin ? '#fff' : COLORS.textSecondary,
        fontFamily: FONT.family,
        fontWeight: FONT.weight.semibold,
        fontSize: FONT.size.sm,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={
        hasCheckin
          ? `Dia ${day} — Prontidão ${prontidao.toFixed(1)} (${getSemaphoreLabel(prontidao)})`
          : `Dia ${day} — sem check-in`
      }
    >
      {!hasCheckin && (
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: RADIUS.sm }}
        >
          <rect width="100%" height="100%" fill="url(#noCheckinHatch)" rx={RADIUS.sm} />
        </svg>
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{day}</span>
    </button>
  );
}

function DayDetailModal({ dayData, onClose }) {
  if (!dayData) return null;
  const detail = mockDayDetail(dayData);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: RADIUS.lg,
          boxShadow: SHADOW.modal,
          padding: SPACING.lg,
          width: '100%',
          maxWidth: 380,
          fontFamily: FONT.family,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>
            Dia {detail.day.day} de julho
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ border: 'none', background: 'none', fontSize: FONT.size.lg, cursor: 'pointer', color: COLORS.textTertiary }}
          >
            ×
          </button>
        </div>

        {detail.prontidao == null ? (
          <div style={{ marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: FONT.size.sm }}>
            Sem check-in registrado neste dia.
          </div>
        ) : (
          <div style={{ marginTop: SPACING.md, display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
            <Row label="Prontidão" value={`${detail.prontidao.toFixed(1)} / 10`} color={getSemaphoreColor(detail.prontidao)} />
            <Row label="Sono" value={`${detail.sono.toFixed(1)} / 10`} />
            <Row label="Exaustão" value={`${detail.exaustaoPct}%`} />
            <Row label="Treino do dia" value={detail.treino} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FONT.size.sm }}>
      <span style={{ color: COLORS.textSecondary }}>{label}</span>
      <span style={{ color: color || COLORS.textPrimary, fontWeight: FONT.weight.semibold }}>{value}</span>
    </div>
  );
}

export default function Calendar() {
  const [selectedDay, setSelectedDay] = useState(null);

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', padding: SPACING.md, fontFamily: FONT.family }}>
      <HatchedPattern />
      <div style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: SPACING.md }}>
        Julho 2026
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          marginBottom: SPACING.sm,
        }}
      >
        {WEEKDAY_LABELS.map((wd, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: FONT.size.xs,
              color: COLORS.textTertiary,
              fontWeight: FONT.weight.semibold,
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
        }}
      >
        {Array.from({ length: FIRST_DAY_OFFSET }).map((_, i) => (
          <div key={`offset-${i}`} />
        ))}
        {mockCalendarJuly2026.map((dayData) => (
          <DayCell key={dayData.day} dayData={dayData} onSelect={setSelectedDay} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: SPACING.md, marginTop: SPACING.lg, flexWrap: 'wrap' }}>
        <Legend color={COLORS.safe} label="Seguro (6.5–10.0)" />
        <Legend color={COLORS.moderate} label="Moderado (3.5–6.4)" />
        <Legend color={COLORS.risk} label="Cautela (0.0–3.4)" />
        <Legend color={COLORS.noCheckinGray} label="Sem check-in" hatched />
        <Legend color={COLORS.futureGray} label="Dia futuro" />
      </div>

      <DayDetailModal dayData={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  );
}

function Legend({ color, label, hatched }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT.size.xs, color: COLORS.textSecondary }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          backgroundColor: color,
          border: hatched ? `1px solid ${COLORS.noCheckinGrayHatchLine}` : 'none',
          display: 'inline-block',
        }}
      />
      {label}
    </div>
  );
}
