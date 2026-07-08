// components/chartUtils.js
// Helpers de desenho SVG compartilhados entre os gráficos do Dashboard
// (TimeSeriesExplorer, PmcChart, PrsVsCalculatedChart etc.), extraídos do
// TimeSeriesExplorer.jsx para evitar duplicar a mesma matemática de curva em
// cada novo componente. Mantém exatamente o mesmo comportamento/assinatura
// que já existia lá (mesma tensão default, mesma regra de segmentação por
// NULLs) — só mudou de arquivo. TimeSeriesExplorer.jsx continua com sua
// própria cópia local intocada (menor risco do que refatorar um arquivo já
// em produção só para importar daqui).

// Formata "2026-07-08" -> "08/07" (dia/mês compacto) sem depender de Date
// (evita bugs de timezone quando a string já vem como data pura).
export function formatDateShort(isoDate) {
  if (!isoDate) return '';
  const parts = String(isoDate).split('-');
  if (parts.length < 3) return isoDate;
  const [, mm, dd] = parts;
  return `${dd}/${mm}`;
}

// Formata número bruto pra exibição compacta: inteiros sem casas decimais,
// fracionários com 1 casa.
export function formatValue(value) {
  if (value == null) return '';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

// Gera um path SVG suave (cardinal spline com tensão configurável, convertida
// para curvas de Bézier cúbicas) a partir de uma lista de pontos {x, y}.
// Ver TimeSeriesExplorer.jsx para a explicação completa da técnica.
export function catmullRomPath(points, tension = 0.5) {
  if (points.length === 0) return '';
  if (points.length === 1) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }
  const d = [`M ${points[0].x},${points[0].y}`];
  const factor = tension / 2;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) * factor;
    const cp1y = p1.y + (p2.y - p0.y) * factor;
    const cp2x = p2.x - (p3.x - p1.x) * factor;
    const cp2y = p2.y - (p3.y - p1.y) * factor;

    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return d.join(' ');
}

// Quebra uma lista de pontos (ordenada no tempo, podendo ter "buracos" onde o
// dado é NULL) em segmentos contíguos de índices de linha consecutivos, para
// a curva nunca interpolar por cima de um dia sem dado.
export function buildSegments(points) {
  const segments = [];
  let current = [];
  let lastRowIndex = null;
  for (const p of points) {
    if (lastRowIndex != null && p.rowIndex !== lastRowIndex + 1) {
      if (current.length > 0) segments.push(current);
      current = [];
    }
    current.push(p);
    lastRowIndex = p.rowIndex;
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

export function normalize(value, min, max) {
  if (value == null || Number.isNaN(value)) return null;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min || 1);
}

export function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}
