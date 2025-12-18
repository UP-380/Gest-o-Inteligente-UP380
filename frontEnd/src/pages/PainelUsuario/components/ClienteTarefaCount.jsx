import React from 'react';

/**
 * Componente de Contador de Tarefas do Cliente
 * 
 * @param {Object} props
 * @param {number} props.quantidadeTarefas - Quantidade de tarefas do cliente
 * @param {boolean} props.modoQuadro - Se true, mostra apenas o número (sem "Tarefas:") e usa fonte menor
 */
const ClienteTarefaCount = ({
  quantidadeTarefas = 0,
  modoQuadro = false
}) => {
  const className = modoQuadro
    ? 'painel-usuario-grupo-count painel-usuario-quadro-count'
    : 'painel-usuario-grupo-count';

  return (
    <span className={className}>
      {modoQuadro ? quantidadeTarefas : `Tarefas: ${quantidadeTarefas}`}
    </span>
  );
};

export default ClienteTarefaCount;

