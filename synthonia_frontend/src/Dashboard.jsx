// Dashboard.jsx
// A grade de 12 cards (TRIMP, ATL, CTL, TSB, monotonia, janela de lesão,
// recuperação física/mental etc.) foi REMOVIDA a pedido do Val: esses cards
// vinham de mockData.js com valores fixos e fabricados, e o motor de cálculo
// real (que produziria esses números de verdade a partir dos check-ins) ainda
// não foi implementado. Melhor não mostrar nada do que mostrar dado inventado.
// Quando o motor de cálculo existir (lendo de metricas_diarias), a grade volta
// aqui alimentada por dados reais.
//
// Por enquanto o Dashboard mostra só o que é real: o explorador de série
// temporal (tempo × variáveis reportadas no check-in).
import React from 'react';
import { COLORS, FONT, SPACING } from './theme';
import TimeSeriesExplorer from './components/TimeSeriesExplorer';

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
        <TimeSeriesExplorer userId={userId} />
      ) : (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>
          Faça login para ver seus dados.
        </div>
      )}

      <div
        style={{
          marginTop: SPACING.md,
          fontSize: FONT.size.xs,
          color: COLORS.textTertiary,
          fontFamily: FONT.family,
        }}
      >
        Métricas calculadas (TRIMP, ATL/CTL/TSB, monotonia, janela de lesão, recuperação
        física/mental) aparecerão aqui assim que o motor de cálculo estiver implementado.
        Por ora, só dados reais e brutos dos seus check-ins são exibidos.
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', padding: SPACING.md }}>
      {content}
    </div>
  );
}
