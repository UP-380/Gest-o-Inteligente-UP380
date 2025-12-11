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
          
          // Aplicar regra: Cliente <-> Produto (apenas quando Cliente está selecionado)
          // Se um select tem "Cliente", o outro só pode ter "Produto"
          // Se um select tem "Produto", o outro pode ter "Cliente" ou "Atividade" (Tarefa)
          let availableOptions = opcoesPrimarias.filter(
            opt => !otherSelectedValues.includes(opt.value)
          );

          // Verificar se algum outro select tem "Cliente" ou "Produto"
          const hasCliente = otherSelectedValues.includes('cliente');
          const hasProduto = otherSelectedValues.includes('produto');

          if (hasCliente) {
            // Se outro select tem "Cliente", este só pode ter "Produto"
            availableOptions = availableOptions.filter(opt => opt.value === 'produto');
          } else if (hasProduto) {
            // Se outro select tem "Produto", este pode ter "Cliente" ou "Atividade" (Tarefa)
            // Não restringir - permitir Cliente ou Atividade
            availableOptions = availableOptions.filter(opt => 
              opt.value === 'cliente' || opt.value === 'atividade'
            );
          } else if (select.value === 'cliente') {
            // Se este select tem "Cliente", outros só podem ter "Produto" (mas não afeta este select)
            // Este select pode manter "Cliente" ou trocar para qualquer opção disponível
            // Não precisa filtrar aqui, pois a regra já foi aplicada acima
          } else if (select.value === 'produto') {
            // Se este select tem "Produto", outros podem ter "Cliente" ou "Atividade" (mas não afeta este select)
            // Este select pode manter "Produto" ou trocar para qualquer opção disponível
            // Não precisa filtrar aqui, pois a regra já foi aplicada acima
          }
          
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

