import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import CustomSelect from '../../components/vinculacoes/CustomSelect';
import SelecaoTarefasPlugRapido from '../../components/vinculacoes/SelecaoTarefasPlugRapido';
import './AprovacoesPendentes.css';

const API_BASE_URL = '/api';

const AprovacoesPendentes = () => {
    const [pendentes, setPendentes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    // Estado do form de edição/aprovação
    const [editForm, setEditForm] = useState({
        cliente_id: '',
        produto_id: '',
        tarefa_id: '',
        data_inicio: '', // Adicionado para exibição/edição se necessário, mas o foco é cliente/produto/tarefa
        data_fim: '',
        tempo_estimado_dia_horas: '08:00'
    });

    // Listas para dropdowns de edição
    const [clientesOptions, setClientesOptions] = useState([]);
    const [produtosOptions, setProdutosOptions] = useState([]);

    useEffect(() => {
        fetchPendentes();
        fetchClientes();
    }, []);

    const fetchPendentes = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/aprovacao`);
            const json = await res.json();
            if (json.success) {
                setPendentes(json.data || []);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchClientes = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/cp_clientes-id-nome?limit=1000`);
            const json = await res.json();
            if (json.success && json.data) {
                setClientesOptions(json.data.map(c => ({ value: String(c.id), label: c.nome })));
            }
        } catch (e) { console.error(e); }
    };

    const fetchProdutos = async (clienteId) => {
        if (!clienteId) {
            setProdutosOptions([]);
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/produtos-por-cliente?clienteId=${clienteId}`);
            const json = await res.json();
            if (json.success && json.data) {
                setProdutosOptions(json.data.map(p => ({ value: String(p.id), label: p.nome })));
            } else {
                setProdutosOptions([]);
            }
        } catch (e) { console.error(e); setProdutosOptions([]); }
    };

    // Ao abrir o modal
    const handleOpenAprovar = async (item) => {
        setSelectedItem(item);

        // Calcular horas/minutos
        const tempoSegundos = item.tempo_estimado_dia || 0;
        const horas = Math.floor(tempoSegundos / 3600);
        const minutos = Math.floor((tempoSegundos % 3600) / 60);
        const timeStr = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;

        // Carregar produtos para o cliente selecionado inicialmente
        await fetchProdutos(item.cliente_id);

        setEditForm({
            cliente_id: item.cliente_id ? String(item.cliente_id) : '',
            produto_id: item.produto_id ? String(item.produto_id) : '',
            tarefa_id: item.tarefa_id ? Number(item.tarefa_id) : '', // Tarefa IDs costumam ser números
            data_inicio: item.data_inicio ? item.data_inicio.split('T')[0] : '',
            data_fim: item.data_fim ? item.data_fim.split('T')[0] : '',
            tempo_estimado_dia_horas: timeStr
        });

        setModalOpen(true);
    };

    const handleClienteChange = (val) => {
        setEditForm(prev => ({ ...prev, cliente_id: val, produto_id: '', tarefa_id: '' }));
        fetchProdutos(val);
    };

    const handleProdutoChange = (val) => {
        setEditForm(prev => ({ ...prev, produto_id: val, tarefa_id: '' }));
    };

    const handleConfirmAprovar = async () => {
        if (!selectedItem) return;

        const [h, m] = editForm.tempo_estimado_dia_horas.split(':').map(Number);
        const tempoSegundos = (h * 3600) + (m * 60);

        const payload = {
            cliente_id: editForm.cliente_id,
            produto_id: editForm.produto_id,
            tarefa_id: editForm.tarefa_id,
            // Mantendo as datas originais ou permitindo edição se adicionássemos os campos de data no form.
            // O usuário pediu "todos os campos do plug rápido", que inclui datas.
            // Vou incluir data_inicio e data_fim no payload baseados no editForm.
            data_inicio: `${editForm.data_inicio}T00:00:00`,
            data_fim: `${editForm.data_fim}T23:59:59`,
            tempo_estimado_dia: tempoSegundos
        };

        try {
            const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/${selectedItem.id}/aprovar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.success) {
                alert('Aprovado com sucesso!');
                setModalOpen(false);
                fetchPendentes();
            } else {
                alert('Erro: ' + (json.error || json.message || 'Erro desconhecido'));
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao aprovar.');
        }
    };

    return (
        <Layout>
            <div className="aprovacoes-container">
                <div className="aprovacoes-header">
                    <h1 className="aprovacoes-title">Aprovações Pendentes</h1>
                    <p className="aprovacoes-subtitle">Gerencie os plugs rápidos realizados pelos colaboradores</p>
                </div>

                {loading ? (
                    <div>Carregando...</div>
                ) : pendentes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                        <i className="fas fa-check-circle" style={{ fontSize: '3rem', marginBottom: '10px' }}></i>
                        <p>Nenhuma pendência encontrada.</p>
                    </div>
                ) : (
                    <div className="aprovacoes-grid">
                        {pendentes.map(p => (
                            <div key={p.id} className="aprovacao-card">
                                <div className="aprovacao-card-header">
                                    <div className="aprovacao-user-info">
                                        <div className="aprovacao-user-avatar" style={{
                                            backgroundImage: p.usuario?.foto_perfil ? `url(${p.usuario.foto_perfil})` : 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {!p.usuario?.foto_perfil && <i className="fas fa-user" style={{ color: '#9ca3af' }}></i>}
                                        </div>
                                        <div>
                                            <div className="aprovacao-user-name">{p.usuario?.nome_usuario || 'Usuário'}</div>
                                            <div className="aprovacao-date">Criado em {new Date(p.criado_em).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div style={{
                                        backgroundColor: '#fff7ed', color: '#d97706',
                                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold'
                                    }}>PENDENTE</div>
                                </div>

                                <div className="aprovacao-details">
                                    <div className="aprovacao-field">
                                        <span className="aprovacao-label">Cliente</span>
                                        <span className="aprovacao-value highlight">{p.cliente?.nome}</span>
                                    </div>
                                    <div className="aprovacao-field">
                                        <span className="aprovacao-label">Produto</span>
                                        <span className="aprovacao-value">{p.produto?.nome || '-'}</span>
                                    </div>
                                    <div className="aprovacao-field">
                                        <span className="aprovacao-label">Tarefa</span>
                                        <span className="aprovacao-value">{p.tarefa?.nome}</span>
                                    </div>

                                    <div className="aprovacao-time-box">
                                        <div className="aprovacao-time-item">
                                            <div className="aprovacao-time-label">Início</div>
                                            <div className="aprovacao-time-value" style={{ fontSize: '0.9rem' }}>{new Date(p.data_inicio).toLocaleDateString()}</div>
                                        </div>
                                        <div className="aprovacao-time-item">
                                            <div className="aprovacao-time-label">Estimado/Dia</div>
                                            <div className="aprovacao-time-value">
                                                {(() => {
                                                    const sec = p.tempo_estimado_dia || 0;
                                                    const h = Math.floor(sec / 3600);
                                                    return `${h}h`;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="aprovacao-actions">
                                    <button className="btn-aprovacao btn-aprovar" onClick={() => handleOpenAprovar(p)}>
                                        <i className="fas fa-check"></i> Revisar e Aprovar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {modalOpen && (
                    <div className="modal-plug-rapido-overlay" onClick={() => setModalOpen(false)}>
                        <div className="modal-plug-rapido-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div className="modal-plug-rapido-header">
                                <h2>Aprovar Atribuição</h2>
                                <button className="modal-plug-rapido-close" onClick={() => setModalOpen(false)}>&times;</button>
                            </div>
                            <div className="modal-plug-rapido-body">
                                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>
                                    Confirme ou edite os dados antes de oficializar a atribuição.
                                </p>

                                {/* Campos de Cliente e Produto editáveis */}
                                <div className="form-group-plug">
                                    <label>Cliente</label>
                                    <CustomSelect
                                        value={editForm.cliente_id}
                                        options={clientesOptions}
                                        onChange={(e) => handleClienteChange(e.target.value)}
                                        placeholder="Selecione o Cliente"
                                        enableSearch={true}
                                    />
                                </div>

                                <div className="form-group-plug">
                                    <label>Produto</label>
                                    <CustomSelect
                                        value={editForm.produto_id}
                                        options={produtosOptions}
                                        onChange={(e) => handleProdutoChange(e.target.value)}
                                        placeholder="Selecione o Produto"
                                        enableSearch={true}
                                        disabled={!editForm.cliente_id}
                                    />
                                </div>

                                {/* Seleção de Tarefa */}
                                <div className="form-group-plug">
                                    <label>Tarefa</label>
                                    <SelecaoTarefasPlugRapido
                                        clienteId={editForm.cliente_id}
                                        produtoId={editForm.produto_id}
                                        selectedTarefaId={editForm.tarefa_id}
                                        onTarefaSelect={(tid) => setEditForm(prev => ({ ...prev, tarefa_id: tid }))}
                                    />
                                </div>

                                {/* Período */}
                                <div className="form-row-plug">
                                    <div className="form-group-plug">
                                        <label>Período (Início)</label>
                                        <input
                                            type="date"
                                            className="form-control-plug"
                                            value={editForm.data_inicio}
                                            onChange={e => setEditForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group-plug">
                                        <label>Período (Fim)</label>
                                        <input
                                            type="date"
                                            className="form-control-plug"
                                            value={editForm.data_fim}
                                            onChange={e => setEditForm(prev => ({ ...prev, data_fim: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Tempo Estimado */}
                                <div className="form-group-plug">
                                    <label>Tempo Estimado / Dia</label>
                                    <input
                                        type="time"
                                        className="form-control-plug"
                                        value={editForm.tempo_estimado_dia_horas}
                                        onChange={e => setEditForm(prev => ({ ...prev, tempo_estimado_dia_horas: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="modal-plug-rapido-footer">
                                <button className="btn-plug-cancel" onClick={() => setModalOpen(false)}>Cancelar</button>
                                <button className="btn-plug-submit" style={{ backgroundColor: '#10b981' }} onClick={handleConfirmAprovar}>
                                    <i className="fas fa-check"></i> Confirmar Aprovação
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default AprovacoesPendentes;
