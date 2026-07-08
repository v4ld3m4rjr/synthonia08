// HomeScreen.jsx
// Home do atleta — AGORA COM DADOS REAIS do Supabase (não mais mockados).
// Busca o check-in de HOJE do usuário autenticado (isolado por RLS: cada
// atleta só vê o próprio). Como o motor de cálculo de métricas (Prontidão,
// ATL/CTL/TSB etc.) ainda não foi implementado como job/função definitiva
// (ver pendência #9 do QA final), esta tela mostra os DADOS BRUTOS que o
// atleta reportou no check-in, de forma honesta, em vez de inventar um
// score calculado que não existe de verdade ainda.
//
// Alertas no topo (acima do card de check-in de hoje):
// - alerta_bemestar: variáveis subjetivas (sono/fadiga/estresse/humor/dor/HRV/FC
//   repouso) fora do padrão pessoal, OU tendência de piora de 3 dias. Vem com
//   texto pronto em `alerta_bemestar_motivo`. Cor âmbar/moderado — é um aviso de
//   "preste atenção", não uma emergência.
// - alerta_alto_risco: alerta de CARGA DE TREINO (monotonia+volume+TSB), já
//   existente na tabela mas sem nenhum tratamento visual até agora. Só boolean,
//   sem motivo pronto no banco — usamos texto genérico. Cor vermelha (risco),
//   visualmente distinto do alerta de bem-estar (ícone, cor e texto diferentes).
// Os dois alertas são INDEPENDENTES entre si e podem aparecer juntos.
//
// Repaginação visual: cores semafóricas dos dois banners de alerta abaixo
// NÃO foram tocadas (sinalização funcional de saúde). O restante do chrome
// (header, CTA de check-in, cards) segue o novo sistema de marca — botão
// principal usa `brandPrimary`, saudação com tipografia de título revisada.
//
// Streak de check-ins (Tarefa C do QA): badge "🔥 N dias seguidos" perto da
// saudação, calculado a partir de checkins.data_referencia (dias consecutivos
// terminando hoje ou ontem — se hoje ainda não tem check-in, a contagem
// começa a partir de ontem, sem penalizar o atleta por ainda não ter feito o
// check-in de hoje).
import React, { useEffect, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING, TOUCH_TARGET_MIN } from './theme';
import ProgressBar from './components/ProgressBar';
import Dashboard from './Dashboard';
import { supabase } from './supabaseClient';

function SectionCard({ children, style }) {
  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, ...style }}>
      {children}
    </div>
  );
}

function ReadinessCheckinCTA({ onStartCheckin }) {
  return (
    <SectionCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.md, textAlign: 'center', border: `1px dashed ${COLORS.border}` }}>
      <div style={{ fontSize: 40 }} aria-hidden="true">📝</div>
      <div>
        <div style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.textPrimary }}>
          Ainda não rolou seu check-in de hoje
        </div>
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginTop: 6, maxWidth: 320 }}>
          Sem check-in, sem prontidão calculada — e sem prontidão, o treino de hoje fica no escuro.
        </div>
      </div>
      <button
        onClick={onStartCheckin}
        style={{
          fontSize: FONT.size.md,
          fontWeight: FONT.weight.semibold,
          color: '#fff',
          backgroundColor: COLORS.brandPrimary,
          border: 'none',
          borderRadius: RADIUS.pill,
          padding: `${SPACING.sm}px ${SPACING.xl}px`,
          minHeight: TOUCH_TARGET_MIN,
          cursor: 'pointer',
          boxShadow: SHADOW.brandGlow,
        }}
      >
        Fazer check-in (1 min)
      </button>
    </SectionCard>
  );
}

function MetricRow({ label, value, unit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: FONT.size.md, color: COLORS.textSecondary }}>{label}</span>
      <span style={{ fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>
        {value}
        <span style={{ fontSize: FONT.size.sm, fontWeight: FONT.weight.regular, marginLeft: 2 }}>{unit}</span>
      </span>
    </div>
  );
}

// Banner de alerta de BEM-ESTAR (variáveis subjetivas fora do padrão pessoal
// ou em tendência de piora). Âmbar/moderado — "preste atenção", não é
// emergência médica. Vem SEMPRE com texto pronto (`alerta_bemestar_motivo`).
// Cores semafóricas INTOCADAS — sinalização funcional, fora de escopo da
// repaginação visual.
function BemEstarAlertBanner({ motivo }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        backgroundColor: '#FFF7E8',
        border: `1px solid ${COLORS.moderate}`,
        borderLeft: `5px solid ${COLORS.moderate}`,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
      }}
    >
      <div style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">⚠️</div>
      <div>
        <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.semibold, color: COLORS.textPrimary }}>
          Atenção ao seu bem-estar
        </div>
        {motivo && (
          <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginTop: 4 }}>
            {motivo}
          </div>
        )}
      </div>
    </div>
  );
}

// Banner de alerta de ALTO RISCO DE CARGA DE TREINO (monotonia+volume+TSB).
// Vermelho/risco — diferente em cor, ícone e posição do alerta de bem-estar,
// já que representa um problema diferente (carga de treino, não subjetivo).
// Não tem texto de motivo pronto no banco (só o boolean), então usamos uma
// mensagem genérica. Cores semafóricas INTOCADAS.
function AltoRiscoCargaAlertBanner() {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        backgroundColor: '#FDECEC',
        border: `1px solid ${COLORS.risk}`,
        borderLeft: `5px solid ${COLORS.risk}`,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
      }}
    >
      <div style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">🚨</div>
      <div>
        <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.semibold, color: COLORS.textPrimary }}>
          Carga de treino em zona de risco
        </div>
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginTop: 4 }}>
          Carga de treino em zona de risco — considere reduzir hoje.
        </div>
      </div>
    </div>
  );
}

// Badge de streak de check-ins ("🔥 N dias seguidos"). Discreto — só um chip
// pequeno perto da saudação, sem chamar atenção demais (pedido explícito:
// "não precisa ser chamativo, só visível"). Não renderiza nada se streak < 1
// (evita "🔥 0 dias seguidos", que soa mal e não agrega).
function StreakBadge({ streak }) {
  if (!streak || streak < 1) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        padding: '3px 10px',
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.background,
        border: `1px solid ${COLORS.border}`,
        fontSize: FONT.size.xs,
        fontWeight: FONT.weight.semibold,
        color: COLORS.textSecondary,
      }}
    >
      <span aria-hidden="true">🔥</span>
      {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}
    </div>
  );
}

const SONO_LABELS = ['', 'Muito ruim', 'Ruim', 'Meio fraca', 'Regular', 'Boa', 'Muito boa', 'Excelente'];
const FADIGA_LABELS = ['', 'Exaustão total', 'Muito alta', 'Alta', 'Moderada', 'Leve', 'Muito leve', 'Nenhuma'];

function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isoDateMinusDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Calcula o streak de dias CONSECUTIVOS de check-in, terminando hoje ou
 * ontem: se o atleta já fez check-in hoje, a contagem começa em hoje; senão,
 * começa em ontem (não penaliza quem simplesmente ainda não fez o check-in
 * de hoje). A partir daí, cada dia anterior sem check-in interrompe a
 * contagem. `dates` é um array (ou Set-like) de strings "YYYY-MM-DD".
 */
function computeStreak(dateStrings) {
  const dateSet = new Set(dateStrings);
  const today = todayIsoDate();
  let cursor = dateSet.has(today) ? today : isoDateMinusDays(today, 1);
  let streak = 0;
  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = isoDateMinusDays(cursor, 1);
  }
  return streak;
}

export default function HomeScreen({ userId, profileName, onStartCheckin, onSignOut }) {
  const [loading, setLoading] = useState(true);
  const [checkin, setCheckin] = useState(null);
  const [error, setError] = useState(null);
  const [alertMetrics, setAlertMetrics] = useState(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadToday() {
      setLoading(true);
      setError(null);
      const today = todayIsoDate();
      const { data, error: fetchError } = await supabase
        .from('checkins')
        .select('*')
        .eq('atleta_id', userId)
        .eq('data_referencia', today)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setCheckin(data);
      }
      setLoading(false);
    }
    loadToday();
    return () => { cancelled = true; };
  }, [userId]);

  // Alertas (bem-estar + alto risco de carga): busca o registro mais recente
  // de metricas_diarias. Se não houver nenhuma linha ainda (histórico muito
  // novo), simplesmente não mostra nenhum banner (sem erro visível ao usuário).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadAlerts() {
      const { data, error: fetchError } = await supabase
        .from('metricas_diarias')
        .select('alerta_bemestar, alerta_bemestar_motivo, alerta_alto_risco, data_referencia')
        .eq('atleta_id', userId)
        .order('data_referencia', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError) {
        // Falha silenciosa: alertas são um plus, não devem quebrar a Home.
        setAlertMetrics(null);
        return;
      }
      setAlertMetrics(data || null);
    }
    loadAlerts();
    return () => { cancelled = true; };
  }, [userId]);

  // Streak de check-ins (Tarefa C): busca todas as datas de check-in do
  // atleta e calcula dias consecutivos terminando hoje ou ontem. Falha
  // silenciosa igual aos alertas — é um plus, não deve quebrar a Home.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadStreak() {
      const { data, error: fetchError } = await supabase
        .from('checkins')
        .select('data_referencia')
        .eq('atleta_id', userId)
        .order('data_referencia', { ascending: false });
      if (cancelled) return;
      if (fetchError) {
        setStreak(0);
        return;
      }
      const dates = (data || []).map((r) => r.data_referencia);
      setStreak(computeStreak(dates));
    }
    loadStreak();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', padding: SPACING.md, fontFamily: FONT.family }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md }}>
        <div>
          <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Olá,</div>
          <div style={{ fontSize: FONT.size.title, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, lineHeight: 1.2 }}>
            {profileName || '...'}
          </div>
          <StreakBadge streak={streak} />
        </div>
        <button
          onClick={onSignOut}
          style={{
            fontSize: FONT.size.xs,
            color: COLORS.textSecondary,
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.pill,
            padding: '10px 16px',
            minHeight: TOUCH_TARGET_MIN,
            cursor: 'pointer',
            fontWeight: FONT.weight.medium,
          }}
        >
          Sair
        </button>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
        {alertMetrics?.alerta_alto_risco && <AltoRiscoCargaAlertBanner />}
        {alertMetrics?.alerta_bemestar && <BemEstarAlertBanner motivo={alertMetrics.alerta_bemestar_motivo} />}

        {error && (
          <SectionCard style={{ color: COLORS.risk }}>Não foi possível carregar seu check-in de hoje: {error}</SectionCard>
        )}

        {loading ? (
          <SectionCard>Carregando…</SectionCard>
        ) : !checkin ? (
          <ReadinessCheckinCTA onStartCheckin={onStartCheckin} />
        ) : (
          <>
            <SectionCard>
              <div style={{ fontSize: FONT.size.xs, textTransform: 'uppercase', letterSpacing: 0.6, color: COLORS.textTertiary, fontWeight: FONT.weight.semibold, marginBottom: SPACING.sm }}>
                Seu check-in de hoje
              </div>
              <MetricRow label="Prontidão percebida (PRS)" value={Number(checkin.prontidao_percebida).toFixed(1)} unit="/ 10" />
              <div style={{ height: SPACING.sm }} />
              <MetricRow label="Sono" value={SONO_LABELS[checkin.qualidade_sono]} unit="" />
              <div style={{ height: SPACING.sm }} />
              <MetricRow label="Fadiga" value={FADIGA_LABELS[checkin.fadiga_geral]} unit="" />
            </SectionCard>

            <SectionCard style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>
              Prontidão, ATL/CTL/TSB e demais métricas calculadas ainda dependem do motor de cálculo (não implementado nesta fase — ver pendência do QA final). Por ora, esta tela mostra exatamente o que você reportou no check-in.
            </SectionCard>

            <SectionCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                <span style={{ fontSize: FONT.size.md, color: COLORS.textSecondary }}>Duração do sono</span>
                <span style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>{checkin.duracao_sono_horas}h</span>
              </div>
              <ProgressBar value={Math.min(checkin.duracao_sono_horas, 10)} max={10} color={COLORS.safe} />
            </SectionCard>
          </>
        )}

        <Dashboard embedded userId={userId} />
      </div>
    </div>
  );
}
