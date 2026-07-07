// theme.js
// SynthonIA — Design System central (cores semafóricas, breakpoints, tipografia, espaçamento).
// Escolha técnica: constantes JS puras (não styled-components) consumidas via `style` inline
// nos componentes. Justificativa no README/relatório final entregue ao QA:
// - Zero dependência extra (sem instalar styled-components/emotion) — reduz fricção nesta fase
//   de scaffold sem build configurado.
// - `theme.js` funciona como single source of truth também para RN/mobile futuro (mesmas
//   constantes podem alimentar um StyleSheet.create em vez de CSS).
// - Trade-off assumido: sem pseudo-classes (:hover) nem media queries reais via CSS-in-JS puro;
//   usamos `useState` para estados de hover/foco onde necessário e helpers de layout responsivo
//   simples (ver `mq` helper). Se o projeto crescer, migrar para styled-components ou CSS Modules
//   é direto porque todas as cores/tokens já estão centralizadas aqui.

export const COLORS = {
  // Cores semafóricas — SEMPRE com o mesmo significado, independente da variável exibida.
  // Verde = seguro / bom. Âmbar = moderado / atenção. Vermelho = cautela / risco.
  safe: '#3DB56A',      // verde
  moderate: '#F5A623',  // âmbar
  risk: '#E5484D',       // vermelho

  // Cinza para dias sem check-in no calendário (NUNCA usar cor semafórica aqui).
  noCheckinGray: '#E0E0E0',
  noCheckinGrayHatchLine: '#C4C4C4', // linha da hachura

  // Dia futuro no calendário — cinza claro, sem número/estado.
  futureGray: '#F4F4F5',

  // Neutros / base UI.
  background: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#EAEAEA',
  textPrimary: '#1A1A1E',
  textSecondary: '#6B6B70',
  textTertiary: '#9B9BA1',
  overlay: 'rgba(20, 20, 24, 0.55)',

  // Gradiente do slider contínuo de prontidão percebida (vermelho -> âmbar -> verde).
  gradientReadiness: 'linear-gradient(90deg, #E5484D 0%, #F5A623 50%, #3DB56A 100%)',
};

// Cortes numéricos oficiais — usados tanto para Prontidão quanto para Janela de risco.
// Mesmos 3 cortes em toda a base 0.0–10.0.
export const THRESHOLDS = {
  RISK_MAX: 3.4,      // 0.0–3.4 = vermelho (cautela)
  MODERATE_MAX: 6.4,  // 3.5–6.4 = âmbar (moderado)
  // 6.5–10.0 = verde (seguro)
};

/**
 * Retorna a cor semafórica correta para um valor 0-10, seguindo os cortes oficiais.
 * Usar para Prontidão, Janela de lesão, e qualquer variável futura na mesma escala.
 */
export function getSemaphoreColor(value) {
  if (value == null || Number.isNaN(value)) return COLORS.noCheckinGray;
  if (value <= THRESHOLDS.RISK_MAX) return COLORS.risk;
  if (value <= THRESHOLDS.MODERATE_MAX) return COLORS.moderate;
  return COLORS.safe;
}

export function getSemaphoreLabel(value) {
  if (value == null || Number.isNaN(value)) return 'Sem check-in';
  if (value <= THRESHOLDS.RISK_MAX) return 'Cautela';
  if (value <= THRESHOLDS.MODERATE_MAX) return 'Moderado';
  return 'Seguro';
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const FONT = {
  family: "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 40,
    display: 56,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const SHADOW = {
  card: '0 2px 8px rgba(20, 20, 24, 0.06)',
  cardHover: '0 4px 16px rgba(20, 20, 24, 0.10)',
  modal: '0 12px 40px rgba(20, 20, 24, 0.25)',
};

// Breakpoints (mobile-first). App é primariamente mobile, mas Dashboard/Calendar
// devem funcionar em tablet/web também (treinador acompanhando múltiplos atletas).
export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
};

/**
 * Helper simples de layout responsivo sem depender de CSS media queries reais
 * (já que usamos style inline). Consumido com useWindowWidth() nos componentes.
 * Ex.: const isDesktop = useMq(BREAKPOINTS.tablet);
 */
export function isAtLeast(width, breakpoint) {
  return width >= breakpoint;
}

const theme = {
  COLORS,
  THRESHOLDS,
  SPACING,
  RADIUS,
  FONT,
  SHADOW,
  BREAKPOINTS,
  getSemaphoreColor,
  getSemaphoreLabel,
  isAtLeast,
};

export default theme;
