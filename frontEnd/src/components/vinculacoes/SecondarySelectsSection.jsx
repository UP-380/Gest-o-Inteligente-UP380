import React from 'react';
import SecondarySelect from './SecondarySelect';

/**
 * Seção de selects secundários (elementos específicos)
 */
const SecondarySelectsSection = ({
  secondarySelects,
  opcoesPrimarias,
  getAllSecondaryOptions,
  getSecondaryOptions,
  getItemLabel,
  isEditing = false,
  onUpdateSelect,
  onRemoveItem,
  onSelectAll,
  expandedSelects,
  onToggleExpand,
  loading = false,
  loadingPorTipo = {},
  onSelectOpen = null,
  tarefasVinculadas = {},
  produtos = []
}) => {
  return (
    <div className="vinculacao-section">
      <h4 className="section-title">Elementos Específicos</h4>
      <p className="section-description">
        {isEditing 
          ? 'Troque o item selecionado para cada tipo escolhido'
          : 'Selecione os itens específicos para cada tipo escolhido'
        }
      </p>

      {secondarySelects.map((select) => {
        const selectedItems = select.selectedItems || [];
        // Na edição, mostrar todas as opções (incluindo a selecionada) para o select simples
        // Na criação, filtrar opções já selecionadas
        const options = isEditing 
          ? getAllSecondaryOptions(select.primaryType)
          : getSecondaryOptions(select.primaryType, selectedItems);
        const primaryLabel = opcoesPrimarias.find(
          op => op.value === select.primaryType
        )?.label || select.primaryType;

        return (
          <React.Fragment key={select.id}>
            <SecondarySelect
              select={select}
              options={options}
              selectedItems={selectedItems}
              primaryLabel={primaryLabel}
              isEditing={isEditing}
              onChange={onUpdateSelect}
              onRemoveItem={onRemoveItem}
              onSelectAll={() => onSelectAll(select.id)}
              getItemLabel={(itemId) => getItemLabel(select.primaryType, itemId)}
              isExpanded={expandedSelects[select.id] || false}
              onToggleExpand={onToggleExpand}
              disabled={loading || loadingPorTipo[select.primaryType]}
              isLoading={loadingPorTipo[select.primaryType]}
              onSelectOpen={() => onSelectOpen && onSelectOpen(select.primaryType)}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SecondarySelectsSection;

