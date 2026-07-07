# SynthonIA — Especificação de Backend (PostgreSQL/Supabase)

Status: especificação/migração para projeto Supabase ainda não criado. Nenhum comando aqui foi executado contra um banco vivo. Convenções: `snake_case`, `uuid` como PK padrão (compatível com `auth.users` do Supabase), timestamps em `timestamptz`, datas de calendário em `date` puro (sem hora) quando representam "dia do atleta".

---

## 0. Extensões e convenções gerais

```sql
-- Extensões necessárias
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- suporte a exclusion constraints se necessário no futuro

-- Schema de aplicação (opcional, usamos "public" por simplicidade do MVP)
-- Todas as tabelas assumem RLS habilitado por padrão em Supabase managed Postgres.

-- Enum de papel do usuário
create type user_role as enum ('coach', 'atleta');

-- Enum de status de vínculo coach-atleta
create type vinculo_status as enum ('pendente', 'ativo', 'revogado');

-- Enum de status de convite
create type convite_status as enum ('pendente', 'usado', 'expirado', 'cancelado');
```

---

## 1. `profiles`

Estende `auth.users` do Supabase. 1 papel por conta nesta v1 (coach OU atleta, não ambos).

```sql
create table public.profiles (
    id                  uuid primary key references auth.users(id) on delete cascade,
    role                user_role not null,
    nome_completo        text not null,
    -- fuso horário do usuário: crítico para "data_referencia" do check-in.
    -- IANA tz name (ex: 'America/Sao_Paulo'). Sem isso não dá para calcular
    -- corretamente a virada do dia do atleta.
    timezone            text not null default 'America/Sao_Paulo',
    avatar_url          text,
    ativo               boolean not null default true, -- soft-disable de conta, não é exclusão
    criado_em           timestamptz not null default now(),
    atualizado_em       timestamptz not null default now()
);

comment on table public.profiles is
'Perfil de aplicação, 1:1 com auth.users. role fixo por conta nesta v1 (sem multi-papel).';
comment on column public.profiles.timezone is
'Fuso IANA do usuário. Usado para calcular data_referencia dos check-ins (dia calendário local do atleta, não UTC).';

-- Trigger simples para manter atualizado_em em dia
create or replace function public.tg_set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_profiles_atualizado_em
before update on public.profiles
for each row execute function public.tg_set_atualizado_em();
```

---

## 2. `convites`

Convite unidirecional: coach gera um código, atleta insere o código para solicitar vínculo. Consentimento explícito de ambos os lados é modelado via o fluxo: convite criado (coach) → atleta "resgata" o convite (aceita) → isso cria uma linha em `coach_atleta_vinculo` com status `pendente` ou já `ativo`, dependendo da decisão de produto sobre dupla confirmação.

Decisão adotada aqui: resgate do código pelo atleta **já constitui o consentimento do atleta**; o consentimento do coach já está implícito em ter gerado o convite. Portanto o vínculo nasce `ativo` diretamente ao ser resgatado (sem etapa extra de aprovação do coach) — **mas isso é parametrizável**, ver comentário na tabela de vínculo.

```sql
create table public.convites (
    id                  uuid primary key default gen_random_uuid(),
    coach_id            uuid not null references public.profiles(id) on delete cascade,
    codigo              text not null unique, -- código curto, gerado pela aplicação (ex: 6-8 chars alfanuméricos)
    status              convite_status not null default 'pendente',
    criado_em           timestamptz not null default now(),
    expira_em           timestamptz not null default (now() + interval '7 days'),
    usado_por_atleta_id uuid references public.profiles(id) on delete set null,
    usado_em            timestamptz,

    constraint chk_convite_coach_role check (true) -- validado via trigger abaixo (não dá para checar role em CHECK direto sem função)
);

comment on table public.convites is
'Convite unidirecional gerado pelo coach. Atleta insere o código para solicitar/efetivar vínculo. Expira em 7 dias por padrão (ajustável).';

-- Garante que só coach pode criar convite (valida role do profile)
create or replace function public.tg_convite_valida_coach()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.coach_id and p.role = 'coach'
  ) then
    raise exception 'Somente contas com role=coach podem gerar convites.';
  end if;
  return new;
end;
$$;

create trigger trg_convite_valida_coach
before insert on public.convites
for each row execute function public.tg_convite_valida_coach();

create index idx_convites_codigo on public.convites(codigo) where status = 'pendente';
create index idx_convites_coach on public.convites(coach_id);
```

---

## 3. `coach_atleta_vinculo`

Regra de negócio: 1 coach : N atletas; 1 atleta : no máximo 1 coach **ativo** simultaneamente (um atleta pode ter histórico de vínculos revogados com outros coaches, mas só 1 ativo por vez).

```sql
create table public.coach_atleta_vinculo (
    id                  uuid primary key default gen_random_uuid(),
    coach_id            uuid not null references public.profiles(id) on delete cascade,
    atleta_id           uuid not null references public.profiles(id) on delete cascade,
    status              vinculo_status not null default 'pendente',
    convite_id          uuid references public.convites(id) on delete set null,

    consentimento_atleta_em timestamptz, -- preenchido quando atleta resgata o convite
    consentimento_coach_em  timestamptz, -- preenchido na criação do convite (implícito) ou em fluxo de dupla-aprovação futuro

    ativado_em          timestamptz,     -- quando status passou a 'ativo'
    revogado_em         timestamptz,     -- quando status passou a 'revogado'
    revogado_por        uuid references public.profiles(id), -- quem desvinculou (coach ou atleta podem revogar)

    -- ============================================================
    -- PARÂMETRO CONFIGURÁVEL (decisão pendente de Val):
    -- Ao desvincular, o acesso do coach é revogado IMEDIATAMENTE.
    -- Mas o acesso ao HISTÓRICO retroativo (check-ins anteriores à
    -- revogação) é uma decisão de produto ainda em aberto.
    -- Este campo permite configurar por vínculo (ou globalmente via
    -- default) se o corte de acesso histórico é retroativo total
    -- ou só dali para frente.
    --   'total'    -> coach perde acesso a TODO o histórico do atleta,
    --                 inclusive dados gerados durante o vínculo ativo.
    --   'parcial'  -> coach mantém leitura do histórico gerado durante
    --                 o período em que o vínculo esteve ativo, mas não
    --                 vê nada gerado depois da revogação.
    -- Default proposto: 'total' (mais conservador do ponto de vista
    -- de privacidade do atleta). AJUSTAR conforme decisão de Val.
    -- ============================================================
    politica_acesso_pos_revogacao text not null default 'total'
        check (politica_acesso_pos_revogacao in ('total', 'parcial')),

    criado_em           timestamptz not null default now(),
    atualizado_em       timestamptz not null default now(),

    constraint chk_coach_atleta_distintos check (coach_id <> atleta_id)
);

comment on table public.coach_atleta_vinculo is
'Vínculo coach-atleta. Regra: no máximo 1 vínculo com status=ativo por atleta (enforced via índice único parcial abaixo).';

comment on column public.coach_atleta_vinculo.politica_acesso_pos_revogacao is
'Parâmetro configurável: define se, após revogação, o acesso do coach ao histórico gerado durante o vínculo é cortado totalmente (total) ou preservado só até a data de revogação (parcial). Decisão de produto pendente com Val — default conservador = total.';

-- Regra dura: 1 atleta só pode ter 1 vínculo ATIVO por vez.
create unique index uq_atleta_vinculo_ativo
    on public.coach_atleta_vinculo(atleta_id)
    where status = 'ativo';

-- Evita duplicar vínculo pendente duplicado do mesmo par coach/atleta
create unique index uq_coach_atleta_pendente
    on public.coach_atleta_vinculo(coach_id, atleta_id)
    where status = 'pendente';

create index idx_vinculo_coach_status on public.coach_atleta_vinculo(coach_id, status);
create index idx_vinculo_atleta_status on public.coach_atleta_vinculo(atleta_id, status);

create trigger trg_vinculo_atualizado_em
before update on public.coach_atleta_vinculo
for each row execute function public.tg_set_atualizado_em();

-- Trigger para carimbar ativado_em / revogado_em automaticamente na transição de status
create or replace function public.tg_vinculo_transicao_status()
returns trigger language plpgsql as $$
begin
  if new.status = 'ativo' and old.status is distinct from 'ativo' then
    new.ativado_em = now();
  end if;
  if new.status = 'revogado' and old.status is distinct from 'revogado' then
    new.revogado_em = now();
  end if;
  return new;
end;
$$;

create trigger trg_vinculo_transicao
before update on public.coach_atleta_vinculo
for each row execute function public.tg_vinculo_transicao_status();
```

---

## 4. `checkins`

13 campos + metadados. **1 registro por atleta por dia** (enforced via UNIQUE em `atleta_id, data_referencia`).

### Decisão de direção de escala (ponto crítico)

Adotamos a opção **(a)** recomendada: armazenar exatamente como exibido ao atleta (1 = pior estado, 7 = melhor estado, consistente nas 5 escalas). A conversão para a direção que cada fórmula científica espera (Hooper Index trata "alto = ruim"; RESTQ trata humor como "alto = bom") acontece **somente na camada de cálculo** (função/view), nunca no armazenamento. Isso mantém o dado bruto = experiência do usuário, e isola a lógica científica em um único lugar auditável.

```sql
create table public.checkins (
    id                          uuid primary key default gen_random_uuid(),
    atleta_id                   uuid not null references public.profiles(id) on delete cascade,

    -- ===== metadados de tempo =====
    data_referencia             date not null, -- dia calendário LOCAL do atleta (calculado no client/app usando profiles.timezone)
    timestamp_envio             timestamptz not null default now(),
    versao_checkin              smallint not null default 1, -- versionamento do formulário, para migrações futuras de escala/campos
    editado                     boolean not null default false,
    timestamp_ultima_edicao     timestamptz,

    -- ===== 7 campos obrigatórios =====
    -- Todas as escalas 1-7 abaixo seguem a MESMA direção de exibição:
    -- 1 = pior estado possível, 7 = melhor estado possível.
    qualidade_sono              smallint not null check (qualidade_sono between 1 and 7),
    duracao_sono_horas          numeric(4,2) not null check (duracao_sono_horas >= 0 and duracao_sono_horas <= 24),
    fadiga_geral                smallint not null check (fadiga_geral between 1 and 7),      -- 1=muito fatigado ... 7=nada fatigado
    estresse_percebido          smallint not null check (estresse_percebido between 1 and 7), -- 1=muito estressado ... 7=nada estressado
    humor_disposicao            smallint not null check (humor_disposicao between 1 and 7),   -- 1=humor ruim ... 7=humor ótimo
    dor_muscular                smallint not null check (dor_muscular between 1 and 7),        -- 1=dor intensa ... 7=sem dor
    prontidao_percebida         numeric(3,1) not null check (prontidao_percebida >= 0 and prontidao_percebida <= 10), -- PRS, 0-10

    -- ===== 3 campos condicionais (se treinou_ontem = true) =====
    treinou_ontem                boolean not null default false,
    rpe_treino_anterior          numeric(3,1) check (rpe_treino_anterior >= 0 and rpe_treino_anterior <= 10),
    duracao_treino_anterior_min  integer check (duracao_treino_anterior_min >= 0 and duracao_treino_anterior_min <= 1440),

    -- ===== 3 campos opcionais =====
    hrv_ms                       numeric(6,2) check (hrv_ms is null or hrv_ms >= 0),
    fc_repouso_bpm               numeric(5,2) check (fc_repouso_bpm is null or (fc_repouso_bpm > 0 and fc_repouso_bpm < 300)),
    nota_livre                   varchar(200),

    criado_em                    timestamptz not null default now(),

    -- 1 check-in por atleta por dia
    constraint uq_checkin_atleta_dia unique (atleta_id, data_referencia),

    -- consistência dos condicionais: se treinou_ontem = false, os campos dependentes devem ser nulos
    constraint chk_condicionais_treino check (
        (treinou_ontem = true) or
        (treinou_ontem = false and rpe_treino_anterior is null and duracao_treino_anterior_min is null)
    ),
    -- se treinou_ontem = true, exigimos ao menos o RPE (duração pode ficar opcional se o produto permitir, mas recomendado obrigar ambos)
    constraint chk_treino_exige_rpe check (
        treinou_ontem = false or rpe_treino_anterior is not null
    )
);

comment on table public.checkins is
'Check-in diário do atleta. 13 campos: 7 obrigatórios + 3 condicionais + 3 opcionais. 1 registro por atleta por data_referencia.';

comment on column public.checkins.qualidade_sono is
'Escala 1-7 exibida ao usuário: 1=pior qualidade de sono, 7=melhor. Direção de fórmula (Hooper: alto=ruim) é convertida em public.fn_hooper_converter, nunca aqui.';
comment on column public.checkins.fadiga_geral is
'Escala 1-7 exibida ao usuário: 1=muito fatigado, 7=nada fatigado (mesma direção "alto=melhor" das demais escalas). Hooper Index espera "alto=ruim" -> conversão isolada na função de cálculo.';
comment on column public.checkins.estresse_percebido is
'Escala 1-7: 1=muito estressado, 7=nada estressado. Conversão para Hooper (alto=ruim) feita na camada de cálculo.';
comment on column public.checkins.humor_disposicao is
'Escala 1-7: 1=humor/disposição ruim, 7=ótimo. RESTQ trata humor como "alto=bom" -> já compatível diretamente, sem inversão necessária (ver função de conversão para o mapeamento explícito campo a campo).';
comment on column public.checkins.dor_muscular is
'Escala 1-7: 1=dor intensa, 7=sem dor. Conversão para Hooper (alto=ruim) feita na camada de cálculo.';
comment on column public.checkins.prontidao_percebida is
'PRS (Perceived Readiness Score), escala 0-10, 0=nada pronto, 10=totalmente pronto. Já nasce na direção "alto=melhor", sem necessidade de inversão.';
comment on column public.checkins.data_referencia is
'Data calendário LOCAL do atleta (usa profiles.timezone). Base para todas as séries temporais de ATL/CTL/monotonia — NUNCA usar timestamp_envio para isso.';
comment on column public.checkins.versao_checkin is
'Versão do formulário/escala no momento do preenchimento. Permite migrar regras de conversão sem quebrar histórico caso o formato de escala mude no futuro.';

create index idx_checkins_atleta_data on public.checkins(atleta_id, data_referencia desc);
create index idx_checkins_data on public.checkins(data_referencia);
```

---

## 5. `treino_planejado`

Cadastrado por coach ou atleta, por atleta, por data.

```sql
create table public.treino_planejado (
    id                  uuid primary key default gen_random_uuid(),
    atleta_id           uuid not null references public.profiles(id) on delete cascade,
    criado_por          uuid not null references public.profiles(id), -- coach ou o próprio atleta
    data_planejada      date not null,

    tipo_treino         text,              -- ex: 'corrida', 'força', 'bike', 'recovery' — livre/enum futuro
    descricao           text,
    duracao_planejada_min integer check (duracao_planejada_min is null or duracao_planejada_min between 0 and 1440),
    rpe_planejado       numeric(3,1) check (rpe_planejado is null or rpe_planejado between 0 and 10),
    carga_planejada     numeric(8,2), -- opcional, se o coach já registrar TRIMP/carga alvo

    concluido           boolean not null default false, -- flag simples de execução (detalhe fino fica no checkin do dia seguinte)

    criado_em           timestamptz not null default now(),
    atualizado_em       timestamptz not null default now()
);

comment on table public.treino_planejado is
'Treino planejado por atleta/data. Pode ser criado pelo coach vinculado ou pelo próprio atleta.';

create trigger trg_treino_planejado_atualizado_em
before update on public.treino_planejado
for each row execute function public.tg_set_atualizado_em();

create index idx_treino_planejado_atleta_data on public.treino_planejado(atleta_id, data_planejada desc);
```

---

## 6. Camada de cálculo — conversão de direção de escala

Isolamos toda a lógica de conversão em uma função SQL pura, documentando o mapeamento campo a campo. Isso é a "fonte da verdade" para qualquer fórmula (Hooper, RESTQ, etc.) que precise da direção "alto = ruim" ou "alto = bom" diferente da exibição.

```sql
-- ============================================================
-- Mapeamento oficial de conversão de escala (1-7, exibição -> fórmula)
--
-- Exibição ao usuário (armazenado em checkins): SEMPRE 1=pior, 7=melhor.
--
-- Hooper Index clássico exige "alto = ruim" para:
--   sono, fadiga, estresse, dor muscular
--   -> conversão: valor_hooper = 8 - valor_exibido   (inverte 1<->7, 2<->6, 3<->5, 4=4)
--
-- RESTQ (subescala de humor/recuperação) exige "alto = bom":
--   humor_disposicao já está armazenado como "alto = bom" (7=ótimo humor)
--   -> conversão: valor_restq = valor_exibido  (identidade, sem inversão)
--
-- PRS (prontidao_percebida) já é 0-10 "alto=melhor" nativamente, sem conversão.
-- ============================================================

create or replace function public.fn_inverter_escala_1_7(valor_exibido smallint)
returns smallint
language sql
immutable
as $$
    select (8 - valor_exibido)::smallint;
$$;

comment on function public.fn_inverter_escala_1_7 is
'Inverte uma escala 1-7 exibida ao usuário (1=pior,7=melhor) para a direção "alto=ruim" exigida por fórmulas como Hooper Index. Fórmula: 8 - valor.';

-- View intermediária: valores já convertidos para a direção de cada fórmula,
-- por check-in. Uma linha por checkin, mantendo rastreabilidade ao dado bruto.
create or replace view public.v_checkin_convertido as
select
    c.id                     as checkin_id,
    c.atleta_id,
    c.data_referencia,

    -- ---- valores brutos (exibição), preservados para auditoria ----
    c.qualidade_sono          as sono_exibido,
    c.fadiga_geral            as fadiga_exibida,
    c.estresse_percebido      as estresse_exibido,
    c.humor_disposicao        as humor_exibido,
    c.dor_muscular            as dor_exibida,

    -- ---- convertidos para Hooper Index (alto = ruim) ----
    public.fn_inverter_escala_1_7(c.qualidade_sono)     as hooper_sono,
    public.fn_inverter_escala_1_7(c.fadiga_geral)       as hooper_fadiga,
    public.fn_inverter_escala_1_7(c.estresse_percebido) as hooper_estresse,
    public.fn_inverter_escala_1_7(c.dor_muscular)       as hooper_dor,
    -- Hooper Index tradicional = soma das 4 subescalas (0-7 cada, quanto maior pior).
    -- Aqui o range fica 1-7 por escala (ajustar offset -1 se quiser 0-6 padrão Hooper original).
    (public.fn_inverter_escala_1_7(c.qualidade_sono)
     + public.fn_inverter_escala_1_7(c.fadiga_geral)
     + public.fn_inverter_escala_1_7(c.estresse_percebido)
     + public.fn_inverter_escala_1_7(c.dor_muscular))   as hooper_index_total,

    -- ---- convertido para RESTQ (alto = bom), humor já nasce nessa direção ----
    c.humor_disposicao        as restq_humor, -- identidade, sem inversão

    -- ---- PRS, sem conversão ----
    c.prontidao_percebida     as prs

from public.checkins c;

comment on view public.v_checkin_convertido is
'View de conversão: aplica o mapeamento de direção de escala documentado (Hooper=inversão 8-x para sono/fadiga/estresse/dor; RESTQ humor=identidade; PRS=identidade). Toda fórmula científica downstream deve ler daqui, nunca direto de checkins, para não reintroduzir erro de direção.';
```

---

## 7. `metricas_diarias` — métricas calculadas

Design: **tabela materializada** (não view simples), porque ATL/CTL exigem EWMA recursivo sobre histórico — caro de recalcular via view a cada leitura de dashboard. Populada por job/trigger que roda a função de cálculo diariamente (ou on-demand ao gravar um check-in novo).

### 7.1 Geração de série temporal por data calendário (evita gap = zero)

O ponto crítico: ATL/CTL/monotonia usam decaimento (EWMA) baseado em **dias-calendário decorridos**, não em contagem de check-ins. Um atleta que não faz check-in por 3 dias não pode ter esses 3 dias tratados como carga=0 "pulados" silenciosamente — o decaimento exponencial precisa avançar 3 dias reais, e a ausência de dado deve ficar marcada como gap explícito (não confundida com "treino zero, mas presente").

```sql
-- Gera uma série contínua de datas por atleta (do primeiro checkin até hoje),
-- e faz LEFT JOIN com checkins reais. Onde não há checkin, a linha existe
-- (a data calendário existe) mas as métricas de entrada ficam NULL — sinalizando
-- gap, não zero. As fórmulas de EWMA devem tratar NULL como "sem contribuição
-- de carga nova" mas ainda assim avançar o fator de decaimento pelo número de
-- dias reais transcorridos desde a última amostra válida.

create or replace function public.fn_serie_calendario_atleta(p_atleta_id uuid, p_desde date, p_ate date)
returns table (atleta_id uuid, data date)
language sql
stable
as $$
    select p_atleta_id, gs::date
    from generate_series(p_desde, p_ate, interval '1 day') as gs;
$$;

comment on function public.fn_serie_calendario_atleta is
'Gera série contínua de datas calendário (sem pular dias) para um atleta. Base para LEFT JOIN com checkins, garantindo que gaps de check-in fiquem como NULL explícito, nunca como zero implícito, preservando o decaimento correto do EWMA em ATL/CTL/monotonia.';

-- Exemplo de uso na construção da carga diária (TRIMP) com gap explícito:
--
-- with calendario as (
--     select * from public.fn_serie_calendario_atleta('<atleta_id>', '<data_inicio>', current_date)
-- ),
-- carga_bruta as (
--     select
--         cal.atleta_id,
--         cal.data,
--         -- carga do dia = TRIMP calculado a partir do treino_planejado + checkin do dia seguinte
--         -- (rpe_treino_anterior * duracao_treino_anterior_min), reportado no checkin da manhã seguinte
--         case when c.treinou_ontem then c.rpe_treino_anterior * c.duracao_treino_anterior_min end as trimp,
--         (c.id is null) as sem_checkin -- flag explícita de gap
--     from calendario cal
--     left join public.checkins c
--         on c.atleta_id = cal.atleta_id and c.data_referencia = cal.data
-- )
-- select * from carga_bruta order by data;
--
-- O cálculo de ATL/CTL (EWMA) deve iterar essa série ordenada por data,
-- usando span real em dias entre amostras consecutivas no expoente de
-- decaimento (não span=1 fixo), e tratando trimp NULL como "0 de carga
-- NOVA hoje" apenas para fins de acumulação de treino — mas o CAMPO
-- sem_checkin deve ser propagado para metricas_diarias para permitir
-- ao frontend exibir "sem dado" em vez de "prontidão 0" no dashboard.
```

### 7.2 Tabela `metricas_diarias`

```sql
create table public.metricas_diarias (
    id                          uuid primary key default gen_random_uuid(),
    atleta_id                   uuid not null references public.profiles(id) on delete cascade,
    data_referencia             date not null,

    -- flag explícita de gap: true = não houve checkin nesse dia.
    -- Consumida pelo frontend para diferenciar "métrica calculada com dado real"
    -- de "métrica projetada apenas via decaimento, sem input do dia".
    sem_checkin_no_dia          boolean not null default false,

    -- ---- carga de treino ----
    trimp_carga_diaria          numeric(10,2),        -- null se sem treino relatado no dia
    atl_7d                      numeric(10,2),         -- EWMA de carga aguda (7 dias)
    ctl_28d                     numeric(10,2),         -- EWMA de carga crônica (28 dias)
    tsb                         numeric(10,2),         -- CTL - ATL (training stress balance)

    monotonia_diaria            numeric(6,3),
    monotonia_semanal           numeric(6,3),

    -- ---- índices compostos (0-10) ----
    indice_janela_lesao         numeric(4,2) check (indice_janela_lesao is null or indice_janela_lesao between 0 and 10),
    prontidao                   numeric(4,2) check (prontidao is null or prontidao between 0 and 10),
    recuperacao_fisica          numeric(4,2) check (recuperacao_fisica is null or recuperacao_fisica between 0 and 10),
    recuperacao_mental          numeric(4,2) check (recuperacao_mental is null or recuperacao_mental between 0 and 10),
    pontuacao_sono              numeric(4,2) check (pontuacao_sono is null or pontuacao_sono between 0 and 10),

    -- ---- percentuais ----
    percentual_exaustao         numeric(5,2) check (percentual_exaustao is null or percentual_exaustao between 0 and 100),
    percentual_reducao_sugerida numeric(5,2) check (percentual_reducao_sugerida is null or percentual_reducao_sugerida between 0 and 70), -- teto de segurança = 70

    -- rastreabilidade: versão do algoritmo/fórmula usada, para permitir recomputar
    -- histórico caso a fórmula mude sem invalidar comparações antigas silenciosamente
    versao_algoritmo            smallint not null default 1,

    calculado_em                timestamptz not null default now(),

    constraint uq_metrica_atleta_dia unique (atleta_id, data_referencia)
);

comment on table public.metricas_diarias is
'Métricas derivadas, 1 linha por atleta por dia calendário (inclusive dias sem check-in, com sem_checkin_no_dia=true). Populada por job de cálculo (ex: Edge Function/cron), não escrita diretamente pelo app.';

comment on column public.metricas_diarias.sem_checkin_no_dia is
'true = não houve check-in nessa data. As métricas ainda são calculadas via decaimento EWMA (para não quebrar a série), mas o frontend deve tratar esse dia como "sem dado reportado" e não como "prontidão ruim/zero".';

comment on column public.metricas_diarias.percentual_reducao_sugerida is
'Percentual de redução de carga sugerida ao treino planejado. Teto de segurança de 70% (nunca sugerir cancelamento total automatizado).';

create index idx_metricas_atleta_data on public.metricas_diarias(atleta_id, data_referencia desc);
create index idx_metricas_data on public.metricas_diarias(data_referencia);
```

Nota de implementação: o job de recomputo (Edge Function agendada, ou trigger `AFTER INSERT/UPDATE` em `checkins` que dispara recálculo assíncrono via `pg_net`/fila) deve sempre recomputar a partir de `fn_serie_calendario_atleta`, populando também os dias sem checkin intermediários — nunca fazer `INSERT` isolado só do dia do novo checkin, sob pena de deixar gaps sem linha em `metricas_diarias` (o que reintroduziria o problema de tratar ausência como buraco não rastreável).

---

## 8. Row Level Security (RLS)

### 8.1 Habilitar RLS em todas as tabelas sensíveis

```sql
alter table public.profiles enable row level security;
alter table public.convites enable row level security;
alter table public.coach_atleta_vinculo enable row level security;
alter table public.checkins enable row level security;
alter table public.treino_planejado enable row level security;
alter table public.metricas_diarias enable row level security;

-- Força RLS mesmo para o dono da tabela (boa prática Supabase, evita bypass acidental
-- por roles com privilégio elevado que não sejam o service_role gerenciado)
alter table public.profiles force row level security;
alter table public.convites force row level security;
alter table public.coach_atleta_vinculo force row level security;
alter table public.checkins force row level security;
alter table public.treino_planejado force row level security;
alter table public.metricas_diarias force row level security;
```

### 8.2 Função helper: vínculo ativo entre coach autenticado e atleta-alvo

```sql
create or replace function public.fn_coach_tem_vinculo_ativo(p_atleta_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.coach_atleta_vinculo v
        where v.atleta_id = p_atleta_id
          and v.coach_id = auth.uid()
          and v.status = 'ativo'
    );
$$;

comment on function public.fn_coach_tem_vinculo_ativo is
'Retorna true se o usuário autenticado (auth.uid()) é coach com vínculo ATIVO para o atleta informado. Usada em todas as policies de leitura do coach. security definer para poder ler coach_atleta_vinculo mesmo que a policy dessa tabela restrinja linhas.';
```

### 8.3 `profiles`

```sql
-- Cada usuário vê e edita o próprio perfil.
create policy profiles_select_own on public.profiles
    for select using (id = auth.uid());

create policy profiles_update_own on public.profiles
    for update using (id = auth.uid());

-- Coach precisa enxergar nome/avatar dos atletas vinculados (para listagem/dashboard).
create policy profiles_select_atleta_vinculado on public.profiles
    for select using (
        role = 'atleta' and public.fn_coach_tem_vinculo_ativo(id)
    );

-- Atleta precisa enxergar nome/avatar do coach vinculado.
create policy profiles_select_coach_vinculado on public.profiles
    for select using (
        role = 'coach' and exists (
            select 1 from public.coach_atleta_vinculo v
            where v.coach_id = profiles.id
              and v.atleta_id = auth.uid()
              and v.status = 'ativo'
        )
    );

-- Inserção do próprio perfil (normalmente via trigger em auth.users -> profiles, mas mantemos policy explícita)
create policy profiles_insert_own on public.profiles
    for insert with check (id = auth.uid());
```

### 8.4 `convites`

```sql
-- Coach vê/gerencia os próprios convites emitidos.
create policy convites_coach_own on public.convites
    for all using (coach_id = auth.uid())
    with check (coach_id = auth.uid());

-- Atleta precisa poder LER um convite pelo código para validá-lo antes de resgatar
-- (necessário para o fluxo "inserir código"). Restringe a convites ainda pendentes
-- e não expirados -- não expõe todos os convites do coach, só permite lookup pontual
-- que a aplicação fará por código exato (a query de app sempre filtra por codigo=).
create policy convites_select_para_resgate on public.convites
    for select using (
        status = 'pendente' and expira_em > now()
    );

-- Atleta "usa" o convite via UPDATE controlado (marca status=usado, usado_por_atleta_id=auth.uid()).
create policy convites_update_resgate on public.convites
    for update using (
        status = 'pendente' and expira_em > now()
    )
    with check (
        usado_por_atleta_id = auth.uid()
    );
```

Nota: a policy `convites_select_para_resgate` é intencionalmente ampla (qualquer autenticado pode ler convites pendentes não expirados) porque o fluxo exige lookup por código antes de haver vínculo. Isso é aceitável pois o código funciona como um segredo compartilhado (token de convite), mas **deve ser gerado com entropia suficiente** (recomendação: mínimo 8 caracteres alfanuméricos aleatórios, rate-limit de tentativas na aplicação) para não virar vetor de enumeração.

### 8.5 `coach_atleta_vinculo`

```sql
-- Atleta vê os próprios vínculos (qualquer status, para ver histórico de coaches).
create policy vinculo_select_atleta on public.coach_atleta_vinculo
    for select using (atleta_id = auth.uid());

-- Coach vê os vínculos onde é o coach (qualquer status -- precisa ver pendentes e revogados também,
-- para gerenciar sua lista e histórico).
create policy vinculo_select_coach on public.coach_atleta_vinculo
    for select using (coach_id = auth.uid());

-- Criação de vínculo: só o próprio coach pode iniciar (via convite) ou o próprio atleta pode
-- criar a linha ao resgatar (dependendo de qual lado a aplicação faz o INSERT).
create policy vinculo_insert on public.coach_atleta_vinculo
    for insert with check (
        coach_id = auth.uid() or atleta_id = auth.uid()
    );

-- Atualização (ativar/revogar): qualquer um dos dois lados do vínculo pode revogar;
-- só o processo de resgate (atleta) ou aprovação (coach) deve poder ativar --
-- a aplicação/Edge Function deve mediar a transição de estado; aqui garantimos
-- apenas que só as partes do vínculo podem alterá-lo.
create policy vinculo_update on public.coach_atleta_vinculo
    for update using (
        coach_id = auth.uid() or atleta_id = auth.uid()
    );
```

### 8.6 `checkins`

```sql
-- Atleta: acesso total (CRUD) aos próprios check-ins.
create policy checkins_atleta_all on public.checkins
    for all using (atleta_id = auth.uid())
    with check (atleta_id = auth.uid());

-- Coach: SOMENTE leitura, e somente de atletas com vínculo ativo.
-- (coach nunca escreve check-in do atleta -- dado é sempre autorreportado)
create policy checkins_coach_select on public.checkins
    for select using (public.fn_coach_tem_vinculo_ativo(atleta_id));
```

Nota sobre `politica_acesso_pos_revogacao` = `'parcial'`: se essa opção for adotada no futuro, a policy `checkins_coach_select` precisa ser estendida para também considerar vínculos `revogado` cujo `revogado_em` seja posterior à `data_referencia` do checkin. Deixado como comentário porque o default atual é `'total'` (corte completo, sem exceção):

```sql
-- Versão alternativa (SE Val decidir por política 'parcial' no futuro):
-- create policy checkins_coach_select_parcial on public.checkins
--     for select using (
--         exists (
--             select 1 from public.coach_atleta_vinculo v
--             where v.atleta_id = checkins.atleta_id
--               and v.coach_id = auth.uid()
--               and (
--                     v.status = 'ativo'
--                 or (v.status = 'revogado'
--                     and v.politica_acesso_pos_revogacao = 'parcial'
--                     and checkins.data_referencia <= v.revogado_em::date)
--               )
--         )
--     );
```

### 8.7 `treino_planejado`

```sql
-- Atleta: leitura e edição dos próprios planejamentos.
create policy treino_atleta_all on public.treino_planejado
    for all using (atleta_id = auth.uid())
    with check (atleta_id = auth.uid());

-- Coach: CRUD sobre treinos de atletas com vínculo ativo (coach cadastra treino planejado).
create policy treino_coach_all on public.treino_planejado
    for all using (public.fn_coach_tem_vinculo_ativo(atleta_id))
    with check (public.fn_coach_tem_vinculo_ativo(atleta_id));
```

### 8.8 `metricas_diarias`

```sql
-- Somente leitura para ambos os papéis -- tabela é populada só por job/service role.
create policy metricas_atleta_select on public.metricas_diarias
    for select using (atleta_id = auth.uid());

create policy metricas_coach_select on public.metricas_diarias
    for select using (public.fn_coach_tem_vinculo_ativo(atleta_id));

-- Nenhuma policy de INSERT/UPDATE/DELETE para roles authenticated/anon:
-- escrita só pelo service_role (job de cálculo), que bypassa RLS por padrão
-- no Supabase. Isso é intencional -- não adicionar policy de escrita aqui.
```

---

## 9. Índices recomendados (resumo consolidado por caso de uso)

| Caso de uso | Índice |
|---|---|
| Dashboard do atleta por período (`where atleta_id=? and data_referencia between ? and ?`) | `idx_checkins_atleta_data (atleta_id, data_referencia desc)`, `idx_metricas_atleta_data (atleta_id, data_referencia desc)` |
| Lista de atletas de um coach (`where coach_id=? and status='ativo'`) | `idx_vinculo_coach_status (coach_id, status)` |
| Verificação de vínculo ativo do atleta (usada em quase toda policy) | `uq_atleta_vinculo_ativo` (parcial, status='ativo') já cobre isso com lookup O(1) |
| Lookup de convite por código no resgate | `idx_convites_codigo (codigo) where status='pendente'` |
| Treinos planejados por atleta/período | `idx_treino_planejado_atleta_data (atleta_id, data_planejada desc)` |
| Consultas globais por data (ex: jobs de recálculo em lote) | `idx_checkins_data (data_referencia)`, `idx_metricas_data (data_referencia)` |

Todos já declarados inline nas seções acima; tabela é só o resumo de rastreabilidade para QA.

---

## 10. Autoauditoria de segurança

**Chave anon/publishable:** o app cliente (frontend) deve usar exclusivamente a chave `anon`/publishable do Supabase, nunca a `service_role`. Toda tabela sensível (`profiles`, `convites`, `coach_atleta_vinculo`, `checkins`, `treino_planejado`, `metricas_diarias`) tem RLS habilitado E `FORCE ROW LEVEL SECURITY`, então a chave anon nunca tem acesso irrestrito — todo acesso passa pelas policies acima. Confirmado: nenhuma tabela lista acima ficou sem `enable row level security`.

**`metricas_diarias` não tem policy de escrita para `authenticated`** — só o `service_role` (usado pelo job de cálculo/Edge Function, nunca exposto ao cliente) pode escrever. Isso evita que um atleta manipule diretamente sua própria pontuação de prontidão.

**Funções `security definer`:** `fn_coach_tem_vinculo_ativo` roda como `security definer` para poder consultar `coach_atleta_vinculo` de forma confiável independente da policy do chamador — isso é intencional e seguro porque a função só retorna um `boolean` (não vaza linhas), e o filtro interno usa `auth.uid()` do próprio contexto de sessão (não aceita um "coach_id" arbitrário como parâmetro, evitando impersonation). Setar `search_path = public` explicitamente evita search_path hijacking.

### Testes de RLS obrigatórios antes de qualquer deploy real

1. Atleta A não consegue `SELECT` check-ins de Atleta B (sem vínculo entre eles).
2. Atleta A não consegue `SELECT`/`UPDATE` `treino_planejado` de Atleta B.
3. Atleta A não consegue ler `metricas_diarias` de Atleta B.
4. Coach sem nenhum vínculo com Atleta X não lê nenhuma linha de `checkins`, `treino_planejado` ou `metricas_diarias` de X (retorno vazio, não erro — confirma que RLS filtra, não apenas bloqueia).
5. Coach com vínculo `pendente` (ainda não `ativo`) NÃO lê dados de check-in do atleta (só vínculo `ativo` libera).
6. Coach com vínculo `ativo` LÊ corretamente check-ins, treinos e métricas do atleta vinculado.
7. Após revogação (`status='revogado'`), coach perde acesso imediatamente — testar leitura logo após o `UPDATE` de revogação, mesma transação/sessão, sem cache stale.
8. Coach nunca consegue `INSERT`/`UPDATE`/`DELETE` em `checkins` (nem dos próprios atletas vinculados) — dado é sempre autorreportado.
9. Ninguém (`authenticated` comum) consegue `INSERT`/`UPDATE` em `metricas_diarias` — só `service_role`.
10. Atleta não consegue forjar `coach_atleta_vinculo` com `status='ativo'` diretamente via `INSERT`/`UPDATE` direto sem passar pelo fluxo de convite mediado pela aplicação (checar se a policy de `UPDATE` em `vinculo` precisa de reforço adicional via função/trigger que valide transições de estado permitidas — atualmente a policy permite ambas as partes fazerem `UPDATE` livre, o que é amplo demais e deve ser refinado com uma função de validação de transição antes do deploy real).
11. Um atleta não consegue ler convites de outro coach que não sejam endereçados a ele antes do resgate, além do necessário para o fluxo de lookup por código (testar que a policy `convites_select_para_resgate` não permite listar todos os convites pendentes do sistema, só localizar por código exato feito na query da aplicação — validar rate limiting/entropia do código na camada de aplicação, pois a policy sozinha não impede enumeração por força bruta).
12. Teste de `profiles`: atleta não consegue ler perfil de outro atleta/coach sem vínculo ativo entre eles.
13. Teste de escalonamento: usuário com `role='atleta'` não consegue se autopromover a `coach` via `UPDATE` em `profiles` (atualmente a policy `profiles_update_own` permite atualizar qualquer coluna, inclusive `role` — **gap identificado**, ver decisão em aberto #7 abaixo).

**Gap identificado nesta autoauditoria:** a policy `profiles_update_own` e `vinculo_update` são amplas demais (permitem update de qualquer coluna/qualquer transição). Recomenda-se, antes do deploy real, restringir via trigger `BEFORE UPDATE` que:
(a) bloqueie mudança de `role` após criação da conta (ou exija fluxo administrativo separado);
(b) valide que transições de `coach_atleta_vinculo.status` sigam a máquina de estados permitida (`pendente -> ativo`, `pendente -> revogado`, `ativo -> revogado`, nunca `revogado -> ativo` direto sem novo convite).

---

## 11. Decisões em aberto para Val

1. **Retenção de dados / LGPD:** por quanto tempo os dados de check-in ficam armazenados após o atleta encerrar a conta? Existe prazo legal de retenção mínima (ex: para fins de defesa em disputas) antes de poder excluir de fato?
2. **Exclusão de conta:** exclusão é hard delete (`ON DELETE CASCADE`, como modelado agora — apaga check-ins, vínculos, métricas) ou soft delete com anonimização (mantém linhas para integridade histórica do coach, mas remove PII)? O schema atual usa `CASCADE`, que é destrutivo e irreversível — confirmar se é essa a intenção.
3. **Histórico do coach ao desvincular:** confirmar a política `politica_acesso_pos_revogacao` — default está em `'total'` (coach perde acesso a tudo, inclusive histórico gerado durante o vínculo ativo). Alternativa `'parcial'` preservaria leitura do período em que o vínculo esteve ativo. Está modelado como campo configurável por vínculo; falta a decisão de produto de qual é o padrão correto (e se deve ser fixo ou escolha do atleta no momento do vínculo/desvínculo).
4. **Múltiplos papéis por conta:** confirmar que a restrição "1 papel por conta" realmente vale para sempre, ou é só limitação da v1 (ex: um coach que também é atleta de outro coach — cenário comum em times). Se for necessário no futuro, o modelo de `role` único em `profiles` precisará virar tabela de papéis N:N.
5. **Dupla confirmação de vínculo:** hoje o modelo ativa o vínculo automaticamente quando o atleta resgata o código (consentimento do coach é implícito ao gerar o convite). Confirmar se Val quer uma segunda etapa de aprovação explícita do coach após o resgate (ex: coach vê "atleta X quer se vincular" e precisa clicar "aceitar") antes de status virar `ativo`.
6. **Expiração de convite:** 7 dias foi um valor arbitrário de placeholder — confirmar prazo desejado.
7. **Mudança de `role` pós-cadastro:** confirmar se deve ser proibida definitivamente (recomendado) ou permitida via fluxo administrativo/suporte.
8. **Retificação de check-in editado:** o campo `editado`/`timestamp_ultima_edicao` existe, mas não há histórico de versões (não guardamos o valor anterior). Confirmar se é necessário auditoria completa de edições (ex: tabela `checkins_historico` com trigger de `BEFORE UPDATE`) para fins de disputa treinador-atleta ou compliance.
9. **Fórmulas exatas de ATL/CTL/monotonia/índice de janela de lesão/%redução sugerida:** este documento modela a estrutura de dados e o mecanismo anti-gap, mas as constantes exatas (ex: coeficientes do EWMA, pesos do índice composto de prontidão, curva exata de %redução sugerida) precisam ser confirmadas com a equipe de ciência do esporte e implementadas na função/job de cálculo (`fn_calcular_metricas_diarias`, ainda não escrita em código final — só o esqueleto/exemplo em `fn_serie_calendario_atleta`).
10. **Coach cria conta de atleta em nome dele (onboarding assistido)?** Não modelado — hoje assume-se que o atleta sempre tem a própria conta e insere o código de convite. Confirmar se há necessidade de um fluxo "coach pré-cadastra atleta sem e-mail ainda".


---

## 12. Correção dos gaps de RLS (aplicada em 2026-07-07)

Esta seção é um **adendo incremental** à especificação acima — não substitui nada das seções 1-11, apenas adiciona migração corretiva para os 2 gaps reais identificados na autoauditoria da seção 10 (item "Gap identificado nesta autoauditoria" e testes obrigatórios #10 e #13).

Motivo de usar trigger em vez de só reforçar a policy `USING`/`WITH CHECK`: RLS em Postgres com `for update using (...)` controla **quais linhas** podem ser alvo do update, mas não controla **quais colunas mudam** nem valida **transições de valor** dentro da linha. Para essas duas garantias (coluna imutável fora de fluxo administrativo; máquina de estados), a ferramenta correta é um trigger `BEFORE UPDATE` que compara `OLD` vs `NEW` e usa `RAISE EXCEPTION` para abortar a transação — RLS sozinho não tem esse poder de comparação campo a campo.

### 12.1 Gap 1 — trava de `profiles.role` via trigger

**Decisão adotada:** bloquear 100% a mudança de `role` por qualquer sessão autenticada comum (`authenticated`), inclusive o próprio dono da linha. Mudança de papel pós-cadastro vira **fluxo administrativo manual/suporte**, executado com a chave `service_role` (que roda como superusuário lógico do Supabase e não é afetada pelo trigger, pois o trigger checa explicitamente o parâmetro de sessão `request.jwt.claim.role`/`auth.role()`).

Justificativa da escolha:
- É a decisão mais conservadora e mais simples de auditar: não existe caminho de aplicação (mobile/web) que legitimamente precise trocar `role` depois da conta criada — o modelo de produto (seção 11, item 4) é "1 papel por conta" na v1. Não há motivo de negócio para permitir isso via RLS/API pública.
- Correção de erro cadastral (raro) ou eventual suporte a multi-papel futuro (seção 11, item 4) ficam quando necessário mediados por um humano/processo com acesso `service_role`, o que cria uma trilha de auditoria fora da superfície de ataque do cliente. Isso é preferível a criar uma "porta dos fundos" com flag/coluna adicional exposta ao próprio usuário, que seria só mais uma coisa a proteger.
- Usar `auth.role() = 'service_role'` como escape hatch é o padrão idiomático do Supabase: toda query feita com a chave `service_role` seta essa claim no JWT/contexto de sessão automaticamente, então o trigger não precisa de nenhum parâmetro extra custom — só checar o papel de conexão já resolve o requisito "só processo administrativo pode mudar" sem exigir infraestrutura adicional.

```sql
-- ============================================================
-- Gap 1: impedir autopromoção de role via UPDATE em profiles.
-- RLS (profiles_update_own) continua permitindo o dono atualizar a
-- própria linha (nome, avatar, timezone etc.) -- o que falta é impedir
-- que ele altere `role` nesse mesmo UPDATE. Isso não dá para expressar
-- em RLS puro (RLS não compara coluna a coluna dentro da linha), por
-- isso o enforcement fica em trigger BEFORE UPDATE.
-- ============================================================

create or replace function public.tg_profiles_bloqueia_mudanca_role()
returns trigger
language plpgsql
as $$
begin
  -- Permite a mudança SOMENTE se a conexão atual for o service_role
  -- (usado por processo administrativo/suporte, nunca exposto ao cliente).
  -- auth.role() reflete a claim "role" do JWT da sessão Supabase;
  -- para conexões feitas com a service_role key, auth.role() = 'service_role'.
  if new.role is distinct from old.role then
    if auth.role() <> 'service_role' then
      raise exception
        'Alteração de role não é permitida via API do cliente. Role só pode ser alterado por processo administrativo (service_role). role atual=%, tentativa=%',
        old.role, new.role
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$;

comment on function public.tg_profiles_bloqueia_mudanca_role is
'Bloqueia UPDATE de profiles.role feito por qualquer sessão que não seja service_role. Decisão de produto: mudança de papel pós-cadastro é 100% fluxo administrativo manual (ver seção 11, item 7, e seção 12.1 para justificativa). Não existe bypass de aplicação para isso.';

-- Roda ANTES do trigger de atualizado_em já existente (trg_profiles_atualizado_em),
-- ordem entre triggers BEFORE do mesmo evento é alfabética por nome do trigger
-- no Postgres -- nomeado para rodar cedo e abortar a transação o quanto antes
-- se a violação ocorrer, evitando efeitos colaterais desnecessários.
create trigger trg_00_profiles_bloqueia_role
before update on public.profiles
for each row execute function public.tg_profiles_bloqueia_mudanca_role();
```

Observação sobre a policy `profiles_update_own` (seção 8.3): **não precisa ser alterada**. Ela continua exatamente como está (`using (id = auth.uid())`), pois RLS aqui só decide "essa é a linha do dono?" — a trava de coluna é responsabilidade exclusiva do trigger acima, que roda depois que a policy já aprovou a linha-alvo.

### 12.2 Gap 2 — máquina de estados de `coach_atleta_vinculo.status` via trigger

**Decisão adotada:** manter a policy `vinculo_update` (seção 8.5) permitindo que ambas as partes (`coach_id = auth.uid()` OU `atleta_id = auth.uid()`) façam `UPDATE`, porque isso é necessário para os fluxos legítimos (atleta resgata convite e ativa; qualquer uma das partes revoga). O que faltava era validar que o **valor de transição** (`OLD.status -> NEW.status`) é uma transição permitida, o que fica no trigger `BEFORE UPDATE` abaixo — reaproveitando o mesmo padrão já usado em `trg_vinculo_transicao` (que carimba `ativado_em`/`revogado_em`), mas como um trigger separado dedicado à validação, executado antes.

Transições permitidas (conforme especificado): `pendente -> ativo`, `pendente -> revogado`, `ativo -> revogado`. Qualquer outra transição de valor (inclusive `revogado -> ativo`, `revogado -> pendente`, `ativo -> pendente`, ou pular direto para o mesmo valor com outros campos sendo indevidamente reescritos) é rejeitada. Reativar um vínculo revogado exige nova linha (novo convite/nova instância de `coach_atleta_vinculo`), nunca reuso da linha antiga — isso preserva o histórico de revogação intacto para auditoria.

```sql
-- ============================================================
-- Gap 2: valida a máquina de estados de coach_atleta_vinculo.status.
-- A policy vinculo_update (seção 8.5) permanece igual -- ela só decide
-- QUEM pode tentar o update (qualquer uma das partes). Este trigger decide
-- se a TRANSIÇÃO DE VALOR tentada é válida, e roda antes de
-- trg_vinculo_transicao (que só carimba timestamps).
-- ============================================================

create or replace function public.tg_vinculo_valida_transicao_status()
returns trigger
language plpgsql
as $$
begin
  -- Sem mudança de status: nada a validar aqui (ex: update só de
  -- politica_acesso_pos_revogacao, se algum dia exposto via app).
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Lista explícita de transições permitidas.
  if (old.status = 'pendente' and new.status = 'ativo')
     or (old.status = 'pendente' and new.status = 'revogado')
     or (old.status = 'ativo'    and new.status = 'revogado')
  then
    return new;
  end if;

  -- Qualquer outra transição (em especial revogado -> ativo, que é o
  -- abuso descrito no Gap 2) é rejeitada explicitamente.
  raise exception
    'Transição de status inválida em coach_atleta_vinculo: % -> %. Transições permitidas: pendente->ativo, pendente->revogado, ativo->revogado. Reativação de vínculo revogado exige novo convite (nova linha), não reuso da linha existente.',
    old.status, new.status
    using errcode = '22023'; -- invalid_parameter_value
end;
$$;

comment on function public.tg_vinculo_valida_transicao_status is
'Valida a máquina de estados de coach_atleta_vinculo.status em qualquer UPDATE. Bloqueia especificamente revogado->ativo (reativação direta), que era o Gap 2 identificado na autoauditoria da seção 10 / teste obrigatório #10. RLS (vinculo_update) continua permitindo ambas as partes tentarem o UPDATE; este trigger é quem decide se a transição de valor é aceitável.';

-- Nomeado para rodar ANTES de trg_vinculo_transicao (ordem alfabética de
-- nome de trigger BEFORE UPDATE no mesmo evento), garantindo que a
-- validação aborte a transação antes de qualquer carimbo de timestamp.
create trigger trg_00_vinculo_valida_transicao
before update on public.coach_atleta_vinculo
for each row execute function public.tg_vinculo_valida_transicao_status();
```

Nota sobre ordem de execução: em Postgres, múltiplos triggers `BEFORE UPDATE` no mesmo evento rodam em ordem alfabética pelo nome do trigger. Os triggers de validação acima foram nomeados com prefixo `trg_00_` propositalmente para rodar antes de `trg_profiles_atualizado_em` e `trg_vinculo_transicao` (que começam com `trg_p`/`trg_v`, alfabeticamente depois de `trg_0`), garantindo que a rejeição aconteça o mais cedo possível na cadeia de triggers.

### 12.3 Testes de RLS correspondentes (completando os testes obrigatórios #10 e #13 da seção 10)

```sql
-- ============================================================
-- Teste #13 (seção 10): autopromoção de role deve falhar
-- ============================================================

-- Setup (contexto: sessão autenticada como o próprio atleta, via anon/authenticated key)
-- set local role authenticated;
-- set local request.jwt.claims.sub = '<uuid-do-atleta-autenticado>';

-- deve falhar (ERROR: Alteração de role não é permitida via API do cliente...)
update public.profiles
set role = 'coach'
where id = auth.uid();  -- auth.uid() = o próprio atleta autenticado tentando virar coach

-- deve funcionar (mesma linha, mesma sessão, mas sem tocar em role)
update public.profiles
set nome_completo = 'Novo Nome', timezone = 'America/Sao_Paulo'
where id = auth.uid();

-- deve funcionar (somente com service_role key, fluxo administrativo/suporte)
-- set local role service_role;
update public.profiles
set role = 'coach'
where id = '<uuid-alvo>';


-- ============================================================
-- Teste #10 (seção 10): reativação direta de vínculo revogado deve falhar
-- ============================================================

-- Setup: existe uma linha em coach_atleta_vinculo com status='revogado'
-- para o par (coach_id, atleta_id), coach_id = <coach-uuid>, atleta_id = <atleta-uuid>.

-- deve falhar (ERROR: Transição de status inválida... revogado -> ativo)
-- tentativa feita pelo coach:
update public.coach_atleta_vinculo
set status = 'ativo'
where coach_id = auth.uid()  -- coach autenticado, uma das partes -> passa na RLS
  and atleta_id = '<atleta-uuid>'
  and status = 'revogado';

-- deve falhar igualmente se tentado pelo atleta (mesma trava, independe de qual parte tenta):
update public.coach_atleta_vinculo
set status = 'ativo'
where atleta_id = auth.uid()
  and coach_id = '<coach-uuid>'
  and status = 'revogado';

-- deve funcionar: transição válida pendente -> revogado (ex: coach ou atleta cancela convite pendente)
update public.coach_atleta_vinculo
set status = 'revogado', revogado_por = auth.uid()
where id = '<vinculo-id>'
  and status = 'pendente'
  and (coach_id = auth.uid() or atleta_id = auth.uid());

-- deve funcionar: transição válida pendente -> ativo (fluxo normal de resgate de convite pelo atleta)
update public.coach_atleta_vinculo
set status = 'ativo', consentimento_atleta_em = now()
where id = '<vinculo-id>'
  and status = 'pendente'
  and atleta_id = auth.uid();

-- deve funcionar: transição válida ativo -> revogado (revogação normal, por qualquer uma das partes)
update public.coach_atleta_vinculo
set status = 'revogado', revogado_por = auth.uid()
where id = '<vinculo-id>'
  and status = 'ativo'
  and (coach_id = auth.uid() or atleta_id = auth.uid());

-- deve funcionar: reativação "correta" depois de revogado é via NOVA linha
-- (novo convite resgatado), nunca via UPDATE da linha antiga:
insert into public.coach_atleta_vinculo (coach_id, atleta_id, status, convite_id, consentimento_atleta_em)
values ('<coach-uuid>', '<atleta-uuid>', 'ativo', '<novo-convite-id>', now());
```

### 12.4 Confirmação de não regressão

A correção não altera nenhuma das policies de RLS já existentes na seção 8 (`profiles_update_own` e `vinculo_update` permanecem literalmente como escritas) — ela só adiciona uma camada de trigger `BEFORE UPDATE` por cima, então todo fluxo que já era legítimo continua funcionando sem nenhuma mudança de código de aplicação: o coach ainda revoga vínculo ativo normalmente (`ativo -> revogado` está na lista de transições permitidas), o atleta ainda resgata convite e ativa vínculo pela primeira vez (`pendente -> ativo` permitido), e qualquer uma das partes ainda cancela um vínculo pendente (`pendente -> revogado` permitido). O único caminho que passa a ser bloqueado é exatamente o abuso descrito nos dois gaps — autopromoção de `role` e reativação direta de vínculo `revogado` sem passar por um novo convite — nenhum dos quais fazia parte de um fluxo de produto documentado nas seções 1-11.
