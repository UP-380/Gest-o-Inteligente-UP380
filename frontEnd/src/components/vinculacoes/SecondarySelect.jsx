import React from 'react';
import CustomSelect from './CustomSelect';
import SelectedItemsList from './SelectedItemsList';

/**
 * Componente de select secundário (elementos específicos)
 */
const SecondarySelect = ({
  select,
  options,
  selectedItems,
  primaryLabel,
  isEditing = false,
  onChange,
  onRemoveItem,
  onSelectAll,
  getItemLabel,
  isExpanded = false,
  onToggleExpand,
  disabled = false,
  isLoading = false,
  onSelectOpen = null
}) => {
  const canRemove = !isEditing || selectedItems.length > 1;

  return (
    <div className="select-group-secondary">
      <label className="select-label">
        {primaryLabel}
      </label>
      
      {selectedItems.length > 0 && (
        <SelectedItemsList
          items={selectedItems}
          getItemLabel={(itemId) => getItemLabel(itemId)}
          onRemoveItem={(itemId) => onRemoveItem(select.id, itemId)}
          canRemove={canRemove}
          isExpanded={isExpanded}
          onToggleExpand={() => onToggleExpand(select.id)}
        />
      )}

      <div className="select-wrapper">
        {isLoading && (
          <div className="select-loading-indicator">
            <i className="fas fa-spinner fa-spin"></i> Carregando opções...
          </div>
        )}
        <CustomSelect
          value={isEditing && selectedItems.length > 0 ? selectedItems[0] : select.value}
          options={options}
          onChange={(e) => onChange(select.id, e.target.value)}
          placeholder={isEditing ? "Trocar item selecionado" : isLoading ? "Carregando..." : "Selecione um item"}
          disabled={disabled || isLoading || options.length === 0}
          keepOpen={!isEditing}
          selectedItems={selectedItems.map(item => String(item))}
          onSelectAll={isEditing ? undefined : onSelectAll}
          hideCheckboxes={isEditing}
          maxVisibleOptions={5}
          enableSearch={true}
          onOpen={onSelectOpen}
        />
      </div>
    </div>
  );
};

export default SecondarySelect;

