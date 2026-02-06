import React from 'react';
import PrimarySelect from './PrimarySelect';

/**
 * Seção de selects primários (tipos de elementos)
 */
const PrimarySelectsSection = ({
  primarySelects,
  opcoesPrimarias,
  onUpdateSelect,
  onAddSelect,
  onRemoveSelect,
  loading = false
}) => {
  return (
    <div className="vinculacao-section">
      <h4 className="section-title">Tipos de Elementos</h4>
      <p className="section-description">
        Selecione os tipos de elementos que deseja vincular
      </p>
      
      <div className="vinculacao-section-primary-selects custom-scrollbar">
        {primarySelects.map((select, index) => {
          // Obter valores selecionados nos outros selects
          const otherSelectedValues = primarySelects
            .filter(s => s.id !== select.id && s.value !== '')
            .map(s => s.value);
          
          // Remover regras restritivas - permitir qualquer combinação
          // Apenas evitar duplicatas do mesmo tipo
          const availableOptions = opcoesPrimarias.filter(
            opt => !otherSelectedValues.includes(opt.value)
          );
          
          return (
            <PrimarySelect
              key={select.id}
              select={select}
              index={index}
              availableOptions={availableOptions}
              onChange={onUpdateSelect}
              onAdd={onAddSelect}
              onRemove={onRemoveSelect}
              canRemove={primarySelects.length > 2}
              isLast={index === primarySelects.length - 1}
              disabled={loading}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PrimarySelectsSection;

