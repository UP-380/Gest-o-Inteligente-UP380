import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../hooks/useToast';
import CustomSelect from './CustomSelect';
import './ModalNovaTarefaRapida.css';

const API_BASE_URL = '/api';

const ModalNovaTarefaRapida = ({ isOpen, onClose, onSuccess, clienteId, produtoId, editTaskId }) => {
    const showToast = useToast();
    const [nome, setNome] = useState('');
    const [tipoTarefaId, setTipoTarefaId] = useState('');
    const [tipoTarefaOptions, setTipoTarefaOptions] = useState([]);
    const [subtarefasOptions, setSubtarefasOptions] = useState([]);
    const [selectedSubtarefas, setSelectedSubtarefas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            if (!editTaskId) {
                setNome('');
                setTipoTarefaId('');
                setSelectedSubtarefas([]);
            }
        }
    }, [isOpen, editTaskId]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [subRes, tipoRes] = await Promise.all([
                fetch(`${API_BASE_URL}/subtarefa?limit=1000`),
                fetch(`${API_BASE_URL}/tipo-tarefa?limit=1000`)
            ]);

            const subJson = await subRes.json();
            const tipoJson = await tipoRes.json();

            if (subJson.success && subJson.data) {
                setSubtarefasOptions(subJson.data.map(s => ({
                    value: String(s.id),
                    label: s.nome
                })));
            }

            if (tipoJson.success && tipoJson.data) {
                setTipoTarefaOptions(tipoJson.data.map(t => ({
                    value: String(t.id),
                    label: t.nome
                })));
            }

            // Se for modo edição, carregar dados da tarefa
            if (editTaskId) {
                const taskRes = await fetch(`${API_BASE_URL}/tarefa/${editTaskId}`);
                const taskJson = await taskRes.json();
                if (taskJson.success && taskJson.data) {
                    setNome(taskJson.data.nome);
                }

                // Carregar TIPO e Sub-tarefas vinculadas especificamente a este contexto
                // Como o 'tipo' fica na tabela de vinculados, precisamos buscar lá
                const vincRes = await fetch(`${API_BASE_URL}/vinculados?filtro_tarefa=${editTaskId}&filtro_cliente=${clienteId || ''}&filtro_produto=${produtoId || ''}`);
                const vincJson = await vincRes.json();

                if (vincJson.success && vincJson.data && vincJson.data.length > 0) {
                    // Pegar o tipo do primeiro vínculo encontrado (todos devem ser iguais para a mesma tarefa)
                    const tipoFound = vincJson.data.find(v => v.tarefa_tipo_id)?.tarefa_tipo_id;
                    if (tipoFound) setTipoTarefaId(String(tipoFound));

                    // Mapear subtarefas
                    const subIds = vincJson.data
                        .filter(v => v.subtarefa_id)
                        .map(v => String(v.subtarefa_id));
                    setSelectedSubtarefas(subIds);
                } else if (vincJson.success) {
                    // Fallback: se não achou no contexto, busca qualquer vínculo da tarefa para pegar o tipo master
                    const masterRes = await fetch(`${API_BASE_URL}/vinculados?filtro_tarefa=${editTaskId}`);
                    const masterJson = await masterRes.json();
                    const masterTipo = masterJson.data?.find(v => v.tarefa_tipo_id)?.tarefa_tipo_id;
                    if (masterTipo) setTipoTarefaId(String(masterTipo));
                }
            }
        } catch (error) {
            console.error('Erro ao buscar dados iniciais:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (!nome.trim()) {
            showToast('warning', 'O nome da tarefa é obrigatório');
            return;
        }

        if (!tipoTarefaId) {
            showToast('warning', 'O tipo de tarefa é obrigatório');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                nome: nome.trim(),
                tipo_tarefa_id: tipoTarefaId,
                cliente_id: clienteId,
                produto_id: produtoId,
                subtarefas_ids: selectedSubtarefas
            };

            const url = editTaskId ? `${API_BASE_URL}/tarefa/rapida/${editTaskId}` : `${API_BASE_URL}/tarefa/rapida`;
            const method = editTaskId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (json.success) {
                showToast('success', editTaskId ? 'Tarefa atualizada!' : 'Nova tarefa criada e vinculada!');
                if (onSuccess) onSuccess(editTaskId || json.data.id);
                onClose();
            } else {
                showToast('error', json.error || 'Erro ao salvar tarefa.');
            }

        } catch (error) {
            console.error('Erro ao salvar tarefa rápida:', error);
            showToast('error', 'Erro de conexão ao servidor.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // Toggle Subtarefa
    const handleToggleSubtarefa = (val, isSelected) => {
        const valStr = String(val);
        setSelectedSubtarefas(prev => {
            if (isSelected) {
                return [...prev, valStr];
            } else {
                return prev.filter(item => item !== valStr);
            }
        });
    };

    const handleSelectAllSubtarefas = () => {
        if (selectedSubtarefas.length === subtarefasOptions.length) {
            setSelectedSubtarefas([]);
        } else {
            setSelectedSubtarefas(subtarefasOptions.map(o => o.value));
        }
    };

    return createPortal(
        <div className="modal-nova-tarefa-overlay" onClick={onClose}>
            <div className="modal-nova-tarefa-container" onClick={e => e.stopPropagation()}>
                <div className="modal-nova-tarefa-header">
                    <h3>
                        <i className={editTaskId ? "fas fa-edit" : "fas fa-plus-circle"} style={{ color: '#3b82f6', marginRight: '10px' }}></i>
                        {editTaskId ? "Editar Tarefa Criada" : "Nova Tarefa Rápida"}
                    </h3>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSave} className="modal-nova-tarefa-body">
                    <p className="modal-hint">
                        <i className="fas fa-info-circle" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                        {editTaskId
                            ? "Ajuste os detalhes da tarefa master criada recentemente."
                            : "Preencha os dados abaixo para criar uma tarefa master e vincular automaticamente ao cliente e produto selecionados."
                        }
                    </p>

                    <div className="form-group-plug">
                        <label>Nome da Tarefa <span className="required">*</span></label>
                        <input
                            type="text"
                            className="form-input"
                            value={nome}
                            onChange={e => setNome(e.target.value)}
                            placeholder=""
                            autoFocus
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group-plug">
                        <label>Tipo de Tarefa <span className="required">*</span></label>
                        <CustomSelect
                            options={tipoTarefaOptions}
                            value={tipoTarefaId}
                            onChange={(e) => setTipoTarefaId(e.target.value)}
                            placeholder={loading ? "Carregando..." : "Selecione o tipo"}
                            enableSearch={true}
                            disabled={loading || saving}
                        />
                    </div>


                    <div className="form-group-plug">
                        <label>Subtarefas (Opcional)</label>
                        <CustomSelect
                            options={subtarefasOptions}
                            selectedItems={selectedSubtarefas}
                            onToggleItem={handleToggleSubtarefa}
                            onSelectAll={handleSelectAllSubtarefas}
                            keepOpen={true}
                            placeholder={loading ? "Carregando..." : "Selecione as subtarefas"}
                            enableSearch={true}
                            disabled={loading || saving}
                            maxVisibleOptions={5}
                        />
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '10px', fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                        * Campos obrigatórios para garantir a visibilidade da tarefa no sistema.
                    </div>
                </form>

                <div className="modal-nova-tarefa-footer">
                    <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button
                        type="button"
                        className="btn-confirm"
                        onClick={handleSave}
                        disabled={saving || !nome.trim() || !tipoTarefaId}
                    >
                        {saving ? 'Salvando...' : (editTaskId ? 'Salvar Alterações' : 'Criar e Vincular')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalNovaTarefaRapida;
