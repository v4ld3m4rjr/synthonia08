// Auth.jsx
// Tela real de login/cadastro usando Supabase Auth (email + senha).
// Isso é o que faltava para o app ter "tela de login e dados individualizados":
// cada conta criada aqui vira uma linha em auth.users, isolada por RLS de
// todas as tabelas (profiles, checkins, metricas_diarias etc — ver
// synthonia_backend_schema.md).
//
// Repaginação visual: faixa superior com o gradiente de marca (identidade
// SynthonIA — quente->frio, ver theme.js) por trás do wordmark, dando
// personalidade forte já na primeira tela sem exigir imagens/assets novos.
import React, { useState } from 'react';
import { BRAND_GRADIENT_CSS, COLORS, FONT, RADIUS, SHADOW, SPACING, TOUCH_TARGET_MIN } from './theme';
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
  minHeight: TOUCH_TARGET_MIN,
};

const buttonStyle = (enabled) => ({
  width: '100%',
  minHeight: TOUCH_TARGET_MIN,
  padding: SPACING.md,
  borderRadius: RADIUS.pill,
  border: 'none',
  backgroundColor: enabled ? COLORS.brandPrimary : COLORS.border,
  color: enabled ? '#fff' : COLORS.textTertiary,
  fontWeight: FONT.weight.semibold,
  fontSize: FONT.size.md,
  cursor: enabled ? 'pointer' : 'default',
  marginTop: SPACING.sm,
  boxShadow: enabled ? SHADOW.brandGlow : 'none',
  transition: 'background-color 0.15s ease',
});

// AuthError às vezes chega sem um `.message` utilizável (ex: erro 500 do
// GoTrue com corpo fora do formato esperado pelo supabase-js) — nesses casos
// o valor podia acabar sendo renderizado como "{}" na tela. Essa função
// sempre devolve um texto legível, nunca o objeto bruto.
function extractAuthErrorMessage(err) {
  if (!err) return 'Não foi possível completar a ação. Tente novamente.';
  if (typeof err.message === 'string' && err.message.trim().length > 0 && err.message.trim() !== '{}') {
    return err.message;
  }
  if (typeof err.error_description === 'string' && err.error_description.trim().length > 0) {
    return err.error_description;
  }
  if (typeof err.status === 'number') {
    return `Não foi possível completar a ação agora (erro ${err.status}). Tente novamente em instantes.`;
  }
  return 'Não foi possível completar a ação. Tente novamente em instantes.';
}

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
        setError(extractAuthErrorMessage(signUpError));
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
      setError(extractAuthErrorMessage(signInError));
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
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: BRAND_GRADIENT_CSS,
            padding: `${SPACING.xl}px ${SPACING.xl}px ${SPACING.lg}px`,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: FONT.size.xxl,
              fontWeight: FONT.weight.extrabold,
              color: '#fff',
              textAlign: 'center',
              margin: 0,
              letterSpacing: -0.5,
              textShadow: '0 2px 10px rgba(0,0,0,0.18)',
            }}
          >
            SynthonIA
          </h1>
          <p
            style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.92)',
              marginTop: SPACING.xs,
              marginBottom: 0,
              fontSize: FONT.size.sm,
              fontWeight: FONT.weight.medium,
            }}
          >
            Prontidão fisiológica, todos os dias
          </p>
        </div>

        <div style={{ padding: SPACING.xl }}>
          <p style={{ textAlign: 'center', color: COLORS.textSecondary, marginTop: 0, marginBottom: SPACING.lg, fontSize: FONT.size.md, fontWeight: FONT.weight.medium }}>
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
            style={{ border: 'none', background: 'none', color: COLORS.brandBlue, marginTop: SPACING.lg, width: '100%', minHeight: TOUCH_TARGET_MIN, cursor: 'pointer', fontSize: FONT.size.sm, fontWeight: FONT.weight.medium }}
          >
            {mode === 'login' ? 'Ainda não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
