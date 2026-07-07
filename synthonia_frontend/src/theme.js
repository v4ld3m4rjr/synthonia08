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

/**
 * Versão invertida de getSemaphoreColor para variáveis 0-10 onde ALTO = RUIM
 * (ex.: Índice Janela de Lesão — é um índice de risco, não de prontidão).
 * Usa os MESMOS cortes oficiais (THRESHOLDS.RISK_MAX / MODERATE_MAX), só que
 * com o mapeamento de cor invertido: valor baixo = seguro, valor alto = risco.
 */
export function getSemaphoreColorInverted(value) {
  if (value == null || Number.isNaN(value)) return COLORS.noCheckinGray;
  if (value <= THRESHOLDS.RISK_MAX) return COLORS.safe;
  if (value <= THRESHOLDS.MODERATE_MAX) return COLORS.moderate;
  return COLORS.risk;
}

/**
 * Cor semafórica para Monotonia (diária ou semanal). Valor bruto tipicamente
 * entre 0.5 e 3.0+; alto = ruim (treino pouco variado, maior risco de lesão/
 * overtraining). Limiar de risco consagrado na literatura: 2.0.
 */
export function getMonotoniaColor(value) {
  if (value == null || Number.isNaN(value)) return COLORS.noCheckinGray;
  if (value < 1.5) return COLORS.safe;
  if (value < 2.0) return COLORS.moderate;
  return COLORS.risk;
}

/**
 * Cor semafórica para TSB (Training Stress Balance). Não é simplesmente
 * "alto = bom" nem "alto = ruim" — segue a tabela de interpretação da
 * literatura de carga de treino:
 * - < -30: risco alto (fadiga não dissipada / overreaching não funcional)
 * - -30 a -10: fadiga funcional acumulada (moderado)
 * - -10 a 25: zona de treino produtivo normal / frescor ótimo (seguro)
 * - > 25: possível destreino por falta de estímulo (moderado)
 */
export function getTsbColor(value) {
  if (value == null || Number.isNaN(value)) return COLORS.noCheckinGray;
  if (value < -30) return COLORS.risk;
  if (value < -10) return COLORS.moderate;
  if (value <= 25) return COLORS.safe;
  return COLORS.moderate;
}

/**
 * Cor semafórica invertida para variáveis percentuais 0-max onde ALTO = RUIM
 * (ex.: %Exaustão, %Redução sugerida). Reescala o valor para a base 0-10 dos
 * cortes oficiais (THRESHOLDS) e reusa a mesma lógica de getSemaphoreColorInverted.
 * Ex.: max=100 (%Exaustão) -> <=34 safe, <=64 moderate, >64 risk.
 *      max=70 (%Redução sugerida) -> <=23.8 safe, <=44.8 moderate, >44.8 risk.
 */
export function getPercentColorInverted(value, max = 100) {
  if (value == null || Number.isNaN(value)) return COLORS.noCheckinGray;
  const rescaled = (value / max) * 10;
  return getSemaphoreColorInverted(rescaled);
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
  getSemaphoreColorInverted,
  getMonotoniaColor,
  getTsbColor,
  getPercentColorInverted,
  isAtLeast,
};

export default theme;
