# QA/VALIDAÇÃO — Auditoria da Fase 2 (UX/UI + CONTEÚDO/TOM)
**Data:** 2026-07-06 | **Status: APROVADO COM RESSALVAS — pendente decisão de Val em 1 ponto bloqueante**

## Veredito por documento

| Documento | Veredito |
|---|---|
| UX/UI | Aprovado com ressalvas — estrutura de Home, semáforo, calendário e dashboard corretos e completos frente ao checklist. |
| Conteúdo/Tom | Aprovado com ressalvas — copy dentro do orçamento de tempo (~37s), e o próprio agente já autoidentificou 3 das 4 ambiguidades relevantes. |
| Consistência entre os dois | **Reprovada nesta interseção específica:** conflito de formato entre "emoji-scale" (UX/UI) e "7 rótulos textuais completos por campo" (Conteúdo/Tom) — não implementável como está. |

## Achados

1. **[BLOQUEANTE] Conflito de componente:** UX/UI especificou emoji-scale (compacto); Conteúdo/Tom escreveu 7 frases completas por campo (5 campos × 7 pontos = 35 strings). Não cabem no componente como especificado. Recomendação do QA: emoji + número como alvo de toque, rótulo do ponto selecionado como legenda de 1 linha, os 7 rótulos completos viram texto de ajuda/acessibilidade (long-press), não exibição simultânea.

2. **[BLOQUEANTE PARA SCHEMA] Direção invertida de `humor_disposicao`:** as outras 4 escalas 1-7 são "1=melhor,7=pior sintoma"; humor é "1=pior,7=melhor" — inverso. Risco real de erro de input em uso diário rápido. Recomendação do QA: padronizar a direção de EXIBIÇÃO das 5 escalas (ex. sempre 1=pior estado, 7=melhor estado) e isolar a conversão científica (RESTQ) na camada de cálculo/backend, documentando o mapeamento.

3. **[NÃO BLOQUEIA DESIGN, BLOQUEIA COPY FINAL] Rótulos intermediários (pontos 2,3,5,6):** não fazem parte do Hooper Index original (que só ancora 1/4/7) — risco de viés de ancoragem semântica que pode distorcer os scores. Precisa validação da Ciência do Esporte antes de travar o texto definitivo.

4. **[ACEITÁVEL, REGISTRAR] RPE de Borg agrupado em faixas:** simplificação aceitável dado o contexto (RPE é insumo, não dado clínico final). Documentar como desvio deliberado do CR-10 original.

5. **[VERIFICAR NA IMPLEMENTAÇÃO] Tratamento de dias sem check-in nos cálculos agregados** (ATL/CTL/monotonia): a representação visual no calendário está correta (cinza, não semafórico), mas o QA reforça que o Backend precisa garantir que esses dias sejam tratados como gap (ausência de dado), nunca como zero, nos cálculos — ligado à pendência já aberta de "threshold de dado insuficiente por variável" (CTL pode precisar de janela >7 dias).

6. Ordem da Home (seção 4.1 do prompt mestre): **respeitada**, confirmado.
   Dashboard (janelas 7/14/21/28d): **atende integralmente ao checklist.**

## Decisões para Val, em ordem de prioridade

1. Formato do componente de escala 1-7 (emoji-scale puro + legenda dinâmica vs. exibir os 7 rótulos completos).
2. Direção da escala de `humor_disposicao` (padronizar exibição vs. manter fidelidade RESTQ com reforço visual apenas).
3. Confirmar que ausência de check-in é tratada como gap (não zero) nos cálculos agregados — resolver junto com a pendência de threshold de dado insuficiente por variável (com Ciência do Esporte).
4. Validação dos rótulos intermediários pela Ciência do Esporte antes do copy final.
5. RPE de Borg agrupado — aceitar e documentar como desvio deliberado (sem ação necessária além de registrar).
