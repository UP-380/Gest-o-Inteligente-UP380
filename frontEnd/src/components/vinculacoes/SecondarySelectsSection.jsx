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
              disabled={loading}
            />
            {/* Exibir tarefas vinculadas se for select de produto */}
            {select.primaryType === 'produto' && selectedItems.length > 0 && (
              <div className="tarefas-vinculadas-container" style={{ 
                marginTop: '15px', 
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ 
                  fontWeight: '600', 
                  color: '#0e3b6f', 
                  marginBottom: '12px',
                  fontSize: '14px',
                  borderBottom: '1px solid #dee2e6',
                  paddingBottom: '8px'
                }}>
                  <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
                  Tarefas Vinculadas aos Produtos
                </div>
                {selectedItems.map(produtoIdStr => {
                  const produtoId = parseInt(produtoIdStr, 10);
                  const produto = produtos.find(p => p.id === produtoId);
                  const produtoNome = produto ? produto.nome : `Produto #${produtoId}`;
                  const tarefas = tarefasVinculadas[produtoId] || [];
                  
                  return (
                    <div key={produtoId} className="tarefas-vinculadas-item" style={{ 
                      marginBottom: '12px',
                      padding: '10px',
                      backgroundColor: '#ffffff',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ 
                        fontWeight: '600', 
                        color: '#0e3b6f', 
                        marginBottom: '8px',
                        fontSize: '13px'
                      }}>
                        <i className="fas fa-box" style={{ marginRight: '6px', color: '#64748b' }}></i>
                        {produtoNome}
                      </div>
                      {tarefas.length > 0 ? (
                        <ul style={{ 
                          margin: 0, 
                          paddingLeft: '20px',
                          listStyle: 'disc'
                        }}>
                          {tarefas.map(tarefa => (
                            <li key={tarefa.id} style={{ 
                              marginBottom: '4px',
                              color: '#495057',
                              fontSize: '13px'
                            }}>
                              {tarefa.nome || `Tarefa #${tarefa.id}`}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ 
                          color: '#64748b',
                          fontSize: '12px',
                          fontStyle: 'italic',
                          paddingLeft: '20px'
                        }}>
                          Nenhuma tarefa vinculada a este produto
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SecondarySelectsSection;

