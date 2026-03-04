import React, { useState, useEffect, useCallback } from 'react';
import { baseConhecimentoAPI } from '../../../services/api';
import RichTextEditor from '../../common/RichTextEditor';
import ButtonPrimary from '../../common/ButtonPrimary';
import LoadingState from '../../common/LoadingState';
import { useToast } from '../../../hooks/useToast';
import { markdownToHtml } from '../../../utils/richEditorMarkdown';
import './AnotacoesClienteContent.css';

const AnotacoesClienteContent = ({ clienteId, onCountChange }) => {
    const [anotacoes, setAnotacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ titulo: '', descricao: '' });
    const [salvando, setSalvando] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const showToast = useToast();

    const carregarAnotacoes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await baseConhecimentoAPI.anotacoes.listar(clienteId);
            if (res.success) {
                const data = res.data || [];
                setAnotacoes(data);
                if (onCountChange) onCountChange(data.length);
            }
        } catch (err) {
            console.error('Erro ao carregar anotações:', err);
            showToast('error', 'Erro ao carregar anotações');
        } finally {
            setLoading(false);
        }
    }, [clienteId, showToast, onCountChange]);

    useEffect(() => {
        carregarAnotacoes();
    }, [carregarAnotacoes]);

    const handleCreate = () => {
        setEditingId(null);
        setFormData({ titulo: '', descricao: '' });
        setShowForm(true);
        setExpandedId(null);
    };

    const handleEdit = (anotacao) => {
        setEditingId(anotacao.id);
        setFormData({ titulo: anotacao.titulo, descricao: anotacao.descricao });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formData.titulo.trim()) {
            showToast('warning', 'O título é obrigatório');
            return;
        }

        setSalvando(true);
        try {
            const payload = {
                cliente_id: clienteId,
                titulo: formData.titulo,
                descricao: formData.descricao
            };

            let res;
            if (editingId) {
                res = await baseConhecimentoAPI.anotacoes.atualizar(editingId, payload);
            } else {
                res = await baseConhecimentoAPI.anotacoes.criar(payload);
            }

            if (res.success) {
                showToast('success', editingId ? 'Anotação atualizada' : 'Anotação criada');
                setShowForm(false);
                setEditingId(null);
                carregarAnotacoes();
            } else {
                const msg = res.details ? `${res.error}: ${res.details}` : (res.error || 'Erro ao salvar anotação');
                showToast('error', msg);
            }
        } catch (err) {
            console.error('Erro ao salvar anotação:', err);
            showToast('error', err.message || 'Erro técnico ao salvar anotação');
        } finally {
            setSalvando(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Deseja realmente excluir esta anotação?')) return;

        try {
            const res = await baseConhecimentoAPI.anotacoes.excluir(id);
            if (res.success) {
                showToast('success', 'Anotação excluída');
                carregarAnotacoes();
            } else {
                showToast('error', res.error || 'Erro ao excluir anotação');
            }
        } catch (err) {
            showToast('error', 'Erro ao excluir anotação');
        }
    };

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const renderConteudo = (conteudo) => {
        if (!conteudo) return null;
        if (conteudo.startsWith('<')) {
            return <div className="anotacao-body-content ql-editor" dangerouslySetInnerHTML={{ __html: conteudo }} />;
        }
        return <div className="anotacao-body-content ql-editor" dangerouslySetInnerHTML={{ __html: markdownToHtml(conteudo) }} />;
    };

    if (loading && !anotacoes.length) {
        return <LoadingState />;
    }

    return (
        <div className="anotacoes-cliente-content">
            <div className="anotacoes-header">
                {!showForm && (
                    <button className="btn-add-anotacao" onClick={handleCreate}>
                        <i className="fas fa-plus-circle"></i>
                        Nova Anotação
                    </button>
                )}
            </div>

            {showForm && !editingId && (
                <div className="anotacao-form-card">
                    <div className="form-header">
                        <i className="far fa-sticky-note"></i>
                        Nova Anotação
                    </div>
                    <div className="form-group">
                        <label>Título</label>
                        <input
                            type="text"
                            className="form-control"
                            value={formData.titulo}
                            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                            placeholder="Título da anotação..."
                        />
                    </div>
                    <div className="form-group">
                        <label>Descrição</label>
                        <RichTextEditor
                            value={formData.descricao}
                            onChange={(val) => setFormData({ ...formData, descricao: val })}
                            placeholder="Digite o conteúdo da anotação..."
                            minHeight={200}
                        />
                    </div>
                    <div className="form-actions">
                        <button className="btn-cancel" onClick={() => setShowForm(false)} disabled={salvando}>
                            Cancelar
                        </button>
                        <button className="btn-save" onClick={handleSave} disabled={salvando}>
                            {salvando ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>{' '}
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-save"></i>{' '}
                                    Salvar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            <div className="anotacoes-list">
                {anotacoes.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-plus-circle"></i>
                        <p>Nenhuma anotação encontrada para este cliente.</p>
                    </div>
                ) : (
                    anotacoes.map((anotacao) => (
                        anotacao.id === editingId ? (
                            <div key={anotacao.id} className="anotacao-form-card" style={{ marginTop: 0 }}>
                                <div className="form-header">
                                    <i className="fas fa-edit"></i>
                                    Editar Anotação
                                </div>
                                <div className="form-group">
                                    <label>Título</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={formData.titulo}
                                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                                        placeholder="Título da anotação..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Descrição</label>
                                    <RichTextEditor
                                        value={formData.descricao}
                                        onChange={(val) => setFormData({ ...formData, descricao: val })}
                                        placeholder="Digite o conteúdo da anotação..."
                                        minHeight={200}
                                    />
                                </div>
                                <div className="form-actions">
                                    <button className="btn-cancel" onClick={() => { setShowForm(false); setEditingId(null); }} disabled={salvando}>
                                        Cancelar
                                    </button>
                                    <button className="btn-save" onClick={handleSave} disabled={salvando}>
                                        {salvando ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin"></i>{' '}
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-save"></i>{' '}
                                                Atualizar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <article
                                key={anotacao.id}
                                className={`anotacao-card ${expandedId === anotacao.id ? 'expanded' : ''}`}
                            >
                                <header className="anotacao-card-header" onClick={() => toggleExpand(anotacao.id)}>
                                    <div className="anotacao-card-info">
                                        <h3 className="anotacao-title">
                                            <i className="far fa-sticky-note"></i>
                                            {anotacao.titulo}
                                        </h3>
                                        <span className="anotacao-date">
                                            <i className="far fa-calendar-alt"></i>
                                            Criado em {new Date(anotacao.data_criacao).toLocaleDateString('pt-BR')} em {new Date(anotacao.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="anotacao-card-actions">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEdit(anotacao); }}
                                            title="Editar"
                                        >
                                            <i className="fas fa-edit"></i>
                                        </button>
                                        <button
                                            className="delete"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(anotacao.id); }}
                                            title="Excluir"
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                        <div className="expand-icon">
                                            <i className={`fas fa-chevron-${expandedId === anotacao.id ? 'up' : 'down'}`}></i>
                                        </div>
                                    </div>
                                </header>

                                <div className="anotacao-card-body">
                                    <div className="anotacao-body-content">
                                        {renderConteudo(anotacao.descricao)}
                                    </div>
                                </div>
                            </article>
                        )
                    ))
                )}
            </div>
        </div>
    );
};

export default AnotacoesClienteContent;
