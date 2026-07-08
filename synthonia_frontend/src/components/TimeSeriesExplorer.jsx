// components/TimeSeriesExplorer.jsx
// Gráfico "Explorador — tempo × variáveis": eixo X = tempo, TODAS as
// variáveis selecionadas pelo usuário desenhadas SOBREPOSTAS no MESMO
// gráfico (mesmo SVG, mesmos eixos X/Y), cada uma normalizada pra escala
// 0-1 usando seu próprio min/max (ver VARIABLES) — assim curvas de
// naturezas bem diferentes (ex.: HRV em ms e TSB em -50..50) cabem juntas
// na mesma altura visual e dá pra comparar formato/tendência entre elas.
// Dados REAIS vindos de public.checkins (campos brutos reportados pelo
// atleta) MESCLADOS por data com public.metricas_diarias (métricas
// calculadas pelo motor real: TRIMP, ATL/CTL/TSB, monotonia, janela de
// lesão, prontidão calculada, recuperação física/mental, pontuação de sono,
// %exaustão, %redução sugerida). RLS garante que o usuário só vê os
// próprios registros em ambas as tabelas.
//
// Formato (voltamos ao original + reforço pedido por Val): pills de seleção
// no topo escolhem quais variáveis entram no overlay. Cada curva ganha um
// RÓTULO DE TEXTO grudado diretamente nela (não só numa legenda separada) —
// o nome curto da variável escrito ao lado do último ponto (mais recente),
// na cor da própria linha, pra identificar cada curva sem precisar olhar
// pra outro lugar. Quando dois rótulos terminam com alturas próximas,
// aplicamos um anti-colisão simples (empurra verticalmente) pra não
// sobrepor o texto. A legenda embaixo do gráfico continua existindo como
// reforço, mostrando o valor bruto mais recente de cada variável.
//
// Nota sobre o caso de 1 único ponto: com poucos check-ins (ex.: só hoje),
// uma linha de 1 ponto não desenha nada visível — isso é esperado e não é
// bug de dados. Tratamos esse caso mostrando um marcador (círculo) com o
// valor ao lado, em vez de uma linha.
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from '../theme';
import { supabase } from '../supabaseClient';
import { formatDateShort, formatValue, catmullRomPath, buildSegments, normalize, resolveLabelCollisions } from './chartUtils';

// Paleta categórica para as linhas (não semafórica — aqui cor = identidade da
// variável, não status de risco).
const LINE_COLORS = ['#378ADD', '#D85A30', '#639922', '#993C1D', '#7F77DD', '#D4537E', '#0F6E56', '#BA7517', '#993556', '#2E8B8B', '#8B5A2B', '#5A5AD8', '#C2185B'];

// Variáveis brutas de check-in (public.checkins).
const CHECKIN_VARIABLES = [
  { key: 'prontidao_percebida', label: 'Prontidão percebida (PRS)', shortLabel: 'PRS', min: 0, max: 10, source: 'checkin' },
  { key: 'qualidade_sono', label: 'Qualidade do sono', shortLabel: 'Qual. sono', min: 1, max: 7, source: 'checkin' },
  { key: 'duracao_sono_horas', label: 'Duração do sono (h)', shortLabel: 'Duração sono', min: 0, max: 12, source: 'checkin' },
  { key: 'fadiga_geral', label: 'Fadiga geral (1=pior)', shortLabel: 'Fadiga', min: 1, max: 7, source: 'checkin' },
  { key: 'estresse_percebido', label: 'Estresse percebido (1=pior)', shortLabel: 'Estresse', min: 1, max: 7, source: 'checkin' },
  { key: 'humor_disposicao', label: 'Humor/disposição (1=pior)', shortLabel: 'Humor', min: 1, max: 7, source: 'checkin' },
  { key: 'dor_muscular', label: 'Dor muscular (1=pior)', shortLabel: 'Dor muscular', min: 1, max: 7, source: 'checkin' },
  { key: 'hrv_ms', label: 'HRV (ms)', shortLabel: 'HRV', min: 20, max: 150, source: 'checkin' },
  { key: 'fc_repouso_bpm', label: 'FC de repouso (bpm)', shortLabel: 'FC repouso', min: 35, max: 100, source: 'checkin' },
];

// Métricas calculadas (public.metricas_diarias), populadas pelo motor real via trigger.
const METRICAS_VARIABLES = [
  { key: 'prontidao', label: 'Prontidão calculada', shortLabel: 'Prontidão', min: 0, max: 10, source: 'metrica' },
  { key: 'trimp_carga_diaria', label: 'TRIMP (carga diária)', shortLabel: 'TRIMP', min: 0, max: 600, source: 'metrica' },
  { key: 'atl_7d', label: 'ATL (7d)', shortLabel: 'ATL', min: 0, max: 150, source: 'metrica' },
  { key: 'ctl_28d', label: 'CTL (28d)', shortLabel: 'CTL', min: 0, max: 150, source: 'metrica' },
  { key: 'tsb', label: 'TSB', shortLabel: 'TSB', min: -50, max: 50, source: 'metrica' },
  { key: 'monotonia_diaria', label: 'Monotonia diária', shortLabel: 'Monot. diária', min: 0, max: 5, source: 'metrica' },
  { key: 'monotonia_semanal', label: 'Monotonia semanal', shortLabel: 'Monot. semanal', min: 0, max: 5, source: 'metrica' },
  { key: 'indice_janela_lesao', label: 'Índice Janela de Lesão', shortLabel: 'Janela lesão', min: 0, max: 10, source: 'metrica' },
  { key: 'percentual_exaustao', label: '% Exaustão', shortLabel: '% Exaustão', min: 0, max: 100, source: 'metrica' },
  { key: 'percentual_reducao_sugerida', label: '% Redução sugerida', shortLabel: '% Redução', min: 0, max: 70, source: 'metrica' },
  { key: 'recuperacao_fisica', label: 'Recuperação física', shortLabel: 'Rec. física', min: 0, max: 10, source: 'metrica' },
  { key: 'recuperacao_mental', label: 'Recuperação mental', shortLabel: 'Rec. mental', min: 0, max: 10, source: 'metrica' },
  { key: 'pontuacao_sono', label: 'Pontuação sono', shortLabel: 'Sono', min: 0, max: 10, source: 'metrica' },
];

export const VARIABLES = [...CHECKIN_VARIABLES, ...METRICAS_VARIABLES];

const SVG_WIDTH = 640;
const CHART_PADDING_X = 14;
const CHART_PADDING_TOP = 22;
const CHART_PADDING_BOTTOM = 14;
const CHART_HEIGHT = 260;
const AXIS_HEIGHT = 28;
const LABEL_GUTTER_RIGHT = 92; // espaço reservado à direita pros rótulos grudados na ponta das curvas
const LABEL_MIN_GAP = 14; // distância vertical mínima entre dois rótulos de linha

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

  const chartWidth = SVG_WIDTH - LABEL_GUTTER_RIGHT;

  // Monta, para cada variável selecionada, os pontos (x, y normalizado 0-1,
  // valor bruto) já na MESMA escala 0-1 — todas as curvas compartilham o
  // mesmo eixo Y do gráfico, por isso normalizamos cada uma pelo seu próprio
  // min/max antes de desenhar.
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
    // (N calculado pra render no máximo ~10 rótulos numéricos por curva),
    // sempre garantindo que o ÚLTIMO ponto (mais recente) sempre tem valor.
    const maxLabels = 10;
    const labelStep = n <= 12 ? 1 : Math.ceil(n / maxLabels);

    const lines = selected.map((key, idx) => {
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
        shortLabel: meta.shortLabel || meta.label,
        color: LINE_COLORS[idx % LINE_COLORS.length],
        points: pointsWithLabelFlag,
        segments,
        isSinglePoint: points.length === 1,
        lastRaw,
      };
    }).filter(Boolean);

    // Rótulo de texto grudado na ponta (último ponto) de cada curva — posição
    // Y desejada é a do próprio último ponto; resolve colisão vertical entre
    // linhas cujo fim fica muito próximo em altura (empurra uma pra baixo da
    // outra, mantendo um espaçamento mínimo de LABEL_MIN_GAP).
    const rawEndLabels = lines.map((line) => {
      const last = line.points[line.points.length - 1];
      return { key: line.key, y: last.x != null ? last.y : CHART_PADDING_TOP, x: last.x, color: line.color, text: line.shortLabel };
    });
    const endLabels = resolveLabelCollisions(rawEndLabels, LABEL_MIN_GAP);
    const endLabelByKey = new Map(endLabels.map((l) => [l.key, l]));

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

    return { lines, endLabelByKey, n, dateTicks };
  }, [rows, selected, chartWidth]);

  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, fontFamily: FONT.family }}>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: 2 }}>
        Explorador — tempo × variáveis
      </div>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.md }}>
        Eixo X = data do check-in. Todas as variáveis selecionadas ficam sobrepostas no MESMO gráfico, cada uma normalizada para uma escala 0-1 (usando o próprio mínimo/máximo) para caberem juntas — cada curva traz seu nome escrito ao lado do ponto mais recente, na própria cor, além da legenda de reforço abaixo. Inclui dados brutos do check-in e métricas calculadas (TRIMP, ATL/CTL/TSB, monotonia, janela de lesão etc.).
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

      {!loading && !error && rows.length > 0 && chart && chart.lines.length > 0 && (
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.sm, backgroundColor: COLORS.background }}>
          <svg width="100%" viewBox={`0 0 ${SVG_WIDTH} ${CHART_HEIGHT + AXIS_HEIGHT}`} preserveAspectRatio="xMinYMin meet">
            {/* Linha-base sutil do gráfico (fundo da escala normalizada) */}
            <line
              x1={0}
              y1={CHART_PADDING_TOP + (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM)}
              x2={chartWidth}
              y2={CHART_PADDING_TOP + (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM)}
              stroke={COLORS.border}
              strokeWidth={1}
            />

            {chart.lines.map((line) => (
              <g key={line.key}>
                {line.isSinglePoint ? (
                  <>
                    <circle cx={line.points[0].x} cy={line.points[0].y} r={4.5} fill={line.color} stroke="#fff" strokeWidth={1.5} />
                    <text
                      x={line.points[0].x}
                      y={line.points[0].y - 9}
                      textAnchor="middle"
                      fontSize={FONT.size.xs - 1}
                      fontFamily={FONT.family}
                      fontWeight={FONT.weight.semibold}
                      fill={COLORS.textPrimary}
                    >
                      {formatValue(line.points[0].value)}
                    </text>
                  </>
                ) : (
                  line.segments.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke={line.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                  ))
                )}

                {!line.isSinglePoint && line.points.map((p) => (
                  <g key={p.rowIndex}>
                    <circle cx={p.x} cy={p.y} r={3} fill={line.color} stroke="#fff" strokeWidth={1} />
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
            ))}

            {/* Rótulo de texto grudado na ponta de cada curva — nome curto da
                variável, na cor da linha, com anti-colisão vertical já
                resolvido em chart.endLabelByKey. */}
            {chart.lines.map((line) => {
              const lbl = chart.endLabelByKey.get(line.key);
              if (!lbl) return null;
              return (
                <text
                  key={`end-label-${line.key}`}
                  x={lbl.x + 8}
                  y={lbl.y + 3}
                  textAnchor="start"
                  fontSize={FONT.size.xs}
                  fontFamily={FONT.family}
                  fontWeight={FONT.weight.bold}
                  fill={lbl.color}
                >
                  {lbl.text}
                </text>
              );
            })}

            {/* Eixo X — datas */}
            <g transform={`translate(0, ${CHART_HEIGHT})`}>
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

          {/* Legenda de reforço (mantida) — valor bruto mais recente de cada variável */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTop: `1px solid ${COLORS.border}` }}>
            {chart.lines.map((line) => (
              <div key={line.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT.size.xs }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: line.color, display: 'inline-block' }} />
                <span style={{ color: COLORS.textSecondary }}>{line.label}:</span>
                <span style={{ color: COLORS.textPrimary, fontWeight: FONT.weight.semibold }}>{formatValue(line.lastRaw)}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginTop: SPACING.xs, textAlign: 'center' }}>
            {rows.length} dia(s) com dado — de {formatDateShort(rows[0].data_referencia)} a {formatDateShort(rows[rows.length - 1].data_referencia)}
          </div>
        </div>
      )}

      {!loading && !error && rows.length > 0 && chart && chart.lines.length === 0 && (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>
          Selecione ao menos uma variável acima para ver o gráfico.
        </div>
      )}
    </div>
  );
}
