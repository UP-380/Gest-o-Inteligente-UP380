import React from 'react';
import CustomSelect from './CustomSelect';
import AddSelectButton from './AddSelectButton';
import RemoveSelectButton from './RemoveSelectButton';

/**
 * Componente de select primário (tipos de elementos)
 */
const PrimarySelect = ({
  select,
  index,
  availableOptions,
  onChange,
  onAdd,
  onRemove,
  canRemove,
  isLast,
  disabled = false
}) => {
  return (
    <div className="select-group">
      <div className="select-wrapper">
        <CustomSelect
          value={select.value}
          options={availableOptions}
          onChange={(e) => onChange(select.id, e.target.value)}
          placeholder="Selecione uma opção"
          disabled={disabled}
        />
        {isLast && (
          <AddSelectButton onClick={onAdd} />
        )}
        {canRemove && (
          <RemoveSelectButton onClick={() => onRemove(select.id)} />
        )}
      </div>
    </div>
  );
};

export default PrimarySelect;




