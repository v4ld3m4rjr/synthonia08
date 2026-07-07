// Auth.jsx
// Tela real de login/cadastro usando Supabase Auth (email + senha).
// Isso é o que faltava para o app ter "tela de login e dados individualizados":
// cada conta criada aqui vira uma linha em auth.users, isolada por RLS de
// todas as tabelas (profiles, checkins, metricas_diarias etc — ver
// synthonia_backend_schema.md).
import React, { useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from './theme';
import { supabase } from './supabaseClient';

const inputStyle = {
  width: '100%',
  padding: SPACING.md,
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.border}`,
  fontFamily: FONT.family,
  fontSize: FONT.size.md,
  boxSizing: 'border-box',
  marginBottom: SPACING.md,
};

const buttonStyle = (enabled) => ({
  width: '100%',
  padding: SPACING.md,
  borderRadius: RADIUS.pill,
  border: 'none',
  backgroundColor: enabled ? COLORS.textPrimary : COLORS.border,
  color: enabled ? '#fff' : COLORS.textTertiary,
  fontWeight: FONT.weight.semibold,
  fontSize: FONT.size.md,
  cursor: enabled ? 'pointer' : 'default',
  marginTop: SPACING.sm,
});

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // Se o projeto exigir confirmação de e-mail, session vem null aqui.
      if (!data.session) {
        setInfoMessage('Conta criada! Verifique seu e-mail para confirmar antes de entrar (ou, se a confirmação estiver desativada no projeto, já pode fazer login).');
        setMode('login');
        return;
      }
      onAuthenticated?.(data.session);
      return;
    }

    // mode === 'login'
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onAuthenticated?.(data.session);
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
        <h1 style={{ fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, textAlign: 'center', margin: 0 }}>
          SynthonIA
        </h1>
        <p style={{ textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg }}>
          {mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Senha (mínimo 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {error && (
            <div style={{ color: COLORS.risk, fontSize: FONT.size.sm, marginBottom: SPACING.sm }}>{error}</div>
          )}
          {infoMessage && (
            <div style={{ color: COLORS.textSecondary, fontSize: FONT.size.sm, marginBottom: SPACING.sm }}>{infoMessage}</div>
          )}

          <button type="submit" disabled={!canSubmit} style={buttonStyle(canSubmit)}>
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfoMessage(null); }}
          style={{ border: 'none', background: 'none', color: COLORS.textSecondary, marginTop: SPACING.lg, width: '100%', cursor: 'pointer', fontSize: FONT.size.sm }}
        >
          {mode === 'login' ? 'Ainda não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  );
}
