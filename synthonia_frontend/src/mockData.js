// mockData.js
// Dados mockados/estáticos — substituir por chamadas reais (Supabase) quando o
// Backend expuser os endpoints/queries definitivos. Formato pensado para já
// espelhar o shape provável das tabelas (ver comentários inline).

export const mockAthlete = {
  id: 'athlete_001',
  name: 'Marina Duarte',
  sport: 'Corrida de rua (10k/21k)',
};

// Snapshot do dia atual — o que alimenta a Home quando HÁ check-in hoje.
export const mockTodayCheckin = {
  date: '2026-07-07',
  hasCheckin: true,
  prontidao: 7.8, // 0-10
  sono: 8.2, // 0-10 (score derivado, não confundir com horas de sono)
  exaustaoPct: 35, // %
  reducaoSugeridaPct: 15, // % (0-70)
  treinoDoDia: {
    titulo: 'Rodagem leve + técnica',
    descricao: '8km em ritmo confortável (Z2) + 6x100m de skips/passadas técnicas.',
    duracaoMin: 55,
    tipo: 'Aeróbico leve',
    ajusteAplicado: 'Volume reduzido em 15% em relação ao planejado, por causa da exaustão levemente elevada.',
  },
  explicacaoAutomatica:
    'Boa notícia: sono em dia e dor muscular baixa deram um empurrão na sua prontidão hoje.',
};

// Estado alternativo — usado para demonstrar o CTA "Fazer check-in agora".
export const mockNoCheckinToday = {
  date: '2026-07-07',
  hasCheckin: false,
};

// 12 cards do Dashboard — cada um abre uma view de série temporal com seletor de janela.
export const mockDashboardCards = [
  {
    id: 'recuperacao_fisica',
    title: 'Recuperação física',
    value: 7.6,
    unit: '/10',
    isSemaphore: true,
    description: 'Índice composto de recuperação neuromuscular e de tecidos.',
  },
  {
    id: 'recuperacao_mental',
    title: 'Recuperação mental',
    value: 6.9,
    unit: '/10',
    isSemaphore: true,
    description: 'Índice composto de recuperação cognitiva/emocional (RESTQ).',
  },
  {
    id: 'tempo_sono',
    title: 'Tempo de sono',
    value: 7.4,
    unit: 'h',
    isSemaphore: false,
    description: 'Média de horas dormidas na janela selecionada.',
  },
  {
    id: 'regularidade_sono',
    title: 'Regularidade do sono',
    value: 82,
    unit: '%',
    isSemaphore: false,
    description: 'Consistência do horário de dormir/acordar.',
  },
  {
    id: 'exaustao',
    title: 'Exaustão',
    value: 35,
    unit: '%',
    isSemaphore: false,
    description: 'Percepção agregada de fadiga geral.',
  },
  {
    id: 'trimp',
    title: 'TRIMP',
    value: 312,
    unit: 'u.a.',
    isSemaphore: false,
    description: 'Training Impulse — carga interna de treino.',
  },
  {
    id: 'atl',
    title: 'ATL',
    value: 48.2,
    unit: '',
    isSemaphore: false,
    description: 'Acute Training Load (carga aguda, média móvel 7 dias).',
  },
  {
    id: 'ctl',
    title: 'CTL',
    value: 41.5,
    unit: '',
    isSemaphore: false,
    description: 'Chronic Training Load (carga crônica, média móvel 42 dias).',
  },
  {
    id: 'tsb',
    title: 'TSB',
    value: -6.7,
    unit: '',
    isSemaphore: false,
    description: 'Training Stress Balance (CTL - ATL) — forma/frescor.',
  },
  {
    id: 'monotonia_diaria',
    title: 'Monotonia diária',
    value: 1.8,
    unit: '',
    isSemaphore: false,
    description: 'Variabilidade da carga diária (Foster).',
  },
  {
    id: 'monotonia_semanal',
    title: 'Monotonia semanal',
    value: 1.5,
    unit: '',
    isSemaphore: false,
    description: 'Variabilidade da carga na semana (Foster).',
  },
  {
    id: 'janela_lesao',
    title: 'Janela de lesão',
    value: 4.1,
    unit: '/10',
    isSemaphore: true,
    description: 'Risco estimado com base em monotonia + strain + TSB.',
    hasExtraDot: true, // "Janela de lesão tem dot semafórico extra"
  },
];

// Série temporal mockada e FIXA por card, reaproveitada para todas as janelas
// (7/14/21/28) apenas fatiando o array — é só para demonstrar o seletor
// funcionando em estado React; não é um gerador de série real.
export const mockTimeSeries28d = [
  6.8, 7.0, 6.5, 7.2, 7.8, 6.9, 7.4,
  7.1, 6.7, 7.6, 7.9, 7.3, 6.8, 7.0,
  7.5, 7.7, 6.6, 6.9, 7.2, 7.8, 7.4,
  6.5, 6.9, 7.1, 7.6, 7.8, 7.3, 7.0,
];

export const WINDOW_OPTIONS = [7, 14, 21, 28];

// Calendário mensal mockado — Julho/2026. `status` é null para dias sem check-in
// (renderizados cinza hachurado) e undefined/omitido para dias futuros.
function buildMockCalendarJuly2026() {
  // valores de prontidão (0-10) para os dias 1-31; null = sem check-in.
  const prontidaoPorDia = {
    1: 7.9, 2: 8.1, 3: 6.8, 4: null, 5: 5.9, 6: 7.8, 7: 7.8,
    8: 4.2, 9: 3.1, 10: 6.5, 11: null, 12: 7.0, 13: 8.4, 14: 7.2,
    15: 2.8, 16: 3.9, 17: null, 18: 6.1, 19: 7.5, 20: 7.9, 21: 6.4,
    22: 5.5, 23: null, 24: null, 25: 7.1,
    // 26 em diante: futuro relativo a "hoje" (2026-07-07) — sem dado.
  };

  const days = [];
  for (let day = 1; day <= 31; day += 1) {
    const isFuture = day > 25; // ficção de mock: consideramos "hoje" perto do fim do mês de exemplo
    days.push({
      day,
      isFuture,
      prontidao: isFuture ? null : prontidaoPorDia[day] ?? null,
      hasCheckin: isFuture ? false : prontidaoPorDia[day] != null,
    });
  }
  return days;
}

export const mockCalendarJuly2026 = buildMockCalendarJuly2026();

export const mockDayDetail = (day) => ({
  day,
  prontidao: day.prontidao,
  sono: day.prontidao != null ? Math.min(10, day.prontidao + 0.4) : null,
  exaustaoPct: day.prontidao != null ? Math.round((10 - day.prontidao) * 8) : null,
  treino: day.prontidao != null ? 'Treino intervalado 5x1000m' : null,
});
