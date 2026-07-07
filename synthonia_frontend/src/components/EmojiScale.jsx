// components/EmojiScale.jsx
// Componente de escala 1-7 = emoji + legenda dinâmica (decisão de Val, fase 2).
// - Emoji/número grande como alvo de toque (7 posições).
// - SÓ o rótulo do ponto SELECIONADO aparece como legenda de 1 linha abaixo.
// - As 7 frases completas NÃO aparecem todas ao mesmo tempo — ficam disponíveis
//   via long-press (mobile) ou o ícone de ajuda "i" (desktop/acessibilidade),
//   que abre um painel com a lista completa (também é o que leitores de tela
//   devem anunciar via aria-describedby/expanded panel).
//
// Repaginação visual: cor de seleção trocada de `textPrimary` (preto) para
// `brandPrimary` (identidade de marca) — mantém contraste AA com texto branco.
import React, { useRef, useState } from 'react';
import { COLORS, FONT, RADIUS, SPACING, TOUCH_TARGET_MIN } from '../theme';

const LONG_PRESS_MS = 450;

export default function EmojiScale({ labels, value, onChange }) {
  // `value` é o displayPosition selecionado (1-7), não o formulaValue.
  const [helpOpen, setHelpOpen] = useState(false);
  const pressTimer = useRef(null);

  const selected = labels.find((l) => l.displayPosition === value);

  const startPress = () => {
    pressTimer.current = setTimeout(() => setHelpOpen(true), LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  return (
    <div style={{ fontFamily: FONT.family, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 6,
          marginBottom: SPACING.md,
        }}
      >
        {labels.map((l) => {
          const isSelected = l.displayPosition === value;
          return (
            <button
              key={l.displayPosition}
              onClick={() => onChange(l.displayPosition)}
              onMouseDown={startPress}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              aria-pressed={isSelected}
              aria-label={`${l.displayPosition}: ${l.text}`}
              style={{
                flex: 1,
                aspectRatio: '1 / 1',
                minHeight: TOUCH_TARGET_MIN,
                borderRadius: RADIUS.md,
                border: `2px solid ${isSelected ? COLORS.brandPrimary : COLORS.border}`,
                backgroundColor: isSelected ? COLORS.brandPrimary : COLORS.surface,
                color: isSelected ? '#fff' : COLORS.textPrimary,
                fontSize: 22,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                padding: 0,
              }}
            >
              <span aria-hidden="true">{l.emoji}</span>
              <span style={{ fontSize: FONT.size.xs, marginTop: 2 }}>{l.displayPosition}</span>
            </button>
          );
        })}
      </div>

      {/* Legenda de 1 linha do ponto selecionado — nunca mostra as 7 ao mesmo tempo. */}
      <div
        style={{
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACING.sm,
          backgroundColor: COLORS.background,
          borderRadius: RADIUS.sm,
          padding: SPACING.sm,
        }}
      >
        <span
          style={{
            fontSize: FONT.size.sm,
            color: COLORS.textPrimary,
            fontWeight: FONT.weight.medium,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          aria-live="polite"
        >
          {selected ? selected.text : 'Toque em um valor acima'}
        </span>
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Ver todas as opções da escala"
          title="Ver todas as opções (long-press também funciona)"
          style={{
            border: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.surface,
            borderRadius: '50%',
            width: 28,
            height: 28,
            minWidth: 28,
            fontSize: FONT.size.xs,
            fontWeight: FONT.weight.bold,
            color: COLORS.textSecondary,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          i
        </button>
      </div>

      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setHelpOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: COLORS.overlay,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: `${RADIUS.lg}px ${RADIUS.lg}px 0 0`,
              padding: SPACING.lg,
              width: '100%',
              maxWidth: 480,
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontWeight: FONT.weight.bold, marginBottom: SPACING.md, fontSize: FONT.size.md, color: COLORS.textPrimary }}>Todas as opções</div>
            {labels.map((l) => (
              <div
                key={l.displayPosition}
                style={{
                  display: 'flex',
                  gap: SPACING.sm,
                  padding: `${SPACING.sm}px 0`,
                  borderBottom: `1px solid ${COLORS.border}`,
                  alignItems: 'center',
                  backgroundColor: l.displayPosition === value ? COLORS.background : 'transparent',
                }}
              >
                <span style={{ fontSize: 20 }} aria-hidden="true">{l.emoji}</span>
                <span style={{ fontSize: FONT.size.sm, color: COLORS.textPrimary }}>
                  <strong>{l.displayPosition}.</strong> {l.text}
                </span>
              </div>
            ))}
            <button
              onClick={() => setHelpOpen(false)}
              style={{
                marginTop: SPACING.md,
                width: '100%',
                minHeight: TOUCH_TARGET_MIN,
                padding: SPACING.sm,
                borderRadius: RADIUS.pill,
                border: 'none',
                backgroundColor: COLORS.brandPrimary,
                color: '#fff',
                fontWeight: FONT.weight.semibold,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
