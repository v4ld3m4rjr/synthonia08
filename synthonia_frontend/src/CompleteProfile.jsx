// CompleteProfile.jsx
// Onboarding real: primeiro login cria a linha em public.profiles (nome +
// papel coach/atleta), exigido pelo RLS (profiles_insert_own) e por toda a
// lógica de vínculo coach-atleta do schema.
import React, { useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from './theme';
import { supabase } from './supabaseClient';

export default function CompleteProfile({ userId, onProfileCreated }) {
  const [nome, setNome] = useState('');
  const [role, setRole] = useState('atleta');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = nome.trim().length >= 2 && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

    const { data, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, role, nome_completo: nome.trim(), timezone })
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
