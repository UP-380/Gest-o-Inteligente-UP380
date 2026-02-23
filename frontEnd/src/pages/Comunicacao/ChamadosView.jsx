import React, { useState, useEffect, useRef } from 'react';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import { departamentosAPI } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import RichEditor from '../../components/common/RichEditor';
import './ChamadosView.css';

const ChamadosView = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newChamado, setNewChamado] = useState({
        titulo: '',
        conteudo: '',
        categoria_id: '',
        metadata: { prioridade: 'media' }
    });
    const [categorias, setCategorias] = useState([]);
    const [dynamicFields, setDynamicFields] = useState({});
    const [selectedFile, setSelectedFile] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadChamados();
        loadCategorias();
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

    const loadCategorias = async () => {
        try {
            const response = await comunicacaoAPI.listarCategorias();
            if (response.success) {
                setCategorias(response.data);
            }
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
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
                    categoria_id: newChamado.categoria_id,
                    campos_dinamicos: dynamicFields,
                    anexos: anexos
                }
            };
            const response = await comunicacaoAPI.enviarMensagem(payload);
            if (response.success) {
                setShowModal(false);
                setNewChamado({ titulo: '', conteudo: '', categoria_id: '', metadata: { prioridade: 'media' } });
                setDynamicFields({});
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
                                            Aberto por: <strong>{chamado.criador?.nome_usuario || 'Usuário'}</strong>
                                        </span>
                                        {chamado.metadata?.responsavel ? (
                                            <span className="chamado-category">
                                                Responsável: <strong>{chamado.metadata.responsavel}</strong>
                                            </span>
                                        ) : (
                                            <span className="chamado-category">
                                                Categoria: {chamado.metadata?.categoria || 'Geral'}
                                            </span>
                                        )}
                                        <span className="chamado-date">
                                            Criado em: {formatDate(chamado.created_at)}
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
                                    <label>Tópico de Ajuda (Categoria)</label>
                                    <select
                                        value={newChamado.categoria_id}
                                        onChange={e => {
                                            const catId = e.target.value;
                                            setNewChamado({ ...newChamado, categoria_id: catId });
                                            setDynamicFields({}); // Reset campos dinâmicos ao trocar categoria
                                        }}
                                        required
                                    >
                                        <option value="">Selecione o tipo de problema</option>
                                        {categorias.map(cat => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {newChamado.categoria_id && (
                                    <>
                                        {/* Renderizar campos dinâmicos se existirem */}
                                        {categorias.find(c => String(c.id) === String(newChamado.categoria_id))?.campos_esquema?.map(field => (
                                            <div className="form-group" key={field.name}>
                                                <label>{field.label} {field.required && '*'}</label>
                                                <input
                                                    type={field.type || 'text'}
                                                    value={dynamicFields[field.name] || ''}
                                                    onChange={e => setDynamicFields({ ...dynamicFields, [field.name]: e.target.value })}
                                                    required={field.required}
                                                    placeholder={field.placeholder || ''}
                                                />
                                            </div>
                                        ))}
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
                                            <RichEditor
                                                initialValue={newChamado.conteudo}
                                                onContentChange={val => setNewChamado({ ...newChamado, conteudo: val })}
                                                placeholder="Descreva o problema ou solicitação..."
                                                minHeight="150px"
                                                showUploadIcon={false}
                                                onImageClick={setExpandedImage}
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            className="attach-file-btn"
                                            onClick={() => fileInputRef.current?.click()}
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
                                            <div className="file-preview-container">
                                                {selectedFile.type.startsWith('image/') ? (
                                                    <div className="image-preview-wrapper">
                                                        <img
                                                            src={URL.createObjectURL(selectedFile)}
                                                            alt="Preview"
                                                            onClick={() => setExpandedImage(URL.createObjectURL(selectedFile))}
                                                            className="image-preview"
                                                            title="Clique para ampliar"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveFile}
                                                            className="remove-image-btn"
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

            {expandedImage && (
                <div className="image-lightbox" onClick={() => setExpandedImage(null)}>
                    <button className="lightbox-close" onClick={() => setExpandedImage(null)}>
                        &times;
                    </button>
                    <img
                        src={expandedImage}
                        alt="Expanded"
                        className="expanded-image"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
};

export default ChamadosView;
