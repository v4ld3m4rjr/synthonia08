# QA FINAL — SynthonIA (Prontidão Fisiológica)
**Status: RODADA DE ESPECIFICAÇÃO + SCAFFOLD CONCLUÍDA — não é sign-off de deploy em produção**

## Checklist de aceite (9 itens do prompt mestre)

| # | Item | Veredito |
|---|---|---|
| 1 | Fórmulas validadas contra literatura | ATENDE |
| 2 | Variáveis normalizadas 0–10 com legenda | ATENDE |
| 3 | Check-in <60s, bem-humorado, válido | ATENDE PARCIALMENTE (estrutura 100%, implementação visual 4/13 perguntas) |
| 4 | Ordem correta da tela principal | ATENDE |
| 5 | Dashboard clicável, janelas 7/14/21/28d | ATENDE PARCIALMENTE (mecânica pronta, gráfico é placeholder, sem dados reais) |
| 6 | Calendário funcional | ATENDE PARCIALMENTE (UI + backend prontos, falta integração real) |
| 7 | HRV/FC como campos opcionais | ATENDE |
| 8 | Coach-atleta com RLS testado | **ATENDE PARCIALMENTE — 2 gaps de segurança conhecidos, não corrigidos** |
| 9 | Fallback para dados ausentes | ATENDE |

## Ponto crítico — item 8 (RLS)

O próprio agente Backend, em autoauditoria, encontrou 2 gaps reais:
1. `profiles_update_own` permite a um atleta fazer `UPDATE role='coach'` nele mesmo (autopromoção).
2. `vinculo_update` permite transição livre de status (ex: reativar vínculo revogado sem passar pelo convite).

**Veredito do QA: aceitável fechar esta rodada de especificação com os gaps documentados, mas nenhum deploy real pode acontecer antes de corrigidos + os 13 testes de RLS executados em projeto Supabase real.**

## Veredito geral

**Rodada do pipeline concluída como especificação + scaffold.** Nenhuma lacuna encontrada exige retorno a Ciência do Esporte, Produto, UX/UI ou Conteúdo/Tom — tudo o que falta é continuação de implementação em Backend (corrigir RLS) e Frontend (completar componentes, integrar Supabase).

## Antes de qualquer deploy real (ordem de prioridade)

1. Corrigir os 2 gaps de RLS + rodar os 13 testes obrigatórios em projeto Supabase real.
2. Implementar os 9 componentes de pergunta restantes do check-in e medir tempo real (<60s) com usuário.
3. Integração real Frontend↔Supabase (autenticação, roteamento, dados reais).
4. Implementar função final de ATL/CTL com constantes definitivas.
5. Trocar placeholder SVG do dashboard por biblioteca de gráficos real.
6. Build real do scaffold (`npm install` nunca rodado).
7. Resolver decisões de produto em aberto (lista abaixo) antes que fiquem caras de mudar.
8. Testes end-to-end dos fallbacks com dados reais incompletos.

## Decisões de produto/negócio em aberto para Val (consolidado de todo o pipeline)

1. Retenção de dados (LGPD).
2. Exclusão de conta — hard delete ou soft delete.
3. Acesso do coach após revogação do vínculo (default atual: acesso total ao histórico).
4. Múltiplos coaches por atleta / múltiplos papéis por conta?
5. Vínculo precisa de dupla confirmação ou basta convite unilateral?
6. Prazo de expiração do convite (hoje 7 dias, placeholder).
7. Mudança de role permitida após cadastro?
8. Check-in editado mantém histórico de versões ou sobrescreve?
9. Constantes exatas de ATL/CTL (janelas EWMA, pesos) — confirmar antes de codificar versão final.
10. Coach pode pré-cadastrar atleta antes dele se cadastrar sozinho?
