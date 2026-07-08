// components/InfoTooltip.jsx
// Ícone "ⓘ" pequeno e clicável/tocável para os cards do Dashboard (Tarefa D
// do QA: tooltips explicativos). Sem biblioteca externa — é só um botão que
// alterna um popover simples posicionado com `position: absolute`, fechado
// ao clicar fora ou nele de novo. Feito para caber no canto de um card com
// `position: relative` (ver uso em Dashboard.jsx).
import React, { useEffect, useRef, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from '../theme';

export default function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="O que significa esta métrica"
        aria-expanded={open}
        style={{
          width: 18,
          height: 18,
          minWidth: 18,
          borderRadius: '50%',
          border: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.background,
          color: COLORS.textTertiary,
          fontSize: 11,
          fontWeight: FONT.weight.bold,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 22,
            right: 0,
            zIndex: 20,
            width: 200,
            backgroundColor: COLORS.textPrimary,
            color: '#fff',
            borderRadius: RADIUS.sm,
            boxShadow: SHADOW.modal,
            padding: SPACING.sm,
            fontSize: FONT.size.xs,
            fontWeight: FONT.weight.regular,
            lineHeight: 1.4,
            fontFamily: FONT.family,
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
