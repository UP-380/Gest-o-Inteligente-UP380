import React, { useState, useEffect, useRef } from 'react';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import { departamentosAPI } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import SearchInput from '../../components/common/SearchInput';
import FilterDate from '../../components/filters/FilterDate';
import RichEditor from '../../components/common/RichEditor';
import './ChamadosView.css';

const ChamadosView = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newChamado, setNewChamado] = useState({
        titulo: '',
        conteudo: '',
        departamento_id: '',
        metadata: { prioridade: 'media', sistema: '', prazo_desejado: '' }
    });
    const [departamentos, setDepartamentos] = useState([]);
    const [dynamicFields, setDynamicFields] = useState({});
    const [selectedFile, setSelectedFile] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);
    const fileInputRef = useRef(null);
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [membrosDepartamento, setMembrosDepartamento] = useState([]);

    useEffect(() => {
        loadChamados();
        loadDepartamentos();
    }, []);

    const loadDepartamentos = async () => {
        try {
            const response = await departamentosAPI.getAll(1, 100);
            if (response.success) {
                setDepartamentos(response.data);
            }
        } catch (error) {
            console.error('Erro ao buscar departamentos:', error);
        }
    };

    const loadMembrosDepartamento = async (deptId) => {
        if (!deptId) {
            setMembrosDepartamento([]);
            return;
        }
        try {
            const response = await departamentosAPI.getMembros(deptId);
            if (response.success) {
                setMembrosDepartamento(response.data);
            }
        } catch (error) {
            console.error('Erro ao buscar membros do departamento:', error);
        }
    };

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
                    departamento_id: newChamado.departamento_id,
                    anexos: anexos
                }
            };
            const response = await comunicacaoAPI.enviarMensagem(payload);
            if (response.success) {
                setShowModal(false);
                setNewChamado({ titulo: '', conteudo: '', departamento_id: '', metadata: { prioridade: 'media', sistema: '' } });
                setDynamicFields({});
                setSelectedFile(null);
                setMembrosDepartamento([]);
                loadChamados();
            }
        } catch (error) {
            console.error('Erro ao abrir chamado:', error);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'ABERTO': return '#ffc107'; // yellow
            case 'EM_ANALISE': return '#fd7e14'; // orange
            case 'RESPONDIDO': return '#007bff'; // blue
            case 'ENCERRADO':
            case 'CONCLUIDO': return '#28a745'; // green
            case 'CANCELADO': return '#dc3545'; // red
            default: return '#6c757d'; // gray
        }
    };

    return (
        <>
            <div className="chamados-view">
                <div className="chamados-header">
                    <h2>Meus Chamados</h2>
                    <button className="new-chamado-btn" onClick={() => {
                        setNewChamado({ titulo: '', conteudo: '', departamento_id: '', metadata: { prioridade: 'media', sistema: '', prazo_desejado: '' } });
                        setMembrosDepartamento([]);
                        setShowModal(true);
                    }}>
                        <i className="fas fa-plus"></i> Novo Chamado
                    </button>
                </div>

                <div className="chamados-controls" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '15px',
                    marginBottom: '25px',
                    padding: '0 20px'
                }}>
                    <div style={{ width: '100%', maxWidth: '500px' }}>
                        <SearchInput
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Pesquisar chamados por título, conteúdo ou autor..."
                        />
                    </div>

                    <div className="chamados-filters" style={{
                        display: 'flex',
                        gap: '10px',
                        overflowX: 'auto',
                        paddingBottom: '5px',
                        width: '100%',
                        justifyContent: 'center'
                    }}>
                        {['Todos', 'ABERTO', 'EM_ANALISE', 'RESPONDIDO', 'ENCERRADO', 'CANCELADO'].map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`status-filter-btn ${statusFilter === st ? 'active' : ''}`}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid #e2e8f0',
                                    background: statusFilter === st ? '#0e3b6f' : 'white',
                                    color: statusFilter === st ? 'white' : '#64748b',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {st === 'Todos' ? 'Todos' :
                                    st === 'EM_ANALISE' ? 'Em análise' :
                                        st === 'RESPONDIDO' ? 'Em processo' :
                                            st === 'ENCERRADO' ? 'Encerrado' :
                                                st === 'CANCELADO' ? 'Cancelado' : st}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="chamados-list">
                    {loading ? (
                        <div className="loading"><i className="fas fa-spinner fa-spin"></i> Carregando...</div>
                    ) : chamados.filter(c => {
                        const matchesStatus = statusFilter === 'Todos' ||
                            (statusFilter === 'ENCERRADO' ? (c.status_chamado === 'ENCERRADO' || c.status_chamado === 'CONCLUIDO') : c.status_chamado === statusFilter);

                        const searchLower = searchTerm.toLowerCase();
                        const matchesSearch = !searchTerm.trim() ||
                            (c.titulo?.toLowerCase().includes(searchLower)) ||
                            (c.conteudo?.toLowerCase().includes(searchLower)) ||
                            (c.criador?.nome_usuario?.toLowerCase().includes(searchLower)) ||
                            (c.metadata?.responsavel?.toLowerCase().includes(searchLower));

                        return matchesStatus && matchesSearch;
                    }).length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-clipboard-list"></i>
                            <p>Nenhum chamado encontrado.</p>
                        </div>
                    ) : (
                        chamados.filter(c => {
                            const matchesStatus = statusFilter === 'Todos' ||
                                (statusFilter === 'ENCERRADO' ? (c.status_chamado === 'ENCERRADO' || c.status_chamado === 'CONCLUIDO') : c.status_chamado === statusFilter);

                            const searchLower = searchTerm.toLowerCase();
                            const matchesSearch = !searchTerm.trim() ||
                                (c.titulo?.toLowerCase().includes(searchLower)) ||
                                (c.conteudo?.toLowerCase().includes(searchLower)) ||
                                (c.criador?.nome_usuario?.toLowerCase().includes(searchLower)) ||
                                (c.metadata?.responsavel?.toLowerCase().includes(searchLower));

                            return matchesStatus && matchesSearch;
                        }).map(chamado => (
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
                                                Departamento: <strong>{departamentos.find(d => String(d.id) === String(chamado.metadata?.departamento_id))?.nome || chamado.categoria?.departamento?.nome || 'Geral'}</strong>
                                            </span>
                                        )}
                                        <span className="chamado-date">
                                            Criado em: {formatDate(chamado.created_at)}
                                        </span>
                                        <span className="chamado-system">
                                            <i className="fas fa-desktop" style={{ marginRight: '8px' }}></i> Sistema: <strong>{chamado.metadata?.sistema || '---'}</strong>
                                        </span>
                                    </div>
                                    <div className="chamado-meta">
                                        <span className="badge status" style={{ backgroundColor: getStatusColor(chamado.status_chamado) }}>
                                            {chamado.status_chamado === 'RESPONDIDO' ? 'EM PROCESSO' :
                                                chamado.status_chamado === 'EM_ANALISE' ? 'EM ANÁLISE' :
                                                    chamado.status_chamado === 'CONCLUIDO' ? 'ENCERRADO' :
                                                        chamado.status_chamado === 'ENCERRADO' ? 'ENCERRADO' :
                                                            chamado.status_chamado === 'CANCELADO' ? 'CANCELADO' :
                                                                chamado.status_chamado}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="deadline-tag" style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                backgroundColor: chamado.prazo_confirmado
                                                    ? (new Date(chamado.prazo_confirmado) < new Date() ? '#fee2e2' : '#dcfce7')
                                                    : '#f1f5f9',
                                                color: chamado.prazo_confirmado
                                                    ? (new Date(chamado.prazo_confirmado) < new Date() ? '#b91c1c' : '#15803d')
                                                    : '#64748b',
                                                fontWeight: '700',
                                                border: '1px solid currentColor'
                                            }}>
                                                Prazo: {chamado.prazo_confirmado ? formatDate(chamado.prazo_confirmado) : 'não confirmado'}
                                            </span>
                                            <i className="fas fa-flag" style={{
                                                color: chamado.metadata?.prioridade === 'URGENTE' ? '#ef4444' :
                                                    chamado.metadata?.prioridade === 'ALTA' ? '#f97316' :
                                                        chamado.metadata?.prioridade === 'NORMAL' ? '#22c55e' : '#3b82f6',
                                                fontSize: '1.2rem'
                                            }} title={`Prioridade: ${chamado.metadata?.prioridade || 'Normal'}`}></i>
                                        </div>
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
                                    <label>Selecione o departamento desejado *</label>
                                    <select
                                        value={newChamado.departamento_id}
                                        onChange={e => {
                                            const deptId = e.target.value;
                                            console.log('Selecionou departamento:', deptId);
                                            setNewChamado({
                                                ...newChamado,
                                                departamento_id: deptId,
                                                metadata: { ...newChamado.metadata, responsavel_id: '', responsavel: '' }
                                            });
                                            setDynamicFields({});
                                            loadMembrosDepartamento(deptId);
                                        }}
                                        required
                                    >
                                        <option value="">Selecione o departamento</option>
                                        {departamentos.map(dept => (
                                            <option key={dept.id} value={dept.id}>
                                                {dept.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {newChamado.departamento_id && (
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

                                        <div className="form-group">
                                            <label>Selecione o responsável (Opcional)</label>
                                            <select
                                                value={newChamado.metadata.responsavel_id || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    const member = membrosDepartamento.find(m => String(m.usuario_id || m.membro_id || m.id) === String(val));
                                                    setNewChamado({
                                                        ...newChamado,
                                                        metadata: {
                                                            ...newChamado.metadata,
                                                            responsavel_id: val,
                                                            responsavel: member ? member.name : ''
                                                        }
                                                    });
                                                }}
                                            >
                                                <option value="">Qualquer pessoa do departamento</option>
                                                {membrosDepartamento.map(m => (
                                                    <option key={m.usuario_id || m.membro_id || m.id} value={m.usuario_id || m.membro_id || m.id}>
                                                        {m.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Sistema relacionado</label>
                                            <select
                                                value={newChamado.metadata.sistema || ''}
                                                onChange={e => setNewChamado({
                                                    ...newChamado,
                                                    metadata: { ...newChamado.metadata, sistema: e.target.value }
                                                })}
                                            >
                                                <option value="">---</option>
                                                <option value="Upmap">Upmap</option>
                                                <option value="MongoHub">MongoHub</option>
                                                <option value="ClickUp">ClickUp</option>
                                                <option value="Teams">Teams</option>
                                                <option value="Sistema de Pendências">Sistema de Pendências</option>
                                                <option value="Whatsapp">Whatsapp</option>
                                                <option value="Omie">Omie</option>
                                                <option value="Kamino">Kamino</option>
                                                <option value="Conciliadora">Conciliadora</option>
                                                <option value="outros">outros</option>
                                                <option value="não é sistema">não é sistema</option>
                                            </select>
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

                                <div className="form-group">
                                    <label>Prazo Desejado para Conclusão</label>
                                    <FilterDate
                                        label=""
                                        value={newChamado.metadata.prazo_desejado}
                                        onChange={e => setNewChamado({
                                            ...newChamado,
                                            metadata: { ...newChamado.metadata, prazo_desejado: e.target.value }
                                        })}
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button type="button" onClick={() => setShowModal(false)}>Cancelar</button>
                                    <button type="submit" className="confirm-btn">Abrir Chamado</button>
                                </div>
                            </form>
                        </div>
                    </div >
                )}
            </div >

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
