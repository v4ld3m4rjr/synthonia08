// components/TimeSeriesExplorer.jsx
// Gráfico pedido explicitamente por Val: eixo X = tempo, eixo Y = variáveis
// escolhidas pelo usuário (múltiplas, sobrepostas). Dados REAIS vindos de
// public.checkins (campos brutos reportados pelo atleta) MESCLADOS por data
// com public.metricas_diarias (métricas calculadas pelo motor real: TRIMP,
// ATL/CTL/TSB, monotonia, janela de lesão, prontidão calculada, recuperação
// física/mental, pontuação de sono, %exaustão, %redução sugerida). RLS
// garante que o usuário só vê os próprios registros em ambas as tabelas.
//
// Nota sobre o caso de 1 único ponto: com poucos check-ins (ex.: só hoje),
// uma polyline de 1 ponto não desenha nada visível — isso é esperado e não é
// bug de dados. Tratamos esse caso mostrando um marcador (círculo) no lugar
// da linha, e a legenda com o valor bruto/calculado mais recente SEMPRE
// aparece, independente de quantos pontos existem.
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from '../theme';
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

  const width = 640;
  const height = 220;
  const padding = 28;

  const chart = useMemo(() => {
    if (rows.length === 0) return null;
    const n = rows.length;
    // Com um único ponto, não há "passo" entre pontos — ancoramos no centro
    // do eixo X pra desenhar um marcador único em vez de dividir por zero.
    const stepX = n > 1 ? (width - padding * 2) / (n - 1) : 0;
    const singlePointX = width / 2;

    const lines = selected.map((key, idx) => {
      const meta = VARIABLES.find((v) => v.key === key);
      if (!meta) return null;

      const points = [];
      rows.forEach((r, i) => {
        const raw = r[key];
        const norm = normalize(raw, meta.min, meta.max);
        if (norm == null) return; // pula NULLs (ex.: métricas calculadas nos primeiros dias)
        const x = n > 1 ? padding + i * stepX : singlePointX;
        const y = height - padding - norm * (height - padding * 2);
        points.push({ x, y });
      });

      // Último valor bruto/calculado NÃO-nulo (percorre de trás pra frente),
      // pra legenda sempre mostrar algo mesmo se o dia mais recente estiver NULL.
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
        points,
        pointsStr: points.map((p) => `${p.x},${p.y}`).join(' '),
        isSinglePoint: points.length === 1,
        lastRaw,
      };
    }).filter(Boolean);

    return { lines, n };
  }, [rows, selected]);

  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, fontFamily: FONT.family }}>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: 2 }}>
        Explorador — tempo × variáveis
      </div>
      <div style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginBottom: SPACING.md }}>
        Eixo X = data do check-in. Eixo Y = variáveis selecionadas abaixo (normalizadas 0–1 para caberem juntas no mesmo gráfico; o valor real de cada uma aparece na legenda). Inclui dados brutos do check-in e métricas calculadas (TRIMP, ATL/CTL/TSB, monotonia, janela de lesão etc.).
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
              l.isSinglePoint ? (
                <circle key={l.key} cx={l.points[0].x} cy={l.points[0].y} r={5} fill={l.color} stroke="#fff" strokeWidth={1.5} />
              ) : (
                <polyline key={l.key} points={l.pointsStr} fill="none" stroke={l.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              )
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
            {rows.length} dia(s) com dado — de {rows[0].data_referencia} a {rows[rows.length - 1].data_referencia}
          </div>
        </div>
      )}
    </div>
  );
}
