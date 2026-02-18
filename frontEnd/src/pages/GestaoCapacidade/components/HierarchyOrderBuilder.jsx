import React, { useCallback, memo } from 'react';
import { LABEL_POR_NIVEL, ICONE_POR_NIVEL } from '../../../services/gestaoCapacidadeAPI';

const TODOS_NIVEIS = ['colaborador', 'cliente', 'produto', 'tipo_tarefa', 'tarefa'];

/**
 * HierarchyOrderBuilder — Cards clicáveis para definir a ordem hierárquica.
 *
 * Todos começam desmarcados. Clicar adiciona ao final da ordem.
 * Clicar de novo remove. O 1º clicado = raiz, 2º = sub-nível, etc.
 */
const HierarchyOrderBuilder = memo(function HierarchyOrderBuilder({
    ordemNiveis = [],
    onChange,
}) {
    const handleClick = useCallback((nivel) => {
        if (ordemNiveis.includes(nivel)) {
            onChange(ordemNiveis.filter(n => n !== nivel));
        } else {
            onChange([...ordemNiveis, nivel]);
        }
    }, [ordemNiveis, onChange]);

    return (
        <div className="filtros-vinculacao-row">
            {TODOS_NIVEIS.map((nivel) => {
                const icone = ICONE_POR_NIVEL[nivel] || 'fas fa-folder';
                const label = LABEL_POR_NIVEL[nivel] || nivel;
                const posicao = ordemNiveis.indexOf(nivel);
                const selecionado = posicao !== -1;
                const isRoot = posicao === 0;

                if (selecionado) {
                    return (
                        <div key={nivel} className="filter-group">
                            <div className="filtro-pai-wrapper">
                                <div
                                    className={`hob-card ${isRoot ? 'hob-card-root' : ''}`}
                                    onClick={() => handleClick(nivel)}
                                >
                                    <div className="filtro-card-content hob-card-active">
                                        <div className="filtro-card-icon">
                                            <i className={icone}></i>
                                        </div>
                                        <div className="filtro-card-text">
                                            <span className="filtro-card-title">{label}</span>
                                            {isRoot && (
                                                <span className="filtro-card-subtitle">
                                                    Nível raiz
                                                </span>
                                            )}
                                        </div>
                                        <div className={`hob-depth-badge ${isRoot ? 'hob-depth-root' : ''}`}>
                                            {posicao + 1}º
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                } else {
                    return (
                        <div key={nivel} className="filter-group">
                            <div className="filtro-pai-wrapper">
                                <div
                                    className="hob-card hob-card-inactive"
                                    onClick={() => handleClick(nivel)}
                                >
                                    <div className="filtro-card-content">
                                        <div className="filtro-card-icon">
                                            <i className={icone}></i>
                                        </div>
                                        <div className="filtro-card-text">
                                            <span className="filtro-card-title">{label}</span>
                                        </div>
                                        <div className="filtro-card-click-indicator">
                                            <i className="fas fa-hand-pointer"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }
            })}
        </div>
    );
});

export default HierarchyOrderBuilder;
