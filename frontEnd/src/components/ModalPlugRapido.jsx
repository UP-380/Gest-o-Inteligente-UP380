import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ModalPlugRapido.css';
import CustomSelect from './vinculacoes/CustomSelect';
import SelecaoTarefasPlugRapido from './vinculacoes/SelecaoTarefasPlugRapido';
import FilterPeriodo from './filters/FilterPeriodo';
import TempoEstimadoInput from './common/TempoEstimadoInput';

const API_BASE_URL = '/api';

const ModalPlugRapido = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [clientesOptions, setClientesOptions] = useState([]);
    const [produtosOptions, setProdutosOptions] = useState([]);

    const [formData, setFormData] = useState({
        cliente_id: '',
        produto_id: '',
        tarefa_id: '',
        data_inicio: '',
        data_fim: '',
        tempo_estimado_ms: 28800000, // 8h em ms
        iniciar_timer: true
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
                tempo_estimado_ms: 28800000
            }));
            setProdutosOptions([]);
            fetchClientes();
        }
    }, [isOpen]);

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
                iniciar_timer: formData.iniciar_timer
            };

            const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (json.success) {
                if (onSuccess) onSuccess();
                onClose();
            } else {
                alert('Erro ao criar: ' + (json.error || 'Erro desconhecido'));
            }

        } catch (error) {
            console.error('Erro submit', error);
            alert('Erro de conexão.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isFormValid = formData.cliente_id &&
        formData.produto_id &&
        formData.tarefa_id &&
        formData.data_inicio &&
        formData.data_fim &&
        formData.tarefa_id &&
        formData.data_inicio &&
        formData.data_fim &&
        formData.tempo_estimado_ms > 0;

    return createPortal(
        <div className="modal-plug-rapido-overlay" onClick={onClose}>
            <div className="modal-plug-rapido-container" onClick={e => e.stopPropagation()}>
                <div className="modal-plug-rapido-header">
                    <h2><i className="fas fa-bolt" style={{ color: '#f59e0b' }}></i> Plug Rápido</h2>
                    <button className="modal-plug-rapido-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-plug-rapido-body">

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
                        <label>Tarefa</label>
                        {/* Componente especializado para buscar tarefas via Cliente+Produto (Vinculados) */}
                        <SelecaoTarefasPlugRapido
                            clienteId={formData.cliente_id}
                            produtoId={formData.produto_id}
                            selectedTarefaId={formData.tarefa_id}
                            onTarefaSelect={(tid) => setFormData(prev => ({ ...prev, tarefa_id: tid }))}
                        />
                    </div>

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

                </form>

                <div className="modal-plug-rapido-footer">
                    <button type="button" className="btn-plug-cancel" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button
                        type="submit"
                        className={`btn-plug-submit ${!isFormValid ? 'disabled' : ''}`}
                        onClick={handleSubmit}
                        disabled={loading || !isFormValid}
                        title={!isFormValid ? "Preencha todos os campos" : "Criar Plug"}
                    >
                        {loading ? <div className="loading-spinner-plug"></div> : 'Confirmar e Plugar'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalPlugRapido;
