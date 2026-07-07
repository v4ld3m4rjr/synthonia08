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
import React, { useEffect, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from './theme';
import { supabase } from './supabaseClient';
import TimeSeriesExplorer from './components/TimeSeriesExplorer';

const CARD_DEFS = [
  { key: 'prontidao', title: 'Prontidão', unit: '/10', decimals: 1 },
  { key: 'trimp_carga_diaria', title: 'TRIMP (carga diária)', unit: 'u.a.', decimals: 0 },
  { key: 'atl_7d', title: 'ATL', unit: '', decimals: 1 },
  { key: 'ctl_28d', title: 'CTL', unit: '', decimals: 1 },
  { key: 'tsb', title: 'TSB', unit: '', decimals: 1 },
  { key: 'monotonia_diaria', title: 'Monotonia diária', unit: '', decimals: 2 },
  { key: 'monotonia_semanal', title: 'Monotonia semanal', unit: '', decimals: 2 },
  { key: 'indice_janela_lesao', title: 'Índice Janela de Lesão', unit: '/10', decimals: 1 },
  { key: 'percentual_reducao_sugerida', title: '% Redução sugerida', unit: '%', decimals: 0 },
  { key: 'recuperacao_fisica', title: 'Recuperação física', unit: '/10', decimals: 1 },
  { key: 'recuperacao_mental', title: 'Recuperação mental', unit: '/10', decimals: 1 },
  { key: 'pontuacao_sono', title: 'Pontuação de sono', unit: '/10', decimals: 1 },
];

function MetricCard({ title, value, unit, decimals }) {
  const hasValue = value != null && !Number.isNaN(value);
  return (
    <div
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        boxShadow: SHADOW.card,
        padding: SPACING.md,
        fontFamily: FONT.family,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, fontWeight: FONT.weight.semibold, marginBottom: SPACING.xs }}>
        {title}
      </div>
      {hasValue ? (
        <div style={{ fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>
          {Number(value).toFixed(decimals)}
          <span style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, fontWeight: FONT.weight.medium }}> {unit}</span>
        </div>
      ) : (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textTertiary, fontStyle: 'italic' }}>
          Calculando… (dados insuficientes)
        </div>
      )}
    </div>
  );
}

function MetricsGrid({ userId }) {
  const [metrics, setMetrics] = useState(null);
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
        .select('data_referencia, trimp_carga_diaria, atl_7d, ctl_28d, tsb, monotonia_diaria, monotonia_semanal, indice_janela_lesao, prontidao, recuperacao_fisica, recuperacao_mental, pontuacao_sono, percentual_exaustao, percentual_reducao_sugerida')
        .eq('atleta_id', userId)
        .not('prontidao', 'is', null)
        .order('data_referencia', { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      setMetrics((data && data[0]) || null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

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

      {userId ? (
        <>
          <MetricsGrid userId={userId} />
          <TimeSeriesExplorer userId={userId} />
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
