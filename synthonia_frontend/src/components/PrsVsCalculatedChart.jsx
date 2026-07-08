// components/PrsVsCalculatedChart.jsx
// PRS percebido (checkins.prontidao_percebida) vs Prontidão calculada
// (metricas_diarias.prontidao), mescladas por data_referencia com o mesmo
// padrão de merge do TimeSeriesExplorer.jsx (Map por data, uma consulta em
// cada tabela). Duas curvas suaves sobrepostas na mesma escala 0-10, cores
// distintas + legenda. Nos dias em que divergencia_prs_alta = true, o ponto
// da prontidão calculada ganha destaque visual (círculo maior + cor de
// alerta) para chamar atenção de quando as duas medidas descolam.
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from '../theme';
import { supabase } from '../supabaseClient';
import { formatDateShort, catmullRomPath, buildSegments, normalize } from './chartUtils';

const SVG_WIDTH = 640;
const PADDING_X = 14;
const CHART_HEIGHT = 160;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 12;
const AXIS_HEIGHT = 26;

const PRS_COLOR = '#7F77DD';
const CALC_COLOR = '#0F6E56';

export default function PrsVsCalculatedChart({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [checkinsRes, metricasRes] = await Promise.all([
        supabase
          .from('checkins')
          .select('data_referencia, prontidao_percebida')
          .eq('atleta_id', userId)
          .order('data_referencia', { ascending: true }),
        supabase
          .from('metricas_diarias')
          .select('data_referencia, prontidao, divergencia_prs_alta, divergencia_prs_valor')
          .eq('atleta_id', userId)
          .order('data_referencia', { ascending: true }),
      ]);
      if (cancelled) return;
      if (checkinsRes.error) {
        setError(checkinsRes.error.message);
        setLoading(false);
        return;
      }
      if (metricasRes.error) {
        console.warn('Falha ao carregar metricas_diarias:', metricasRes.error.message);
      }
      const byDate = new Map();
      for (const r of checkinsRes.data || []) {
        byDate.set(r.data_referencia, { ...(byDate.get(r.data_referencia) || {}), ...r });
      }
      for (const r of metricasRes.data || []) {
        byDate.set(r.data_referencia, { ...(byDate.get(r.data_referencia) || {}), ...r });
      }
      const merged = Array.from(byDate.values()).sort((a, b) =>
        a.data_referencia < b.data_referencia ? -1 : a.data_referencia > b.data_referencia ? 1 : 0
      );
      setRows(merged);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const chart = useMemo(() => {
    if (rows.length === 0) return null;
    const n = rows.length;
    const innerWidth = SVG_WIDTH - PADDING_X * 2;
    const stepX = n > 1 ? innerWidth / (n - 1) : 0;
    const singleX = SVG_WIDTH / 2;
    const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

    function buildLine(key) {
      const points = [];
      rows.forEach((r, i) => {
        const raw = r[key];
        const norm = normalize(raw, 0, 10);
        if (norm == null) return;
        const x = n > 1 ? PADDING_X + i * stepX : singleX;
        const y = PADDING_TOP + usableHeight - norm * usableHeight;
        points.push({ x, y, value: raw, rowIndex: i, divergente: !!r.divergencia_prs_alta });
      });
      const segments = buildSegments(points).map((seg) => catmullRomPath(seg, 0.5));
      return { points, segments };
    }

    const prsLine = buildLine('prontidao_percebida');
    const calcLine = buildLine('prontidao');

    const approxLabelWidth = 34;
    const maxDateLabels = Math.max(2, Math.floor(innerWidth / approxLabelWidth));
    const dateStep = n <= maxDateLabels ? 1 : Math.ceil(n / maxDateLabels);
    const dateTicks = rows
      .map((r, i) => ({ i, date: r.data_referencia }))
      .filter(({ i }) => i === 0 || i === n - 1 || i % dateStep === 0)
      .map(({ i, date }) => ({
        x: n > 1 ? PADDING_X + i * stepX : singleX,
        label: formatDateShort(date),
      }));

    return { prsLine, calcLine, dateTicks };
  }, [rows]);

  const svgHeight = CHART_HEIGHT + AXIS_HEIGHT;
  const hasDivergence = rows.some((r) => r.divergencia_prs_alta);

  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, fontFamily: FONT.family, marginTop: SPACING.md }}>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: 2 }}>
        PRS percebido × Prontidão calculada
      </div>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.sm }}>
        Compara o que você reportou sentir (PRS) com o que o motor calculou a partir de todos os fatores. Pontos em vermelho marcam dias em que as duas medidas divergiram bastante.
      </div>

      <div style={{ display: 'flex', gap: SPACING.md, marginBottom: SPACING.sm, fontSize: FONT.size.xs }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: PRS_COLOR, display: 'inline-block' }} />
          PRS percebido
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: CALC_COLOR, display: 'inline-block' }} />
          Prontidão calculada
        </span>
        {hasDivergence && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS.risk, display: 'inline-block' }} />
            Divergência alta
          </span>
        )}
      </div>

      {loading && <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Carregando…</div>}
      {error && <div style={{ fontSize: FONT.size.sm, color: COLORS.risk }}>Erro ao carregar: {error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Ainda não há dados suficientes para este gráfico.</div>
      )}

      {!loading && !error && chart && (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.sm, backgroundColor: COLORS.background }}>
          <svg width="100%" viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`} preserveAspectRatio="xMinYMin meet">
            {chart.prsLine.segments.map((d, i) => (
              <path key={`prs-${i}`} d={d} fill="none" stroke={PRS_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {chart.calcLine.segments.map((d, i) => (
              <path key={`calc-${i}`} d={d} fill="none" stroke={CALC_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {chart.prsLine.points.map((p) => (
              <circle key={`prs-pt-${p.rowIndex}`} cx={p.x} cy={p.y} r={2.5} fill={PRS_COLOR} stroke="#fff" strokeWidth={1} />
            ))}
            {chart.calcLine.points.map((p) => (
              <circle
                key={`calc-pt-${p.rowIndex}`}
                cx={p.x}
                cy={p.y}
                r={p.divergente ? 6 : 2.5}
                fill={p.divergente ? COLORS.risk : CALC_COLOR}
                stroke="#fff"
                strokeWidth={p.divergente ? 2 : 1}
              />
            ))}

            <g transform={`translate(0, ${CHART_HEIGHT})`}>
              <line x1={0} y1={2} x2={SVG_WIDTH} y2={2} stroke={COLORS.border} strokeWidth={1} />
              {chart.dateTicks.map((t, i) => (
                <text key={i} x={t.x} y={AXIS_HEIGHT - 6} textAnchor="middle" fontSize={FONT.size.xs - 1} fontFamily={FONT.family} fill={COLORS.textTertiary}>
                  {t.label}
                </text>
              ))}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}
