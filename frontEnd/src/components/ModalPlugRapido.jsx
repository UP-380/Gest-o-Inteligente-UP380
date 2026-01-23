import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../hooks/useToast';
import './ModalPlugRapido.css';
import CustomSelect from './vinculacoes/CustomSelect';
import SelecaoTarefasPlugRapido from './vinculacoes/SelecaoTarefasPlugRapido';
import FilterPeriodo from './filters/FilterPeriodo';
import TempoEstimadoInput from './common/TempoEstimadoInput';
import ModalNovaTarefaRapida from './vinculacoes/ModalNovaTarefaRapida';

const API_BASE_URL = '/api';

const ModalPlugRapido = ({ isOpen, onClose, onSuccess }) => {
    const showToast = useToast();
    const [loading, setLoading] = useState(false);
    const [clientesOptions, setClientesOptions] = useState([]);
    const [produtosOptions, setProdutosOptions] = useState([]);
    const [showNewTaskModal, setShowNewTaskModal] = useState(false);
    const [minhasPendentes, setMinhasPendentes] = useState([]);
    const [tasksRefreshToken, setTasksRefreshToken] = useState(0);
    const [formData, setFormData] = useState({
        cliente_id: '',
        produto_id: '',
        tarefa_id: '',
        data_inicio: '',
        data_fim: '',
        tempo_estimado_ms: 28800000,
        iniciar_timer: true,
        nova_tarefa_criada: false,
        sem_tarefa_definida: false,
        comentario_colaborador: ''
    });

    // Reset e fetch inicial
    useEffect(() => {
        if (isOpen) {
            const hoje = new Date();
            const yyyy = hoje.getFullYear();
            const mm = String(hoje.getMonth() + 1).padStart(2, '0');
            const dd = String(hoje.getDate()).padStart(2, '0');

            setFormData(prev => ({
                ...prev,
                cliente_id: '',
                produto_id: '',
                tarefa_id: '',
                data_inicio: `${yyyy}-${mm}-${dd}`,
                data_fim: `${yyyy}-${mm}-${dd}`,
                tempo_estimado_ms: 28800000,
                nova_tarefa_criada: false,
                sem_tarefa_definida: false,
                comentario_colaborador: ''
            }));
            setProdutosOptions([]);
            fetchClientes();
            fetchMinhasPendentes();
            setTasksRefreshToken(0);
        }
    }, [isOpen]);

    const fetchMinhasPendentes = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/minhas`);
            const json = await res.json();
            if (json.success) {
                setMinhasPendentes(json.data || []);
            }
        } catch (error) {
            console.error('Erro ao buscar minhas pendências', error);
        }
    };

    const fetchClientes = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/cp_clientes-id-nome?limit=1000`);
            const json = await res.json();
            if (json.success && json.data) {
                setClientesOptions(json.data.map(c => ({ value: String(c.id), label: c.nome })));
            }
        } catch (error) {
            console.error('Erro ao buscar clientes', error);
        }
    };

    const fetchProdutos = async (clienteId) => {
        if (!clienteId) {
            setProdutosOptions([]);
            return;
        }
        // Limpar seleção anterior de produto/tarefa
        setFormData(prev => ({ ...prev, produto_id: '', tarefa_id: '' }));

        try {
            const res = await fetch(`${API_BASE_URL}/produtos-por-cliente?clienteId=${clienteId}`);
            const json = await res.json();
            if (json.success && json.data) {
                setProdutosOptions(json.data.map(p => ({ value: String(p.id), label: p.nome })));
            } else {
                setProdutosOptions([]);
            }
        } catch (error) {
            console.error('Erro ao buscar produtos', error);
            setProdutosOptions([]);
        }
    };

    const handleClienteChange = (val) => {
        setFormData(prev => ({ ...prev, cliente_id: val }));
        fetchProdutos(val);
    };

    const handleProdutoChange = (val) => {
        setFormData(prev => ({ ...prev, produto_id: val, tarefa_id: '' }));
    };

    const handleNewTaskSuccess = (newTaskId) => {
        setTasksRefreshToken(prev => prev + 1); // Força recarregamento da lista
        setFormData(prev => ({
            ...prev,
            tarefa_id: String(newTaskId),
            nova_tarefa_criada: true
        })); // Seleciona automaticamente e marca como nova
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const tempoSegundos = Math.floor(formData.tempo_estimado_ms / 1000);

            const payload = {
                cliente_id: formData.cliente_id,
                produto_id: formData.produto_id,
                tarefa_id: formData.tarefa_id,
                data_inicio: `${formData.data_inicio}T00:00:00`,
                data_fim: `${formData.data_fim}T23:59:59`,
                tempo_estimado_dia: tempoSegundos,
                iniciar_timer: formData.iniciar_timer,
                nova_tarefa_criada: formData.nova_tarefa_criada,
                comentario_colaborador: formData.sem_tarefa_definida ? formData.comentario_colaborador : null
            };

            const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (json.success) {
                showToast('success', 'Solicitação de atribuição enviada com sucesso!');

                if (formData.iniciar_timer) {
                    window.dispatchEvent(new CustomEvent('registro-tempo-iniciado'));
                }

                if (onSuccess) onSuccess();
                onClose();
            } else {
                showToast('error', json.error || 'Erro ao criar solicitação.');
            }

        } catch (error) {
            console.error('Erro submit', error);
            showToast('error', 'Erro de conexão ao servidor.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isFormValid = formData.data_inicio &&
        formData.data_fim &&
        formData.tempo_estimado_ms > 0 &&
        (formData.sem_tarefa_definida
            ? (formData.comentario_colaborador && formData.comentario_colaborador.length >= 5)
            : (formData.cliente_id && formData.produto_id && formData.tarefa_id)
        );

    // Verificar se já existe uma pendência idêntica
    const isDuplicate = minhasPendentes.some(p =>
        String(p.cliente_id) === String(formData.cliente_id) &&
        String(p.produto_id) === String(formData.produto_id) &&
        String(p.tarefa_id) === String(formData.tarefa_id) &&
        p.data_inicio.split('T')[0] === formData.data_inicio &&
        p.data_fim.split('T')[0] === formData.data_fim
    );

    return createPortal(
        <div className="modal-plug-rapido-overlay" onClick={onClose}>
            <div className="modal-plug-rapido-container" onClick={e => e.stopPropagation()}>
                <div className="modal-plug-rapido-header">
                    <h2><i className="fas fa-bolt" style={{ color: '#f59e0b' }}></i> Plug Rápido</h2>
                    <button className="modal-plug-rapido-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-plug-rapido-body">

                    <div className="no-task-toggle-container">
                        <div className="no-task-toggle" onClick={() => setFormData(d => ({ ...d, sem_tarefa_definida: !d.sem_tarefa_definida }))}>
                            <input type="checkbox" checked={formData.sem_tarefa_definida} readOnly />
                            <div className="no-task-label">
                                <strong>Não sei qual a minha tarefa</strong>
                                <span>Plugar sem estimativa prévia (o gestor classificará depois)</span>
                            </div>
                        </div>
                    </div>

                    {!formData.sem_tarefa_definida ? (
                        <>

                            <div className="form-group-plug">
                                <label>Cliente</label>
                                <CustomSelect
                                    value={formData.cliente_id}
                                    options={clientesOptions}
                                    onChange={(e) => handleClienteChange(e.target.value)}
                                    placeholder="Selecione o Cliente"
                                    enableSearch={true}
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group-plug">
                                <label>Produto</label>
                                <CustomSelect
                                    value={formData.produto_id}
                                    options={produtosOptions}
                                    onChange={(e) => handleProdutoChange(e.target.value)}
                                    placeholder="Selecione o Produto"
                                    enableSearch={true}
                                    disabled={!formData.cliente_id || loading}
                                />
                            </div>

                            <div className="form-group-plug">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label style={{ marginBottom: 0 }}>Tarefa</label>
                                    {formData.cliente_id && formData.produto_id && (
                                        <button
                                            type="button"
                                            onClick={() => setShowNewTaskModal(true)}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid #f59e0b',
                                                borderRadius: '4px',
                                                color: '#f59e0b',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                padding: '2px 8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.2s'
                                            }}
                                            className="btn-add-task-plug"
                                        >
                                            <i className="fas fa-plus"></i> Nova Tarefa
                                        </button>
                                    )}
                                </div>
                                {/* Componente especializado para buscar tarefas via Cliente+Produto (Vinculados) */}
                                <SelecaoTarefasPlugRapido
                                    key={tasksRefreshToken}
                                    clienteId={formData.cliente_id}
                                    produtoId={formData.produto_id}
                                    selectedTarefaId={formData.tarefa_id}
                                    onTarefaSelect={(tid) => setFormData(prev => ({ ...prev, tarefa_id: tid }))}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="form-group-plug">
                            <label>O que você vai fazer? (Obrigatório) <span style={{ color: '#dc2626' }}>*</span></label>
                            <textarea
                                className="form-control-plug-textarea"
                                value={formData.comentario_colaborador}
                                onChange={(e) => setFormData(d => ({ ...d, comentario_colaborador: e.target.value }))}
                                placeholder="Descreva brevemente a tarefa para que o gestor saiba como classificá-la depois..."
                                rows={4}
                                required
                            />
                            <p className="field-hint">Mínimo de 5 caracteres. Seja específico.</p>
                        </div>
                    )}

                    <div className="form-group-plug">
                        <label>Período</label>
                        <FilterPeriodo
                            dataInicio={formData.data_inicio}
                            dataFim={formData.data_fim}
                            onInicioChange={(e) => setFormData(d => ({ ...d, data_inicio: e.target.value }))}
                            onFimChange={(e) => setFormData(d => ({ ...d, data_fim: e.target.value }))}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group-plug">
                        <label>Tempo Estimado / Dia</label>
                        <TempoEstimadoInput
                            value={formData.tempo_estimado_ms}
                            onChange={(val) => setFormData(d => ({ ...d, tempo_estimado_ms: val }))}
                            disabled={loading}
                        />
                    </div>

                    <div className="timer-option-plug" onClick={() => setFormData(d => ({ ...d, iniciar_timer: !d.iniciar_timer }))}>
                        <input type="checkbox" checked={formData.iniciar_timer} readOnly />
                        <label>Iniciar cronômetro agora (Criar Plug)</label>
                    </div>

                    {isDuplicate && (
                        <div className="duplicate-warning-plug" style={{
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '10px',
                            border: '1px solid #fecaca'
                        }}>
                            <i className="fas fa-exclamation-triangle"></i>
                            <span>Você já possui uma solicitação idêntica aguardando aprovação para este período.</span>
                        </div>
                    )}

                </form>

                <div className="modal-plug-rapido-footer">
                    <button type="button" className="btn-plug-cancel" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button
                        type="submit"
                        className={`btn-plug-submit ${(loading || !isFormValid || isDuplicate) ? 'disabled' : ''}`}
                        onClick={handleSubmit}
                        disabled={loading || !isFormValid || isDuplicate}
                        title={
                            isDuplicate
                                ? "Configuração de plug rápido já existente"
                                : (!isFormValid ? "Preencha todos os campos" : "Criar Plug")
                        }
                    >
                        {loading ? <div className="loading-spinner-plug"></div> : 'Confirmar e Plugar'}
                    </button>
                </div>
            </div>

            {/* Modal de Criação Rápida de Tarefa */}
            <ModalNovaTarefaRapida
                isOpen={showNewTaskModal}
                onClose={() => setShowNewTaskModal(false)}
                onSuccess={handleNewTaskSuccess}
                clienteId={formData.cliente_id}
                produtoId={formData.produto_id}
            />
        </div>,
        document.body
    );
};

export default ModalPlugRapido;
