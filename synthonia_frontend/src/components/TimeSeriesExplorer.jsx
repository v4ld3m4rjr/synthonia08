// components/TimeSeriesExplorer.jsx
// Gráfico pedido explicitamente por Val: eixo X = tempo, uma FILEIRA por
// variável escolhida pelo usuário (em vez de todas sobrepostas no mesmo
// eixo Y). Dados REAIS vindos de public.checkins (campos brutos reportados
// pelo atleta) MESCLADOS por data com public.metricas_diarias (métricas
// calculadas pelo motor real: TRIMP, ATL/CTL/TSB, monotonia, janela de
// lesão, prontidão calculada, recuperação física/mental, pontuação de sono,
// %exaustão, %redução sugerida). RLS garante que o usuário só vê os
// próprios registros em ambas as tabelas.
//
// Redesenho (layout "uma fileira por variável"): cada variável selecionada
// ganha sua própria linha com título à esquerda + gráfico de linha curva à
// direita, na escala PRÓPRIA daquela variável (não precisa mais normalizar
// 0-1 pra dividir eixo Y com outras variáveis). Um único eixo de datas fica
// embaixo de todas as fileiras, já que todas compartilham o mesmo intervalo
// de tempo.
//
// Nota sobre o caso de 1 único ponto: com poucos check-ins (ex.: só hoje),
// uma linha de 1 ponto não desenha nada visível — isso é esperado e não é
// bug de dados. Tratamos esse caso mostrando um marcador (círculo) com o
// valor ao lado, em vez de uma linha.
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING, BREAKPOINTS } from '../theme';
import { supabase } from '../supabaseClient';

// Paleta categórica para as linhas (não semafórica — aqui cor = identidade da
// variável, não status de risco).
const LINE_COLORS = ['#378ADD', '#D85A30', '#639922', '#993C1D', '#7F77DD', '#D4537E', '#0F6E56', '#BA7517', '#993556', '#2E8B8B', '#8B5A2B', '#5A5AD8', '#C2185B'];

// Variáveis brutas de check-in (public.checkins).
const CHECKIN_VARIABLES = [
  { key: 'prontidao_percebida', label: 'Prontidão percebida (PRS)', min: 0, max: 10, source: 'checkin' },
  { key: 'qualidade_sono', label: 'Qualidade do sono', min: 1, max: 7, source: 'checkin' },
  { key: 'duracao_sono_horas', label: 'Duração do sono (h)', min: 0, max: 12, source: 'checkin' },
  { key: 'fadiga_geral', label: 'Fadiga geral (1=pior)', min: 1, max: 7, source: 'checkin' },
  { key: 'estresse_percebido', label: 'Estresse percebido (1=pior)', min: 1, max: 7, source: 'checkin' },
  { key: 'humor_disposicao', label: 'Humor/disposição (1=pior)', min: 1, max: 7, source: 'checkin' },
  { key: 'dor_muscular', label: 'Dor muscular (1=pior)', min: 1, max: 7, source: 'checkin' },
  { key: 'hrv_ms', label: 'HRV (ms)', min: 20, max: 150, source: 'checkin' },
  { key: 'fc_repouso_bpm', label: 'FC de repouso (bpm)', min: 35, max: 100, source: 'checkin' },
];

// Métricas calculadas (public.metricas_diarias), populadas pelo motor real via trigger.
const METRICAS_VARIABLES = [
  { key: 'prontidao', label: 'Prontidão calculada', min: 0, max: 10, source: 'metrica' },
  { key: 'trimp_carga_diaria', label: 'TRIMP (carga diária)', min: 0, max: 600, source: 'metrica' },
  { key: 'atl_7d', label: 'ATL (7d)', min: 0, max: 150, source: 'metrica' },
  { key: 'ctl_28d', label: 'CTL (28d)', min: 0, max: 150, source: 'metrica' },
  { key: 'tsb', label: 'TSB', min: -50, max: 50, source: 'metrica' },
  { key: 'monotonia_diaria', label: 'Monotonia diária', min: 0, max: 5, source: 'metrica' },
  { key: 'monotonia_semanal', label: 'Monotonia semanal', min: 0, max: 5, source: 'metrica' },
  { key: 'indice_janela_lesao', label: 'Índice Janela de Lesão', min: 0, max: 10, source: 'metrica' },
  { key: 'percentual_exaustao', label: '% Exaustão', min: 0, max: 100, source: 'metrica' },
  { key: 'percentual_reducao_sugerida', label: '% Redução sugerida', min: 0, max: 70, source: 'metrica' },
  { key: 'recuperacao_fisica', label: 'Recuperação física', min: 0, max: 10, source: 'metrica' },
  { key: 'recuperacao_mental', label: 'Recuperação mental', min: 0, max: 10, source: 'metrica' },
  { key: 'pontuacao_sono', label: 'Pontuação sono', min: 0, max: 10, source: 'metrica' },
];

export const VARIABLES = [...CHECKIN_VARIABLES, ...METRICAS_VARIABLES];

function normalize(value, min, max) {
  if (value == null || Number.isNaN(value)) return null;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min || 1);
}

// Formata "2026-07-08" -> "08/07" (dia/mês compacto) sem depender de Date
// (evita bugs de timezone quando a string já vem como data pura).
function formatDateShort(isoDate) {
  if (!isoDate) return '';
  const parts = String(isoDate).split('-');
  if (parts.length < 3) return isoDate;
  const [, mm, dd] = parts;
  return `${dd}/${mm}`;
}

// Formata número bruto pra exibição compacta perto do ponto: inteiros sem
// casas decimais, fracionários com 1 casa (mantém "10" limpo, mas "6.5"
// legível). Ex.: prontidão 7 -> "7", TSB -12.345 -> "-12.3".
function formatValue(value) {
  if (value == null) return '';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

// Gera um path SVG suave (cardinal spline com tensão ~0.5, convertida para
// curvas de Bézier cúbicas) a partir de uma lista de pontos {x, y}. Técnica
// clássica: para cada segmento P[i]->P[i+1], os pontos de controle são
// derivados da tangente estimada em cada ponto usando os vizinhos
// (P[i-1], P[i+2]), escalada pela tensão. Não requer biblioteca externa.
function catmullRomPath(points, tension = 0.5) {
  if (points.length === 0) return '';
  if (points.length === 1) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }
  const d = [`M ${points[0].x},${points[0].y}`];
  const factor = tension / 2; // fator clássico de conversão cardinal->Bézier (com tensão 0.5 dá o padrão "Catmull-Rom" 1/6)
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) * factor;
    const cp1y = p1.y + (p2.y - p0.y) * factor;
    const cp2x = p2.x - (p3.x - p1.x) * factor;
    const cp2y = p2.y - (p3.y - p1.y) * factor;

    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return d.join(' ');
}

// Quebra uma lista de pontos (já ordenada no tempo, mas podendo ter "buracos"
// onde o dado é NULL) em segmentos contíguos de índices de rows consecutivos.
// Isso garante que a curva NUNCA interpola por cima de um dia sem check-in —
// ela simplesmente para e recomeça, igual à polyline original fazia ao pular
// NULLs (mas ali a quebra "acontecia sozinha" pq eram pontos soltos; aqui
// como desenhamos curva precisamos ser explícitos sobre onde ela quebra).
function buildSegments(points) {
  const segments = [];
  let current = [];
  let lastRowIndex = null;
  for (const p of points) {
    if (lastRowIndex != null && p.rowIndex !== lastRowIndex + 1) {
      if (current.length > 0) segments.push(current);
      current = [];
    }
    current.push(p);
    lastRowIndex = p.rowIndex;
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

const ROW_HEIGHT = 92;
const ROW_LABEL_WIDTH = 148;
const ROW_LABEL_WIDTH_NARROW = 96;
const CHART_HEIGHT = 72;
const CHART_PADDING_X = 14;
const CHART_PADDING_TOP = 22;
const CHART_PADDING_BOTTOM = 14;
const AXIS_HEIGHT = 28;
const SVG_TOTAL_WIDTH = 640; // largura "virtual" do viewBox; o SVG escala via % no CSS

function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < BREAKPOINTS.mobile : false
  );
  useEffect(() => {
    function onResize() {
      setNarrow(window.innerWidth < BREAKPOINTS.mobile);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}

export default function TimeSeriesExplorer({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(['prontidao_percebida', 'qualidade_sono']);
  const isNarrow = useIsNarrow();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);

      const [checkinsRes, metricasRes] = await Promise.all([
        supabase
          .from('checkins')
          .select('data_referencia, prontidao_percebida, qualidade_sono, duracao_sono_horas, fadiga_geral, estresse_percebido, humor_disposicao, dor_muscular, hrv_ms, fc_repouso_bpm')
          .eq('atleta_id', userId)
          .order('data_referencia', { ascending: true }),
        supabase
          .from('metricas_diarias')
          .select('data_referencia, trimp_carga_diaria, atl_7d, ctl_28d, tsb, monotonia_diaria, monotonia_semanal, indice_janela_lesao, prontidao, recuperacao_fisica, recuperacao_mental, pontuacao_sono, percentual_exaustao, percentual_reducao_sugerida')
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
        // Não bloqueia o gráfico inteiro por erro nas métricas calculadas —
        // ainda mostramos os dados brutos de checkins normalmente.
        console.warn('Falha ao carregar metricas_diarias:', metricasRes.error.message);
      }

      // Mescla por data_referencia num único array ordenado.
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

  const toggleVar = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const labelWidth = isNarrow ? ROW_LABEL_WIDTH_NARROW : ROW_LABEL_WIDTH;
  const chartWidth = SVG_TOTAL_WIDTH - labelWidth;

  // Monta, para cada variável selecionada, os pontos (x, y, valor bruto) já
  // na escala PRÓPRIA daquela variável — sem normalizar 0-1, já que cada
  // fileira tem seu próprio eixo Y e não precisa mais compartilhar espaço
  // vertical com as outras variáveis.
  const chart = useMemo(() => {
    if (rows.length === 0) return null;
    const n = rows.length;
    const innerWidth = chartWidth - CHART_PADDING_X * 2;
    const stepX = n > 1 ? innerWidth / (n - 1) : 0;
    const singlePointX = chartWidth / 2;
    const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

    // Regra de densidade de rótulos numéricos nos pontos: com poucos dias
    // (<=12) mostramos o valor em TODOS os pontos, pois cabe sem poluir.
    // Com mais dias, mostramos só primeiro, último, e a cada N pontos
    // (N calculado pra render no máximo ~10 rótulos numéricos na fileira),
    // sempre garantindo que o ÚLTIMO ponto (mais recente) sempre tem valor.
    const maxLabels = 10;
    const labelStep = n <= 12 ? 1 : Math.ceil(n / maxLabels);

    const rowsChart = selected.map((key, idx) => {
      const meta = VARIABLES.find((v) => v.key === key);
      if (!meta) return null;

      const points = [];
      rows.forEach((r, i) => {
        const raw = r[key];
        const norm = normalize(raw, meta.min, meta.max);
        if (norm == null) return; // pula NULLs (ex.: métricas calculadas nos primeiros dias, ou dia sem checkin)
        const x = n > 1 ? CHART_PADDING_X + i * stepX : singlePointX;
        const y = CHART_PADDING_TOP + usableHeight - norm * usableHeight;
        points.push({ x, y, value: raw, rowIndex: i });
      });

      const segments = buildSegments(points).map((seg) => catmullRomPath(seg, 0.5));

      // Decide quais pontos ganham rótulo numérico visível: último ponto
      // sempre, primeiro ponto sempre (se houver mais de 1), e demais a
      // cada `labelStep` (contando por posição dentro da lista de pontos
      // válidos, não por índice de linha, pra não ficar irregular quando
      // há NULLs no meio).
      const lastIdx = points.length - 1;
      const pointsWithLabelFlag = points.map((p, i) => ({
        ...p,
        showLabel: i === 0 || i === lastIdx || i % labelStep === 0,
      }));

      // Último valor bruto/calculado NÃO-nulo (percorre de trás pra frente),
      // pra sempre mostrar algo mesmo se o dia mais recente estiver NULL.
      let lastRaw = null;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i][key] != null) {
          lastRaw = rows[i][key];
          break;
        }
      }

      return {
        key,
        label: meta.label,
        color: LINE_COLORS[idx % LINE_COLORS.length],
        points: pointsWithLabelFlag,
        segments,
        isSinglePoint: points.length === 1,
        lastRaw,
      };
    }).filter(Boolean);

    // Rótulos do eixo X compartilhado: espaçamento dinâmico pra não colidir.
    // Estimativa de largura de cada rótulo de data ("dd/mm" ~ 30px) — cabe
    // no espaço disponível dividindo por esse tamanho mínimo e arredondando
    // o passo pra cima.
    const approxLabelWidth = 34;
    const maxDateLabels = Math.max(2, Math.floor(chartWidth / approxLabelWidth));
    const dateStep = n <= maxDateLabels ? 1 : Math.ceil(n / maxDateLabels);
    const dateTicks = rows
      .map((r, i) => ({ i, date: r.data_referencia }))
      .filter(({ i }) => i === 0 || i === n - 1 || i % dateStep === 0)
      .map(({ i, date }) => ({
        x: n > 1 ? CHART_PADDING_X + i * stepX : singlePointX,
        label: formatDateShort(date),
      }));

    return { rowsChart, n, dateTicks };
  }, [rows, selected, chartWidth]);

  const svgHeight = chart ? chart.rowsChart.length * ROW_HEIGHT + AXIS_HEIGHT : 0;

  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, fontFamily: FONT.family }}>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: 2 }}>
        Explorador — tempo × variáveis
      </div>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.md }}>
        Eixo X = data do check-in (comum a todas as fileiras abaixo). Cada variável selecionada ganha sua própria fileira, com escala própria no eixo Y. Inclui dados brutos do check-in e métricas calculadas (TRIMP, ATL/CTL/TSB, monotonia, janela de lesão etc.).
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

      {!loading && !error && rows.length > 0 && chart && chart.rowsChart.length > 0 && (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.sm, backgroundColor: COLORS.background }}>
          <svg width="100%" viewBox={`0 0 ${SVG_TOTAL_WIDTH} ${svgHeight}`} preserveAspectRatio="xMinYMin meet">
            {chart.rowsChart.map((row, rowIdx) => {
              const rowY = rowIdx * ROW_HEIGHT;
              return (
                <g key={row.key} transform={`translate(0, ${rowY})`}>
                  {/* Título da variável, coluna fixa à esquerda */}
                  <foreignObject x={0} y={0} width={labelWidth - 8} height={ROW_HEIGHT}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: ROW_HEIGHT,
                        gap: 6,
                        fontFamily: FONT.family,
                        fontSize: FONT.size.xs,
                        fontWeight: FONT.weight.semibold,
                        color: COLORS.textPrimary,
                        lineHeight: 1.25,
                        paddingRight: 6,
                      }}
                    >
                      <span style={{ width: 8, height: 8, minWidth: 8, borderRadius: '50%', backgroundColor: row.color, display: 'inline-block' }} />
                      <span>{row.label}</span>
                    </div>
                  </foreignObject>

                  {/* Área do gráfico desta fileira */}
                  <g transform={`translate(${labelWidth}, 0)`}>
                    {/* Linha-base sutil da fileira */}
                    <line
                      x1={0}
                      y1={CHART_PADDING_TOP + (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM)}
                      x2={chartWidth}
                      y2={CHART_PADDING_TOP + (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM)}
                      stroke={COLORS.border}
                      strokeWidth={1}
                    />

                    {row.isSinglePoint ? (
                      <>
                        <circle cx={row.points[0].x} cy={row.points[0].y} r={4.5} fill={row.color} stroke="#fff" strokeWidth={1.5} />
                        <text
                          x={row.points[0].x}
                          y={row.points[0].y - 9}
                          textAnchor="middle"
                          fontSize={FONT.size.xs - 1}
                          fontFamily={FONT.family}
                          fontWeight={FONT.weight.semibold}
                          fill={COLORS.textPrimary}
                        >
                          {formatValue(row.points[0].value)}
                        </text>
                      </>
                    ) : (
                      row.segments.map((d, i) => (
                        <path key={i} d={d} fill="none" stroke={row.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                      ))
                    )}

                    {!row.isSinglePoint && row.points.map((p) => (
                      <g key={p.rowIndex}>
                        <circle cx={p.x} cy={p.y} r={3} fill={row.color} stroke="#fff" strokeWidth={1} />
                        {p.showLabel && (
                          <text
                            x={p.x}
                            y={p.y - 8}
                            textAnchor="middle"
                            fontSize={FONT.size.xs - 1}
                            fontFamily={FONT.family}
                            fontWeight={FONT.weight.medium}
                            fill={COLORS.textSecondary}
                          >
                            {formatValue(p.value)}
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                </g>
              );
            })}

            {/* Eixo X compartilhado — datas, embaixo de todas as fileiras */}
            <g transform={`translate(${labelWidth}, ${chart.rowsChart.length * ROW_HEIGHT})`}>
              <line x1={0} y1={2} x2={chartWidth} y2={2} stroke={COLORS.border} strokeWidth={1} />
              {chart.dateTicks.map((t, i) => (
                <text
                  key={i}
                  x={t.x}
                  y={AXIS_HEIGHT - 6}
                  textAnchor="middle"
                  fontSize={FONT.size.xs - 1}
                  fontFamily={FONT.family}
                  fill={COLORS.textTertiary}
                >
                  {t.label}
                </text>
              ))}
            </g>
          </svg>
          <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginTop: SPACING.xs, textAlign: 'center' }}>
            {rows.length} dia(s) com dado — de {formatDateShort(rows[0].data_referencia)} a {formatDateShort(rows[rows.length - 1].data_referencia)}
          </div>
        </div>
      )}

      {!loading && !error && rows.length > 0 && chart && chart.rowsChart.length === 0 && (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>
          Selecione ao menos uma variável acima para ver o gráfico.
        </div>
      )}
    </div>
  );
}
