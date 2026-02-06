import React from 'react';
import './MiniCardSelector.css';

/**
 * Componente MiniCardSelector
 * Mini card que aparece ao clicar no "+" para selecionar o tipo de conteúdo do bloco
 */
const MiniCardSelector = ({ onSelect, onClose }) => {
  const opcoes = [
    {
      id: 'minhas-tarefas',
      label: 'Minhas Tarefas',
      icon: 'fa-tasks',
      descricao: 'Lista de tarefas atribuídas a você'
    }
    // Futuramente pode adicionar mais opções aqui
  ];

  return (
    <div className="mini-card-selector-overlay" onClick={onClose}>
      <div className="mini-card-selector" onClick={(e) => e.stopPropagation()}>
        <div className="mini-card-selector-header">
          <h3>Selecione o tipo de conteúdo</h3>
          <button className="mini-card-selector-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="mini-card-selector-options">
          {opcoes.map((opcao) => (
            <div
              key={opcao.id}
              className="mini-card-option"
              onClick={() => {
                onSelect(opcao.id);
                onClose();
              }}
            >
              <div className="mini-card-option-icon">
                <i className={`fas ${opcao.icon}`}></i>
              </div>
              <div className="mini-card-option-content">
                <div className="mini-card-option-label">{opcao.label}</div>
                <div className="mini-card-option-desc">{opcao.descricao}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MiniCardSelector;
