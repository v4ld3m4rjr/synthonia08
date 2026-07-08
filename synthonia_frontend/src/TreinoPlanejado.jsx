// TreinoPlanejado.jsx
// Tela "Treinos" — lista de treinos planejados CONFIRMADOS (revisado_pelo_usuario=true)
// + fluxo de adição (upload de PDF com extração via IA, ou formulário manual)
// + tela de revisão obrigatória para rascunhos extraídos por IA antes de virarem oficiais.
//
// Regra de ouro deste arquivo (ver instruções do backend): revisado_pelo_usuario=false
// é SEMPRE rascunho não-oficial. Nunca é exibido na lista principal (seção 1) nem em
// nenhum outro lugar do app como "plano confirmado" — só aparece na tela de revisão
// (seção 3), de onde só sai por Confirmar (vira true) ou Descartar (delete).
//
// Fluxo de estados da tela (`view`):
// - 'list'   : lista de confirmados + botão "Adicionar treino planejado"
// - 'choose' : seção com as 2 opções (upload PDF / formulário manual)
// - 'review' : tela de revisão dos itens extraídos por IA (só após upload OK)
// - 'manual' : formulário manual (usado tanto como opção B direta quanto como
//              fallback oferecido automaticamente se o upload falhar)
import React, { useEffect, useState } from 'react';
import { COLORS, FONT, RADIUS, SHADOW, SPACING, TOUCH_TARGET_MIN, BRAND_GRADIENT_CSS } from './theme';
import { supabase } from './supabaseClient';

const TIPOS_TREINO_SUGESTOES = ['Rodagem leve', 'Intervalado', 'Longo', 'Força', 'Regenerativo', 'Prova', 'Descanso'];

function SectionCard({ children, style }) {
  return (
    <div style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: SHADOW.card, padding: SPACING.lg, ...style }}>
      {children}
    </div>
  );
}

function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Formata 'YYYY-MM-DD' em dd/mm/aaaa sem passar por Date() (evita bug de fuso).
function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: TOUCH_TARGET_MIN,
        padding: `${SPACING.sm}px ${SPACING.xl}px`,
        borderRadius: RADIUS.pill,
        border: 'none',
        backgroundColor: disabled ? COLORS.border : COLORS.brandPrimary,
        color: disabled ? COLORS.textTertiary : '#fff',
        fontWeight: FONT.weight.semibold,
        fontSize: FONT.size.md,
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled ? 'none' : SHADOW.brandGlow,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: TOUCH_TARGET_MIN,
        padding: `${SPACING.sm}px ${SPACING.lg}px`,
        borderRadius: RADIUS.pill,
        border: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.surface,
        color: COLORS.textPrimary,
        fontWeight: FONT.weight.medium,
        fontSize: FONT.size.md,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function TextField({ label, children }) {
  return (
    <div style={{ marginBottom: SPACING.md }}>
      <label style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, display: 'block', marginBottom: SPACING.xs, fontWeight: FONT.weight.medium }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  minHeight: TOUCH_TARGET_MIN,
  padding: SPACING.sm,
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.border}`,
  fontFamily: FONT.family,
  fontSize: FONT.size.md,
  boxSizing: 'border-box',
  color: COLORS.textPrimary,
};

// -----------------------------------------------------------------------
// Seção 1: lista de treinos planejados já confirmados
// -----------------------------------------------------------------------
function PlanoConfirmadoRow({ plano }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${SPACING.md}px 0`,
        borderBottom: `1px solid ${COLORS.border}`,
        gap: SPACING.md,
      }}
    >
      <div>
        <div style={{ fontSize: FONT.size.sm, color: COLORS.textTertiary, fontWeight: FONT.weight.semibold }}>
          {formatDateBR(plano.data_planejada)}
        </div>
        <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.semibold, color: COLORS.textPrimary, marginTop: 2 }}>
          {plano.tipo_treino || 'Treino'}
        </div>
        {plano.descricao && (
          <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginTop: 2, maxWidth: 320 }}>
            {plano.descricao}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {plano.duracao_planejada_min != null && (
          <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>
            {plano.duracao_planejada_min} min
          </div>
        )}
        {plano.rpe_planejado != null && (
          <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>
            RPE {plano.rpe_planejado}
          </div>
        )}
      </div>
    </div>
  );
}

function ListaConfirmados({ userId, refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [planos, setPlanos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('treino_planejado')
        .select('*')
        .eq('atleta_id', userId)
        .eq('revisado_pelo_usuario', true)
        .gte('data_planejada', todayIsoDate())
        .order('data_planejada', { ascending: true })
        .limit(10);
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setPlanos(data || []);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  return (
    <SectionCard>
      <div style={{ fontSize: FONT.size.xs, textTransform: 'uppercase', letterSpacing: 0.6, color: COLORS.textTertiary, fontWeight: FONT.weight.semibold, marginBottom: SPACING.sm }}>
        Próximos treinos planejados
      </div>
      {loading ? (
        <div style={{ color: COLORS.textSecondary, fontSize: FONT.size.sm }}>Carregando…</div>
      ) : error ? (
        <div style={{ color: COLORS.risk, fontSize: FONT.size.sm }}>Não foi possível carregar: {error}</div>
      ) : planos.length === 0 ? (
        <div style={{ color: COLORS.textSecondary, fontSize: FONT.size.sm }}>
          Nenhum treino planejado confirmado ainda. Adicione um abaixo.
        </div>
      ) : (
        <div>
          {planos.map((p) => <PlanoConfirmadoRow key={p.id} plano={p} />)}
        </div>
      )}
    </SectionCard>
  );
}

// -----------------------------------------------------------------------
// Formulário manual (usado como Opção B e como fallback pós-erro de upload)
// -----------------------------------------------------------------------
function FormularioManual({ userId, initial, onSaved, onCancel, saveLabel }) {
  const [data, setData] = useState(initial?.data_planejada || todayIsoDate());
  const [tipo, setTipo] = useState(initial?.tipo_treino || '');
  const [duracao, setDuracao] = useState(initial?.duracao_planejada_min ?? '');
  const [rpe, setRpe] = useState(initial?.rpe_planejado ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? initial?.descricao_extraida ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSave = data && tipo.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const payload = {
      atleta_id: userId,
      data_planejada: data,
      tipo_treino: tipo.trim(),
      duracao_planejada_min: duracao === '' ? null : Number(duracao),
      rpe_planejado: rpe === '' ? null : Number(rpe),
      descricao: descricao.trim() || null,
      origem: 'manual',
      revisado_pelo_usuario: true,
    };
    const { data: inserted, error: insertError } = await supabase
      .from('treino_planejado')
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSaved(inserted);
  };

  return (
    <SectionCard>
      <div style={{ fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textPrimary, marginBottom: SPACING.md }}>
        Novo treino planejado
      </div>

      <TextField label="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={inputStyle} />
      </TextField>

      <TextField label="Tipo de treino">
        <input
          type="text"
          list="tipos-treino-sugestoes"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          placeholder="ex: Rodagem leve"
          style={inputStyle}
        />
        <datalist id="tipos-treino-sugestoes">
          {TIPOS_TREINO_SUGESTOES.map((t) => <option key={t} value={t} />)}
        </datalist>
      </TextField>

      <TextField label="Duração planejada (min)">
        <input
          type="number"
          min={0}
          value={duracao}
          onChange={(e) => setDuracao(e.target.value)}
          placeholder="ex: 60"
          style={inputStyle}
        />
      </TextField>

      <TextField label="RPE planejado (0-10)">
        <input
          type="number"
          min={0}
          max={10}
          step={1}
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          placeholder="ex: 5"
          style={inputStyle}
        />
      </TextField>

      <TextField label="Descrição (opcional)">
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="ex: 8km Z2 + 6x100m técnica"
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
        />
      </TextField>

      {error && (
        <div style={{ color: COLORS.risk, fontSize: FONT.size.sm, marginBottom: SPACING.md }}>
          Não foi possível salvar: {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: SPACING.sm, justifyContent: 'flex-end' }}>
        <SecondaryButton onClick={onCancel} disabled={saving}>Cancelar</SecondaryButton>
        <PrimaryButton onClick={handleSave} disabled={!canSave || saving}>
          {saving ? 'Salvando…' : (saveLabel || 'Salvar')}
        </PrimaryButton>
      </div>
    </SectionCard>
  );
}

// -----------------------------------------------------------------------
// Opção A: upload de PDF
// -----------------------------------------------------------------------
function UploadPdf({ userId, onExtracted, onError, onBusyChange }) {
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (!file) return;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${userId}/${timestamp}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('treinos-pdf')
        .upload(storagePath, file, { contentType: 'application/pdf' });

      if (uploadError) {
        onError(`Não foi possível enviar o PDF: ${uploadError.message}`);
        return;
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke('parse-treino-pdf', {
        body: { storage_path: storagePath, atleta_id: userId },
      });

      if (fnError) {
        onError(fnError.message || 'Não foi possível ler esse PDF. Tente preencher manualmente.');
        return;
      }
      if (fnData?.error) {
        onError(fnData.error);
        return;
      }
      if (!fnData?.items || fnData.items.length === 0) {
        onError('Não foi possível identificar treinos nesse PDF. Tente preencher manualmente.');
        return;
      }

      onExtracted(fnData.items, storagePath);
    } catch (err) {
      onError(err?.message || 'Não foi possível processar esse PDF. Tente preencher manualmente.');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <SectionCard style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: SPACING.sm }} aria-hidden="true">📄</div>
      <div style={{ fontSize: FONT.size.md, fontWeight: FONT.weight.semibold, color: COLORS.textPrimary, marginBottom: SPACING.xs }}>
        Enviar plano em PDF
      </div>
      <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary, marginBottom: SPACING.md, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
        A IA vai ler o arquivo e sugerir os treinos — você confirma antes de qualquer coisa virar oficial.
      </div>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: TOUCH_TARGET_MIN,
          padding: `${SPACING.sm}px ${SPACING.xl}px`,
          borderRadius: RADIUS.pill,
          background: BRAND_GRADIENT_CSS,
          color: '#fff',
          fontWeight: FONT.weight.semibold,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Enviando…' : 'Escolher arquivo PDF'}
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFile}
          disabled={busy}
          style={{ display: 'none' }}
        />
      </label>
    </SectionCard>
  );
}

// -----------------------------------------------------------------------
// Seção 3: tela de revisão dos rascunhos extraídos por IA
// -----------------------------------------------------------------------
function ItemRevisao({ item, onConfirmado, onDescartado }) {
  const [tipo, setTipo] = useState(item.tipo_treino || '');
  const [duracao, setDuracao] = useState(item.duracao_planejada_min ?? '');
  const [rpe, setRpe] = useState(item.rpe_planejado ?? '');
  const [dataPlanejada, setDataPlanejada] = useState(item.data_planejada || '');
  const [descricao, setDescricao] = useState(item.descricao ?? item.descricao_extraida ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resolved, setResolved] = useState(false);

  const handleConfirmar = async () => {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('treino_planejado')
      .update({
        revisado_pelo_usuario: true,
        data_planejada: dataPlanejada,
        tipo_treino: tipo.trim() || null,
        duracao_planejada_min: duracao === '' ? null : Number(duracao),
        rpe_planejado: rpe === '' ? null : Number(rpe),
        descricao: descricao.trim() || null,
      })
      .eq('id', item.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setResolved(true);
    onConfirmado(item.id);
  };

  const handleDescartar = async () => {
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from('treino_planejado')
      .delete()
      .eq('id', item.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setResolved(true);
    onDescartado(item.id);
  };

  if (resolved) return null;

  return (
    <SectionCard style={{ border: `1px solid ${COLORS.moderate}` }}>
      <TextField label="Data">
        <input type="date" value={dataPlanejada} onChange={(e) => setDataPlanejada(e.target.value)} style={inputStyle} />
      </TextField>
      <TextField label="Tipo de treino">
        <input
          type="text"
          list="tipos-treino-sugestoes"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          style={inputStyle}
        />
      </TextField>
      <TextField label="Duração planejada (min)">
        <input type="number" min={0} value={duracao} onChange={(e) => setDuracao(e.target.value)} style={inputStyle} />
      </TextField>
      <TextField label="RPE planejado (0-10)">
        <input type="number" min={0} max={10} value={rpe} onChange={(e) => setRpe(e.target.value)} style={inputStyle} />
      </TextField>
      <TextField label="Descrição (opcional)">
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
        />
      </TextField>

      {error && (
        <div style={{ color: COLORS.risk, fontSize: FONT.size.sm, marginBottom: SPACING.md }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: SPACING.sm, justifyContent: 'flex-end' }}>
        <SecondaryButton onClick={handleDescartar} disabled={saving} style={{ color: COLORS.risk, borderColor: COLORS.risk }}>
          Descartar
        </SecondaryButton>
        <PrimaryButton onClick={handleConfirmar} disabled={saving}>
          {saving ? 'Confirmando…' : 'Confirmar'}
        </PrimaryButton>
      </div>
    </SectionCard>
  );
}

function TelaRevisao({ items, onAllResolved, onBackToList }) {
  const [pending, setPending] = useState(items.map((it) => it.id));
  const [confirmingAll, setConfirmingAll] = useState(false);

  const handleConfirmarTodos = async () => {
    setConfirmingAll(true);
    const ids = items.map((it) => it.id);
    await supabase
      .from('treino_planejado')
      .update({ revisado_pelo_usuario: true })
      .in('id', ids);
    setConfirmingAll(false);
    setPending([]);
    onAllResolved();
  };

  const handleItemResolved = (id) => {
    setPending((prev) => {
      const next = prev.filter((x) => x !== id);
      if (next.length === 0) onAllResolved();
      return next;
    });
  };

  const remainingItems = items.filter((it) => pending.includes(it.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: SPACING.sm,
          background: BRAND_GRADIENT_CSS,
          borderRadius: RADIUS.md,
          padding: SPACING.md,
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">🤖</div>
        <div>
          <div style={{ fontWeight: FONT.weight.bold, fontSize: FONT.size.md }}>
            A IA leu isso do seu PDF — confira antes de confirmar
          </div>
          <div style={{ fontSize: FONT.size.sm, opacity: 0.92, marginTop: 2 }}>
            Nada aqui vira oficial até você confirmar item por item (ou todos de uma vez).
          </div>
        </div>
      </div>

      {remainingItems.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <PrimaryButton onClick={handleConfirmarTodos} disabled={confirmingAll}>
            {confirmingAll ? 'Confirmando…' : `Confirmar todos (${remainingItems.length})`}
          </PrimaryButton>
        </div>
      )}

      {remainingItems.map((item) => (
        <ItemRevisao
          key={item.id}
          item={item}
          onConfirmado={handleItemResolved}
          onDescartado={handleItemResolved}
        />
      ))}

      <SecondaryButton onClick={onBackToList}>Voltar para a lista</SecondaryButton>
    </div>
  );
}

// -----------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------
export default function TreinoPlanejado({ userId }) {
  const [view, setView] = useState('list'); // list | choose | review | manual
  const [uploadError, setUploadError] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleExtracted = (items) => {
    setReviewItems(items);
    setUploadError(null);
    setView('review');
  };

  const handleUploadError = (message) => {
    setUploadError(message);
  };

  const handleAllResolved = () => {
    setRefreshKey((k) => k + 1);
    setView('list');
    setReviewItems([]);
  };

  const handleManualSaved = () => {
    setRefreshKey((k) => k + 1);
    setView('list');
  };

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', padding: SPACING.md, fontFamily: FONT.family }}>
      <header style={{ marginBottom: SPACING.md }}>
        <div style={{ fontSize: FONT.size.title, fontWeight: FONT.weight.bold, color: COLORS.textPrimary }}>
          Treinos planejados
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md, maxWidth: 480, margin: '0 auto' }}>
        {view === 'list' && (
          <>
            <ListaConfirmados userId={userId} refreshKey={refreshKey} />
            <PrimaryButton onClick={() => setView('choose')}>+ Adicionar treino planejado</PrimaryButton>
          </>
        )}

        {view === 'choose' && (
          <>
            <UploadPdf
              userId={userId}
              onExtracted={handleExtracted}
              onError={handleUploadError}
              onBusyChange={setUploadBusy}
            />

            {uploadBusy && (
              <SectionCard style={{ textAlign: 'center', color: COLORS.textSecondary }}>
                Lendo seu PDF…
              </SectionCard>
            )}

            {uploadError && (
              <SectionCard style={{ border: `1px solid ${COLORS.risk}` }}>
                <div style={{ color: COLORS.risk, fontSize: FONT.size.sm, marginBottom: SPACING.sm }}>
                  {uploadError}
                </div>
                <div style={{ fontSize: FONT.size.sm, color: COLORS.textSecondary }}>
                  Sem problema — preencha manualmente abaixo.
                </div>
              </SectionCard>
            )}

            <div style={{ textAlign: 'center', color: COLORS.textTertiary, fontSize: FONT.size.sm }}>ou</div>

            <SecondaryButton onClick={() => setView('manual')}>Preencher manualmente</SecondaryButton>
            <SecondaryButton onClick={() => setView('list')}>Cancelar</SecondaryButton>
          </>
        )}

        {view === 'manual' && (
          <FormularioManual
            userId={userId}
            onSaved={handleManualSaved}
            onCancel={() => setView('list')}
            saveLabel="Salvar treino"
          />
        )}

        {view === 'review' && (
          <TelaRevisao
            items={reviewItems}
            onAllResolved={handleAllResolved}
            onBackToList={() => { setRefreshKey((k) => k + 1); setView('list'); }}
          />
        )}
      </div>
    </div>
  );
}
