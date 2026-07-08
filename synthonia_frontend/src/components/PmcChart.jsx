// components/PmcChart.jsx
// PMC — Performance Management Chart (padrão consagrado da ciência do
// esporte: ATL "fadiga aguda" em curva, CTL "fitness/forma" em curva, e TSB
// "equilíbrio forma-fadiga" como faixa de barras finas abaixo, coloridas pela
// mesma tabela semafórica de getTsbColor já usada nos cards do Dashboard).
// Busca atl_7d/ctl_28d/tsb de metricas_diarias no mesmo range de datas que o
// resto do Dashboard (todo o histórico do atleta, mesmo padrão de
// TimeSeriesExplorer.jsx). ATL e CTL dividem a MESMA escala 0..max observado
// (ambas em "carga", unidade compatível) — desenhadas como duas curvas
// suaves (Catmull-Rom, helper compartilhado em chartUtils.js) sobrepostas no
// mesmo eixo Y, com legenda simples. TSB fica numa faixa própria embaixo
// (barras fininhas, uma por dia com dado), alinhada ao mesmo eixo X de datas.
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING, getTsbColor } from '../theme';
import { supabase } from '../supabaseClient';
import { formatDateShort, catmullRomPath, buildSegments, normalize } from './chartUtils';

const SVG_WIDTH = 640;
const PADDING_X = 14;
const CURVE_HEIGHT = 150;
const CURVE_PADDING_TOP = 18;
const CURVE_PADDING_BOTTOM = 10;
const TSB_HEIGHT = 60;
const TSB_GAP = 8;
const AXIS_HEIGHT = 26;

export default function PmcChart({ userId }) {
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
        .select('data_referencia, atl_7d, ctl_28d, tsb')
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

  const chart = useMemo(() => {
    if (rows.length === 0) return null;
    const n = rows.length;
    const innerWidth = SVG_WIDTH - PADDING_X * 2;
    const stepX = n > 1 ? innerWidth / (n - 1) : 0;
    const singleX = SVG_WIDTH / 2;

    // Escala compartilhada ATL/CTL: 0 até o máximo observado entre as duas
    // séries (arredondado pra cima, com uma margem de 10% pra não encostar
    // no topo do gráfico).
    let maxLoad = 0;
    rows.forEach((r) => {
      if (r.atl_7d != null && r.atl_7d > maxLoad) maxLoad = r.atl_7d;
      if (r.ctl_28d != null && r.ctl_28d > maxLoad) maxLoad = r.ctl_28d;
    });
    maxLoad = maxLoad > 0 ? maxLoad * 1.1 : 10;

    const usableHeight = CURVE_HEIGHT - CURVE_PADDING_TOP - CURVE_PADDING_BOTTOM;

    function buildLine(key) {
      const points = [];
      rows.forEach((r, i) => {
        const raw = r[key];
        const norm = normalize(raw, 0, maxLoad);
        if (norm == null) return;
        const x = n > 1 ? PADDING_X + i * stepX : singleX;
        const y = CURVE_PADDING_TOP + usableHeight - norm * usableHeight;
        points.push({ x, y, value: raw, rowIndex: i });
      });
      const segments = buildSegments(points).map((seg) => catmullRomPath(seg, 0.5));
      let lastRaw = null;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i][key] != null) { lastRaw = rows[i][key]; break; }
      }
      return { points, segments, lastRaw };
    }

    const atlLine = buildLine('atl_7d');
    const ctlLine = buildLine('ctl_28d');

    // TSB: uma barra fina por dia com valor não-nulo, cor semafórica própria
    // (getTsbColor). Escala simétrica em torno de 0, com max absoluto
    // observado (mínimo 20 pra barras pequenas não ficarem ilegíveis).
    let maxAbsTsb = 20;
    rows.forEach((r) => {
      if (r.tsb != null && Math.abs(r.tsb) > maxAbsTsb) maxAbsTsb = Math.abs(r.tsb);
    });
    const tsbMid = TSB_GAP + TSB_HEIGHT / 2;
    const tsbBars = rows.map((r, i) => {
      if (r.tsb == null) return null;
      const x = n > 1 ? PADDING_X + i * stepX : singleX;
      const halfBar = (Math.abs(r.tsb) / maxAbsTsb) * (TSB_HEIGHT / 2 - 2);
      const barHeight = Math.max(1.5, halfBar);
      const y = r.tsb >= 0 ? tsbMid - barHeight : tsbMid;
      return { x, y, height: barHeight, color: getTsbColor(r.tsb), value: r.tsb };
    }).filter(Boolean);

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

    return { atlLine, ctlLine, tsbBars, tsbMid, dateTicks, n };
  }, [rows]);

  const svgHeight = CURVE_HEIGHT + TSB_GAP + TSB_HEIGHT + AXIS_HEIGHT;

  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, fontFamily: FONT.family, marginTop: SPACING.md }}>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: 2 }}>
        PMC — Fitness, Fadiga e Forma
      </div>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.sm }}>
        ATL (fadiga aguda, 7 dias) e CTL (fitness/forma, 28 dias) na mesma escala de carga. A faixa abaixo mostra o TSB (equilíbrio forma-fadiga) de cada dia, colorido pelo mesmo semáforo dos cards.
      </div>

      <div style={{ display: 'flex', gap: SPACING.md, marginBottom: SPACING.sm, fontSize: FONT.size.xs }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#D85A30', display: 'inline-block' }} />
          ATL — fadiga aguda
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#378ADD', display: 'inline-block' }} />
          CTL — fitness/forma
        </span>
      </div>

      {loading && <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Carregando…</div>}
      {error && <div style={{ fontSize: FONT.size.sm, color: COLORS.risk }}>Erro ao carregar: {error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Ainda não há métricas suficientes para este gráfico.</div>
      )}

      {!loading && !error && chart && (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.sm, backgroundColor: COLORS.background }}>
          <svg width="100%" viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`} preserveAspectRatio="xMinYMin meet">
            {/* Curvas ATL/CTL */}
            {chart.ctlLine.segments.map((d, i) => (
              <path key={`ctl-${i}`} d={d} fill="none" stroke="#378ADD" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {chart.atlLine.segments.map((d, i) => (
              <path key={`atl-${i}`} d={d} fill="none" stroke="#D85A30" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {chart.ctlLine.points.length === 1 && (
              <circle cx={chart.ctlLine.points[0].x} cy={chart.ctlLine.points[0].y} r={4} fill="#378ADD" stroke="#fff" strokeWidth={1.5} />
            )}
            {chart.atlLine.points.length === 1 && (
              <circle cx={chart.atlLine.points[0].x} cy={chart.atlLine.points[0].y} r={4} fill="#D85A30" stroke="#fff" strokeWidth={1.5} />
            )}
            {chart.ctlLine.points.map((p) => (
              <circle key={`ctl-pt-${p.rowIndex}`} cx={p.x} cy={p.y} r={2.5} fill="#378ADD" stroke="#fff" strokeWidth={1} />
            ))}
            {chart.atlLine.points.map((p) => (
              <circle key={`atl-pt-${p.rowIndex}`} cx={p.x} cy={p.y} r={2.5} fill="#D85A30" stroke="#fff" strokeWidth={1} />
            ))}

            {/* Faixa TSB */}
            <g transform={`translate(0, ${CURVE_HEIGHT + TSB_GAP})`}>
              <line x1={0} y1={TSB_HEIGHT / 2} x2={SVG_WIDTH} y2={TSB_HEIGHT / 2} stroke={COLORS.border} strokeWidth={1} />
              {chart.tsbBars.map((b, i) => (
                <rect
                  key={i}
                  x={b.x - 2}
                  y={b.y}
                  width={4}
                  height={b.height}
                  fill={b.color}
                  rx={1}
                />
              ))}
            </g>

            {/* Eixo X compartilhado */}
            <g transform={`translate(0, ${CURVE_HEIGHT + TSB_GAP + TSB_HEIGHT})`}>
              <line x1={0} y1={2} x2={SVG_WIDTH} y2={2} stroke={COLORS.border} strokeWidth={1} />
              {chart.dateTicks.map((t, i) => (
                <text key={i} x={t.x} y={AXIS_HEIGHT - 6} textAnchor="middle" fontSize={FONT.size.xs - 1} fontFamily={FONT.family} fill={COLORS.textTertiary}>
                  {t.label}
                </text>
              ))}
            </g>
          </svg>
          <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginTop: SPACING.xs, textAlign: 'center' }}>
            Faixa TSB: verde = frescor produtivo, âmbar = fadiga acumulada ou destreino, vermelho = risco alto.
          </div>
        </div>
      )}
    </div>
  );
}
