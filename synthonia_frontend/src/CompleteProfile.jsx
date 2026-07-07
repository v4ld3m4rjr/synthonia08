// CompleteProfile.jsx
// Onboarding real: primeiro login cria a linha em public.profiles (nome +
// papel coach/atleta), exigido pelo RLS (profiles_insert_own) e por toda a
// lógica de vínculo coach-atleta do schema.
//
// Quando o papel escolhido é "atleta", também coletamos `nivel_atleta`
// (iniciante/intermediario/avancado) — usado pelo motor de cálculo para
// calibrar as métricas de carga de treino (TRIMP/ATL/CTL/monotonia) nas
// primeiras semanas, antes de haver histórico suficiente do próprio atleta.
// Coach não treina, então esse campo não se aplica e fica null.
import React, { useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from './theme';
import { supabase } from './supabaseClient';

const NIVEL_OPTIONS = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];

export default function CompleteProfile({ userId, onProfileCreated }) {
  const [nome, setNome] = useState('');
  const [role, setRole] = useState('atleta');
  const [nivelAtleta, setNivelAtleta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAtleta = role === 'atleta';
  const canSubmit = nome.trim().length >= 2 && !loading && (!isAtleta || !!nivelAtleta);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

    const { data, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        role,
        nome_completo: nome.trim(),
        timezone,
        nivel_atleta: isAtleta ? nivelAtleta : null,
      })
      .select()
      .single();

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onProfileCreated?.(data);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: COLORS.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.lg,
        fontFamily: FONT.family,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          backgroundColor: COLORS.surface,
          borderRadius: RADIUS.lg,
          boxShadow: SHADOW.card,
          padding: SPACING.xl,
        }}
      >
        <h2 style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, margin: 0 }}>
          Antes de começar
        </h2>
        <p style={{ color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg }}>
          Como podemos te chamar, e você é coach ou atleta?
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={{
              width: '100%',
              padding: SPACING.md,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
              fontFamily: FONT.family,
              fontSize: FONT.size.md,
              boxSizing: 'border-box',
              marginBottom: SPACING.md,
            }}
          />

          <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: SPACING.lg }}>
            {['atleta', 'coach'].map((r) => {
              const selected = role === r;
              return (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1,
                    padding: SPACING.md,
                    borderRadius: RADIUS.md,
                    border: `2px solid ${selected ? COLORS.textPrimary : COLORS.border}`,
                    backgroundColor: selected ? COLORS.textPrimary : COLORS.surface,
                    color: selected ? '#fff' : COLORS.textPrimary,
                    fontWeight: FONT.weight.semibold,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>

          {isAtleta && (
            <div style={{ marginBottom: SPACING.lg }}>
              <label style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, display: 'block', marginBottom: SPACING.xs }}>
                Qual seu nível como atleta?
              </label>
              <div style={{ display: 'flex', gap: SPACING.sm }}>
                {NIVEL_OPTIONS.map((opt) => {
                  const selected = nivelAtleta === opt.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setNivelAtleta(opt.value)}
                      style={{
                        flex: 1,
                        padding: `${SPACING.sm}px ${SPACING.xs}px`,
                        borderRadius: RADIUS.md,
                        border: `2px solid ${selected ? COLORS.textPrimary : COLORS.border}`,
                        backgroundColor: selected ? COLORS.textPrimary : COLORS.surface,
                        color: selected ? '#fff' : COLORS.textPrimary,
                        fontWeight: FONT.weight.semibold,
                        fontSize: FONT.size.sm,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, marginTop: SPACING.xs, marginBottom: 0 }}>
                Usado pra calibrar as métricas de carga de treino nas primeiras semanas, antes de
                termos histórico suficiente dos seus check-ins.
              </p>
            </div>
          )}

          {error && (
            <div style={{ color: COLORS.risk, fontSize: FONT.size.sm, marginBottom: SPACING.sm }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: SPACING.md,
              borderRadius: RADIUS.pill,
              border: 'none',
              backgroundColor: canSubmit ? COLORS.textPrimary : COLORS.border,
              color: canSubmit ? '#fff' : COLORS.textTertiary,
              fontWeight: FONT.weight.semibold,
              fontSize: FONT.size.md,
              cursor: canSubmit ? 'pointer' : 'default',
            }}
          >
            {loading ? 'Aguarde…' : 'Começar'}
          </button>
        </form>
      </div>
    </div>
  );
}
