// components/TimeSeriesExplorer.jsx
// Gráfico pedido explicitamente por Val: eixo X = tempo, eixo Y = variáveis
// escolhidas pelo usuário (múltiplas, sobrepostas). Dados REAIS vindos de
// public.checkins do usuário autenticado (RLS garante que só vê os próprios).
// Como o motor de cálculo (ATL/CTL/TSB/Prontidão) ainda não está implementado
// como job real, as variáveis disponíveis aqui são os campos BRUTOS do
// check-in (o que existe de verdade hoje) — quando o motor de cálculo for
// implementado, basta adicionar as métricas calculadas a VARIABLES abaixo,
// buscando de metricas_diarias em vez de checkins.
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from '../theme';
import { supabase } from '../supabaseClient';

// Paleta categórica para as linhas (não semafórica — aqui cor = identidade da
// variável, não status de risco).
const LINE_COLORS = ['#378ADD', '#D85A30', '#639922', '#993C1D', '#7F77DD', '#D4537E', '#0F6E56', '#BA7517', '#993556'];

export const VARIABLES = [
  { key: 'prontidao_percebida', label: 'Prontidão percebida (PRS)', min: 0, max: 10 },
  { key: 'qualidade_sono', label: 'Qualidade do sono', min: 1, max: 7 },
  { key: 'duracao_sono_horas', label: 'Duração do sono (h)', min: 0, max: 12 },
  { key: 'fadiga_geral', label: 'Fadiga geral (1=pior)', min: 1, max: 7 },
  { key: 'estresse_percebido', label: 'Estresse percebido (1=pior)', min: 1, max: 7 },
  { key: 'humor_disposicao', label: 'Humor/disposição (1=pior)', min: 1, max: 7 },
  { key: 'dor_muscular', label: 'Dor muscular (1=pior)', min: 1, max: 7 },
  { key: 'hrv_ms', label: 'HRV (ms)', min: 20, max: 150 },
  { key: 'fc_repouso_bpm', label: 'FC de repouso (bpm)', min: 35, max: 100 },
];

function normalize(value, min, max) {
  if (value == null || Number.isNaN(value)) return null;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min || 1);
}

export default function TimeSeriesExplorer({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(['prontidao_percebida', 'qualidade_sono']);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('checkins')
        .select('data_referencia, prontidao_percebida, qualidade_sono, duracao_sono_horas, fadiga_geral, estresse_percebido, humor_disposicao, dor_muscular, hrv_ms, fc_repouso_bpm')
        .eq('atleta_id', userId)
        .order('data_referencia', { ascending: true });
      if (cancelled) return;
      if (fetchError) setError(fetchError.message);
      else setRows(data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const toggleVar = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const width = 640;
  const height = 220;
  const padding = 28;

  const chart = useMemo(() => {
    if (rows.length === 0) return null;
    const n = rows.length;
    const stepX = n > 1 ? (width - padding * 2) / (n - 1) : 0;

    const lines = selected.map((key, idx) => {
      const meta = VARIABLES.find((v) => v.key === key);
      const points = rows.map((r, i) => {
        const norm = normalize(r[key], meta.min, meta.max);
        const x = padding + i * stepX;
        if (norm == null) return null;
        const y = height - padding - norm * (height - padding * 2);
        return `${x},${y}`;
      });
      return {
        key,
        label: meta.label,
        color: LINE_COLORS[idx % LINE_COLORS.length],
        pointsStr: points.filter(Boolean).join(' '),
        lastRaw: rows[rows.length - 1][key],
      };
    });

    return { lines, n };
  }, [rows, selected]);

  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, fontFamily: FONT.family }}>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: 2 }}>
        Explorador — tempo × variáveis
      </div>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.md }}>
        Eixo X = data do check-in. Eixo Y = variáveis selecionadas abaixo (normalizadas 0–1 para caberem juntas no mesmo gráfico; o valor real de cada uma aparece na legenda).
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md }}>
        {VARIABLES.map((v) => {
          const isOn = selected.includes(v.key);
          const idx = selected.indexOf(v.key);
          const color = isOn ? LINE_COLORS[idx % LINE_COLORS.length] : COLORS.border;
          return (
            <button
              key={v.key}
              onClick={() => toggleVar(v.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: RADIUS.pill,
                border: `1.5px solid ${isOn ? color : COLORS.border}`,
                backgroundColor: isOn ? '#fff' : COLORS.background,
                color: isOn ? COLORS.textPrimary : COLORS.textTertiary,
                fontSize: FONT.size.xs,
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
              {v.label}
            </button>
          );
        })}
      </div>

      {loading && <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Carregando…</div>}
      {error && <div style={{ fontSize: FONT.size.sm, color: COLORS.risk }}>Erro ao carregar: {error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>
          Ainda não há check-ins registrados — faça alguns check-ins em dias diferentes para o gráfico aparecer.
        </div>
      )}

      {!loading && !error && rows.length > 0 && chart && (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.sm, backgroundColor: COLORS.background }}>
          <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={COLORS.border} strokeWidth={1} />
            {chart.lines.map((l) => (
              <polyline key={l.key} points={l.pointsStr} fill="none" stroke={l.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </svg>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm }}>
            {chart.lines.map((l) => (
              <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT.size.xs, color: COLORS.textSecondary }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: l.color, display: 'inline-block' }} />
                {l.label}: <strong style={{ color: COLORS.textPrimary }}>{l.lastRaw ?? '—'}</strong>
              </div>
            ))}
          </div>
          <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginTop: SPACING.xs, textAlign: 'center' }}>
            {rows.length} check-in(s) — de {rows[0].data_referencia} a {rows[rows.length - 1].data_referencia}
          </div>
        </div>
      )}
    </div>
  );
}
