# Especificação Funcional — SynthonIA (Prontidão Fisiológica)
## Agente PRODUTO — Stage 1/8 — **v1.1 (corrigida pós-QA, aprovada por Val em 2026-07-06)**

> Esta versão incorpora as correções exigidas pelo agente QA/VALIDAÇÃO após auditoria de consistência com o documento da Ciência do Esporte. Alterações em relação à v1.0 estão marcadas com **[CORRIGIDO]**.

---

## 0. Premissas assumidas para esta especificação

- Modelo multiusuário: `Coach` e `Atleta` são papéis (roles) de um mesmo tipo de conta; um usuário tem 1 papel ativo por conta nesta v1.
- Sem wearable: HRV e FC repouso são digitados manualmente pelo atleta, campos **opcionais** (confirmado por Val — sem integração automática nesta fase).
- Check-in diário único, meta < 60s, combinando itens equivalentes de Hooper Index, TQR, PRS e RESTQ-Sport-36 — versão condensada sem redundância entre questionários.
- **[CORRIGIDO]** Escala de Prontidão: **0–10** (não 0–100), conforme definido pela Ciência do Esporte e chancelado por Val.
- **[CORRIGIDO]** Janela de Risco de Lesão: 3 faixas com limiares numéricos definidos pela Ciência do Esporte e chancelados por Val — Baixo (0.0–3.4) / Moderado (3.5–6.4) / Alto (6.5–10.0).
- Sem integração de treino planejado automatizada — "treino planejado do dia" é um dado que o próprio app armazena (inserido por coach ou atleta). Pendente de decisão de Val (ver seção 5, pergunta aberta #1).

---

## 1. User Stories

(Sem alterações em relação à v1.0 — ver seções 1.1 a 1.6 completas no histórico do pipeline: onboarding/vínculo coach-atleta US-01 a US-08; check-in diário US-09 a US-14; tela principal US-15 a US-21; dashboard US-22 a US-26; calendário US-27 a US-30; visão do coach US-31 a US-37.)

**[CORRIGIDO]** US-15 (critério de aceite atualizado): a Pontuação de Prontidão é exibida na Home como valor numérico em **escala 0–10** (não 0–100) + rótulo categórico + cor semafórica, usando os cortes definidos pela Ciência do Esporte.

**[CORRIGIDO]** US-25 (critério de aceite atualizado): o banner de "Janela de Risco de Lesão" é acionado quando o Índice de Janela de Lesão (0–10) cruza os limiares 3.5 (moderado) ou 6.5 (alto), conforme fórmula da Ciência do Esporte.

---

## 2. Critérios de Aceite

(Sem alterações estruturais — ver v1.0. Critérios de US-15 e US-25 atualizados conforme acima.)

---

## 3. Estrutura de Dados de Entrada — Check-in Diário

**v1.1 — corrigida.** Objetivo: < 60 segundos, mínimo de perguntas. Campos obrigatórios primeiro, opcionais depois.

### 3.1 Campos obrigatórios

| # | Campo | Tipo | Escala/Formato | Questionário de origem | Observação |
|---|-------|------|------------------|------------------------|------------|
| 1 | `qualidade_sono` | Escala | **[CORRIGIDO] 1-7** (muito ruim → muito boa) | Hooper Index | Escala nativa do Hooper — alinhada à fórmula da Ciência do Esporte |
| 2 | `duracao_sono_horas` | Numérico decimal | 0-24h (stepper de 0.5h) | Item próprio | Ex: 7.5 |
| 3 | `fadiga_geral` | Escala | **[CORRIGIDO] 1-7** (nenhuma → exaustão total) | Hooper Index | Componente central de %Exaustão (derivado, não pergunta separada) |
| 4 | `estresse_percebido` | Escala | **[CORRIGIDO] 1-7** (nenhum → extremo) | Hooper Index / RESTQ | Alimenta Recuperação Mental (peso 0.5) |
| 5 | `humor_disposicao` | Escala | **[NOVO — CORRIGIDO] 1-7 invertida** (1=péssimo, 7=ótimo) | RESTQ-Sport-36 (subescala Recuperação Social/Emocional) | Campo adicionado por exigência da fórmula de Recuperação Mental (peso 0.5, junto com estresse) |
| 6 | `dor_muscular` | Escala | **[CORRIGIDO] 1-7** (nenhuma → extrema) | Hooper Index | Sinal de janela de lesão / Recuperação Física (peso 0.6) |
| 7 | `prontidao_percebida` | Escala | 0-10 | **[CORRIGIDO] PRS apenas** (referência removida ao TQR — redundante, conforme Ciência do Esporte) | Pergunta âncora / validação cruzada da Prontidão calculada |

### 3.2 Campos condicionais (aparecem apenas se aplicável)

| # | Campo | Tipo | Condição de exibição |
|---|-------|------|------------------------|
| 8 | `treinou_ontem` | Toggle Sim/Não | Sempre exibido primeiro do bloco condicional |
| 9 | `rpe_treino_anterior` | Escala 0-10 (RPE de Borg CR-10) | Se `treinou_ontem` = Sim |
| 10 | `duracao_treino_anterior_min` | Numérico (minutos) | Se `treinou_ontem` = Sim |

### 3.3 Campos opcionais (não bloqueiam envio)

| # | Campo | Tipo | Observação |
|---|-------|------|------------|
| 11 | `hrv_ms` | Numérico | Unidade ms (rMSSD), inserção manual (confirmado: sem wearable nesta fase) |
| 12 | `fc_repouso_bpm` | Numérico | Batimentos por minuto, inserção manual |
| 13 | `nota_livre` | Texto curto (≤ 200 caracteres) | Opcional, **recomendado exibir colapsado por padrão** ("+ adicionar comentário") para não competir com o orçamento de 60s (risco sinalizado pelo QA) |

### 3.4 Contagem final de perguntas (pós-correção, validada pelo QA)

- **Dia sem treino:** 7 obrigatórias + `treinou_ontem` = 8 interações ativas (+ HRV/FC opcionais, tipicamente pulados) → ~9 conforme matriz da Ciência do Esporte.
- **Dia com treino:** 8 + RPE + duração = 11 interações.
- Avaliação do QA: viável dentro de 60s com sliders/toggles de 1 toque, mas **orçamento fica apertado em dias de treino** (33-55s estimados) dado que HRV/FC são manuais. Decisão de Val: seguir assim e otimizar na fase de UX/Conteúdo (sliders rápidos, nota livre colapsada) — **não cortar perguntas nesta fase**.

**Nota removida (v1.0 → v1.1):** a ambiguidade "TQR adaptado / PRS" foi eliminada — o campo 7 usa exclusivamente a escala PRS (0-10), por decisão já resolvida pela Ciência do Esporte e chancelada por Val.

---

## 4. Regras de Negócio — Vínculo Coach-Atleta

(Sem alterações — ver RN-01 a RN-09 da v1.0: cardinalidade 1 coach : N atletas / 1 atleta : 1 coach; isolamento de dados; convite unidirecional; consentimento explícito; etc.)

---

## 5. Perguntas em Aberto / Ambiguidades para Val

**[RESOLVIDAS nesta rodada:]**
- ~~Escala e rótulos da Pontuação de Prontidão~~ → **Resolvido: 0-10, aprovado por Val.**
- ~~Limiares de janela de risco de lesão~~ → **Resolvido: 3 faixas (0.0-3.4/3.5-6.4/6.5-10.0), aprovado por Val.**

**Ainda em aberto (não bloqueiam UX/Backend, mas precisam de decisão antes do Backend fechar o schema):**

1. Treino planejado — origem do dado (coach, atleta, ou ambos cadastram).
2. Check-in perdido/pulado — regra de imputação (já parcialmente coberta pelo fallback da Ciência do Esporte, mas Produto precisa confirmar comportamento de UI).
3. Alertas de risco de lesão para o coach — canal e frequência de notificação.
4. Limite de atletas por coach (relacionado a modelo de monetização, fora de escopo desta especificação).
5. Retroatividade de acesso ao desvincular coach-atleta (LGPD).
6. Múltiplos papéis por usuário (coach que também é atleta) — assumido "não" nesta v1.
7. Idioma/localização — assumido PT-BR.
8. Fuso horário multi-atleta para corte de edição do check-in.
9. Retenção de dados / LGPD (exclusão de conta, exportação).
10. Conflito de edição do treino planejado entre coach e atleta.
11. Coach preenchendo check-in em nome do atleta — fora de escopo por padrão, confirmar.
12. Limite de atletas comparáveis simultaneamente na visão do coach (US-35).

---

## Status desta entrega

**Aprovado por Val em 2026-07-06**, condicionado às 3 correções acima (todas aplicadas nesta v1.1) e à chancela dos thresholds de Prontidão e Janela de Risco de Lesão. Pronta para handoff a UX/UI, CONTEÚDO/TOM e BACKEND — pendências da seção 5 seguem em paralelo, não bloqueantes para início dessas fases.
