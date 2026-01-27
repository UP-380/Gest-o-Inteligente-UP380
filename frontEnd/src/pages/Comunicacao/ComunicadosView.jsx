import React, { useState, useEffect } from 'react';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import './ComunicadosView.css';

const ComunicadosView = () => {
    const [comunicados, setComunicados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newComunicado, setNewComunicado] = useState({ titulo: '', conteudo: '' });
    const [isGestor, setIsGestor] = useState(false);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('usuario'));
        if (user && (user.permissoes === 'administrador' || user.permissoes === 'gestor')) {
            setIsGestor(true);
        }
        loadComunicados();
    }, []);

    const loadComunicados = async () => {
        setLoading(true);
        try {
            const response = await comunicacaoAPI.listarComunicados();
            if (response.success) {
                setComunicados(response.data);
            }
        } catch (error) {
            console.error('Erro ao listar comunicados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                tipo: 'COMUNICADO',
                titulo: newComunicado.titulo,
                conteudo: newComunicado.conteudo
            };
            const response = await comunicacaoAPI.enviarMensagem(payload);
            if (response.success) {
                setShowModal(false);
                setNewComunicado({ titulo: '', conteudo: '' });
                loadComunicados();
            }
        } catch (error) {
            console.error('Erro ao criar comunicado:', error);
        }
    };

    return (
        <div className="comunicados-view">
            <div className="comunicados-header">
                <h2>Comunicados Internos</h2>
                {isGestor && (
                    <button className="new-comunicado-btn" onClick={() => setShowModal(true)}>
                        <i className="fas fa-plus"></i> Novo Comunicado
                    </button>
                )}
            </div>

            <div className="comunicados-list">
                {loading ? (
                    <div className="loading"><i className="fas fa-spinner fa-spin"></i> Carregando...</div>
                ) : comunicados.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-bullhorn"></i>
                        <p>Nenhum comunicado encontrado.</p>
                    </div>
                ) : (
                    comunicados.map(com => (
                        <div key={com.id} className="comunicado-card">
                            <div className="comunicado-meta">
                                <span className="author">{com.criador?.nome_usuario}</span>
                                <span className="date">{new Date(com.created_at).toLocaleDateString()}</span>
                            </div>
                            <h3 className="comunicado-title">{com.titulo}</h3>
                            <div className="comunicado-content">{com.conteudo}</div>
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Novo Comunicado</h3>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Título</label>
                                <input
                                    type="text"
                                    value={newComunicado.titulo}
                                    onChange={e => setNewComunicado({ ...newComunicado, titulo: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Conteúdo</label>
                                <textarea
                                    rows="5"
                                    value={newComunicado.conteudo}
                                    onChange={e => setNewComunicado({ ...newComunicado, conteudo: e.target.value })}
                                    required
                                ></textarea>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="confirm-btn">Publicar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComunicadosView;
