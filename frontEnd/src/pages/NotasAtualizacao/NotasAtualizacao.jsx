import React, { useState, useCallback, useEffect, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import PageHeader from '../../components/common/PageHeader';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import RichTextEditor from '../../components/common/RichTextEditor';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import { baseConhecimentoAPI } from '../../services/api';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useLocation } from 'react-router-dom';
import './NotasAtualizacao.css';

const MENSAGENS = {
    SELECIONE_ITEM: 'Selecione uma nota de atualização para visualizar.',
    CRIAR_PRIMEIRO: 'Criar primeira nota',
    TITULO_OBRIGATORIO: 'Título é obrigatório',
    CRIADO_SUCESSO: 'Nota criada com sucesso.',
    ATUALIZADO_SUCESSO: 'Nota atualizada com sucesso.',
    EXCLUIDO_SUCESSO: 'Nota excluída com sucesso.',
    ERRO_CARREGAR: 'Erro ao carregar notas.',
    ERRO_SALVAR: 'Erro ao salvar nota.',
    ERRO_EXCLUIR: 'Erro ao excluir nota.',
    EXCLUIR_TITULO: 'Excluir Nota',
    EXCLUIR_TEXTO: 'Tem certeza que deseja excluir esta nota de atualização? Esta ação não pode ser desfeita.',
    CONTEUDO_VAZIO: 'O conteúdo não pode estar vazio.',
    SEM_PERMISSAO: 'Você não tem permissão para realizar esta ação.',
};

const NotasAtualizacao = () => {
    const showToast = useToast();
    const { isAdmin } = usePermissions();
    const { search } = useLocation();

    const [notas, setNotas] = useState([]);
    const [notaSelecionadaId, setNotaSelecionadaId] = useState(null);
    const [carregandoListagem, setCarregandoListagem] = useState(false);

    // Estado do formulário
    const [titulo, setTitulo] = useState('');
    const [conteudo, setConteudo] = useState('');
    const [dataPublicacao, setDataPublicacao] = useState(new Date().toISOString().split('T')[0]);
    const [salvando, setSalvando] = useState(false);
    const [excluindo, setExcluindo] = useState(false);

    // Controle de edição
    const [isEditing, setIsEditing] = useState(false); // True se estiver criando ou editando
    const [isCreating, setIsCreating] = useState(false); // True apenas se estiver criando nova

    const [notaParaExcluir, setNotaParaExcluir] = useState(null);

    // Upload
    const fileInputRef = useRef(null);
    const richEditorRef = useRef(null);
    const [uploadingMidia, setUploadingMidia] = useState(false);

    const carregarNotas = useCallback(async () => {
        setCarregandoListagem(true);
        try {
            const res = await baseConhecimentoAPI.atualizacoes.listar();
            if (res.success) {
                setNotas(res.data || []);
                // Se houver notas e nenhuma selecionada, não seleciona automaticamente para dar visão geral?
                // Ou seleciona a primeira? Vamos deixar o usuário selecionar.
            } else {
                showToast('error', MENSAGENS.ERRO_CARREGAR);
            }
        } catch (err) {
            showToast('error', err.message || MENSAGENS.ERRO_CARREGAR);
        } finally {
            setCarregandoListagem(false);
        }
    }, [showToast]);

    useEffect(() => {
        carregarNotas();
    }, [carregarNotas]);

    // Carregar detalhes da nota selecionada
    const carregarDetalhesNota = useCallback(async (id) => {
        if (!id) return;
        try {
            // Se já temos o conteúdo na listagem (idealmente listagem é leve, detalhes pesado)
            // Mas o endpoint de detalhes busca tudo. Vamos buscar detalhes.
            const res = await baseConhecimentoAPI.atualizacoes.getPorId(id);
            if (res.success && res.data) {
                setTitulo(res.data.titulo);
                setConteudo(res.data.conteudo || '');
                setDataPublicacao(res.data.data_publicacao ? res.data.data_publicacao.split('T')[0] : new Date().toISOString().split('T')[0]);
                setIsEditing(false);
                setIsCreating(false);
            } else {
                showToast('error', 'Erro ao carregar detalhes.');
            }
        } catch (error) {
            showToast('error', 'Erro ao carregar detalhes.');
        }
    }, [showToast]);

    const handleSelecionarNota = useCallback((id) => {
        if (salvando) return; // Evitar troca enquanto salva
        // Se estiver editando e mudar, verificar alterações? (Simplificado por enquanto)
        setNotaSelecionadaId(id);
        carregarDetalhesNota(id);
    }, [salvando, carregarDetalhesNota]);

    const handleNovaNota = useCallback(() => {
        if (!isAdmin) return;
        setNotaSelecionadaId('novo');
        setTitulo('');
        setConteudo('');
        setDataPublicacao(new Date().toISOString().split('T')[0]);
        setIsCreating(true);
        setIsEditing(true);
    }, [isAdmin]);

    const handleEditarNota = useCallback(() => {
        if (!isAdmin) return;
        setIsEditing(true);
    }, [isAdmin]);

    const handleCancelarEdicao = useCallback(() => {
        if (isCreating) {
            setNotaSelecionadaId(null);
            setTitulo('');
            setConteudo('');
            setDataPublicacao(new Date().toISOString().split('T')[0]);
            setIsCreating(false);
            setIsEditing(false);
        } else {
            setIsEditing(false);
            // Recarregar dados originais
            if (notaSelecionadaId) carregarDetalhesNota(notaSelecionadaId);
        }
    }, [isCreating, notaSelecionadaId, carregarDetalhesNota]);

    const handleSalvar = useCallback(async () => {
        if (!isAdmin) {
            showToast('error', MENSAGENS.SEM_PERMISSAO);
            return;
        }

        if (!titulo.trim()) {
            showToast('warning', MENSAGENS.TITULO_OBRIGATORIO);
            return;
        }

        // Conteúdo opcional? Pode ser. Mas aviso se vazio.
        if (!conteudo.trim()) {
            showToast('warning', MENSAGENS.CONTEUDO_VAZIO);
            return;
        }

        setSalvando(true);
        try {
            if (isCreating) {
                const res = await baseConhecimentoAPI.atualizacoes.criar({ titulo, conteudo, data_publicacao: dataPublicacao });
                if (res.success) {
                    showToast('success', MENSAGENS.CRIADO_SUCESSO);
                    await carregarNotas();
                    setNotaSelecionadaId(res.data.id);
                    setIsCreating(false);
                    setIsEditing(false);
                } else {
                    showToast('error', res.error || MENSAGENS.ERRO_SALVAR);
                }
            } else {
                const res = await baseConhecimentoAPI.atualizacoes.atualizar(notaSelecionadaId, { titulo, conteudo, data_publicacao: dataPublicacao });
                if (res.success) {
                    showToast('success', MENSAGENS.ATUALIZADO_SUCESSO);
                    await carregarNotas(); // Atualizar lista para refletir titulo novo
                    setIsEditing(false);
                } else {
                    showToast('error', res.error || MENSAGENS.ERRO_SALVAR);
                }
            }
        } catch (err) {
            showToast('error', err.message || MENSAGENS.ERRO_SALVAR);
        } finally {
            setSalvando(false);
        }
    }, [isAdmin, isCreating, notaSelecionadaId, titulo, conteudo, dataPublicacao, showToast, carregarNotas]);

    const handleExcluir = useCallback(async () => {
        if (!notaParaExcluir || !isAdmin) return;
        setExcluindo(true);
        try {
            const res = await baseConhecimentoAPI.atualizacoes.excluir(notaParaExcluir.id);
            if (res.success) {
                showToast('success', MENSAGENS.EXCLUIDO_SUCESSO);
                if (notaParaExcluir.id === notaSelecionadaId) {
                    setNotaSelecionadaId(null);
                    setTitulo('');
                    setConteudo('');
                    setIsEditing(false);
                }
                setNotaParaExcluir(null);
                await carregarNotas();
            } else {
                showToast('error', res.error || MENSAGENS.ERRO_EXCLUIR);
            }
        } catch (err) {
            showToast('error', err.message || MENSAGENS.ERRO_EXCLUIR);
        } finally {
            setExcluindo(false);
        }
    }, [notaParaExcluir, notaSelecionadaId, isAdmin, showToast, carregarNotas]);

    // Função para extrair headers do conteúdo HTML
    const extractHeaders = useCallback((html) => {
        if (!html) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const headers = Array.from(doc.querySelectorAll('h1, h2, h3'));

        return headers.map((h, index) => ({
            id: `header-${index}`,
            text: h.innerText || h.textContent,
            level: parseInt(h.tagName.substring(1)),
            tagName: h.tagName
        }));
    }, []);

    // Função para rolar até o header
    const scrollToHeader = useCallback((text) => {
        const contentArea = document.querySelector('.notas-visualizacao-content');
        if (!contentArea) return;

        const headers = Array.from(contentArea.querySelectorAll('h1, h2, h3'));
        const target = headers.find(h => (h.innerText || h.textContent) === text);

        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    const initialSelectionDone = useRef(false);

    // Auto-select note from URL
    useEffect(() => {
        if (initialSelectionDone.current) return;
        const queryParams = new URLSearchParams(search);
        const id = queryParams.get('id');
        if (id) {
            handleSelecionarNota(id);
            initialSelectionDone.current = true;
        }
    }, [search, handleSelecionarNota]);

    // Upload Logic (reused)
    const handleUploadTrigger = useCallback(() => fileInputRef.current?.click(), []);
    const handleFileSelect = useCallback(async (e) => {
        const files = e.target.files;
        if (!files?.length) return;
        const file = files[0];

        setUploadingMidia(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await comunicacaoAPI.uploadMedia(formData);
            if (res?.success && res?.data?.url) {
                const url = res.data.url;
                const isVideo = file.type.startsWith('video/');
                if (isVideo && richEditorRef.current?.insertVideoAtEnd) {
                    richEditorRef.current.insertVideoAtEnd(url);
                } else if (!isVideo && richEditorRef.current?.insertImageAtEnd) {
                    richEditorRef.current.insertImageAtEnd(url);
                } else if (richEditorRef.current?.insertHtmlAtEnd) {
                    const html = isVideo
                        ? `<p><video src="${url}" controls style="max-width:100%;"></video></p>`
                        : `<p><img src="${url}" alt="imagem" style="max-width:100%;" /></p>`;
                    richEditorRef.current.insertHtmlAtEnd(html);
                }
                // Atualizar conteudo state via onChange do editor, mas podemos forçar aqui se precisar
            } else {
                showToast('error', 'Falha no upload.');
            }
        } catch (err) {
            showToast('error', 'Falha no upload.');
        } finally {
            setUploadingMidia(false);
            e.target.value = '';
        }
    }, [showToast]);

    return (
        <Layout>
            <div className="container notas-atualizacao-page-wrapper">
                <main className="main-content">
                    <CardContainer>
                        <div className="anexar-arquivo-container"> {/* Reusing CSS class for layout structure */}
                            <PageHeader title="Notas de Atualização" subtitle="Registro de alterações e melhorias do sistema" />

                            <div className="anexar-arquivo-layout">
                                {/* Coluna Esquerda: Lista */}
                                <div className="anexar-arquivo-col-esq">
                                    <div className="anexar-arquivo-pastas-header">
                                        {isAdmin && (
                                            <button type="button" className="anexar-arquivo-btn-nova-pasta" onClick={handleNovaNota} disabled={isCreating}>
                                                <i className="fas fa-plus"></i> Novo
                                            </button>
                                        )}
                                    </div>

                                    {carregandoListagem ? (
                                        <div className="anexar-arquivo-loading"><i className="fas fa-spinner fa-spin"></i> Carregando...</div>
                                    ) : notas.length === 0 ? (
                                        <div className="anexar-arquivo-empty-pastas">
                                            <p>Nenhuma nota encontrada.</p>
                                        </div>
                                    ) : (
                                        <ul className="anexar-arquivo-pastas-list">
                                            {notas.map(nota => {
                                                const subOptions = notaSelecionadaId === nota.id && !isEditing ? extractHeaders(nota.conteudo) : [];
                                                const isDraft = !nota.anunciado;

                                                return (
                                                    <React.Fragment key={nota.id}>
                                                        <li
                                                            className={`anexar-arquivo-pasta-item ${notaSelecionadaId === nota.id ? 'active' : ''} ${isDraft ? 'nota-draft' : ''}`}
                                                            onClick={() => handleSelecionarNota(nota.id)}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
                                                                <span className="anexar-arquivo-pasta-nome" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    {isDraft && <i className="fas fa-clock" style={{ fontSize: '10px', color: '#f59e0b' }} title="Agendado"></i>}
                                                                    {nota.titulo}
                                                                </span>
                                                                <span className="notas-data-badge">{new Date(nota.data_publicacao || nota.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </li>

                                                        {subOptions.length > 0 && (
                                                            <div className="nota-sub-options">
                                                                {subOptions.map((header, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className={`nota-sub-option level-${header.level}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            scrollToHeader(header.text);
                                                                        }}
                                                                    >
                                                                        {header.text}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>

                                {/* Coluna Direita: Editor/Visualizador */}
                                <div className="anexar-arquivo-col-dir">
                                    {!notaSelecionadaId ? (
                                        <div className="anexar-arquivo-empty-doc">
                                            <p>{MENSAGENS.SELECIONE_ITEM}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="anexar-arquivo-doc-bar">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        className="notas-titulo-input"
                                                        value={titulo}
                                                        onChange={e => setTitulo(e.target.value)}
                                                        placeholder="Título da Versão/Atualização"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <h3 className="anexar-arquivo-doc-bar-titulo">{titulo}</h3>
                                                        <span className="notas-data-badge" style={{ fontSize: '0.85rem' }}>
                                                            {new Date(dataPublicacao).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="anexar-arquivo-doc-bar-actions">
                                                    {isEditing && (
                                                        <div className="notas-date-picker-container">
                                                            <label htmlFor="nota-date-input" className="notas-calendar-btn" title="Definir data da nota">
                                                                <i className="fas fa-calendar-alt"></i>
                                                                <input
                                                                    id="nota-date-input"
                                                                    type="date"
                                                                    value={dataPublicacao}
                                                                    onChange={e => setDataPublicacao(e.target.value)}
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                    {isAdmin && !isEditing && (
                                                        <>
                                                            <button type="button" className="anexar-arquivo-btn-edit" onClick={handleEditarNota} title="Editar">
                                                                <i className="fas fa-edit"></i> Editar
                                                            </button>
                                                            <button type="button" className="anexar-arquivo-btn-delete" onClick={() => setNotaParaExcluir({ id: notaSelecionadaId })} title="Excluir">
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </>
                                                    )}

                                                    {isEditing && (
                                                        <>
                                                            <button type="button" className="btn-secondary margin-right-sm" onClick={handleCancelarEdicao} disabled={salvando}>
                                                                Cancelar
                                                            </button>
                                                            <ButtonPrimary onClick={handleSalvar} disabled={salvando} icon={salvando ? 'fas fa-spinner fa-spin' : 'fas fa-save'}>
                                                                {salvando ? 'Salvando...' : 'Salvar'}
                                                            </ButtonPrimary>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="anexar-arquivo-doc-page">
                                                <div className="anexar-arquivo-doc-page-inner">
                                                    {isEditing ? (
                                                        <>
                                                            <RichTextEditor
                                                                ref={richEditorRef}
                                                                value={conteudo}
                                                                onChange={setConteudo}
                                                                placeholder="Descreva as atualizações aqui..."
                                                                minHeight={420}
                                                            />
                                                            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="anexar-arquivo-upload-input" onChange={handleFileSelect} />
                                                            <div className="anexar-arquivo-doc-upload-wrap">
                                                                <button type="button" className="anexar-arquivo-doc-upload-btn" onClick={handleUploadTrigger} disabled={uploadingMidia} title="Anexar imagem ou vídeo">
                                                                    {uploadingMidia ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-cloud-upload-alt" />}
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        /* Modo Leitura */
                                                        <div className="notas-visualizacao-content" dangerouslySetInnerHTML={{ __html: conteudo }} />
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContainer>
                </main>
            </div>

            {/* Modal Confirmar Excluir */}
            {notaParaExcluir && (
                <ConfirmModal
                    isOpen={true}
                    onClose={() => setNotaParaExcluir(null)}
                    onConfirm={handleExcluir}
                    title={MENSAGENS.EXCLUIR_TITULO}
                    message={MENSAGENS.EXCLUIR_TEXTO}
                    confirmText="Excluir"
                    confirmButtonClass="btn-danger" // Assuming you have red button style
                    isLoading={excluindo}
                />
            )}
        </Layout>
    );
};

export default NotasAtualizacao;
