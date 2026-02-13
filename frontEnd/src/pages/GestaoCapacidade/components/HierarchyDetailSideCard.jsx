import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import HierarchyNode from './HierarchyNode';
import '../GestaoCapacidade.css';
import '../../../components/dashboard/DetailSideCard.css';
import '../../../components/dashboard/TarefasDetalhadasList.css';

import { useToast } from '../../../hooks/useToast';

/**
 * Funções utilitárias locais
 */
const removerAcentos = (texto) => {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

/**
 * HierarchyDetailSideCard — Side card especializado para exibir a hierarquia
 * a partir do segundo nível (depth > 0).
 */
const HierarchyDetailSideCard = ({
    nodeId,
    nodeData,
    nivelNome,
    proximosNiveis,
    onClose,
    position
}) => {
    const cardRef = useRef(null);
    const lupaRef = useRef(null);
    const popoverRef = useRef(null);
    const showToast = useToast();

    const [hiddenChildren, setHiddenChildren] = useState(new Set());
    const [showFilterPopover, setShowFilterPopover] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Ignorar se o clique for dentro do card
            if (cardRef.current && cardRef.current.contains(event.target)) return;

            // Ignorar se o clique for dentro de um popover de filtro (renderizado via Portal)
            if (event.target.closest('.hierarchy-filter-popover')) return;

            // Se chegou aqui, o clique foi realmente fora
            onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        if (!showFilterPopover) return;
        const handleClickPopover = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target) &&
                lupaRef.current && !lupaRef.current.contains(e.target)) {
                setShowFilterPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickPopover);
        return () => document.removeEventListener('mousedown', handleClickPopover);
    }, [showFilterPopover]);

    if (!nodeData || !nodeData.detalhes) return null;

    const childrenList = Object.entries(nodeData.detalhes);
    const isFiltered = hiddenChildren.size > 0;

    const filteredChildren = useMemo(() => {
        return childrenList.filter(([id]) => !hiddenChildren.has(id));
    }, [childrenList, hiddenChildren]);

    const popoverOptions = useMemo(() => {
        const query = removerAcentos(searchQuery);
        return childrenList
            .map(([id, data]) => ({ id, nome: data.nome || id }))
            .filter(opt => !query || removerAcentos(opt.nome).includes(query))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [childrenList, searchQuery]);

    const handleCopyJSON = (e) => {
        e.stopPropagation();
        try {
            const jsonStr = JSON.stringify(nodeData, null, 2);
            navigator.clipboard.writeText(jsonStr);
            showToast('success', 'JSON da hierarquia copiado!');
        } catch (err) {
            console.error('Erro ao copiar JSON:', err);
            showToast('error', 'Falha ao copiar JSON');
        }
    };

    const toggleFilter = (e) => {
        e.stopPropagation();
        if (!showFilterPopover && lupaRef.current) {
            const rect = lupaRef.current.getBoundingClientRect();
            setPopoverCoords({
                top: rect.bottom + 5,
                left: rect.right - 240
            });
        }
        setShowFilterPopover(prev => !prev);
    };

    const toggleChildVisibility = (childId) => {
        setHiddenChildren(prev => {
            const next = new Set(prev);
            if (next.has(childId)) next.delete(childId);
            else next.add(childId);
            return next;
        });
    };

    const selectAllChildren = () => {
        setHiddenChildren(new Set());
    };

    const cardStyle = {
        opacity: 1,
        transform: 'scale(1)',
        position: 'absolute',
        top: position ? `${position.top}px` : '50%',
        left: position ? `${position.left}px` : '50%',
        margin: 0,
    };

    if (!position) {
        cardStyle.transform = 'translate(-50%, -50%) scale(1)';
    }

    return createPortal(
        <div
            className="detail-side-card"
            ref={cardRef}
            style={cardStyle}
        >
            <div className="detail-side-card-header">
                <h3>
                    <i className="fas fa-sitemap"></i>
                    {nivelNome}: {nodeData.nome || nodeId}
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Botão de Filtro (Lupa) */}
                    <div className="apply-btn-wrapper has-tooltip">
                        <button
                            className={`detail-side-card-close ${isFiltered ? 'active' : ''}`}
                            onClick={toggleFilter}
                            ref={lupaRef}
                            style={{ position: 'relative' }}
                        >
                            <i className="fas fa-search"></i>
                            {isFiltered && <span className="node-action-badge"></span>}
                        </button>
                        <div className="filter-tooltip">
                            Filtrar descendentes
                        </div>

                        {showFilterPopover && createPortal(
                            <div
                                className="hierarchy-filter-popover"
                                ref={popoverRef}
                                style={{
                                    position: 'fixed',
                                    top: `${popoverCoords.top}px`,
                                    left: `${popoverCoords.left}px`,
                                    zIndex: 9999
                                }}
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="hfp-search-wrapper">
                                    <input
                                        type="text"
                                        className="hfp-search-input"
                                        placeholder="Buscar item..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="hfp-options">
                                    {popoverOptions.map(opt => (
                                        <div
                                            key={opt.id}
                                            className={`hfp-option ${!hiddenChildren.has(opt.id) ? 'selected' : ''}`}
                                            onClick={() => toggleChildVisibility(opt.id)}
                                        >
                                            <div className="hfp-option-checkbox">
                                                {!hiddenChildren.has(opt.id) && <i className="fas fa-check"></i>}
                                            </div>
                                            <span>{opt.nome}</span>
                                        </div>
                                    ))}
                                    {popoverOptions.length === 0 && <div className="hfp-empty">Nenhum item encontrado</div>}
                                </div>
                                <div className="hfp-footer">
                                    <button className="hfp-btn-link" onClick={selectAllChildren}>Selecionar Todos</button>
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                        {childrenList.length - hiddenChildren.size}/{childrenList.length}
                                    </span>
                                </div>
                            </div>,
                            document.body
                        )}
                    </div>

                    {/* Botão de Código (JSON) */}
                    <div className="apply-btn-wrapper has-tooltip">
                        <button
                            className="detail-side-card-close"
                            onClick={handleCopyJSON}
                            aria-label="Copiar JSON da Hierarquia"
                        >
                            <i className="fas fa-code"></i>
                        </button>
                        <div className="filter-tooltip">
                            Copiar JSON da Hierarquia
                        </div>
                    </div>

                    <button className="detail-side-card-close" onClick={onClose} title="Fechar">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div className="detail-side-card-body">
                <div className="detail-side-card-list">
                    {filteredChildren.length > 0 ? (
                        <div className="tarefas-detalhadas-list">
                            {filteredChildren.map(([childId, childData]) => (
                                <HierarchyNode
                                    key={childId}
                                    nodeId={childId}
                                    nodeData={childData}
                                    nivelAtual={proximosNiveis[0]}
                                    proximosNiveis={proximosNiveis.slice(1)}
                                    depth={1}
                                    theme="list"
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            {isFiltered ? 'Nenhum item visível com os filtros atuais.' : 'Nenhum detalhe encontrado.'}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default HierarchyDetailSideCard;
