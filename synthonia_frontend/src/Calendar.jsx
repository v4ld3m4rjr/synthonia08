// Calendar.jsx
// Calendário mensal com DADOS REAIS do Supabase (antes usava mockCalendarJuly2026,
// um mês inteiro de julho/2026 inventado — removido a pedido do Val, já que
// isso é exatamente o tipo de "dado fabricado" que o app não pode mostrar).
// Célula por dia colorida pela faixa de prontidão real. Dias sem check-in:
// cinza hachurado. Dia futuro: cinza claro, sem número. Clique abre detalhe.
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING, getSemaphoreColor, getSemaphoreLabel } from './theme';
import { supabase } from './supabaseClient';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toISODate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function HatchedPattern() {
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
        style={{ aspectRatio: '1 / 1', borderRadius: RADIUS.sm, backgroundColor: COLORS.futureGray }}
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
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: RADIUS.sm }}>
          <rect width="100%" height="100%" fill="url(#noCheckinHatch)" rx={RADIUS.sm} />
        </svg>
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{day}</span>
    </button>
  );
}

function DayDetailModal({ dayData, onClose }) {
  if (!dayData) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: COLORS.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: SPACING.md, zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.modal,
          padding: SPACING.lg, width: '100%', maxWidth: 380, fontFamily: FONT.family,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>
            Dia {dayData.day}
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ border: 'none', background: 'none', fontSize: FONT.size.lg, cursor: 'pointer', color: COLORS.textTertiary }}
          >
            ×
          </button>
        </div>

        {!dayData.hasCheckin ? (
          <div style={{ marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: FONT.size.sm }}>
            Sem check-in registrado neste dia.
          </div>
        ) : (
          <div style={{ marginTop: SPACING.md, display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
            <Row label="Prontidão" value={`${dayData.prontidao.toFixed(1)} / 10`} color={getSemaphoreColor(dayData.prontidao)} />
            {dayData.qualidade_sono != null && <Row label="Sono" value={`${dayData.qualidade_sono} / 7`} />}
            {dayData.fadiga_geral != null && <Row label="Fadiga" value={`${dayData.fadiga_geral} / 7`} />}
            {dayData.duracao_sono_horas != null && <Row label="Duração do sono" value={`${dayData.duracao_sono_horas}h`} />}
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

export default function Calendar({ userId }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [checkinsByDate, setCheckinsByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const todayDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay(); // 0=domingo

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const start = toISODate(year, month, 1);
      const end = toISODate(year, month, daysInMonth);
      const { data, error: fetchError } = await supabase
        .from('checkins')
        .select('data_referencia, prontidao_percebida, qualidade_sono, fadiga_geral, duracao_sono_horas')
        .eq('atleta_id', userId)
        .gte('data_referencia', start)
        .lte('data_referencia', end);
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        const byDate = {};
        (data || []).forEach((row) => { byDate[row.data_referencia] = row; });
        setCheckinsByDate(byDate);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, month]);

  const days = useMemo(() => {
    const arr = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const isFuture = day > todayDay;
      const iso = toISODate(year, month, day);
      const row = checkinsByDate[iso];
      arr.push({
        day,
        isFuture,
        hasCheckin: !isFuture && !!row,
        prontidao: row ? Number(row.prontidao_percebida) : null,
        qualidade_sono: row ? row.qualidade_sono : null,
        fadiga_geral: row ? row.fadiga_geral : null,
        duracao_sono_horas: row ? row.duracao_sono_horas : null,
      });
    }
    return arr;
  }, [checkinsByDate, daysInMonth, todayDay, year, month]);

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', padding: SPACING.md, fontFamily: FONT.family }}>
      <HatchedPattern />
      <div style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: SPACING.md }}>
        {MONTH_NAMES[month]} {year}
      </div>

      {loading && <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginBottom: SPACING.md }}>Carregando…</div>}
      {error && <div style={{ fontSize: FONT.size.sm, color: COLORS.risk, marginBottom: SPACING.md }}>Erro ao carregar: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: SPACING.sm }}>
        {WEEKDAY_LABELS.map((wd, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: FONT.size.xs, color: COLORS.textTertiary, fontWeight: FONT.weight.semibold }}>
            {wd}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`offset-${i}`} />
        ))}
        {days.map((dayData) => (
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
          width: 14, height: 14, borderRadius: 4, backgroundColor: color,
          border: hatched ? `1px solid ${COLORS.noCheckinGrayHatchLine}` : 'none',
          display: 'inline-block',
        }}
      />
      {label}
    </div>
  );
}
