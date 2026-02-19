import React, { useState, useEffect, useRef } from 'react';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import './ChamadosView.css';

const ChamadosView = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newChamado, setNewChamado] = useState({
        titulo: '',
        conteudo: '',
        categoria: '',
        metadata: { prioridade: 'media' }
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);
    const fileInputRef = useRef(null);

    const OPERADORES_POR_CATEGORIA = {
        'Hardware': 'Carlos Ferreira',
        'Software': 'Ana Clara',
        'Rede': 'Roberto Mendes',
        'Acesso': 'Fernanda Lima',
        'Outros': 'Suporte Geral'
    };

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

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            let anexos = [];

            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                const uploadResponse = await comunicacaoAPI.uploadMedia(formData);

                if (uploadResponse.data && uploadResponse.data.url) {
                    anexos.push({
                        url: uploadResponse.data.url,
                        nome: selectedFile.name,
                        tipo: selectedFile.type
                    });
                }
            }

            const payload = {
                tipo: 'CHAMADO',
                titulo: newChamado.titulo,
                conteudo: newChamado.conteudo,
                status_chamado: 'ABERTO',
                metadata: {
                    ...newChamado.metadata,
                    categoria: newChamado.categoria,
                    anexos: anexos
                }
            };
            const response = await comunicacaoAPI.enviarMensagem(payload);
            if (response.success) {
                setShowModal(false);
                setNewChamado({ titulo: '', conteudo: '', categoria: '', metadata: { prioridade: 'media' } });
                setSelectedFile(null);
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
        <>
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
                                        {chamado.metadata?.categoria && (
                                            <span className="chamado-category">
                                                Categoria: {chamado.metadata.categoria}
                                            </span>
                                        )}
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
                                    <label>Categoria</label>
                                    <select
                                        value={newChamado.categoria}
                                        onChange={e => setNewChamado({ ...newChamado, categoria: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecione uma categoria</option>
                                        {Object.keys(OPERADORES_POR_CATEGORIA).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    {newChamado.categoria && (
                                        <small className="operator-hint">
                                            Responsável: {OPERADORES_POR_CATEGORIA[newChamado.categoria]}
                                        </small>
                                    )}
                                </div>

                                {newChamado.categoria && (
                                    <>
                                        <div className="form-group">
                                            <label>Assunto</label>
                                            <input
                                                type="text"
                                                value={newChamado.titulo}
                                                onChange={e => setNewChamado({ ...newChamado, titulo: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="form-group description-group">
                                            <label>Descrição do Problema/Solicitação *</label>
                                            <div className="textarea-wrapper">
                                                <textarea
                                                    rows="5"
                                                    value={newChamado.conteudo}
                                                    onChange={e => setNewChamado({ ...newChamado, conteudo: e.target.value })}
                                                    required
                                                ></textarea>
                                            </div>

                                            <button
                                                type="button"
                                                className="attach-file-btn"
                                                onClick={() => {
                                                    console.log('[ChamadosView] Button clicked, ref:', fileInputRef.current);
                                                    fileInputRef.current?.click();
                                                }}
                                            >
                                                <i className="fas fa-paperclip"></i> Anexar arquivo
                                            </button>

                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                style={{ display: 'none' }}
                                                onChange={handleFileSelect}
                                                accept="image/*,video/*"
                                            />

                                            {selectedFile && (
                                                <div className="file-preview-container" style={{ marginTop: '10px' }}>
                                                    {selectedFile.type.startsWith('image/') ? (
                                                        <div className="image-preview-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
                                                            <img
                                                                src={URL.createObjectURL(selectedFile)}
                                                                alt="Preview"
                                                                onClick={() => setExpandedImage(URL.createObjectURL(selectedFile))}
                                                                style={{
                                                                    maxWidth: '120px',
                                                                    maxHeight: '120px',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid #e2e8f0',
                                                                    display: 'block',
                                                                    cursor: 'pointer',
                                                                    transition: 'transform 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                                title="Clique para ampliar"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={handleRemoveFile}
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '5px',
                                                                    right: '5px',
                                                                    background: 'rgba(0, 0, 0, 0.4)',
                                                                    border: 'none',
                                                                    borderRadius: '50%',
                                                                    color: 'white',
                                                                    cursor: 'pointer',
                                                                    width: '24px',
                                                                    height: '24px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '14px',
                                                                    transition: 'background 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'}
                                                                title="Remover imagem"
                                                            >
                                                                <i className="fas fa-times"></i>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="file-preview">
                                                            <span><i className="fas fa-paperclip"></i> {selectedFile.name}</span>
                                                            <i className="fas fa-times remove-file" onClick={handleRemoveFile} title="Remover anexo"></i>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

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

            {
                expandedImage && (
                    <div
                        className="image-lightbox"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.9)',
                            zIndex: 99999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }}
                        onClick={() => setExpandedImage(null)}
                    >
                        <button
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                fontSize: '40px',
                                cursor: 'pointer'
                            }}
                            onClick={() => setExpandedImage(null)}
                        >
                            &times;
                        </button>
                        <img
                            src={expandedImage}
                            alt="Expanded"
                            style={{
                                maxWidth: '90%',
                                maxHeight: '90%',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}
        </>
    );
};

export default ChamadosView;
