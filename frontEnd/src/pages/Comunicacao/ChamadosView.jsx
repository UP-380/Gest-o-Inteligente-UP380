import React, { useState, useEffect } from 'react';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import './ChamadosView.css';

const ChamadosView = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newChamado, setNewChamado] = useState({ titulo: '', conteudo: '', metadata: { prioridade: 'media' } });

    useEffect(() => {
        loadChamados();
    }, []);

    const loadChamados = async () => {
        setLoading(true);
        try {
            const response = await comunicacaoAPI.listarChamados();
            if (response.success) {
                setChamados(response.data);
            }
        } catch (error) {
            console.error('Erro ao listar chamados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                tipo: 'CHAMADO',
                titulo: newChamado.titulo,
                conteudo: newChamado.conteudo,
                status_chamado: 'ABERTO',
                metadata: newChamado.metadata
            };
            const response = await comunicacaoAPI.enviarMensagem(payload);
            if (response.success) {
                setShowModal(false);
                setNewChamado({ titulo: '', conteudo: '', metadata: { prioridade: 'media' } });
                loadChamados();
            }
        } catch (error) {
            console.error('Erro ao abrir chamado:', error);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'ABERTO': return '#ffc107'; // yellow
            case 'EM_ANALISE': return '#17a2b8'; // teal
            case 'RESPONDIDO': return '#007bff'; // blue
            case 'CONCLUIDO': return '#28a745'; // green
            default: return '#6c757d'; // gray
        }
    };

    return (
        <div className="chamados-view">
            <div className="chamados-header">
                <h2>Meus Chamados</h2>
                <button className="new-chamado-btn" onClick={() => setShowModal(true)}>
                    <i className="fas fa-plus"></i> Novo Chamado
                </button>
            </div>

            <div className="chamados-list">
                {loading ? (
                    <div className="loading"><i className="fas fa-spinner fa-spin"></i> Carregando...</div>
                ) : chamados.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-clipboard-list"></i>
                        <p>Nenhum chamado encontrado.</p>
                    </div>
                ) : (
                    chamados.map(chamado => (
                        <div key={chamado.id} className="chamado-card">
                            <div className="chamado-status-stripe" style={{ backgroundColor: getStatusColor(chamado.status_chamado) }}></div>
                            <div className="chamado-body">
                                <div className="chamado-info">
                                    <h3 className="chamado-title">{chamado.titulo}</h3>
                                    <span className="chamado-date">
                                        Criado em: {new Date(chamado.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="chamado-meta">
                                    <span className="badge status" style={{ backgroundColor: getStatusColor(chamado.status_chamado) }}>
                                        {chamado.status_chamado}
                                    </span>
                                    <span className="badge priority">
                                        {chamado.metadata?.prioridade || 'Normal'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Novo Chamado</h3>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Assunto</label>
                                <input
                                    type="text"
                                    value={newChamado.titulo}
                                    onChange={e => setNewChamado({ ...newChamado, titulo: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Descrição do Problema/Solicitação</label>
                                <textarea
                                    rows="5"
                                    value={newChamado.conteudo}
                                    onChange={e => setNewChamado({ ...newChamado, conteudo: e.target.value })}
                                    required
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <label>Prioridade</label>
                                <select
                                    value={newChamado.metadata.prioridade}
                                    onChange={e => setNewChamado({ ...newChamado, metadata: { ...newChamado.metadata, prioridade: e.target.value } })}
                                >
                                    <option value="baixa">Baixa</option>
                                    <option value="media">Média</option>
                                    <option value="alta">Alta</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="confirm-btn">Abrir Chamado</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChamadosView;
