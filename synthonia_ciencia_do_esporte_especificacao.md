# SynthonIA — Especificação de Ciência do Esporte
## Motor de Prontidão Fisiológica (Fórmulas, Normalização e Fallbacks)

**Agente:** Ciência do Esporte (Fisiologista / Cientista de Dados)
**Estágio do pipeline:** ORQUESTRADOR → PRODUTO → **CIÊNCIA DO ESPORTE** → UX/UI → CONTEÚDO/TOM → BACKEND → FRONTEND → QA
**Status:** Especificação matemática para auditoria do agente QA. Nenhum código incluído.

---

## Premissas de dados assumidas

- **Sem HR contínua de treino** (sem cinta/relógio integrado obrigatório). Intensidade de sessão vem de RPE (escala CR-10 de Borg).
- **HRV e FC de repouso**: manuais, opcionais, podem faltar em qualquer dia.
- **Check-in diário único, <60s**, combinando itens equivalentes de Hooper Index, TQR, PRS e RESTQ-Sport-36 (ver item 13).
- Multiusuário Coach ↔ Atleta: todas as fórmulas rodam por atleta individual; o Coach vê agregações (não definidas aqui — ver PRODUTO).

---

## 1. TRIMP (Training Impulse)

### Método escolhido: **session-RPE (Foster et al., 2001)** — não Banister TRIMP clássico

**Fórmula:**

```
TRIMP_sessão = RPE_sessão × Duração_sessão(min)
```

Onde `RPE_sessão` é a percepção de esforço da sessão inteira (não instantânea) coletada na **escala CR-10 de Borg modificada (0–10)**, aplicada **~30 min após o término da sessão** (protocolo original de Foster).

Se houver múltiplas sessões no dia, a carga diária é a soma:

```
Carga_diária = Σ (RPE_sessão_i × Duração_sessão_i)
```

**Unidade resultante:** unidades arbitrárias (AU), tipicamente na faixa 0–1500+ AU/dia para atletas de endurance/equipe.

### Justificativa da escolha

- O **TRIMP de Banister (1991)** exige FC contínua durante o exercício e um fator de ponderação exponencial calibrado por sexo (curva de lactato: `Y = 0.64·e^(1.92x)` homens, `Y = 0.86·e^(1.67x)` mulheres, onde `x` = razão de reserva de FC). Isso é **inviável** no app porque HR contínua de treino não é coletada (só HRV/FC de repouso manuais, e mesmo esses são opcionais).
- O **método de Foster (session-RPE)** foi validado especificamente como *substituto de baixo custo de dados* para métodos baseados em FC, com correlação forte (r ≈ 0.5–0.9 conforme modalidade) ao TRIMP de Banister e à concentração sanguínea de lactato, e é o padrão de facto em esportes coletivos e contextos "meio-mínimo-dados" (Foster et al., 2001; Impellizzeri et al., 2004; revisão em Haddad et al., 2017, *Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors*, Frontiers in Physiology).
- Requer apenas 2 inputs por sessão: RPE (1 pergunta) e duração (auto-capturada ou informada) — compatível com o orçamento de <60s de interação diária.

### Normalização 0–10 (para exibição, não para os cálculos internos de ATL/CTL que usam AU brutas)

```
TRIMP_norm(0-10) = min(10, (Carga_diária / Carga_diária_máxima_pessoal) × 10)
```

Onde `Carga_diária_máxima_pessoal` é o P95 histórico individual (mínimo 14 dias de dados; fallback ver item 12). Isso evita necessidade de tabela de referência populacional e se auto-calibra por atleta.

**Referências:** Foster C, et al. (2001). *A new approach to monitoring exercise training.* J Strength Cond Res 15(1):109-115. | Impellizzeri FM, et al. (2004). *Use of RPE-based training load in soccer.* Med Sci Sports Exerc 36(6):1042-1047. | Haddad M, et al. (2017). Frontiers in Physiology.

---

## 2. ATL (Acute Training Load / Fadiga)

### Janela e método: **EWMA de 7 dias** (não média móvel simples)

Seguindo a recomendação metodológica de Williams et al. (2017) e o consenso de Bourdon et al. (2017), que apontam que médias móveis simples ("rolling average") ignoram o decaimento temporal do estímulo, o app usa **média móvel exponencialmente ponderada (EWMA)**.

**Fórmula (recursiva, forma Williams/Bannister):**

```
ATL_hoje = Carga_hoje × λ_A + ATL_ontem × (1 − λ_A)

λ_A = 2 / (N_A + 1),  com N_A = 7 dias
→ λ_A = 2/8 = 0.25
```

**Forma equivalente (tempo-constante, usada por TrainingPeaks/Coggan):**

```
ATL_hoje = ATL_ontem × e^(−1/τ_A) + Carga_hoje × (1 − e^(−1/τ_A))
τ_A = 7 dias
```

O app padroniza na **forma EWMA discreta (λ = 2/(N+1))**, por ser a formulação citada pela literatura de ciência do esporte (Williams et al., 2017) — a forma exponencial contínua de Coggan é equivalente na prática e pode ser usada de forma intercambiável no backend, mas a documentação de referência deve citar a primeira.

**Interpretação:** ATL representa fadiga aguda / carga recente — sobe rápido com treinos intensos e decai rápido com dias de folga.

**Referências:** Williams S, et al. (2017). *Better way to determine the acute:chronic workload ratio?* Br J Sports Med 51(3):209-210. | Bourdon PC, et al. (2017). *Monitoring Athlete Training Loads: Consensus Statement.* Int J Sports Physiol Perform 12(s2):S2-161–S2-170.

---

## 3. CTL (Chronic Training Load / Fitness)

### Janela e método: **EWMA de 28 dias** (compromisso entre 4 e 6 semanas)

```
CTL_hoje = Carga_hoje × λ_C + CTL_ontem × (1 − λ_C)

λ_C = 2 / (N_C + 1),  com N_C = 28 dias
→ λ_C = 2/29 ≈ 0.069
```

**Nota de calibração:** a literatura de ciclismo (Coggan/TrainingPeaks, não peer-reviewed mas amplamente adotada na prática aplicada) usa **42 dias**; a literatura de ACWR em esportes coletivos (Hulin, Gabbett, Bourdon) frequentemente usa **28 dias**. Optamos por **28 dias** porque:
1. É o padrão mais citado em estudos de injury-risk com ACWR/EWMA (Hulin et al., 2016; Bourdon et al., 2017);
2. Uma janela mais curta responde mais rápido às mudanças de treino do usuário recreativo/semi-profissional (público provável do app), evitando "inércia" excessiva do indicador de fitness.

Este parâmetro (**28 vs 42 dias**) deve ser sinalizado ao agente PRODUTO como **decisão configurável** — recomendação: 28 dias como padrão, com nota de que 42 dias é alternativa válida se o público-alvo for endurance de longa duração.

**Interpretação:** CTL representa a "forma física" acumulada / capacidade de tolerar carga, construída lentamente e perdida lentamente (decaimento em ~4 semanas sem treino).

---

## 4. TSB (Training Stress Balance)

**Fórmula:**

```
TSB_hoje = CTL_ontem − ATL_ontem
```

(Usa-se CTL/ATL do dia anterior — D-1 — pois a carga de hoje ainda não "assentou"; é a convenção padrão do Performance Manager Chart de Coggan, adotada por toda a literatura aplicada de ACWR/TSB.)

### Faixas de interpretação (adaptado de Coggan/TrainingPeaks + consenso de Bourdon et al. 2017 sobre ACWR):

| TSB | Interpretação | Zona |
|---|---|---|
| TSB > +25 | Forma física pode estar decaindo por falta de estímulo (destreino) | Atenção — subtreino |
| +5 a +25 | Frescor / boa prontidão para picos de performance | Ótima |
| −10 a +5 | Zona de treino produtivo normal | Neutra |
| −30 a −10 | Fadiga funcional acumulada (esperado em bloco de carga) | Alerta moderado |
| < −30 | Alto risco de overreaching não-funcional / overtraining | Alerta alto |

Essas faixas numéricas seguem a heurística consolidada por Allen & Coggan (*Training and Racing with a Power Meter*) e são compatíveis qualitativamente com as zonas de risco do ACWR (Gabbett, 2016: ACWR 0.8–1.3 = "zona doce"; >1.5 = alto risco), mapeadas aqui para a escala aditiva de TSB por ser mais intuitiva num app de bem-estar geral (não só endurance).

**Referências:** Allen H, Coggan A. *Training and Racing with a Power Meter*, 3rd ed. | Gabbett TJ (2016). *The training—injury prevention paradox.* Br J Sports Med 50(5):273-280.

---

## 5. Monotonia diária vs. monotonia semanal (Foster)

### Monotonia semanal (definição original de Foster et al., 2001)

```
Monotonia_semanal = Média(Carga_diária, últimos 7 dias) / DesvioPadrão(Carga_diária, últimos 7 dias)
```

Onde a média e o desvio-padrão (populacional, n=7) são calculados sobre as cargas diárias (`TRIMP_sessão` somado por dia, incluindo dias de folga como carga = 0) da semana corrente (janela móvel de 7 dias, não semana de calendário).

**Interpretação:** monotonia alta = treino "sempre igual" (pouca variação dia-a-dia), o que Foster identificou como fator de risco combinado com carga alta.

### Monotonia diária (adaptação para o app, não está no paper original de Foster — necessária pois o app quer um sinal *diário* de risco, não apenas semanal)

Como o conceito original de Foster é inerentemente semanal (precisa de variância de uma janela de dias), a "monotonia diária" no app é a **monotonia semanal recalculada a cada dia usando janela móvel dos últimos 7 dias terminando hoje** (rolling), enquanto a "monotonia semanal" oficial (para relatórios/telas de tendência) é a mesma métrica mas **fixada e reportada uma vez por semana-calendário (ex: toda segunda, referente aos 7 dias anteriores)**.

```
Monotonia_diária(dia_t) = Média(Carga, [t-6, t]) / DP(Carga, [t-6, t])   ← recalculada todo dia, uso interno/alertas
Monotonia_semanal(semana_W) = Média(Carga, semana_W) / DP(Carga, semana_W)  ← fixada semanalmente, uso em relatórios
```

**Diferença prática:** a diária serve ao motor de alerta de risco (item 6) rodando todo dia; a semanal serve à tela de tendência/relatório do Coach (visão de "como foi a semana"), evitando ruído de recalcular o indicador de resumo a cada 24h.

### Normalização 0–10 (para exibição)

```
Monotonia_norm(0-10) = min(10, (Monotonia_bruta / 2.5) × 10)
```

Calibração: monotonia bruta ≥ 2.0 já é consistentemente citada na literatura como zona de risco (ver item 6); usamos 2.5 como teto de escala para deixar faixa de alerta visível na metade superior da escala 0–10.

**Referência:** Foster C (1998). *Monitoring training in athletes with reference to overtraining syndrome.* Med Sci Sports Exerc 30(7):1164-1168. Foster C, et al. (2001), já citado.

---

## 6. Janela de lesão (Strain de Foster × TSB)

### Fórmula exata

**Passo 1 — Strain semanal (Foster):**

```
Strain = Carga_semanal_total × Monotonia_semanal

onde Carga_semanal_total = Σ Carga_diária (últimos 7 dias)
```

**Passo 2 — Strain normalizado (z-score individual, necessário porque strain bruto não é comparável entre atletas):**

```
Strain_z = (Strain − Média_pessoal_Strain_56dias) / DP_pessoal_Strain_56dias
```

Requer histórico mínimo de 4 semanas (28 dias) de strain semanal rolling para ter DP estável; abaixo disso, aplicar fallback (item 12).

**Passo 3 — Cruzamento com TSB para gerar o índice de Janela de Lesão:**

```
Indice_Janela_Lesao = Strain_z_normalizado(0-10) × w1 + TSB_risco_normalizado(0-10) × w2

w1 = 0.6 (strain/monotonia — peso maior, é o preditor mais estudado)
w2 = 0.4 (TSB negativo — contexto agudo)
```

Onde:

```
Strain_z_normalizado(0-10) = clamp(0, 10, 5 + Strain_z × 2.5)
   # z=0 → 5 (neutro); z=+2 → 10 (risco máximo); z=-2 → 0 (sem risco)

TSB_risco_normalizado(0-10):
   TSB ≥ 5        → 0
   -10 ≤ TSB < 5  → interpolação linear 0→5
   -30 ≤ TSB < -10→ interpolação linear 5→8
   TSB < -30      → interpolação linear 8→10 (saturando em 10 a partir de -45)
```

### Faixas de risco (limiares numéricos)

| Índice Janela de Lesão (0–10) | Classificação | Ação recomendada |
|---|---|---|
| 0.0 – 3.4 | **Baixo risco** | Treino normal |
| 3.5 – 6.4 | **Risco moderado** | Monitorar; considerar variar intensidade (quebrar monotonia) |
| 6.5 – 10.0 | **Alto risco** | Sinalizar redução de carga (ver item 10) e alertar Coach |

**Gatilho de alerta binário adicional** (regra dura, independente do score contínuo, replicando o achado empírico original de Foster/Gabbett de que a combinação específica é o preditor, não cada variável isolada):

```
SE Monotonia_semanal > 2.0 E Carga_semanal_total > (Média_pessoal_carga_semanal_28dias × 1.5) E TSB < -10
ENTÃO Alerta_Alto_Risco = TRUE (independente do valor contínuo do índice)
```

Esse gatilho combina três achados da literatura: (a) monotonia > 2.0 associada a maior incidência de doença/lesão em atletas de endurance (Foster, 1998); (b) picos agudos de carga semanal (~razão análoga ao ACWR > 1.5) associados a risco 2–4x maior de lesão (Hulin et al., 2014; Gabbett, 2016); (c) TSB muito negativo como marcador de fadiga acumulada não dissipada.

**Referências:** Foster C (1998), já citado. Hulin BT, et al. (2014). *The acute:chronic workload ratio predicts injury.* Br J Sports Med 48(8):708-712. Gabbett TJ (2016), já citado.

---

## 7. Prontidão (score composto da tela principal, 0–10)

### Variáveis de entrada

| Variável | Origem | Peso | Obrigatória? |
|---|---|---|---|
| Recuperação física (item 11) | Check-in combinado (Hooper: soreness; TQR/PRS) | 0.25 | Sim |
| Recuperação mental (item 11) | Check-in combinado (RESTQ: estresse/humor) | 0.20 | Sim |
| Pontuação do sono (item 8) | Check-in (duração + regularidade) | 0.20 | Sim |
| TSB normalizado (item 4) | Calculado (carga) | 0.20 | Sim (fallback se sem histórico) |
| HRV (Δ vs. baseline pessoal, se disponível) | Manual, opcional | 0.10 | Não — redistribuir peso se ausente |
| FC repouso (Δ vs. baseline pessoal, se disponível) | Manual, opcional | 0.05 | Não — redistribuir peso se ausente |

Pesos somam 1.00 quando todas as 6 variáveis estão presentes.

### Fórmula de combinação

```
Prontidao(0-10) = Σ (peso_i_efetivo × valor_i_normalizado_0-10)
```

**Redistribuição de peso quando HRV e/ou FC repouso faltam** (renormalização proporcional — regra padrão para manter soma = 1.0):

```
peso_i_efetivo = peso_i_original / Σ(pesos_das_variaveis_disponiveis)
```

Exemplo: se HRV e FC repouso ambos faltam (caso mais comum, dado que são opcionais), os 4 componentes restantes somam 0.85 de peso original → cada peso é dividido por 0.85:
- Recuperação física: 0.25/0.85 = 0.294
- Recuperação mental: 0.20/0.85 = 0.235
- Sono: 0.20/0.85 = 0.235
- TSB: 0.20/0.85 = 0.235

### Normalização de cada componente para 0–10

- **Recuperação física / mental**: já nativamente 0–10 pela definição do item 11 (reescalado do questionário combinado).
- **Sono**: já 0–10 pela fórmula do item 8.
- **TSB**: `TSB_norm(0-10) = clamp(0, 10, 5 + TSB/10)` — TSB=0 → 5 (neutro); TSB=+25 → 7.5 (não sobe demais para não premiar destreino); TSB=-25 → 2.5. Faixa de saturação: TSB ≥ +40 trava em 8; TSB ≤ -40 trava em 0.
- **HRV**: `HRV_norm(0-10) = clamp(0, 10, 5 + (HRV_hoje − HRV_baseline_7d)/HRV_baseline_7d × 50)` — variação percentual vs. média móvel de 7 dias (método rMSSD com médias log-transformadas é o padrão da literatura de Plews/Buchheit, mas simplificado aqui para % de desvio, adequado a input manual esporádico).
- **FC repouso**: `FCrep_norm(0-10) = clamp(0, 10, 5 − (FCrep_hoje − FCrep_baseline_7d) × 0.5)` — FC repouso elevada reduz o score (sinal de possível fadiga/estresse/doença).

**Justificativa dos pesos:** recuperação física+mental (0.45 combinado) dominam porque são os únicos itens diretamente validados como preditores de próximo-dia de performance/prontidão na literatura de questionários (Hooper & Mackinnon, 1995; Saw et al., 2016 revisão de measures psicométricos). TSB (0.20) traz o componente objetivo de carge/dose-resposta (Banister). Sono (0.20) é preditor independente bem estabelecido (Fullagar et al., 2015, *Sleep and Athletic Performance*). HRV/FC repouso somam apenas 0.15 porque são opcionais e, mais importante, a validade preditiva de HRV isolada para prontidão diária tem evidência mista/heterogênea na literatura (Plews et al., 2013; Bellenger et al., 2016) — não deve dominar o score.

**Referências:** Saw AE, Main LC, Gastin PB (2016). *Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review.* Br J Sports Med 50(5):281-291. Fullagar HHK, et al. (2015). Sports Med 45(2):161-186. Plews DJ, et al. (2013). *Training adaptation and heart rate variability in elite endurance athletes.* Eur J Appl Physiol.

---

## 8. Pontuação do sono (0–10)

### Fórmula

```
Sono(0-10) = (Duracao_norm × 0.6) + (Regularidade_norm × 0.4)
```

**Componente 1 — Duração** (input: horas dormidas, manual ou de wearable se integrado futuramente):

```
Duracao_norm(0-10):
   horas ≥ 8                 → 10
   7 ≤ horas < 8              → interpolação linear 8→10
   6 ≤ horas < 7              → interpolação linear 5→8
   5 ≤ horas < 6              → interpolação linear 2→5
   horas < 5                  → interpolação linear 0→2 (saturando em 0 a partir de 3h)
```

Baseado nas recomendações da National Sleep Foundation e do consenso de sono no esporte (Watson, 2017; Bird, 2013) de 7–9h como faixa ótima para atletas, com penalização mais acentuada abaixo de 6h (associado a maior risco de lesão em atletas jovens — Milewski et al., 2014).

**Componente 2 — Regularidade** (desvio-padrão do horário de dormir/acordar OU do total de horas nos últimos 7 dias — usar o que o check-in efetivamente coletar; recomendação: desvio-padrão da **duração total** por ser 1 pergunta só):

```
Regularidade_norm(0-10) = clamp(0, 10, 10 − DP_horas_sono_7dias × 4)
```

DP=0h (dorme sempre igual) → 10. DP=2.5h → 0. Regularidade do sono é preditor independente de recuperação e humor mesmo controlando duração total (Bonnar et al., 2018, revisão de sono em atletas).

**Justificativa do peso 60/40:** duração tem maior peso por ser o componente com evidência mais direta e robusta de dose-resposta com performance/recuperação; regularidade entra como modulador (Bonnar et al., 2018 sugere efeito aditivo, não dominante).

**Referências:** Watson AM (2017). *Sleep and Athletic Performance.* Curr Sports Med Rep 16(6):413-418. Bonnar D, et al. (2018). *Sleep Interventions Designed to Improve Athletic Performance.* Sports Med 48(3):683-703. Milewski MD, et al. (2014). *Chronic lack of sleep is associated with increased sports injuries.* J Pediatr Orthop 34(2):129-133.

---

## 9. % de exaustão

### Fórmula e origem

Origem: item do check-in equivalente ao domínio **"Fadiga"** do Hooper Index (escala 1–7, 1=nenhuma fadiga, 7=exaustão total) combinado com a leitura de esforço acumulado do TQR/PRS invertido.

```
%Exaustao = ((Fadiga_Hooper − 1) / 6) × 100
```

Isso remapeia a escala 1–7 do Hooper para 0–100%. Se o app usa a variante RESTQ-alinhada (escala 0–6, típica do RESTQ-Sport), a fórmula é:

```
%Exaustao = (Fadiga_bruta / Escala_max) × 100
```

genericamente, onde `Escala_max` é o teto da escala usada no item de check-in (a decisão exata da escala do item único é do agente CONTEÚDO/TOM + UX/UI, mas a normalização deve seguir esta razão simples min-max).

**Nota de design:** "% de exaustão" é semanticamente o **inverso** de "recuperação física" (item 11) quando a pergunta-fonte é a mesma (fadiga percebida). Para evitar redundância de pergunta no check-in, **%Exaustão deve ser derivado matematicamente do mesmo item de fadiga usado em Recuperação Física**, não uma pergunta separada:

```
%Exaustao = 100 − (RecuperacaoFisica_norm(0-10) × 10)
```

Isso garante consistência interna (não pode o app dizer "recuperação física alta" e "exaustão alta" ao mesmo tempo a partir de fontes desalinhadas) e cumpre a exigência de não sobrecarregar o check-in.

**Referência:** Hooper SL, Mackinnon LT (1995). *Monitoring overtraining in athletes: recommendations.* Sports Med 20(5):321-327.

---

## 10. % sugerido de redução do treino do dia

### Fórmula

```
%Reducao = clamp(0, 70, w_p × (10 − Prontidao) × 10  +  w_e × %Exaustao  +  w_l × Indice_Janela_Lesao × 10) / 3

com w_p = 0.4, w_e = 0.3, w_l = 0.3 (pesos somam 1.0; divisão por escala apropriada abaixo)
```

Forma explícita e escalada corretamente (cada termo já em % 0–100 antes da ponderação):

```
Termo_Prontidao   = (10 − Prontidao) × 10        # Prontidao=10→0%; Prontidao=0→100%
Termo_Exaustao    = %Exaustao                     # já em 0-100
Termo_Lesao       = Indice_Janela_Lesao × 10       # 0-10 → 0-100

%Reducao_bruta = 0.4×Termo_Prontidao + 0.3×Termo_Exaustao + 0.3×Termo_Lesao

%Reducao_final = clamp(0, 70, %Reducao_bruta)
```

**Justificativa do teto de 70%:** o app **nunca prescreve treino zero automaticamente** — decisão de repouso total é clínica/do coach, não algorítmica. O teto de 70% de redução é o piso de segurança que ainda deixa o coach decidir a interrupção completa manualmente. Isso deve ser confirmado com o agente PRODUTO como regra de negócio, mas é a recomendação de ciência do esporte (evitar automação de decisão médica).

### Exemplos numéricos

**Exemplo A — atleta bem recuperado, carga controlada:**
- Prontidão = 8.5 → Termo_Prontidao = (10-8.5)×10 = 15
- %Exaustão = 20%
- Índice Janela de Lesão = 2.0 → Termo_Lesão = 20
- %Redução = 0.4×15 + 0.3×20 + 0.3×20 = 6 + 6 + 6 = **18%** → arredondar para faixa de comunicação (ex: "reduza ~15-20% do volume planejado")

**Exemplo B — atleta em fadiga moderada, monotonia alta:**
- Prontidão = 5.0 → Termo_Prontidao = 50
- %Exaustão = 55%
- Índice Janela de Lesão = 5.5 → Termo_Lesão = 55
- %Redução = 0.4×50 + 0.3×55 + 0.3×55 = 20 + 16.5 + 16.5 = **53%** → "reduza cerca de metade do volume; priorize técnica sobre intensidade"

**Exemplo C — sinal de alto risco combinado (gatilho binário do item 6 ativo):**
- Prontidão = 2.5 → Termo_Prontidao = 75
- %Exaustão = 80%
- Índice Janela de Lesão = 8.0 (Alerta_Alto_Risco = TRUE) → Termo_Lesão = 80
- %Redução = 0.4×75 + 0.3×80 + 0.3×80 = 30 + 24 + 24 = **78%** → clamp em **70%**, com flag adicional "Alerta_Alto_Risco = TRUE" disparando notificação ao Coach (não é decisão só do algoritmo — precisa de revisão humana)

---

## 11. Recuperação física vs. recuperação mental

### Princípio de mapeamento (evitar redundância entre os 4 questionários)

Os 4 questionários de referência têm sobreposição conceitual significativa. A estratégia é **usar cada questionário como fonte primária de UM domínio específico**, não aplicar os 4 inteiros.

| Domínio | Fonte primária | Itens equivalentes descartados (redundantes) |
|---|---|---|
| **Recuperação física** | Hooper (soreness/DOMS + fadiga) + PRS (escala 0-10 geral) | TQR não traz granularidade física adicional relevante |
| **Recuperação mental** | RESTQ-Sport-36 (subescalas de estresse geral, conflitos/pressão, exaustão emocional) + Hooper (estresse) | — |
| **Qualidade do sono** | Hooper (sleep quality) + item de duração próprio | RESTQ tem subescala "Sleep Quality" — usar Hooper como fonte primária (mais simples/validado para uso diário) |
| **Prontidão percebida geral (cross-check)** | PRS (escala 0-10 âncorada) | Serve como validação cruzada rápida do score composto, não como input direto adicional (evita dupla contagem) |

### Fórmula — Recuperação física (0–10)

```
RecFisica(0-10) = 10 − ((Soreness_Hooper(1-7) − 1)/6 × 10) × 0.6  −  ((Fadiga_Hooper(1-7)-1)/6 ×10) × 0.4
```

Simplificado (média ponderada invertida, já que Hooper usa "alto = ruim"):

```
RecFisica(0-10) = 10 − [0.6 × Soreness_norm(0-10) + 0.4 × Fadiga_norm(0-10)]
```

Onde `Soreness_norm` e `Fadiga_norm` seguem a mesma conversão min-max 0–10 usada no item 9.

Peso maior em soreness (0.6) porque dor muscular é o marcador mais específico de dano estrutural/recuperação física verdadeira (DOMS), enquanto fadiga é mais um sintoma cruzado físico+mental (Hooper & Mackinnon, 1995; Twist & Highton, 2013 — revisão de marcadores de dano muscular).

### Fórmula — Recuperação mental (0–10)

```
RecMental(0-10) = 10 − [0.5 × Estresse_norm(0-10) + 0.5 × HumorConflito_norm(0-10)]
```

Onde:
- `Estresse_norm` vem do item de "estresse geral" (equivalente ao domínio Hooper-stress, mas semanticamente ancorado nas subescalas RESTQ de **Estresse Geral / Pressão / Conflitos Sociais** quando o check-in perguntar de forma mais ampla que apenas Hooper).
- `HumorConflito_norm` vem de um item único cobrindo o construto RESTQ de **"Recuperação Social/Emocional"** (ex: "Como está seu humor/disposição mental hoje?").

**Diferenciação física vs. mental — regra geral:** cada questionário contribui **exatamente um item** ao check-in por domínio; nenhum item é reaproveitado em mais de um score. A tabela do item 13 formaliza isso.

**Referências:** Kellmann M, Kallus KW (2001/2016). *Recovery-Stress Questionnaire for Athletes: User Manual.* Human Kinetics. Twist C, Highton J (2013). *Monitoring fatigue and recovery in rugby league players.* Int J Sports Physiol Perform 8(5):467-474.

---

## 12. Regras de fallback (dados ausentes)

| Situação | Variável afetada | Regra de fallback |
|---|---|---|
| **Sem HRV hoje** | Prontidão | Remover HRV do cálculo; redistribuir peso proporcionalmente (item 7). Se ausente por >7 dias seguidos, parar de mostrar "tendência de HRV" na UI (dado insuficiente), mas manter Prontidão calculada normalmente sem o componente. |
| **Sem FC repouso hoje** | Prontidão | Idêntico ao HRV: redistribuição proporcional de peso. |
| **Atleta pulou o check-in de ontem** | ATL, CTL, Monotonia, Prontidão, Sono, Recuperação | Carga do dia faltante = **0 se não houve treino registrado** OU **imputação pela média móvel dos últimos 7 dias válidos** se houve treino mas sem RPE reportado (ver linha abaixo). Para variáveis subjetivas (recuperação, sono), o dia sem check-in **não deve ser imputado com valor neutro (viés)** — a fórmula de EWMA/monotonia simplesmente pula o dia (não conta como 0 nem como média); usar **decaimento baseado em dias-calendário reais decorridos**, não em "número de check-ins", para não distorcer a janela temporal. Prontidão do dia seguinte usa o último dado disponível de cada componente com uma flag "dado desatualizado (>1 dia)" reduzindo a confiança exibida (ex: ícone de alerta), mas ainda calcula um número. |
| **Sessão de treino sem RPE reportado** | TRIMP/Carga diária | Fallback = duração × RPE médio pessoal das últimas 4 semanas para o mesmo tipo de sessão (se categorizado) ou RPE médio geral pessoal. Marcar como "estimado" internamente. |
| **Primeiro dia de uso (zero histórico)** | ATL, CTL, TSB, Monotonia, Strain, Índice Janela de Lesão | Sem histórico → **ATL e CTL não existem matematicamente ainda (EWMA precisa de semente).** Regra: `ATL_dia1 = Carga_dia1` e `CTL_dia1 = Carga_dia1` (a série começa igual à primeira carga observada — convenção padrão de séries EWMA sem burn-in). TSB_dia1 = 0 (neutro, não pode ser calculado com sentido). Monotonia e Strain requerem mínimo de **3 dias de carga registrada** para produzir DP não-trivial; **antes de 3 dias, exibir "Calculando... (dados insuficientes)"** em vez de um número, e **excluir a Janela de Lesão do cálculo de Prontidão** até completar 7 dias corridos de dados (mínimo estatisticamente honesto para uma janela semanal). Prontidão nesse período usa apenas recuperação física + mental + sono, com pesos redistribuídos (peso de TSB=0, redistribuído aos demais 3 componentes). |
| **CTL com menos de 28 dias de histórico** | CTL | CTL é calculado desde o dia 1 (não espera 28 dias — é EWMA recursiva, não média de janela fixa), mas a UI deve rotular CTL como "**preliminar**" até completar 28 dias corridos, pois o valor ainda está sob forte influência da carga inicial (baixa "profundidade" estatística). |
| **Menos de 14 dias para o P95 pessoal (normalização de TRIMP, item 1)** | TRIMP_norm exibido | Usar um valor de referência populacional genérico e conservador por nível declarado do atleta (iniciante/intermediário/avançado — dado de onboarding, definido pelo agente PRODUTO) até acumular 14 dias; substituir pelo P95 pessoal assim que disponível, sem necessidade de recalcular retroativamente. |
| **Sem nenhum dado hoje (check-in totalmente pulado, sem treino registrado)** | Todas as telas do dia | Tela de prontidão mostra o **último valor válido calculado**, com timestamp/label explícito ("Última atualização: há 2 dias") em vez de recalcular ou zerar. Nenhum score subjetivo é extrapolado silenciosamente sem indicar a defasagem ao usuário. |
| **Dado ausente por período longo (>14 dias, ex: lesão, férias)** | ATL, CTL | Deixar o decaimento natural da EWMA ocorrer com Carga=0 nos dias sem treino registrado (isso é fisiologicamente correto — CTL cai naturalmente refletindo destreino real), mas **não** aplicar decaimento para dias em que o app simplesmente não sabe se houve treino ou não (check-in ausente sem log de atividade) — nesse caso, é preferível **pausar o relógio da série** (manter ATL/CTL constantes) e sinalizar "gap de dados" em vez de assumir destreino que pode não ter ocorrido. Distinção chave: **treino=0 confirmado pelo usuário** vs. **ausência de informação**.

---

## 13. Matriz questionário → variável calculada (para agente CONTEÚDO/TOM)

Esta matriz define exatamente **qual pergunta única do check-in diário** alimenta qual variável, garantindo que os 4 questionários sejam representados sem duplicidade e dentro do orçamento de <60 segundos.

| # | Pergunta do check-in (conceito, tom a definir por CONTEÚDO/TOM) | Questionário de origem (base científica) | Escala nativa sugerida | Variável(is) calculada(s) alimentada(s) |
|---|---|---|---|---|
| 1 | Duração do sono na última noite (horas) | Item próprio (não de questionário validado, mas prática padrão em todos: Hooper/RESTQ/TQR mencionam sono) | Numérico (horas, ou slider 0-12h) | Sono → Duração (item 8) |
| 2 | Qualidade percebida do sono | Hooper (Sleep Quality) | 1-7 (1=ótima, 7=péssima) | Sono → Regularidade/qualidade (item 8) — combinar com histórico de duração para regularidade |
| 3 | Dor muscular / rigidez hoje (DOMS) | Hooper (Muscle Soreness) | 1-7 (1=nenhuma, 7=extrema) | Recuperação Física (item 11), contribui a %Exaustão (item 9) |
| 4 | Nível de fadiga geral | Hooper (Fatigue) | 1-7 (1=nenhuma, 7=exaustão total) | Recuperação Física (item 11) + %Exaustão (item 9, fonte primária) |
| 5 | Nível de estresse (vida/treino) | Hooper (Stress) + RESTQ (Estresse Geral) | 1-7 (1=nenhum, 7=extremo) | Recuperação Mental (item 11) |
| 6 | Humor / disposição emocional hoje | RESTQ-Sport-36 (subescala Recuperação Social/Emocional, "Being in Good Mood") | 1-7 (1=péssimo, 7=ótimo — nota: escala invertida vs. as anteriores, atenção do CONTEÚDO/TOM para padronizar direção na UI) | Recuperação Mental (item 11) |
| 7 | Estado geral de recuperação percebida (checagem rápida, âncoras específicas) | PRS — Perceived Recovery Status (Laurent et al., 2011) | 0-10 (0=muito mal recuperado, 10=totalmente recuperado) | **Validação cruzada** da Prontidão calculada (não entra como peso direto — usado para detectar divergência grande entre o score do app e a percepção do atleta, disparando alerta de recalibração) |
| 8 | Quão pronto você se sente para treinar hoje, considerando tudo (sono, dores, energia)? | TQR — Total Quality Recovery (Kenttä & Hassmén, 1998), versão simplificada TQR-10 | 6-20 (original) → app usa versão 0-10 simplificada | Cross-check adicional de Prontidão (mesmo papel do PRS — TQR e PRS são conceitualmente muito próximos; **recomendação: usar apenas UM dos dois no check-in diário para não redundar**, ver nota abaixo) |
| 9 | RPE da sessão de treino (se treinou) | Session-RPE (Foster et al., 2001) — não é um dos 4 questionários de recuperação, mas é o input de carga | 0-10 (CR-10 Borg) | TRIMP/Carga diária (item 1) → ATL/CTL/TSB/Monotonia/Strain |
| 10 | Duração da sessão de treino (se treinou) | Complementar ao Session-RPE | Numérico (minutos) | TRIMP/Carga diária (item 1) |
| 11 (opcional) | HRV de repouso (manual, se o atleta mede externamente) | N/A (dado fisiológico objetivo, não questionário) | Numérico (ms, rMSSD) | Prontidão (item 7), componente opcional |
| 12 (opcional) | FC de repouso (manual) | N/A | Numérico (bpm) | Prontidão (item 7), componente opcional |

### Nota crítica de deduplicação — PRS vs. TQR

PRS (Laurent et al., 2011) e TQR (Kenttä & Hassmén, 1998) medem constructos quase idênticos ("quão recuperado você está/quão pronto para treinar"). **Recomendação de Ciência do Esporte: incluir apenas 1 dos 2 no check-in diário** (sugestão: **PRS**, por ter âncoras verbais mais simples de traduzir/localizar e escala 0-10 nativa, que já é a escala-alvo do app, evitando conversão de escala 6-20). Isso reduz o check-in de 12 para **11 perguntas efetivas**, das quais 2 (RPE e duração) só aparecem em dias de treino — em dias sem treino, o check-in tem **9 perguntas**, todas de resposta rápida (slider/escala), compatível com o orçamento de <60 segundos.

### Resumo de contagem de perguntas por dia

- **Dia com treino:** 9 (recuperação/sono/estresse/humor/PRS) + 2 (RPE+duração) = 11 perguntas, mas a maioria é slider de 1 toque → tempo estimado 35-50s.
- **Dia sem treino:** 9 perguntas → tempo estimado 25-35s.
- HRV/FC repouso são opcionais e não contam no orçamento de tempo padrão (usuário pula se não medir).

**Referências consolidadas deste item:** Hooper SL, Mackinnon LT (1995), já citado. Kellmann M, Kallus KW (2001). *Recovery-Stress Questionnaire for Athletes.* Kenttä G, Hassmén P (1998). *Overtraining and recovery: a conceptual model.* Sports Med 26(1):1-16. Laurent CM, et al. (2011). *A practical approach to monitoring recovery: development of a perceived recovery status scale.* J Strength Cond Res 25(3):620-628.

---

## Referências completas (ordem alfabética)

1. Allen H, Coggan A. *Training and Racing with a Power Meter*, 3rd ed. VeloPress.
2. Bonnar D, Bartel K, Kakoschke N, Lang C (2018). *Sleep Interventions Designed to Improve Athletic Performance and Recovery.* Sports Medicine 48(3):683-703.
3. Bourdon PC, Cardinale M, Murray A, et al. (2017). *Monitoring Athlete Training Loads: Consensus Statement.* Int J Sports Physiol Perform 12(s2):S2-161–S2-170.
4. Foster C (1998). *Monitoring training in athletes with reference to overtraining syndrome.* Med Sci Sports Exerc 30(7):1164-1168.
5. Foster C, Florhaug JA, Franklin J, et al. (2001). *A new approach to monitoring exercise training.* J Strength Cond Res 15(1):109-115.
6. Fullagar HHK, Skorski S, Duffield R, et al. (2015). *Sleep and Athletic Performance.* Sports Medicine 45(2):161-186.
7. Gabbett TJ (2016). *The training—injury prevention paradox: should athletes be training smarter and harder?* Br J Sports Med 50(5):273-280.
8. Haddad M, Stylianides G, Djaoui L, et al. (2017). *Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors.* Frontiers in Physiology 8:612.
9. Hooper SL, Mackinnon LT (1995). *Monitoring overtraining in athletes: recommendations.* Sports Medicine 20(5):321-327.
10. Hulin BT, Gabbett TJ, Blanch P, et al. (2014). *Spikes in acute:chronic workload ratio... predict injury.* Br J Sports Med 48(8):708-712.
11. Impellizzeri FM, Rampinini E, Marcora SM (2004). Med Sci Sports Exerc 36(6):1042-1047.
12. Kellmann M, Kallus KW (2001, 2016). *Recovery-Stress Questionnaire for Athletes: User Manual.* Human Kinetics.
13. Kenttä G, Hassmén P (1998). *Overtraining and recovery: a conceptual model.* Sports Medicine 26(1):1-16.
14. Laurent CM, Green JM, Bishop PA, et al. (2011). *A practical approach to monitoring recovery: development of a perceived recovery status scale.* J Strength Cond Res 25(3):620-628.
15. Milewski MD, Skaggs DL, Bishop GA, et al. (2014). *Chronic lack of sleep is associated with increased sports injuries.* J Pediatr Orthop 34(2):129-133.
16. Plews DJ, Laursen PB, Stanley J, et al. (2013). *Training adaptation and heart rate variability in elite endurance athletes.* Eur J Appl Physiol.
17. Saw AE, Main LC, Gastin PB (2016). *Monitoring the athlete training response... subjective measures trump objective measures: systematic review.* Br J Sports Med 50(5):281-291.
18. Twist C, Highton J (2013). *Monitoring fatigue and recovery in rugby league players.* Int J Sports Physiol Perform 8(5):467-474.
19. Watson AM (2017). *Sleep and Athletic Performance.* Curr Sports Med Rep 16(6):413-418.
20. Williams S, West S, Cross MJ, Stokes KA (2017). *Better way to determine the acute:chronic workload ratio?* Br J Sports Med 51(3):209-210.

---

## Itens em aberto para o ORQUESTRADOR / PRODUTO validar

1. **Janela de CTL (28 vs. 42 dias)** — recomendação: 28 dias, mas é decisão de produto/público-alvo.
2. **Teto de 70% na redução de treino** — regra de segurança para não automatizar decisão de repouso total; precisa de sign-off de PRODUTO (e possivelmente revisão legal/responsabilidade).
3. **Escolha entre PRS e TQR** — recomendação: manter apenas PRS no check-in diário (ver item 13), eliminando redundância.
4. **Nível declarado do atleta no onboarding** (iniciante/intermediário/avançado) é pré-requisito para o fallback do item 1 (P95 populacional) — confirmar que o fluxo de onboarding do PRODUTO coleta esse dado.
