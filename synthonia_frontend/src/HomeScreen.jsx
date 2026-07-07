// HomeScreen.jsx
// Home do atleta — AGORA COM DADOS REAIS do Supabase (não mais mockados).
// Busca o check-in de HOJE do usuário autenticado (isolado por RLS: cada
// atleta só vê o próprio). Como o motor de cálculo de métricas (Prontidão,
// ATL/CTL/TSB etc.) ainda não foi implementado como job/função definitiva
// (ver pendência #9 do QA final), esta tela mostra os DADOS BRUTOS que o
// atleta reportou no check-in, de forma honesta, em vez de inventar um
// score calculado que não existe de verdade ainda.
import React, { useEffect, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from './theme';
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
        style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.semibold, color: '#fff', backgroundColor: COLORS.textPrimary, border: 'none', borderRadius: RADIUS.pill, padding: `${SPACING.sm}px ${SPACING.xl}px`, cursor: 'pointer' }}
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

const SONO_LABELS = ['', 'Muito ruim', 'Ruim', 'Meio fraca', 'Regular', 'Boa', 'Muito boa', 'Excelente'];
const FADIGA_LABELS = ['', 'Exaustão total', 'Muito alta', 'Alta', 'Moderada', 'Leve', 'Muito leve', 'Nenhuma'];

export default function HomeScreen({ userId, profileName, onStartCheckin, onSignOut }) {
  const [loading, setLoading] = useState(true);
  const [checkin, setCheckin] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadToday() {
      setLoading(true);
      setError(null);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', padding: SPACING.md, fontFamily: FONT.family }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
        <div>
          <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>Olá,</div>
          <div style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>
            {profileName || '...'}
          </div>
        </div>
        <button
          onClick={onSignOut}
          style={{ fontSize: FONT.size.xs, color: COLORS.textSecondary, backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.pill, padding: '6px 12px', cursor: 'pointer' }}
        >
          Sair
        </button>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
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
