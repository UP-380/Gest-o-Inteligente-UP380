import React, { useState, useEffect } from 'react';
import CustomSelect from '../vinculacoes/CustomSelect';
import SelecaoTarefasPlugRapido from '../vinculacoes/SelecaoTarefasPlugRapido';
import FilterPeriodo from '../filters/FilterPeriodo';
import FilterDate from '../filters/FilterDate';
import TempoEstimadoInput from '../common/TempoEstimadoInput';
import { useToast } from '../../hooks/useToast';
import '../ModalPlugRapido.css';

const API_BASE_URL = '/api';

/**
 * Modal para editar registro pendente (Plug Rápido)
 * Inclui campos do timer (data/hora início e fim) + campos da atribuição (Cliente, Produto, Tarefa, Período, Tempo Estimado)
 */
const EditarPendentePlugRapidoModal = ({ isOpen, onClose, registro, onSuccess }) => {
  const showToast = useToast();
  const [saving, setSaving] = useState(false);
  const [clientesOptions, setClientesOptions] = useState([]);
  const [produtosOptions, setProdutosOptions] = useState([]);

  const [form, setForm] = useState({
    cliente_id: '',
    produto_id: '',
    tarefa_id: '',
    periodo_inicio: '',
    periodo_fim: '',
    tempo_estimado_ms: 28800000,
    data_inicio: '',
    hora_inicio: 0,
    minuto_inicio: 0,
    data_fim: '',
    hora_fim: 0,
    minuto_fim: 0
  });

  useEffect(() => {
    if (isOpen && registro) {
      const dInicio = registro.data_inicio ? new Date(registro.data_inicio) : new Date();
      const dFim = registro.data_fim ? new Date(registro.data_fim) : new Date();
      const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const tempoRaw = registro.tempo_estimado_dia || 0;
      const tempoMs = tempoRaw < 50000 ? tempoRaw * 1000 : tempoRaw;

      setForm({
        cliente_id: registro.cliente_id ? String(registro.cliente_id) : '',
        produto_id: registro.produto_id ? String(registro.produto_id) : '',
        tarefa_id: registro.tarefa_id ? String(registro.tarefa_id) : '',
        periodo_inicio: registro.periodo_inicio || toYMD(dInicio),
        periodo_fim: registro.periodo_fim || toYMD(dFim),
        tempo_estimado_ms: tempoMs || 28800000,
        data_inicio: toYMD(dInicio),
        hora_inicio: dInicio.getHours(),
        minuto_inicio: dInicio.getMinutes(),
        data_fim: toYMD(dFim),
        hora_fim: dFim.getHours(),
        minuto_fim: dFim.getMinutes()
      });
      fetchClientes();
    }
  }, [isOpen, registro]);

  useEffect(() => {
    if (form.cliente_id) {
      fetchProdutos(form.cliente_id);
    } else {
      setProdutosOptions([]);
    }
  }, [form.cliente_id]);

  const fetchClientes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/cp_clientes-id-nome?limit=1000`);
      const json = await res.json();
      if (json.success && json.data) {
        setClientesOptions(json.data.map(c => ({ value: String(c.id), label: c.nome })));
      }
    } catch (e) { /* silent */ }
  };

  const fetchProdutos = async (clienteId) => {
    if (!clienteId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/produtos-por-cliente?clienteId=${clienteId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProdutosOptions(json.data.map(p => ({ value: String(p.id), label: p.nome })));
      } else {
        setProdutosOptions([]);
      }
    } catch (e) {
      setProdutosOptions([]);
    }
  };

  const handleClienteChange = (val) => {
    setForm(prev => ({ ...prev, cliente_id: val, produto_id: '', tarefa_id: '' }));
  };

  const handleProdutoChange = (val) => {
    setForm(prev => ({ ...prev, produto_id: val, tarefa_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!registro?.id) return;

    const dataInicioISO = new Date(
      `${form.data_inicio}T${String(form.hora_inicio).padStart(2, '0')}:${String(form.minuto_inicio).padStart(2, '0')}:00`
    ).toISOString();
    const dataFimISO = new Date(
      `${form.data_fim}T${String(form.hora_fim).padStart(2, '0')}:${String(form.minuto_fim).padStart(2, '0')}:00`
    ).toISOString();

    if (new Date(dataInicioISO) >= new Date(dataFimISO)) {
      showToast('error', 'Data de início deve ser anterior à data de fim');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/registro-tempo-pendente/${registro.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data_inicio: dataInicioISO,
          data_fim: dataFimISO,
          cliente_id: form.cliente_id || null,
          produto_id: form.produto_id || null,
          tarefa_id: form.tarefa_id || null,
          periodo_inicio: form.periodo_inicio,
          periodo_fim: form.periodo_fim,
          tempo_estimado_ms: form.tempo_estimado_ms
        })
      });

      const json = await res.json();
      if (json.success) {
        showToast('success', 'Registro pendente atualizado com sucesso!');
        onSuccess?.();
        onClose();
      } else {
        throw new Error(json.error || 'Erro ao salvar');
      }
    } catch (err) {
      showToast('error', err.message || 'Erro ao salvar registro pendente');
    } finally {
      setSaving(false);
    }
  };

  const formatarTempoHMS = (ms) => {
    if (!ms || ms <= 0) return '0s';
    const totalSegundos = Math.floor(ms / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    if (horas > 0) return `${horas}h ${minutos}min ${segundos}s`;
    if (minutos > 0) return `${minutos}min ${segundos}s`;
    return `${segundos}s`;
  };

  const dInicio = form.data_inicio
    ? new Date(`${form.data_inicio}T${String(form.hora_inicio).padStart(2, '0')}:${String(form.minuto_inicio).padStart(2, '0')}:00`)
    : null;
  const dFim = form.data_fim
    ? new Date(`${form.data_fim}T${String(form.hora_fim).padStart(2, '0')}:${String(form.minuto_fim).padStart(2, '0')}:00`)
    : null;
  const tempoRealizadoMs = dInicio && dFim ? dFim.getTime() - dInicio.getTime() : 0;

  if (!isOpen) return null;

  return (
    <div className="modal-plug-rapido-overlay" onClick={onClose}>
      <div className="modal-plug-rapido-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-plug-rapido-header">
          <h2><i className="fas fa-edit"></i> Editar Plug Rápido (Pendente)</h2>
          <button className="modal-plug-rapido-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-plug-rapido-body">
          <p className="modal-aprovar-hint" style={{
            backgroundColor: '#fefce8',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #fde047',
            color: '#854d0e',
            marginBottom: '12px',
            fontSize: '0.9rem'
          }}>
            <i className="fas fa-bolt" style={{ marginRight: '8px' }}></i>
            Edite os dados do timer e da classificação (Cliente, Produto, Tarefa) antes da aprovação.
          </p>

          {/* Campos Plug Rápido */}
          <div className="form-group-plug">
            <label>Cliente</label>
            <CustomSelect
              value={form.cliente_id}
              options={clientesOptions}
              onChange={(e) => handleClienteChange(e.target.value)}
              placeholder="Selecione o Cliente"
              enableSearch={true}
            />
          </div>
          <div className="form-group-plug">
            <label>Produto</label>
            <CustomSelect
              value={form.produto_id}
              options={produtosOptions}
              onChange={(e) => handleProdutoChange(e.target.value)}
              placeholder="Selecione o Produto"
              enableSearch={true}
              disabled={!form.cliente_id}
            />
          </div>
          <div className="form-group-plug">
            <label>Tarefa</label>
            <SelecaoTarefasPlugRapido
              clienteId={form.cliente_id}
              produtoId={form.produto_id}
              selectedTarefaId={form.tarefa_id}
              onTarefaSelect={(tid) => setForm(prev => ({ ...prev, tarefa_id: tid }))}
            />
          </div>
          <div className="form-row-plug">
            <div className="form-group-plug">
              <label>Período</label>
              <FilterPeriodo
                dataInicio={form.periodo_inicio}
                dataFim={form.periodo_fim}
                onInicioChange={(e) => setForm(prev => ({ ...prev, periodo_inicio: e.target.value }))}
                onFimChange={(e) => setForm(prev => ({ ...prev, periodo_fim: e.target.value }))}
              />
            </div>
            <div className="form-group-plug">
              <label>Tempo Estimado / Dia</label>
              <TempoEstimadoInput
                value={form.tempo_estimado_ms}
                onChange={(val) => setForm(prev => ({ ...prev, tempo_estimado_ms: val }))}
              />
            </div>
          </div>

          {/* Campos Timer (como edição normal) */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
              Período do Timer (Início e Fim)
            </label>
            <div className="form-row-plug">
              <div className="form-group-plug">
                <label>Data e Hora de Início</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <FilterDate
                    label=""
                    value={form.data_inicio}
                    onChange={(e) => setForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                    className="timer-edit-date-picker"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      value={form.hora_inicio}
                      onChange={(e) => setForm(prev => ({ ...prev, hora_inicio: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      min="0"
                      max="23"
                      style={{ width: '48px', padding: '6px' }}
                    />
                    <span>h</span>
                    <input
                      type="number"
                      value={form.minuto_inicio}
                      onChange={(e) => setForm(prev => ({ ...prev, minuto_inicio: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      min="0"
                      max="59"
                      style={{ width: '48px', padding: '6px' }}
                    />
                    <span>min</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-row-plug" style={{ marginTop: '12px' }}>
              <div className="form-group-plug">
                <label>Data e Hora de Fim</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <FilterDate
                    label=""
                    value={form.data_fim}
                    onChange={(e) => setForm(prev => ({ ...prev, data_fim: e.target.value }))}
                    className="timer-edit-date-picker"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      value={form.hora_fim}
                      onChange={(e) => setForm(prev => ({ ...prev, hora_fim: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      min="0"
                      max="23"
                      style={{ width: '48px', padding: '6px' }}
                    />
                    <span>h</span>
                    <input
                      type="number"
                      value={form.minuto_fim}
                      onChange={(e) => setForm(prev => ({ ...prev, minuto_fim: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      min="0"
                      max="59"
                      style={{ width: '48px', padding: '6px' }}
                    />
                    <span>min</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
              <strong><i className="far fa-clock" style={{ marginRight: '6px' }}></i>Tempo realizado total:</strong>{' '}
              {tempoRealizadoMs > 0 ? formatarTempoHMS(tempoRealizadoMs) : '—'}
            </div>
          </div>

          <div className="modal-plug-rapido-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>Cancelar</button>
            <button
              type="submit"
              className="btn-confirm"
              disabled={saving || !form.cliente_id || !form.produto_id || !form.tarefa_id}
            >
              {saving ? <><i className="fas fa-spinner fa-spin"></i> Salvando...</> : <><i className="fas fa-save"></i> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarPendentePlugRapidoModal;
