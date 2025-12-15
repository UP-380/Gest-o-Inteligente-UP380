import React from 'react';
import SelectedItemTag from './SelectedItemTag';
import ExpandItemsButton from './ExpandItemsButton';

/**
 * Componente para lista de itens selecionados com expansão
 */
const SelectedItemsList = ({
  items,
  getItemLabel,
  onRemoveItem,
  canRemove = true,
  maxVisibleItems = 5,
  isExpanded = false,
  onToggleExpand
}) => {
  if (items.length === 0) return null;

  const visibleItems = isExpanded 
    ? items 
    : items.slice(0, maxVisibleItems);
  const hasMore = items.length > maxVisibleItems;

  return (
    <div className="selected-items-container">
      {visibleItems.map((itemId) => (
        <SelectedItemTag
          key={itemId}
          label={getItemLabel(itemId)}
          onRemove={() => onRemoveItem(itemId)}
          canRemove={canRemove}
        />
      ))}
      {hasMore && (
        <ExpandItemsButton
          isExpanded={isExpanded}
          onClick={onToggleExpand}
          hiddenCount={items.length - maxVisibleItems}
        />
      )}
    </div>
  );
};

export default SelectedItemsList;




