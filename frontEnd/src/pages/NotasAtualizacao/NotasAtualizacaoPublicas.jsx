import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import LoadingState from '../../components/common/LoadingState';
import EditButton from '../../components/common/EditButton';
import { baseConhecimentoAPI } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import './NotasAtualizacaoPublicas.css';

const NotasAtualizacaoPublicas = () => {
    const navigate = useNavigate();
    const { canAccessRoute } = usePermissions();
    const [notas, setNotas] = useState([]);
    const [notaSelecionada, setNotaSelecionada] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const carregarNotas = useCallback(async () => {
        setLoading(true);
        try {
            const res = await baseConhecimentoAPI.atualizacoes.listar();
            if (res.success) {
                const data = res.data || [];
                setNotas(data);
                if (data.length > 0) {
                    setNotaSelecionada(data[0]);
                }
            }
        } catch (err) {
            console.error('Erro ao carregar notas:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregarNotas();
    }, [carregarNotas]);

    const filteredNotas = useMemo(() => {
        if (!searchTerm.trim()) return notas;
        const term = searchTerm.toLowerCase();
        return notas.filter(n => n.titulo.toLowerCase().includes(term));
    }, [notas, searchTerm]);

    const formatarData = (dataStr) => {
        if (!dataStr) return '';
        return new Date(dataStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

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
            <div className="tutoriais-publicos-view"> {/* Reusing the same base class for layout consistency */}
                <aside className="tutoriais-sidebar-nav">
                    <div className="sidebar-doc-header">
                        <div className="sidebar-doc-icon">
                            <i className="fas fa-clipboard-check"></i>
                        </div>
                        <span className="sidebar-doc-brand">Notas de Atualizações</span>
                    </div>

                    <div className="sidebar-search-compact">
                        <div className="sidebar-search-header">
                            <span className="sidebar-group-label" style={{ padding: 0 }}>Pesquisar</span>
                            {canAccessRoute('/base-conhecimento/notas-atualizacao') && (
                                <EditButton onClick={() => navigate('/base-conhecimento/notas-atualizacao')} title="Editar Notas" />
                            )}
                        </div>
                        <div className="search-input-wrapper">
                            <i className="fas fa-search"></i>
                            <input
                                type="text"
                                placeholder="Buscar nota..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="sidebar-group-label">Histórico de Versões</div>
                    <nav className="sidebar-items">
                        {filteredNotas.length === 0 ? (
                            <div className="empty-search">Nenhum item</div>
                        ) : (
                            filteredNotas.map(nota => (
                                <button
                                    key={nota.id}
                                    className={`sidebar-nav-item ${notaSelecionada?.id === nota.id ? 'active' : ''}`}
                                    onClick={() => setNotaSelecionada(nota)}
                                >
                                    <i className="fas fa-history"></i>
                                    <div className="nav-item-content">
                                        <span className="nav-item-text">{nota.titulo}</span>
                                        <span className="nav-item-subtext">{new Date(nota.data_publicacao).toLocaleDateString()}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </nav>
                </aside>

                <main className="tutoriais-doc-content-wrapper">
                    {notaSelecionada ? (
                        <div className="tutoriais-doc-paper">
                            <header className="doc-paper-header">
                                <h1 className="doc-main-title">{notaSelecionada.titulo}</h1>

                                <div className="doc-author-meta">
                                    <div className="meta-author">
                                        <div className="author-avatar">UP</div>
                                        <span className="author-name">Equipe de Desenvolvimento</span>
                                    </div>
                                    <div className="meta-divider"></div>
                                    <span className="meta-update">Publicado em {formatarData(notaSelecionada.data_publicacao)}</span>
                                </div>
                            </header>

                            <div className="doc-content-body-wrapper">
                                <div
                                    className="tutorial-content-body ql-editor"
                                    dangerouslySetInnerHTML={{ __html: notaSelecionada.conteudo }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="doc-not-selected">
                            <div className="not-selected-icon">
                                <i className="far fa-clipboard"></i>
                            </div>
                            <h2>Selecione uma versão</h2>
                            <p>Escolha uma nota de atualização na lista ao lado para ver o que mudou.</p>
                        </div>
                    )}
                </main>
            </div>
        </Layout>
    );
};

export default NotasAtualizacaoPublicas;
