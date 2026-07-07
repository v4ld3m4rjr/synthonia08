# Especificação de Design — SynthonIA (Prontidão Fisiológica)
## Agente: UX/UI (Designer de Produto) — Stage 3/8

---

## 0. Premissas de design que orientam tudo abaixo

- **Mobile-first, uso em <30s de olhada.** O atleta abre o app antes do treino, muitas vezes com o celular na mão na academia. Hierarquia visual precisa comunicar "posso treinar hoje?" em menos de 2 segundos, sem ler texto.
- **Cor é o canal primário de comunicação de risco**, tipografia/tamanho é o canal primário de hierarquia de importância. Os dois sistemas não competem: cor = status, tamanho = prioridade.
- **Consistência de paleta semafórica entre Prontidão e Janela de Risco de Lesão** é mandato explícito do Produto/Ciência do Esporte — mesmo verde/âmbar/vermelho, mesmos princípios de corte, para que o usuário aprenda o código de cores uma vez e o reaproveite em toda a interface.
- Todas as especificações de tamanho são **relativas** (unidades `rem`/proporção), a implementação de pixels fica com Frontend.

---

## 1. Wireframe textual da Home

```
┌─────────────────────────────────────────────┐
│ [Avatar/Nome]         [Sino notif.] [Perfil] │  ← Header, altura 56px equiv., fundo neutro
├─────────────────────────────────────────────┤
│                                               │
│   ┌───────────────────────────────────────┐ │
│   │            HOJE, 6 DE JUL              │ │  ← Data, texto pequeno secundário (0.875rem)
│   │                                         │ │
│   │              ╭───────╮                 │ │
│   │              │  7.8  │  ← PRONTIDÃO    │ │  ← Anel/gauge circular, DIÂMETRO = ~40% da
│   │              │ /10   │                 │ │     largura da tela. Maior elemento da Home.
│   │              ╰───────╯                 │ │     Cor do anel = semáforo (ver seção 2).
│   │           "Prontidão alta"              │ │  ← Rótulo textual da faixa, 1rem, cor = mesma do anel
│   │                                         │ │
│   └───────────────────────────────────────┘ │
│                                               │
│   ┌───────────────┐   ┌───────────────────┐ │
│   │  Sono          │   │  Exaustão          │ │  ← Par de cards secundários, MESMA largura,
│   │  8.2 /10       │   │  35%               │ │     ALTURA = ~50% do card de Prontidão.
│   │  [barra mini]  │   │  [barra mini]      │ │     Tamanho de número: 1.5rem (vs 3rem do
│   └───────────────┘   └───────────────────┘ │     anel de Prontidão) — hierarquia clara.
│                                               │
│   ┌───────────────────────────────────────┐ │
│   │  Redução sugerida do treino: 15%        │ │  ← Card de largura total, altura baixa
│   │  [barra horizontal 0-70%, marca de teto]│ │     (~1 linha + barra). Sempre visível mesmo
│   └───────────────────────────────────────┘ │     quando 0% ("nenhuma redução sugerida").
│                                               │
│   ┌───────────────────────────────────────┐ │
│   │  TREINO DE HOJE                         │ │  ← Card lado a lado conceitualmente com a
│   │  Corrida intervalada — 8x400m           │ │     Prontidão (mesma "unidade de decisão":
│   │  18:00 · Pista Central                  │ │     "como estou" + "o que vou fazer").
│   │  [Editar treino →]                      │ │     Fica LOGO ABAIXO do bloco de Prontidão,
│   └───────────────────────────────────────┘ │     nunca abaixo do dashboard.
│                                               │
│  ───────────── divisor visual ────────────── │
│                                               │
│   DASHBOARD                          [ver tudo]│ ← Título de seção, 1rem, uppercase, cinza médio
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│   │Recup.  │ │Recup.  │ │Tempo   │ │Regular.││  ← Grid de cards clicáveis, 2 colunas em
│   │física  │ │mental  │ │sono    │ │sono    ││     mobile (4 visíveis por vez + scroll),
│   │ 7.5    │ │ 6.0    │ │ 7h40   │ │ 8.1    ││     4 colunas em tablet/desktop.
│   ├────────┤ ├────────┤ ├────────┤ ├────────┤│     Cada card: ícone + label + valor +
│   │Exaustão│ │TRIMP   │ │ATL     │ │CTL     ││     sparkline mini (7 dias) + seta de
│   │ 35%    │ │ 320    │ │ 45.2   │ │ 52.0   ││     tendência (↑↓→).
│   ├────────┤ ├────────┤ ├────────┤ ├────────┤│
│   │TSB     │ │Monot.  │ │Monot.  │ │Janela  ││
│   │ +6.8   │ │diária  │ │semanal │ │ lesão  ││  ← Card "Janela de lesão" tem borda ou
│   │        │ │ 1.2    │ │ 1.4    │ │ 2.1 🟢 ││     dot de cor semafórica própria (ver seção 2),
│   └────────┘ └────────┘ └────────┘ └────────┘│     distinto visualmente dos demais 11 cards.
│                                               │
├─────────────────────────────────────────────┤
│ [Home] [Calendário] [Check-in ➕] [Perfil]    │  ← Tab bar fixa inferior. Check-in é botão
└─────────────────────────────────────────────┘     central, elevado, com destaque (FAB-like).
```

### Hierarquia visual exata (ordem de peso visual, do maior ao menor)
1. **Anel de Prontidão** — maior elemento, cor semafórica, número em destaque máximo (~3rem).
2. **Rótulo de faixa da Prontidão** ("Prontidão alta/moderada/baixa") — reforço textual imediatamente abaixo do anel.
3. **Card "Treino de hoje"** — mesmo nível de prioridade estrutural que Sono/Exaustão, mas com tratamento visual distinto (fundo levemente diferenciado, ícone de atividade) porque é a peça de **decisão acionável**, não só leitura passiva.
4. **Cards Sono / Exaustão** — pares lado a lado, números médios (1.5rem), sem gauge circular (barra linear fina ou semicírculo pequeno).
5. **Card de % redução de treino** — largura total, tratamento de "alerta informativo", ícone de escudo.
6. **Dashboard (grid)** — hierarquia mais baixa, todos os 12 cards com o mesmo peso visual entre si (exceto Janela de Lesão, que ganha o dot semafórico), número menor (1.125rem).

### CTA de check-in quando ainda não feito
Quando **não há check-in hoje**, todo o bloco de Prontidão/Sono/Exaustão/Redução é substituído por um **card CTA de largura total**:

```
┌───────────────────────────────────────┐
│              🌤️                        │
│   Ainda sem check-in hoje              │
│   Leva menos de 1 minuto               │
│                                         │
│      [  FAZER CHECK-IN AGORA  ]        │  ← Botão primário, cor de destaque (accent,
│                                         │     não semafórica), largura total, altura
└───────────────────────────────────────┘     generosa (48px equiv.)
```
Abaixo, o card "Treino de hoje" continua visível normalmente. O dashboard mostra os últimos valores conhecidos com rótulo discreto "última atualização: ontem". O botão de check-in na tab bar ganha badge/dot de notificação enquanto pendente.

---

## 2. Sistema de cores semafórico

### 2.1 Prontidão (0-10) — espelhando os cortes da Janela de Risco (0.0-3.4 / 3.5-6.4 / 6.5-10.0)

| Faixa numérica | Prontidão (valor alto = bom) | Cor | Hex sugerido |
|---|---|---|---|
| 0.0 – 3.4 | Prontidão baixa (cautela) | Vermelho | `#E5484D` |
| 3.5 – 6.4 | Prontidão moderada | Âmbar | `#F5A623` |
| 6.5 – 10.0 | Prontidão alta (liberado) | Verde | `#3DB56A` |

### 2.2 Janela de Risco de Lesão — polaridade invertida (mesmos cortes)

| Faixa numérica | Significado | Cor |
|---|---|---|
| 0.0 – 3.4 | Baixo risco de lesão | Verde `#3DB56A` |
| 3.5 – 6.4 | Risco moderado | Âmbar `#F5A623` |
| 6.5 – 10.0 | Alto risco de lesão | Vermelho `#E5484D` |

**Regra de consistência mandatória:** verde sempre = "seguro/pode treinar", vermelho sempre = "cautela", independente da variável ou da direção do número cru. Item a ser testado explicitamente pelo QA.

### 2.3 Paleta do calendário

| Estado do dia | Cor/Estilo |
|---|---|
| Check-in feito, Prontidão 6.5–10.0 | Verde sólido `#3DB56A` |
| Check-in feito, Prontidão 3.5–6.4 | Âmbar `#F5A623` |
| Check-in feito, Prontidão 0.0–3.4 | Vermelho `#E5484D` |
| **Sem check-in** | **Cinza neutro tracejado/hachurado** `#E0E0E0`, nunca vermelho |
| Dia futuro | Cinza muito claro, sem número de prontidão |
| Hoje | Borda/anel de destaque neutro sobreposto |

### 2.4 Cor de acento não-semafórica
Para CTAs neutros (check-in, navegação ativa) — nunca verde/âmbar/vermelho. Sugestão placeholder: `#4A5FE8` (decisão de marca em aberto, seção 8).

---

## 3. Wireframe do Dashboard

Grid de **12 cards clicáveis** (2 colunas mobile / 4 colunas tablet-desktop), ordem fixa: Recuperação física, Recuperação mental, Tempo de sono, Regularidade do sono, Exaustão, TRIMP, ATL, CTL, TSB, Monotonia diária, Monotonia semanal, Janela de lesão.

Cada card: ícone, label (0.75rem), valor atual (1.125rem negrito), sparkline 7 dias, seta de tendência (cinza, não semafórica). Exceção: card "Janela de lesão" tem dot colorido 8px (semafórico). ATL/CTL/TSB exibidos em valor bruto com unidade contextual (não normalizado), com ícone "i" explicando a escala.

**Ao clicar:** abre em tela cheia (não modal), slide-up:

```
┌─────────────────────────────────────┐
│ [← Voltar]   Recuperação física   [i]│
├─────────────────────────────────────┤
│         [Gráfico de linha/área]       │
├─────────────────────────────────────┤
│   [ 7 ] [ 14 ] [ 21 ] [ 28 ] dias    │  ← segmented control, default = 7 dias
├─────────────────────────────────────┤
│  Média do período: 7.1                │
│  Mín: 5.2   Máx: 8.9                  │
└─────────────────────────────────────┘
```

Para a Janela de Risco de Lesão, o gráfico ganha 3 faixas de fundo coloridas (verde/âmbar/vermelho) atrás da série temporal.

---

## 4. Wireframe do Calendário

```
┌─────────────────────────────────────────┐
│  [<]        Julho 2026            [>]    │
├─────────────────────────────────────────┤
│  D    S    T    Q    Q    S    S         │
├─────────────────────────────────────────┤
│            1🟩  2🟨  3🟥  4░░   5🟩       │
│  6🟩  7·    8·   9·   10·  11·  12·      │
├─────────────────────────────────────────┤
│  Legenda:                                 │
│  🟩 Prontidão alta   🟨 Moderada  🟥 Baixa │
│  ░░ Sem check-in     · Dia futuro         │
└─────────────────────────────────────────┘
```

Célula "hoje" recebe contorno adicional. Dias sem check-in: hachura diagonal sutil, texto cinza médio — nunca confundível com vermelho.

**Ao clicar:** dia passado com check-in → modal com resumo do check-in + link "ver dashboard completo desse dia". Dia sem check-in → modal "Sem registro" + opção "preencher retroativamente" (decisão em aberto). Dia futuro → sem ação. Hoje sem check-in → vai direto para o check-in.

---

## 5. Wireframe da tela de Check-in

Fluxo de **uma pergunta por tela**, com barra de progresso segmentada no topo (ex. "3/7").

Componentes de resposta por pergunta:
| # | Pergunta | Escala | Componente |
|---|---|---|---|
| 1 | Qualidade do sono | 1-7 | Emoji-scale |
| 2 | Duração do sono | — | Chips de faixa de horas (<5h, 5-6h...>10h) |
| 3 | Fadiga geral | 1-7 | Emoji-scale |
| 4 | Estresse percebido | 1-7 | Emoji-scale |
| 5 | Humor/disposição | 1-7 | Emoji-scale |
| 6 | Dor muscular | 1-7 | Emoji-scale / ícone de corpo |
| 7 | Prontidão percebida (PRS) | 0-10 | Slider contínuo, gradiente vermelho→verde |

Seção condicional (treino de ontem) entra dinamicamente após a pergunta 7, estendendo a barra de progresso. Seção opcional (HRV, FC, nota livre) aparece numa tela única combinada ao final, com "+ Adicionar comentário" colapsado por padrão e "Concluir check-in" sempre habilitado.

---

## 6. Wireframe da visão do Coach

Lista/grade de atletas com busca e filtro. Banner-resumo no topo ("2 atletas em risco · 3 sem check-in"). Cards ordenados: em risco primeiro, sem check-in depois, demais por ordem alfabética/prontidão. Cada card com dot semafórico, nome, valor ou "sem check-in", tag de alerta textual.

Ao clicar num atleta: mesma tela de Home/Dashboard do atleta, modo somente-leitura, header "Visualizando: [nome] [← voltar]".

---

## 7. Estados vazios / erro

- **Home sem check-in:** CTA substitui bloco de Prontidão; dashboard mostra últimos valores com "última atualização: [data]".
- **Dashboard <7 dias de histórico:** cards mostram "Faltam X dias para o primeiro gráfico"; seletor 7/14/21/28 desabilita janelas maiores que o histórico disponível; métricas cumulativas (CTL) ganham badge "provisório".
- **Calendário sem registro:** cinza hachurado, nunca semafórico.
- **Erros de rede:** skeleton loaders; banner discreto "Não foi possível atualizar. [Tentar novamente]"; check-in nunca perde respostas já dadas em caso de falha de envio.

---

## 8. Decisões de design em aberto (precisam validação de Val)

1. Cor de acento não-semafórica (identidade de marca ainda não definida).
2. Check-in retroativo permitido ou não (afeta integridade de ATL/CTL/TSB).
3. Coach pode "enviar lembrete" a atleta sem check-in, ou só observa passivamente?
4. Seletor de janela (7/14/21/28) deve persistir preferência do usuário entre variáveis, ou sempre resetar para 7?
5. Emoji-scale pode soar "infantil" para atletas de alto rendimento — validar tom com Conteúdo/Tom (ver nota cruzada abaixo).
6. Threshold exato de "dado insuficiente" por variável (CTL pode precisar de janela maior que 7 dias — confirmar com Ciência do Esporte).
7. Nomenclatura da faixa "moderada" de Prontidão — revisar com Conteúdo/Tom.
8. Modo alternativo de acessibilidade para daltonismo (padrões/texturas além de cor).
9. Comportamento do card "Treino de hoje" quando não há treino cadastrado.
10. Atletas comuns entendem os acrônimos ATL/CTL/TSB, ou precisam de nomes descritivos alternativos?

---

**Status:** Especificação completa, pronta para handoff a Backend/Frontend após resolução dos itens leves da seção 8 e cruzamento com o documento de Conteúdo/Tom (ver nota de QA sobre emoji-scale vs. rótulos intermediários do Hooper).
