// components/TodayRadarChart.jsx
// Radar do dia (snapshot de hoje): pega o registro mais recente de
// metricas_diarias com prontidao não-nulo (mesmo critério do MetricsGrid em
// Dashboard.jsx) e desenha um polígono SVG simples com até 4 eixos, todos na
// escala 0-10:
//   - Recuperação física (recuperacao_fisica)
//   - Recuperação mental (recuperacao_mental)
//   - Sono (pontuacao_sono)
//   - TSB normalizado, calculado no client: clamp(0,10, 5 + tsb/10),
//     saturando em 0 se tsb<=-40 e 10 se tsb>=40 (mesma fórmula documentada
//     no motor de cálculo).
// Eixos cujo valor de origem é NULL são OMITIDOS do radar (nunca inventamos
// valor) — o polígono é recalculado só com os eixos disponíveis, igualmente
// espaçados em círculo.
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from '../theme';
import { supabase } from '../supabaseClient';
import { clamp } from './chartUtils';

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS_MAX = 90;
const LABEL_OFFSET = 34;

function tsbNormalized(tsb) {
  if (tsb == null || Number.isNaN(tsb)) return null;
  if (tsb <= -40) return 0;
  if (tsb >= 40) return 10;
  return clamp(0, 10, 5 + tsb / 10);
}

export default function TodayRadarChart({ userId }) {
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
        .select('data_referencia, recuperacao_fisica, recuperacao_mental, pontuacao_sono, tsb')
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

  const axes = useMemo(() => {
    if (!metrics) return [];
    const candidates = [
      { key: 'recuperacao_fisica', label: 'Recup. física', value: metrics.recuperacao_fisica },
      { key: 'recuperacao_mental', label: 'Recup. mental', value: metrics.recuperacao_mental },
      { key: 'pontuacao_sono', label: 'Sono', value: metrics.pontuacao_sono },
      { key: 'tsb_norm', label: 'TSB (normalizado)', value: tsbNormalized(metrics.tsb) },
    ];
    return candidates.filter((c) => c.value != null && !Number.isNaN(c.value));
  }, [metrics]);

  const polygon = useMemo(() => {
    if (axes.length < 3) return null; // menos de 3 eixos não forma um polígono útil
    const n = axes.length;
    const angleStep = (2 * Math.PI) / n;
    const points = axes.map((axis, i) => {
      const angle = i * angleStep - Math.PI / 2; // começa no topo
      const r = (axis.value / 10) * RADIUS_MAX;
      return {
        x: CENTER + r * Math.cos(angle),
        y: CENTER + r * Math.sin(angle),
        labelX: CENTER + (RADIUS_MAX + LABEL_OFFSET) * Math.cos(angle),
        labelY: CENTER + (RADIUS_MAX + LABEL_OFFSET) * Math.sin(angle),
        axisEndX: CENTER + RADIUS_MAX * Math.cos(angle),
        axisEndY: CENTER + RADIUS_MAX * Math.sin(angle),
        ...axis,
      };
    });
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';
    // Anéis de referência (grade) em 2.5 / 5 / 7.5 / 10
    const rings = [0.25, 0.5, 0.75, 1].map((frac) => {
      const ringPoints = axes.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const r = RADIUS_MAX * frac;
        return `${CENTER + r * Math.cos(angle)},${CENTER + r * Math.sin(angle)}`;
      });
      return ringPoints.join(' ');
    });
    return { points, pathD, rings };
  }, [axes]);

  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, fontFamily: FONT.family, marginTop: SPACING.md }}>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: 2 }}>
        Radar do dia
      </div>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.md }}>
        Snapshot do dia mais recente com prontidão calculada — recuperação física/mental, sono e equilíbrio de forma/fadiga (TSB), todos numa escala 0-10. Eixos sem dado são omitidos.
      </div>

      {loading && <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Carregando…</div>}
      {error && <div style={{ fontSize: FONT.size.sm, color: COLORS.risk }}>Erro ao carregar: {error}</div>}
      {!loading && !error && !metrics && (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Ainda não há métricas calculadas para hoje.</div>
      )}
      {!loading && !error && metrics && axes.length < 3 && (
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Dados insuficientes para desenhar o radar (menos de 3 eixos disponíveis).</div>
      )}

      {!loading && !error && metrics && polygon && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.lg }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }}>
            {polygon.rings.map((ring, i) => (
              <polygon key={i} points={ring} fill="none" stroke={COLORS.border} strokeWidth={1} />
            ))}
            {polygon.points.map((p, i) => (
              <line key={i} x1={CENTER} y1={CENTER} x2={p.axisEndX} y2={p.axisEndY} stroke={COLORS.border} strokeWidth={1} />
            ))}
            <path d={polygon.pathD} fill={COLORS.brandPrimary} fillOpacity={0.22} stroke={COLORS.brandPrimary} strokeWidth={2} strokeLinejoin="round" />
            {polygon.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={COLORS.brandPrimary} stroke="#fff" strokeWidth={1.5} />
            ))}
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
            {axes.map((a) => (
              <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', gap: SPACING.md, minWidth: 160 }}>
                <span style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>{a.label}</span>
                <span style={{ fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>{a.value.toFixed(1)} / 10</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
