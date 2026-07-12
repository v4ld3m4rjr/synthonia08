// Auth.jsx
// Tela real de login/cadastro usando Supabase Auth (email + senha).
//
// MUDANÇA (decisão do Val, para destravar cadastro sem depender de e-mail
// funcionando/SMTP/DNS): em vez de confiar na confirmação por e-mail do
// Supabase (que exige SMTP configurado e vinha travando cadastros reais com
// "email rate limit exceeded" / falhas de domínio), o cadastro agora pede
// CONFIRMAÇÃO DE E-MAIL E DE SENHA digitando duas vezes cada um — validação
// no próprio formulário, sem depender de nenhum e-mail ser enviado. Isso
// exige que "Confirm email" esteja DESLIGADO nas configurações de
// Authentication do projeto Supabase (senão o Supabase ainda vai tentar
// mandar e-mail de confirmação por baixo dos panos e a conta ficaria pendente
// mesmo com os campos batendo aqui). Ver nota em handleSubmit.
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

const inputErrorStyle = {
  ...inputStyle,
  border: `1px solid ${COLORS.risk}`,
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

const fieldLabelStyle = {
  fontSize: FONT.size.xs,
  color: COLORS.textTertiary,
  fontWeight: FONT.weight.semibold,
  marginBottom: 4,
  display: 'block',
};

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
  const [emailConfirm, setEmailConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const emailsMatch = mode === 'login' || (emailConfirm.length > 0 && email.trim().toLowerCase() === emailConfirm.trim().toLowerCase());
  const passwordsMatch = mode === 'login' || (passwordConfirm.length > 0 && password === passwordConfirm);
  const emailMismatchVisible = mode === 'signup' && emailConfirm.length > 0 && !emailsMatch;
  const passwordMismatchVisible = mode === 'signup' && passwordConfirm.length > 0 && !passwordsMatch;

  const canSubmit =
    email.trim().length > 3 &&
    password.length >= 6 &&
    !loading &&
    (mode === 'login' || (emailsMatch && passwordsMatch));

  const resetConfirmFields = () => {
    setEmailConfirm('');
    setPasswordConfirm('');
  };

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
      // Com "Confirm email" desligado no projeto Supabase, data.session já
      // vem preenchida aqui e a pessoa entra direto — não depende de nenhum
      // e-mail ser enviado. Se por acaso a confirmação ainda estiver ligada
      // no projeto (configuração não aplicada), session vem null; mantemos um
      // aviso de fallback nesse caso para não deixar a pessoa sem feedback.
      if (!data.session) {
        setInfoMessage('Conta criada! Se pedir confirmação por e-mail, verifique sua caixa de entrada antes de entrar — ou tente entrar direto, pode já estar liberado.');
        setMode('login');
        resetConfirmFields();
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
            <div>
              {mode === 'signup' && <label style={fieldLabelStyle}>E-mail</label>}
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="email"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label style={fieldLabelStyle}>Confirme o e-mail</label>
                <input
                  type="email"
                  placeholder="digite o e-mail de novo"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  style={emailMismatchVisible ? inputErrorStyle : inputStyle}
                  autoComplete="email"
                />
                {emailMismatchVisible && (
                  <div style={{ color: COLORS.risk, fontSize: FONT.size.xs, marginTop: -8, marginBottom: SPACING.sm }}>
                    Os e-mails não coincidem.
                  </div>
                )}
              </div>
            )}

            <div>
              {mode === 'signup' && <label style={fieldLabelStyle}>Senha</label>}
              <input
                type="password"
                placeholder="Senha (mínimo 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label style={fieldLabelStyle}>Confirme a senha</label>
                <input
                  type="password"
                  placeholder="digite a senha de novo"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  style={passwordMismatchVisible ? inputErrorStyle : inputStyle}
                  autoComplete="new-password"
                />
                {passwordMismatchVisible && (
                  <div style={{ color: COLORS.risk, fontSize: FONT.size.xs, marginTop: -8, marginBottom: SPACING.sm }}>
                    As senhas não coincidem.
                  </div>
                )}
              </div>
            )}

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
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setInfoMessage(null);
              resetConfirmFields();
            }}
            style={{ border: 'none', background: 'none', color: COLORS.brandBlue, marginTop: SPACING.lg, width: '100%', minHeight: TOUCH_TARGET_MIN, cursor: 'pointer', fontSize: FONT.size.sm, fontWeight: FONT.weight.medium }}
          >
            {mode === 'login' ? 'Ainda não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
