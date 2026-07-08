// components/WeeklyLoadChart.jsx
// Carga semanal em barras: agrega trimp_carga_diaria somando os valores
// não-nulos em blocos de 7 dias corridos a partir do primeiro dia com dado
// (critério mais simples de implementar corretamente do que semana ISO real
// — não depende do dia da semana em que o histórico começa, e cada bloco
// sempre tem exatamente 7 dias corridos exceto possivelmente o último).
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from '../theme';
import { supabase } from '../supabaseClient';
import { formatDateShort } from './chartUtils';

const BAR_WIDTH = 34;
const BAR_GAP = 18;
const CHART_HEIGHT = 180;
const PADDING_TOP = 26;
const PADDING_BOTTOM = 34;
const PADDING_X = 20;

export default function WeeklyLoadChart({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('metricas_diarias')
        .select('data_referencia, trimp_carga_diaria')
        .eq('atleta_id', userId)
        .order('data_referencia', { ascending: true });
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      setRows(data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const weeks = useMemo(() => {
    if (rows.length === 0) return [];
    const result = [];
    for (let i = 0; i < rows.length; i += 7) {
      const chunk = rows.slice(i, i + 7);
      const total = chunk.reduce((sum, r) => sum + (r.trimp_carga_diaria != null ? Number(r.trimp_carga_diaria) : 0), 0);
      const startDate = chunk[0].data_referencia;
      const endDate = chunk[chunk.length - 1].data_referencia;
      result.push({
        total,
        label: `${formatDateShort(startDate)}–${formatDateShort(endDate)}`,
      });
    }
    return result;
  }, [rows]);

  const chartWidth = Math.max(weeks.length * (BAR_WIDTH + BAR_GAP) + PADDING_X * 2, 300);
  const maxTotal = weeks.length > 0 ? Math.max(...weeks.map((w) => w.total), 1) : 1;
  const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, fontFamily: FONT.family, marginTop: SPACING.md }}>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: 2 }}>
        Carga semanal (TRIMP)
      </div>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.md }}>
        Soma do TRIMP diário em blocos de 7 dias corridos, do primeiro dia com dado até hoje.
      </div>

      {loading && <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Carregando…</div>}
      {error && <div style={{ fontSize: FONT.size.sm, color: COLORS.risk }}>Erro ao carregar: {error}</div>}
      {!loading && !error && weeks.length === 0 && (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Ainda não há carga de treino suficiente para este gráfico.</div>
      )}

      {!loading && !error && weeks.length > 0 && (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.sm, backgroundColor: COLORS.background, overflowX: 'auto' }}>
          <svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
            <line x1={0} y1={CHART_HEIGHT - PADDING_BOTTOM} x2={chartWidth} y2={CHART_HEIGHT - PADDING_BOTTOM} stroke={COLORS.border} strokeWidth={1} />
            {weeks.map((w, i) => {
              const barHeight = maxTotal > 0 ? (w.total / maxTotal) * usableHeight : 0;
              const x = PADDING_X + i * (BAR_WIDTH + BAR_GAP);
              const y = CHART_HEIGHT - PADDING_BOTTOM - barHeight;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={BAR_WIDTH} height={Math.max(barHeight, 1)} fill={COLORS.brandPrimary} rx={4} />
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={FONT.size.xs}
                    fontFamily={FONT.family}
                    fontWeight={FONT.weight.semibold}
                    fill={COLORS.textPrimary}
                  >
                    {Math.round(w.total)}
                  </text>
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={CHART_HEIGHT - PADDING_BOTTOM + 16}
                    textAnchor="middle"
                    fontSize={FONT.size.xs - 1}
                    fontFamily={FONT.family}
                    fill={COLORS.textTertiary}
                  >
                    {w.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
