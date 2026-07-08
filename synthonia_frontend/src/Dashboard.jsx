// Dashboard.jsx
// A grade de 12 cards (TRIMP, ATL, CTL, TSB, monotonia, janela de lesão,
// recuperação física/mental etc.) volta AQUI alimentada por dados REAIS de
// public.metricas_diarias, agora que o motor de cálculo real (trigger sobre
// checkins) está implementado e populando a tabela de verdade.
//
// Mostramos sempre o registro mais recente com `prontidao IS NOT NULL` (ou
// seja, o dia mais recente em que houve check-in e o motor calculou algo).
// Campos que dependem de histórico maior (monotonia precisa de ~3+ dias,
// índice de janela de lesão precisa de 28+ dias) podem vir NULL mesmo nesse
// registro — nesse caso mostramos "Calculando… (dados insuficientes)" em vez
// de qualquer valor fabricado.
//
// Decisão de escopo: sem modal de detalhe / dot semafórico extra (como no
// mockData.js antigo) — grade simples somente leitura, para não reintroduzir
// a complexidade do protótipo anterior sem necessidade comprovada ainda.
//
// Cores semafóricas nos VALORES dos cards (decisão explícita do usuário,
// INTOCADA pela repaginação visual):
// - Prontidão, Recuperação física/mental, Pontuação de sono: alto=bom,
//   usam getSemaphoreColor direto (escala 0-10 já pensada assim).
// - Índice Janela de Lesão: é um índice de risco (alto=ruim), usa a versão
//   invertida getSemaphoreColorInverted.
// - Monotonia diária/semanal: usa getMonotoniaColor (limiar de risco = 2.0).
// - TSB: usa getTsbColor (tabela de interpretação própria, não é
//   simplesmente alto=bom nem alto=ruim).
// - %Exaustão e %Redução sugerida: alto=ruim, usam getPercentColorInverted
//   com o max correto de cada variável (100 e 70 respectivamente).
// - TRIMP, ATL, CTL: SEM semáforo — são apenas quantidade de carga, sem
//   "bom/ruim" isolado — ficam com a cor de texto padrão (neutra).
//
// Repaginação visual: apenas o "chrome" dos cards (borda superior sutil de
// marca, título/tipografia, espaçamento) foi revisado — os `colorFn` acima
// e os valores calculados continuam 100% intocados.
//
// NOVIDADES (rodada de gráficos + UX):
// - Tarefa A: 4 gráficos novos abaixo do TimeSeriesExplorer — PmcChart
//   (ATL/CTL/TSB), WeeklyLoadChart (carga semanal), TodayRadarChart (radar do
//   dia) e PrsVsCalculatedChart (PRS percebido vs prontidão calculada).
// - Tarefa B: setas de tendência em cada card, comparando o valor mais
//   recente com o valor de ~7 dias atrás (mesma consulta única de ~35 dias,
//   reaproveitada por todos os cards — evita 12 queries separadas).
// - Tarefa D: ícone "ⓘ" em cada card com explicação curta da métrica
//   (InfoTooltip.jsx, popover simples sem biblioteca externa).
import React, { useEffect, useMemo, useState } from 'react';
import {
  COLORS,
  FONT,
  RADIUS,
  SHADOW,
  SPACING,
  getSemaphoreColor,
  getSemaphoreColorInverted,
  getMonotoniaColor,
  getTsbColor,
  getPercentColorInverted,
} from './theme';
import { supabase } from './supabaseClient';
import TimeSeriesExplorer from './components/TimeSeriesExplorer';
import PmcChart from './components/PmcChart';
import WeeklyLoadChart from './components/WeeklyLoadChart';
import TodayRadarChart from './components/TodayRadarChart';
import PrsVsCalculatedChart from './components/PrsVsCalculatedChart';
import InfoTooltip from './components/InfoTooltip';

// Explicações curtas, linguagem simples, sem jargão — usadas no InfoTooltip
// de cada card (Tarefa D).
const METRIC_EXPLANATIONS = {
  trimp_carga_diaria: 'Carga do treino de ontem (esforço × duração). Quanto maior, mais puxado foi o treino.',
  atl_7d: 'Fadiga aguda — o quanto seu corpo acumulou de cansaço nos últimos 7 dias.',
  ctl_28d: 'Sua forma física de base, construída aos poucos nos últimos 28 dias.',
  tsb: 'Equilíbrio entre forma e fadiga. Positivo = descansado. Muito negativo = cansaço acumulado.',
  monotonia_diaria: "O quanto seu treino está 'sempre igual' — monotonia alta + carga alta é fator de risco de lesão.",
  monotonia_semanal: "O quanto seu treino está 'sempre igual' na semana — monotonia alta + carga alta é fator de risco de lesão.",
  indice_janela_lesao: 'Risco estimado combinando padrão de treino e seu equilíbrio de forma/fadiga.',
  percentual_exaustao: 'O quanto de fadiga você reportou hoje, em porcentagem.',
  percentual_reducao_sugerida: 'Quanto o app sugere reduzir o treino de hoje, considerando tudo.',
  recuperacao_fisica: 'O quanto seu corpo parece recuperado hoje, baseado no que você reportou.',
  recuperacao_mental: 'O quanto sua mente parece recuperada hoje, baseado no que você reportou.',
  pontuacao_sono: 'Nota combinando duração e regularidade do seu sono.',
  prontidao: 'Nota geral de prontidão para treinar hoje, combinando todos os outros fatores.',
};

// Direção "boa" de cada métrica, para a seta de tendência (Tarefa B).
// 'up'    = subir é bom (prontidão, recuperação, sono).
// 'down'  = descer é bom (%exaustão, %redução, monotonia, índice de lesão).
// 'none'  = sem direção simples de "melhor" (TSB) — seta neutra/omitida.
const TREND_DIRECTION = {
  prontidao: 'up',
  trimp_carga_diaria: 'none', // carga não tem "melhor" isolado
  atl_7d: 'none',
  ctl_28d: 'none',
  tsb: 'none',
  monotonia_diaria: 'down',
  monotonia_semanal: 'down',
  indice_janela_lesao: 'down',
  percentual_exaustao: 'down',
  percentual_reducao_sugerida: 'down',
  recuperacao_fisica: 'up',
  recuperacao_mental: 'up',
  pontuacao_sono: 'up',
};

const CARD_DEFS = [
  { key: 'prontidao', title: 'Prontidão', unit: '/10', decimals: 1, colorFn: (v) => getSemaphoreColor(v) },
  { key: 'trimp_carga_diaria', title: 'TRIMP (carga diária)', unit: 'u.a.', decimals: 0, colorFn: null },
  { key: 'atl_7d', title: 'ATL', unit: '', decimals: 1, colorFn: null },
  { key: 'ctl_28d', title: 'CTL', unit: '', decimals: 1, colorFn: null },
  { key: 'tsb', title: 'TSB', unit: '', decimals: 1, colorFn: (v) => getTsbColor(v) },
  { key: 'monotonia_diaria', title: 'Monotonia diária', unit: '', decimals: 2, colorFn: (v) => getMonotoniaColor(v) },
  { key: 'monotonia_semanal', title: 'Monotonia semanal', unit: '', decimals: 2, colorFn: (v) => getMonotoniaColor(v) },
  { key: 'indice_janela_lesao', title: 'Índice Janela de Lesão', unit: '/10', decimals: 1, colorFn: (v) => getSemaphoreColorInverted(v) },
  { key: 'percentual_exaustao', title: '% Exaustão', unit: '%', decimals: 0, colorFn: (v) => getPercentColorInverted(v, 100) },
  { key: 'percentual_reducao_sugerida', title: '% Redução sugerida', unit: '%', decimals: 0, colorFn: (v) => getPercentColorInverted(v, 70) },
  { key: 'recuperacao_fisica', title: 'Recuperação física', unit: '/10', decimals: 1, colorFn: (v) => getSemaphoreColor(v) },
  { key: 'recuperacao_mental', title: 'Recuperação mental', unit: '/10', decimals: 1, colorFn: (v) => getSemaphoreColor(v) },
  { key: 'pontuacao_sono', title: 'Pontuação de sono', unit: '/10', decimals: 1, colorFn: (v) => getSemaphoreColor(v) },
];

// Limiar de "estável" para a seta de tendência: variação relativa menor que
// isso conta como seta neutra (→) em vez de subida/descida.
const STABLE_THRESHOLD_PCT = 5;

/**
 * Calcula a seta de tendência (↑/↓/→) comparando o valor atual com o valor
 * de referência de ~7 dias atrás, considerando a direção "boa" da métrica.
 * Retorna null quando não há seta a mostrar (métrica sem direção definida,
 * ou faltando um dos dois valores).
 */
function computeTrend(key, current, previous) {
  if (current == null || previous == null) return null;
  const direction = TREND_DIRECTION[key];
  if (!direction || direction === 'none') return null;

  const base = Math.abs(previous) > 1e-9 ? Math.abs(previous) : 1e-9;
  const relChangePct = ((current - previous) / base) * 100;

  if (Math.abs(relChangePct) < STABLE_THRESHOLD_PCT) {
    return { arrow: '→', label: 'estável' };
  }
  const wentUp = current > previous;
  const isGood = direction === 'up' ? wentUp : !wentUp;
  return {
    arrow: wentUp ? '↑' : '↓',
    label: isGood ? 'melhorou' : 'piorou',
  };
}

function MetricCard({ title, value, unit, decimals, colorFn, explanation, trend }) {
  const hasValue = value != null && !Number.isNaN(value);
  const valueColor = hasValue && colorFn ? colorFn(value) : COLORS.textPrimary;
  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        boxShadow: SHADOW.card,
        borderTop: `3px solid ${COLORS.brandPrimary}`,
        padding: SPACING.md,
        fontFamily: FONT.family,
        minWidth: 0,
      }}
    >
      {explanation && (
        <div style={{ position: 'absolute', top: SPACING.xs, right: SPACING.xs }}>
          <InfoTooltip text={explanation} />
        </div>
      )}
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, fontWeight: FONT.weight.semibold, marginBottom: SPACING.xs, paddingRight: 20 }}>
        {title}
      </div>
      {hasValue ? (
        <div style={{ fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: valueColor, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span>
            {Number(value).toFixed(decimals)}
            <span style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, fontWeight: FONT.weight.medium }}> {unit}</span>
          </span>
          {trend && (
            <span
              title={`${trend.label} nos últimos ~7 dias`}
              style={{ fontSize: FONT.size.md, color: COLORS.textTertiary, fontWeight: FONT.weight.bold }}
            >
              {trend.arrow}
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textTertiary, fontStyle: 'italic' }}>
          Calculando… (dados insuficientes)
        </div>
      )}
    </div>
  );
}

const HISTORY_KEYS = [
  'data_referencia', 'trimp_carga_diaria', 'atl_7d', 'ctl_28d', 'tsb',
  'monotonia_diaria', 'monotonia_semanal', 'indice_janela_lesao', 'prontidao',
  'recuperacao_fisica', 'recuperacao_mental', 'pontuacao_sono',
  'percentual_exaustao', 'percentual_reducao_sugerida',
];

function MetricsGrid({ userId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      // Uma única query trazendo os últimos ~35 dias (em vez de uma query por
      // card): dá margem suficiente para sempre existir um registro perto de
      // 7 dias atrás, mesmo com alguns dias sem check-in no meio.
      const { data, error: fetchError } = await supabase
        .from('metricas_diarias')
        .select(HISTORY_KEYS.join(', '))
        .eq('atleta_id', userId)
        .order('data_referencia', { ascending: false })
        .limit(35);
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      setHistory(data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // Registro mais recente com prontidão calculada (mesmo critério de sempre).
  const metrics = useMemo(() => {
    return history.find((r) => r.prontidao != null) || null;
  }, [history]);

  // Registro de referência "~7 dias atrás": entre os registros mais antigos
  // que `metrics`, escolhe o que tem a data mais próxima de (data do
  // registro atual - 7 dias). Não exige que seja exatamente 7 dias, já que
  // pode haver dias sem check-in.
  const previousMetrics = useMemo(() => {
    if (!metrics) return null;
    const targetDate = new Date(`${metrics.data_referencia}T00:00:00Z`);
    targetDate.setUTCDate(targetDate.getUTCDate() - 7);

    let best = null;
    let bestDiff = Infinity;
    for (const r of history) {
      if (r.data_referencia === metrics.data_referencia) continue;
      const d = new Date(`${r.data_referencia}T00:00:00Z`);
      const diff = Math.abs(d.getTime() - targetDate.getTime());
      // Só considera candidatos dentro de uma janela de +/- 3 dias do alvo,
      // para não comparar com algo tempor demais distante caso o histórico
      // tenha um buraco grande.
      if (diff <= 3 * 24 * 60 * 60 * 1000 && diff < bestDiff) {
        best = r;
        bestDiff = diff;
      }
    }
    return best;
  }, [history, metrics]);

  if (loading) {
    return <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginBottom: SPACING.md }}>Carregando métricas…</div>;
  }
  if (error) {
    return <div style={{ fontSize: FONT.size.sm, color: COLORS.risk, marginBottom: SPACING.md }}>Erro ao carregar métricas: {error}</div>;
  }
  if (!metrics) {
    return (
      <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginBottom: SPACING.md }}>
        Ainda não há métricas calculadas — faça um check-in para o motor de cálculo gerar os primeiros valores.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: SPACING.lg }}>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.sm }}>
        Referente a {metrics.data_referencia}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: SPACING.sm,
        }}
      >
        {CARD_DEFS.map((def) => (
          <MetricCard
            key={def.key}
            title={def.title}
            value={metrics[def.key]}
            unit={def.unit}
            decimals={def.decimals}
            colorFn={def.colorFn}
            explanation={METRIC_EXPLANATIONS[def.key]}
            trend={computeTrend(def.key, metrics[def.key], previousMetrics ? previousMetrics[def.key] : null)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} [props.embedded] - quando usado dentro da Home, remove o
 *   background/padding próprios de tela cheia (a Home já provê o container).
 */
export default function Dashboard({ embedded = false, userId }) {
  const content = (
    <div>
      {!embedded && (
        <div
          style={{
            fontSize: FONT.size.title,
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

      {userId ? (
        <>
          <MetricsGrid userId={userId} />
          <TimeSeriesExplorer userId={userId} />
          <PmcChart userId={userId} />
          <WeeklyLoadChart userId={userId} />
          <TodayRadarChart userId={userId} />
          <PrsVsCalculatedChart userId={userId} />
        </>
      ) : (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>
          Faça login para ver seus dados.
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', padding: SPACING.md }}>
      {content}
    </div>
  );
}
