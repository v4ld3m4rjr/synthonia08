// CheckIn.jsx
// Fluxo de check-in diário — 1 pergunta por tela, navegação linear com
// possibilidade de voltar. É o fluxo mais usado do app, então recebe atenção
// extra de UX na repaginação visual:
// - Indicador de progresso "X/Y" já existia (ProgressBar + contador numérico)
//   e foi mantido — apenas a cor da barra e dos controles passou a usar o
//   novo `brandPrimary` no lugar do preto genérico anterior.
// - Todos os controles de resposta (chips de hora, toggle sim/não, bandas de
//   RPE, escala de emoji) e o botão de avançar/concluir agora usam
//   `brandPrimary` como cor de seleção/ação, com alvo de toque mínimo de 44px.
import React, { useMemo, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING, TOUCH_TARGET_MIN } from './theme';
import ProgressBar from './components/ProgressBar';
import EmojiScale from './components/EmojiScale';
import { CHECKIN_QUESTIONS, CONFIRMATION_MESSAGES, HOUR_CHIP_MIDPOINT, SCALE_TYPE } from './checkinQuestions';
import { supabase } from './supabaseClient';

function QuestionHeader({ question, microcopy }) {
  return (
    <div style={{ marginBottom: SPACING.lg, textAlign: 'center' }}>
      <h2 style={{ fontFamily: FONT.family, fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, margin: 0 }}>
        {question}
      </h2>
      {microcopy && (
        <p style={{ fontFamily: FONT.family, fontSize: FONT.size.sm, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
          {microcopy}
        </p>
      )}
    </div>
  );
}

function HourChips({ chips, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'center' }}>
      {chips.map((chip) => {
        const isSelected = chip === value;
        return (
          <button
            key={chip}
            onClick={() => onChange(chip)}
            style={{
              minHeight: TOUCH_TARGET_MIN,
              padding: `${SPACING.sm}px ${SPACING.md}px`,
              borderRadius: RADIUS.pill,
              border: `2px solid ${isSelected ? COLORS.brandPrimary : COLORS.border}`,
              backgroundColor: isSelected ? COLORS.brandPrimary : COLORS.surface,
              color: isSelected ? '#fff' : COLORS.textPrimary,
              fontFamily: FONT.family,
              fontSize: FONT.size.md,
              fontWeight: FONT.weight.medium,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

function ContinuousSlider({ anchors, value, onChange }) {
  const shown = value ?? 5;
  return (
    <div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', height: 44, accentColor: COLORS.brandPrimary, background: COLORS.gradientReadiness, borderRadius: 8 }}
      />
      <div style={{ textAlign: 'center', fontSize: FONT.size.xxl, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginTop: SPACING.md }}>
        {shown}
      </div>
      <div style={{ textAlign: 'center', fontSize: FONT.size.sm, color: COLORS.textSecondary, minHeight: 20 }}>
        {anchors[shown] || ''}
      </div>
    </div>
  );
}

function ToggleYesNo({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: SPACING.md, justifyContent: 'center' }}>
      {[{ v: true, label: 'Sim' }, { v: false, label: 'Não' }].map((opt) => {
        const selected = value === opt.v;
        return (
          <button
            key={opt.label}
            onClick={() => onChange(opt.v)}
            style={{
              minHeight: TOUCH_TARGET_MIN,
              minWidth: 96,
              padding: `${SPACING.md}px ${SPACING.xl}px`,
              borderRadius: RADIUS.pill,
              border: `2px solid ${selected ? COLORS.brandPrimary : COLORS.border}`,
              backgroundColor: selected ? COLORS.brandPrimary : COLORS.surface,
              color: selected ? '#fff' : COLORS.textPrimary,
              fontWeight: FONT.weight.semibold,
              fontSize: FONT.size.md,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function RpeBands({ bands, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
      {bands.map((b) => {
        const selected = value === b.value;
        return (
          <button
            key={b.value}
            onClick={() => onChange(b.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.sm,
              minHeight: TOUCH_TARGET_MIN,
              padding: `${SPACING.sm}px ${SPACING.md}px`,
              borderRadius: RADIUS.md,
              border: `2px solid ${selected ? COLORS.brandPrimary : COLORS.border}`,
              backgroundColor: selected ? COLORS.brandPrimary : COLORS.surface,
              color: selected ? '#fff' : COLORS.textPrimary,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <strong>{b.value}</strong>
            <span style={{ fontSize: FONT.size.sm }}>{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function NumberInput({ value, onChange, placeholder }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      placeholder={placeholder}
      style={{
        width: '100%',
        minHeight: TOUCH_TARGET_MIN,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.border}`,
        fontFamily: FONT.family,
        fontSize: FONT.size.lg,
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    />
  );
}

function OptionalGroup({ answers, setAnswer }) {
  const [showNota, setShowNota] = useState(false);
  return (
    <div>
      <label style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, display: 'block', marginBottom: SPACING.xs }}>
        HRV (ms) — opcional
      </label>
      <NumberInput value={answers.hrv_ms} onChange={(v) => setAnswer('hrv_ms', v)} placeholder="ex: 65" />
      <div style={{ height: SPACING.md }} />
      <label style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, display: 'block', marginBottom: SPACING.xs }}>
        FC de repouso (bpm) — opcional
      </label>
      <NumberInput value={answers.fc_repouso_bpm} onChange={(v) => setAnswer('fc_repouso_bpm', v)} placeholder="ex: 58" />
      <div style={{ height: SPACING.md }} />
      {!showNota ? (
        <button
          onClick={() => setShowNota(true)}
          style={{ border: 'none', background: 'none', color: COLORS.brandBlue, cursor: 'pointer', fontSize: FONT.size.sm, minHeight: TOUCH_TARGET_MIN, fontWeight: FONT.weight.medium }}
        >
          + adicionar comentário
        </button>
      ) : (
        <textarea
          maxLength={200}
          value={answers.nota_livre || ''}
          onChange={(e) => setAnswer('nota_livre', e.target.value)}
          placeholder="Alguma coisa que os números não contam? (máx. 200 caracteres)"
          style={{
            width: '100%',
            minHeight: 80,
            padding: SPACING.md,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
            fontFamily: FONT.family,
            fontSize: FONT.size.sm,
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}

function QuestionBody({ question, answers, value, onChange, setAnswer }) {
  switch (question.type) {
    case SCALE_TYPE.EMOJI_SCALE_1_7:
      return <EmojiScale labels={question.labels} value={value} onChange={onChange} />;
    case SCALE_TYPE.HOUR_CHIPS:
      return <HourChips chips={question.chips} value={value} onChange={onChange} />;
    case SCALE_TYPE.CONTINUOUS_SLIDER_0_10:
      return <ContinuousSlider anchors={question.anchors} value={value} onChange={onChange} />;
    case SCALE_TYPE.TOGGLE_YES_NO:
      return <ToggleYesNo value={value} onChange={onChange} />;
    case SCALE_TYPE.RPE_BANDS_0_10:
      return <RpeBands bands={question.bands} value={value} onChange={onChange} />;
    case SCALE_TYPE.NUMBER_INPUT:
      return <NumberInput value={value} onChange={onChange} placeholder="minutos" />;
    case SCALE_TYPE.OPTIONAL_GROUP:
      return <OptionalGroup answers={answers} setAnswer={setAnswer} />;
    default:
      return <div style={{ color: COLORS.textTertiary, textAlign: 'center' }}>Tipo não suportado: {question.type}</div>;
  }
}

function todayLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Formata 'YYYY-MM-DD' em dd/mm/aaaa para exibição amigável, sem passar por
// Date() (evitar bug de fuso horário ao parsear string de data pura).
function formatDateBR(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function DateSelector({ value, max, onChange }) {
  const isRetroactive = value !== max;
  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        width: '100%',
        marginBottom: SPACING.md,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        boxShadow: SHADOW.card,
        padding: SPACING.md,
        boxSizing: 'border-box',
      }}
    >
      <label style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, display: 'block', marginBottom: SPACING.xs }}>
        Data do check-in
      </label>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: TOUCH_TARGET_MIN,
          padding: SPACING.sm,
          borderRadius: RADIUS.sm,
          border: `1px solid ${COLORS.border}`,
          fontFamily: FONT.family,
          fontSize: FONT.size.md,
          boxSizing: 'border-box',
          color: COLORS.textPrimary,
        }}
      />
      {isRetroactive && (
        <div style={{ fontSize: FONT.size.xs, color: COLORS.moderate, marginTop: SPACING.xs, fontWeight: FONT.weight.medium }}>
          Preenchendo check-in de {formatDateBR(value)}
        </div>
      )}
    </div>
  );
}

function ConfirmationScreen({ message, onDone }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: COLORS.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.lg,
        fontFamily: FONT.family,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: SPACING.md }} aria-hidden="true">✅</div>
      <div style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.textPrimary, maxWidth: 320 }}>
        {message}
      </div>
      <button
        onClick={onDone}
        style={{
          marginTop: SPACING.lg,
          minHeight: TOUCH_TARGET_MIN,
          padding: `${SPACING.sm}px ${SPACING.xl}px`,
          borderRadius: RADIUS.pill,
          border: 'none',
          backgroundColor: COLORS.brandPrimary,
          color: '#fff',
          fontWeight: FONT.weight.semibold,
          cursor: 'pointer',
          boxShadow: SHADOW.brandGlow,
        }}
      >
        Voltar para a Home
      </button>
    </div>
  );
}

export default function CheckIn({ userId, onComplete }) {
  const todayISO = useMemo(() => todayLocalDateString(), []);
  const [answers, setAnswers] = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [confirmationMessage] = useState(
    () => CONFIRMATION_MESSAGES[Math.floor(Math.random() * CONFIRMATION_MESSAGES.length)]
  );

  const handleDateChange = (value) => {
    if (!value) return;
    // Bloqueia datas futuras mesmo que o usuário digite manualmente no campo
    // (o atributo `max` só impede escolher via o seletor nativo do navegador).
    setSelectedDate(value > todayISO ? todayISO : value);
  };

  const flowQuestions = useMemo(() => {
    return CHECKIN_QUESTIONS.filter((q) => {
      if (!q.conditional) return true;
      if (!q.dependsOn) return true;
      return answers[q.dependsOn.field] === q.dependsOn.equals;
    });
  }, [answers]);

  const currentQuestion = flowQuestions[stepIndex];
  const totalSteps = flowQuestions.length;
  const isLastStep = stepIndex === totalSteps - 1;

  const currentDisplayValue = useMemo(() => {
    if (currentQuestion?.type !== SCALE_TYPE.EMOJI_SCALE_1_7) return undefined;
    const stored = answers[currentQuestion.id];
    if (stored == null) return undefined;
    const match = currentQuestion.labels.find((l) => l.formulaValue === stored);
    return match?.displayPosition;
  }, [answers, currentQuestion]);

  const setAnswer = (id, val) => setAnswers((prev) => ({ ...prev, [id]: val }));

  const handleAnswerChange = (rawValue) => {
    if (!currentQuestion) return;
    if (currentQuestion.type === SCALE_TYPE.EMOJI_SCALE_1_7) {
      const label = currentQuestion.labels.find((l) => l.displayPosition === rawValue);
      setAnswer(currentQuestion.id, label?.formulaValue);
    } else {
      setAnswer(currentQuestion.id, rawValue);
    }
  };

  const canAdvance =
    currentQuestion?.type === SCALE_TYPE.OPTIONAL_GROUP ||
    currentQuestion?.optional ||
    answers[currentQuestion?.id] !== undefined;

  const buildPayload = () => {
    const treinouOntem = !!answers.treinou_ontem;
    return {
      atleta_id: userId,
      data_referencia: selectedDate,
      qualidade_sono: answers.qualidade_sono,
      duracao_sono_horas: HOUR_CHIP_MIDPOINT[answers.duracao_sono_horas] ?? null,
      fadiga_geral: answers.fadiga_geral,
      estresse_percebido: answers.estresse_percebido,
      humor_disposicao: answers.humor_disposicao,
      dor_muscular: answers.dor_muscular,
      prontidao_percebida: answers.prontidao_percebida,
      treinou_ontem: treinouOntem,
      rpe_treino_anterior: treinouOntem ? answers.rpe_treino_anterior ?? null : null,
      duracao_treino_anterior_min: treinouOntem ? answers.duracao_treino_anterior_min ?? null : null,
      hrv_ms: answers.hrv_ms ?? null,
      fc_repouso_bpm: answers.fc_repouso_bpm ?? null,
      nota_livre: answers.nota_livre ?? null,
    };
  };

  const goNext = async () => {
    if (!isLastStep) {
      setStepIndex((i) => i + 1);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload = buildPayload();
    const { error } = await supabase
      .from('checkins')
      .upsert(payload, { onConflict: 'atleta_id,data_referencia' });
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setDone(true);
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  };

  if (done) {
    return <ConfirmationScreen message={confirmationMessage} onDone={() => onComplete?.()} />;
  }

  if (!currentQuestion) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: COLORS.background, display: 'flex', flexDirection: 'column', padding: SPACING.lg, fontFamily: FONT.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md }}>
        <button
          onClick={goBack}
          disabled={stepIndex === 0}
          aria-label="Voltar"
          style={{
            border: 'none',
            background: 'none',
            fontSize: FONT.size.lg,
            color: stepIndex === 0 ? COLORS.textTertiary : COLORS.textPrimary,
            cursor: stepIndex === 0 ? 'default' : 'pointer',
            padding: 4,
            minWidth: TOUCH_TARGET_MIN,
            minHeight: TOUCH_TARGET_MIN,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <ProgressBar value={stepIndex + 1} max={totalSteps} color={COLORS.brandPrimary} />
        </div>
        <span style={{ fontSize: FONT.size.xs, color: COLORS.textTertiary, minWidth: 36, textAlign: 'right', fontWeight: FONT.weight.semibold }}>
          {stepIndex + 1}/{totalSteps}
        </span>
      </div>

      <DateSelector value={selectedDate} max={todayISO} onChange={handleDateChange} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg }}>
          <QuestionHeader question={currentQuestion.question} microcopy={currentQuestion.microcopy} />
          <QuestionBody
            question={currentQuestion}
            answers={answers}
            value={currentQuestion.type === SCALE_TYPE.EMOJI_SCALE_1_7 ? currentDisplayValue : answers[currentQuestion.id]}
            onChange={handleAnswerChange}
            setAnswer={setAnswer}
          />
        </div>

        {saveError && (
          <div style={{ color: COLORS.risk, fontSize: FONT.size.sm, marginTop: SPACING.sm, textAlign: 'center' }}>
            Não foi possível salvar: {saveError}
          </div>
        )}

        <button
          onClick={goNext}
          disabled={!canAdvance || saving}
          style={{
            marginTop: SPACING.lg,
            minHeight: TOUCH_TARGET_MIN,
            padding: SPACING.md,
            borderRadius: RADIUS.pill,
            border: 'none',
            backgroundColor: canAdvance && !saving ? COLORS.brandPrimary : COLORS.border,
            color: canAdvance && !saving ? '#fff' : COLORS.textTertiary,
            fontWeight: FONT.weight.semibold,
            fontSize: FONT.size.md,
            cursor: canAdvance && !saving ? 'pointer' : 'default',
            boxShadow: canAdvance && !saving ? SHADOW.brandGlow : 'none',
            transition: 'background-color 0.15s ease',
          }}
        >
          {saving ? 'Salvando…' : isLastStep ? 'Concluir check-in' : 'Próxima'}
        </button>
      </div>
    </div>
  );
}
