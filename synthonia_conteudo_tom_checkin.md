# Check-in Diário — Conteúdo & Tom (SynthonIA) — Stage 4/8

Tom: leve, bem-humorado, parceiro de treino — nunca deboche. Humor na embalagem (adjetivos, emojis pontuais, analogias), nunca no conteúdo científico (as âncoras semânticas dos instrumentos originais permanecem intactas para não quebrar validade do Hooper Index / RESTQ / PRS / RPE).

---

## 0. Onboarding rápido do check-in

> "Antes de treinar, um raio-x rápido de como você chegou hoje. Leva menos de 1 minuto e ajuda a gente a te dar um treino que combina com o seu corpo — não com o corpo que você gostaria de ter dormido a noite passada. 😴"

*(Variação curta:)* "60 segundos, 13 perguntas, zero julgamento. É assim que a gente sabe se hoje é dia de acelerar ou de pisar no freio."

---

## 1. Campos obrigatórios (escala 1-7, exceto duração)

### 1. `qualidade_sono` — "Como foi seu sono essa noite?"
Microcopy: "Pense na noite inteira, não só na hora que o despertador tocou."
| Valor | Rótulo |
|---|---|
| 1 | Muito ruim — foi mais uma vigília com intervalos |
| 2 | Ruim — dormi, mas não descansei |
| 3 | Meio fraca — deu pra levantar, só isso |
| 4 | Regular — nem ajudou nem atrapalhou |
| 5 | Boa — acordei funcional |
| 6 | Muito boa — acordei antes do despertador e nem fiquei bravo |
| 7 | Excelente — dormi como se tivesse hibernando |

### 2. `duracao_sono_horas` — "Quantas horas você dormiu, no total?"
Microcopy: "Vale soneca gigante de manhã também — soma tudo." (input numérico decimal, sem rótulos de humor)

### 3. `fadiga_geral` — "Qual seu nível de cansaço geral agora?"
Microcopy: "Não é sono — é a bateria do corpo mesmo, antes de qualquer café."
| Valor | Rótulo |
|---|---|
| 1 | Nenhuma — pilhas 100% |
| 2 | Muito leve — só uma pontinha |
| 3 | Leve — presente, mas discreta |
| 4 | Moderada — dá pra notar no dia a dia |
| 5 | Alta — o corpo já está pedindo pausa |
| 6 | Muito alta — cada tarefa pesa o dobro |
| 7 | Exaustão total — sem bateria, sem power bank |

### 4. `estresse_percebido` — "E o estresse? Como está a cabeça hoje?"
Microcopy: "Treino, trabalho, trânsito, grupo de família no WhatsApp — tudo conta."
| Valor | Rótulo |
|---|---|
| 1 | Nenhum — tranquilidade total |
| 2 | Muito leve — quase imperceptível |
| 3 | Leve — só um ruído de fundo |
| 4 | Moderado — presente e perceptível |
| 5 | Alto — pesando bastante |
| 6 | Muito alto — no limite |
| 7 | Extremo — o pote está transbordando |

### 5. `humor_disposicao` (escala invertida: 1=péssimo, 7=ótimo) — "Como está seu humor e disposição hoje?"
Microcopy: "Vale sinceridade — ninguém aqui vai contar pro seu treinador... poxa, menos ele. 😅"
| Valor | Rótulo |
|---|---|
| 1 | Péssimo — hoje é dia de café em silêncio |
| 2 | Muito ruim — pavio curto |
| 3 | Ruim — meio na defensiva |
| 4 | Neutro — nem lá nem cá |
| 5 | Bom — de bem com a vida |
| 6 | Muito bom — animado e disposto |
| 7 | Ótimo — hoje eu abraçaria até o despertador |

*(Atenção de implementação: manter a inversão correta — 1 = pior estado emocional, igual ao RESTQ original.)*

### 6. `dor_muscular` — "Quanta dor muscular você sente hoje?"
Microcopy: "Aquela dorzinha de 'ontem treinei mesmo' conta — seja honesto com a escala."
| Valor | Rótulo |
|---|---|
| 1 | Nenhuma — corpo leve, sem sinal de treino |
| 2 | Muito leve — quase não percebo |
| 3 | Leve — notei ao me mexer |
| 4 | Moderada — incomoda em certos movimentos |
| 5 | Alta — dificulta o movimento normal |
| 6 | Muito alta — dói pra sentar e levantar |
| 7 | Extrema — cada escada é uma decisão de vida |

*(Humor mais comedido de propósito — dor é sintoma clínico-relevante.)*

### 7. `prontidao_percebida` (0-10, PRS) — "Considerando tudo — sono, cansaço, dor, cabeça — o quanto você se sente pronto pra treinar hoje?"
Microcopy: "Essa é a pergunta que resume todas as outras. Confie no seu instinto."
- 0 = "Nada pronto — hoje o sofá vence"
- 5 = "Mais ou menos — daria pra ir, sem exagero"
- 10 = "Totalmente pronto — bota o treino mais difícil da semana"

---

## 2. Campos condicionais (se `treinou_ontem` = Sim)

### 8. `treinou_ontem` — "Você treinou ontem?" (toggle Sim/Não)

### 9. `rpe_treino_anterior` — "Numa escala de 0 a 10, quão puxado foi o treino de ontem?"
Microcopy: "Pense no esforço geral da sessão inteira, não só no pico."
| Valor | Rótulo |
|---|---|
| 0 | Nada — foi só um aquecimento disfarçado |
| 1-2 | Muito leve |
| 3-4 | Leve a moderado |
| 5-6 | Um tanto puxado |
| 7-8 | Puxado — precisou de foco |
| 9 | Muito puxado — quase no limite |
| 10 | Máximo — dei tudo que tinha (e um pouco do que não tinha) |

### 10. `duracao_treino_anterior_min` — "Quanto tempo durou o treino de ontem (em minutos)?"
Microcopy: "Do aquecimento ao alongamento final — vale contar tudo."

---

## 3. Campos opcionais (sempre por último)

### 11. `hrv_ms` — "Tem seu HRV de hoje? (opcional)" — "Se você mede isso, já sabe o valor. Se não mede, pode pular numa boa."
### 12. `fc_repouso_bpm` — "E a FC de repouso, em bpm? (opcional)" — "Aquele número que seu relógio/app mostra assim que você acorda."
### 13. `nota_livre` — Link colapsado: "+ adicionar comentário" — Placeholder: "Alguma coisa que os números não contam? (máx. 200 caracteres)"

---

## 4. Mensagens de confirmação pós-envio (variações)

1. "Check-in feito! Seus dados já estão trabalhando enquanto você aquece. 💪"
2. "Recebido! Agora é só treinar — a análise é com a gente."
3. "Boa! Check-in registrado. Bora ver o que o corpo tem a dizer sobre o treino de hoje."
4. "Prontinho — check-in salvo. Seu treino de hoje já está sendo calibrado com essas respostas."

---

## 5. CTA — check-in ainda não feito (Home)

**Texto:** "Ainda não rolou seu check-in de hoje" · **Botão:** "Fazer check-in (1 min)"
Microcopy: "Sem check-in, sem prontidão calculada — e sem prontidão, o treino de hoje fica no escuro."

---

## 6. Explicações automáticas da prontidão (US-20)

1. "Sono baixo e estresse alto pesaram hoje — sua prontidão veio abaixo da média da semana."
2. "Boa notícia: sono em dia e dor muscular baixa deram um empurrão na sua prontidão hoje."
3. "Fadiga elevada foi o principal freio hoje — mesmo com bom humor, o corpo pediu calma."

*(Padrão: [fator 1] + [fator 2] + efeito, tom informativo-neutro, nunca alarmista.)*

---

## 7. Estimativa de tempo (orçamento <60s)

Total interação pura (todos os 13 campos): **~37 segundos**. Rótulos calibrados para caber em 1 linha em mobile; perguntas principais com no máximo 8-10 palavras; microcopy de apoio é dispensável/ocultável após a primeira semana de uso.

---

## 8. Ambiguidades identificadas (para QA e Ciência do Esporte revisarem)

1. **Rótulos intermediários (2,3,5,6):** Hooper Index original define oficialmente só pontos-âncora (1, 4, 7); os rótulos intermediários são preenchimento de UX, não fazem parte do instrumento validado — risco de viés de ancoragem semântica a confirmar com Ciência do Esporte.
2. **Direção invertida em `humor_disposicao`:** risco de o usuário errar o sentido por hábito adquirido nos campos anteriores (todos 1=menor intensidade, exceto este). Recomenda-se reforço visual (UX) além do texto.
3. **Dor muscular/fadiga são campos sensíveis:** humor mantido discreto nesses dois. Sugestão: se o padrão de respostas indicar sinal de alerta real, suprimir mensagens celebrativas pós-check-in (decisão de Produto/Backend, fora do escopo de redação).
4. **`prontidao_percebida` como pergunta "resumo":** sobreposição semântica esperada e validada pela literatura do PRS — não remover a frase de contexto que justifica a repetição ao usuário.
5. **RPE de Borg agrupado em faixas:** os rótulos oficiais da escala CR-10 são termos técnicos fixos por cada ponto 0-10; o agrupamento em faixas foi uma escolha de tom/tempo. Decisão pendente: fidelidade literal ao Borg (mais lento) vs. tempo de resposta (mais rápido).

---

**Status:** Pronto para handoff a Backend/Frontend após QA validar os pontos 1, 2, 3 e 5 acima.
