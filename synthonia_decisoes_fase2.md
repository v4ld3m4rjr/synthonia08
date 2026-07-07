# Decisões de Val — Fase 2 (2026-07-07)

Registradas para orientar BACKEND e FRONTEND.

## 1. Componente de escala 1-7 no check-in

**Decisão: Emoji + legenda dinâmica.**
O componente permanece um emoji-scale compacto (emoji/número grande como alvo de toque). Apenas o rótulo textual do ponto atualmente selecionado aparece como legenda de 1 linha abaixo do emoji. As 7 frases completas escritas pelo Conteúdo/Tom deixam de aparecer todas simultaneamente na tela principal — viram texto de ajuda acessível via long-press/tooltip (e servem integralmente para leitores de tela).

Impacto para Frontend: componente de slider/emoji precisa expor um estado de "rótulo ativo" (1 linha, truncando se necessário) e um affordance de ajuda (long-press ou ícone "i") que abre as 7 frases completas.

## 2. Direção da escala de `humor_disposicao`

**Decisão: Padronizar a direção de exibição.**
Todas as 5 escalas de humor/estado (qualidade_sono, fadiga_geral, estresse_percebido, humor_disposicao, dor_muscular) passam a ser exibidas com a mesma direção visual: **1 = pior estado, 7 = melhor estado** (ou seja, `humor_disposicao` mantém sua direção original 1=péssimo/7=ótimo, e as outras 4 são invertidas na exibição para bater com essa direção: 1=pior sintoma/mais intenso, 7=melhor/sem sintoma).

Impacto para Backend/Ciência do Esporte: a conversão para as fórmulas científicas (Hooper 1-7 "alto=ruim" e RESTQ) deve ser feita na camada de cálculo — mapear o valor exibido ao usuário para o valor de entrada da fórmula original antes de aplicar TRIMP/Recuperação Física/Mental. Documentar esse mapeamento explicitamente no schema (ex.: coluna `valor_exibido` vs. `valor_formula`, ou uma função de conversão única e testada).

Impacto para Conteúdo/Tom: os rótulos das perguntas 1, 3, 4, 6 (sono, fadiga, estresse, dor) precisam ser reordenados/invertidos na exibição (visualmente, o ponto 1 do slider passa a mostrar o rótulo que hoje é "7 — nenhuma/ótimo", e vice-versa), sem mudar o texto das frases em si, apenas a ordem em que aparecem no componente.

## Itens não decididos nesta rodada (registrados, sem ação necessária agora)

- Rótulos intermediários (2,3,5,6) fora do Hooper original — Val optou por seguir adiante; se Ciência do Esporte identificar viés real na fase de Backend/scoring, retorna para ajuste.
- RPE de Borg agrupado em faixas — aceito e documentado como desvio deliberado do CR-10 original.
- Tratamento de dias sem check-in nos cálculos agregados (gap, não zero) — será resolvido como parte do schema do Backend.
