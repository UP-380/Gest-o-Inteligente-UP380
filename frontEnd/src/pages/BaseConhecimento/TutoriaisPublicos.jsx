import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import EditButton from '../../components/common/EditButton';
import { baseConhecimentoAPI } from '../../services/api';
import { markdownToHtml } from '../../utils/richEditorMarkdown';
import { usePermissions } from '../../hooks/usePermissions';
import './TutoriaisPublicos.css';

const TutoriaisPublicos = () => {
    const navigate = useNavigate();
    const { canAccessRoute } = usePermissions();
    const [pastas, setPastas] = useState([]);
    const [pastaSelecionada, setPastaSelecionada] = useState(null);
    const [anexos, setAnexos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingAnexos, setLoadingAnexos] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [ultimoLog, setUltimoLog] = useState(null);

    const carregarPastas = useCallback(async () => {
        setLoading(true);
        try {
            const res = await baseConhecimentoAPI.getPastas();
            if (res.success) {
                const data = res.data || [];
                setPastas(data);
                if (data.length > 0) {
                    setPastaSelecionada(data[0]);
                }
            }
        } catch (err) {
            console.error('Erro ao carregar pastas:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const carregarAnexos = useCallback(async (pastaId) => {
        setLoadingAnexos(true);
        try {
            const res = await baseConhecimentoAPI.getAnexosPorPasta(pastaId);
            if (res.success) {
                setAnexos(res.data || []);
            }
        } catch (err) {
            console.error('Erro ao carregar anexos:', err);
        } finally {
            setLoadingAnexos(false);
        }
    }, []);

    const carregarUltimoLog = useCallback(async (pastaId) => {
        try {
            const resLogs = await baseConhecimentoAPI.getTutorialLogs(1, pastaId);
            if (resLogs.success && resLogs.data && resLogs.data.length > 0) {
                setUltimoLog(resLogs.data[0]);
            } else {
                setUltimoLog(null);
            }
        } catch (err) {
            console.error('Erro ao carregar log do tutorial:', err);
            setUltimoLog(null);
        }
    }, []);

    useEffect(() => {
        carregarPastas();
    }, [carregarPastas]);

    useEffect(() => {
        if (pastaSelecionada) {
            carregarAnexos(pastaSelecionada.id);
            carregarUltimoLog(pastaSelecionada.id);
        } else {
            setUltimoLog(null);
        }
    }, [pastaSelecionada, carregarAnexos, carregarUltimoLog]);

    const renderConteudo = (conteudo) => {
        if (!conteudo) return null;
        if (conteudo.startsWith('<')) {
            return <div className="tutorial-content-body ql-editor" dangerouslySetInnerHTML={{ __html: conteudo }} />;
        }
        return <div className="tutorial-content-body ql-editor" dangerouslySetInnerHTML={{ __html: markdownToHtml(conteudo) }} />;
    };

    const filteredPastas = useMemo(() => {
        if (!searchTerm.trim()) return pastas;
        const term = searchTerm.toLowerCase();
        return pastas.filter(p => p.nome.toLowerCase().includes(term));
    }, [pastas, searchTerm]);

    if (loading) {
        return (
            <Layout>
                <div className="container">
                    <LoadingState />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="tutoriais-publicos-view">
                <aside className="tutoriais-sidebar-nav">
                    <div className="sidebar-doc-header">
                        <div className="sidebar-doc-icon">
                            <i className="fas fa-book-open"></i>
                        </div>
                        <span className="sidebar-doc-brand">Tutoriais</span>
                    </div>

                    <div className="sidebar-search-compact">
                        <div className="sidebar-search-header">
                            <span className="sidebar-group-label" style={{ padding: 0 }}>Pesquisar</span>
                            {canAccessRoute('/base-conhecimento/tutoriais') && (
                                <EditButton onClick={() => navigate('/base-conhecimento/tutoriais')} title="Editar Tutoriais" />
                            )}
                        </div>
                        <div className="search-input-wrapper">
                            <i className="fas fa-search"></i>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="sidebar-group-label">Páginas</div>
                    <nav className="sidebar-items">
                        {filteredPastas.length === 0 ? (
                            <div className="empty-search">Nenhum item</div>
                        ) : (
                            filteredPastas.map(pasta => (
                                <button
                                    key={pasta.id}
                                    className={`sidebar-nav-item ${pastaSelecionada?.id === pasta.id ? 'active' : ''}`}
                                    onClick={() => setPastaSelecionada(pasta)}
                                >
                                    <i className="far fa-file-alt"></i>
                                    <span className="nav-item-text">{pasta.nome}</span>
                                </button>
                            ))
                        )}
                    </nav>
                </aside>

                <main className="tutoriais-doc-content-wrapper">
                    {pastaSelecionada ? (
                        <div className="tutoriais-doc-paper">
                            <header className="doc-paper-header">
                                <h1 className="doc-main-title">{pastaSelecionada.nome}</h1>

                                <div className="doc-author-meta">
                                    <div className="meta-author">
                                        <div className="author-avatar">
                                            {ultimoLog?.user_email ? ultimoLog.user_email.substring(0, 2).toUpperCase() : 'SC'}
                                        </div>
                                        <span className="author-name">
                                            {ultimoLog?.user_email || 'Sistema Central'}
                                        </span>
                                    </div>
                                    <div className="meta-divider"></div>
                                    <span className="meta-update">
                                        {ultimoLog?.created_at
                                            ? `Atualizado em ${new Date(ultimoLog.created_at).toLocaleDateString('pt-BR')}`
                                            : 'Atualizado recentemente'
                                        }
                                    </span>
                                </div>
                            </header>

                            <div className="doc-content-body-wrapper">
                                {loadingAnexos ? (
                                    <div className="doc-loading">
                                        <i className="fas fa-circle-notch fa-spin"></i>
                                        <span>Sincronizando conteúdo...</span>
                                    </div>
                                ) : anexos.length === 0 ? (
                                    <div className="doc-empty">
                                        <p>Este documento ainda está vazio.</p>
                                    </div>
                                ) : (
                                    <div className="doc-sections">
                                        {anexos.map((anexo) => (
                                            <div key={anexo.id} className="doc-section">
                                                {anexo.titulo && <h2 className="doc-section-title">{anexo.titulo}</h2>}
                                                {renderConteudo(anexo.conteudo)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="doc-not-selected">
                            <div className="not-selected-icon">
                                <i className="far fa-file"></i>
                            </div>
                            <h2>Selecione uma página</h2>
                            <p>Escolha um tutorial na lista ao lado para começar a ler.</p>
                        </div>
                    )}
                </main>
            </div>
        </Layout>
    );
};

export default TutoriaisPublicos;
