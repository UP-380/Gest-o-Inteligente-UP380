import React from 'react';
import ClienteTempoEstimado from './ClienteTempoEstimado';
import ClienteTempoRealizado from './ClienteTempoRealizado';
import ClienteTarefaCount from './ClienteTarefaCount';
import './ClienteTempoInfo.css';

/**
 * Componente de Informações de Tempo do Cliente
 * Exibe tempo estimado, tempo realizado e contador de tarefas
 * 
 * @param {Object} props
 * @param {number} props.tempoEstimadoTotal - Tempo estimado total em horas (formato decimal, ex: 9.0)
 * @param {number} props.tempoRealizadoTotal - Tempo realizado total em milissegundos
 * @param {number} props.quantidadeTarefas - Quantidade de tarefas do cliente
 * @param {Function} props.formatarTempoHMS - Função para formatar tempo em formato HMS (ex: "24min 35s")
 * @param {boolean} props.modoQuadro - Se true, usa layout e estilos do modo quadro (mesma linha, fonte menor, contador sem "Tarefas:")
 */
const ClienteTempoInfo = ({
  tempoEstimadoTotal = 0,
  tempoRealizadoTotal = 0,
  quantidadeTarefas = 0,
  formatarTempoHMS,
  modoQuadro = false
}) => {
  return (
    <>
      <ClienteTempoEstimado 
        tempoEstimadoTotal={tempoEstimadoTotal}
        modoQuadro={modoQuadro}
      />
      <ClienteTempoRealizado 
        tempoRealizadoTotal={tempoRealizadoTotal}
        formatarTempoHMS={formatarTempoHMS}
        modoQuadro={modoQuadro}
      />
      <ClienteTarefaCount 
        quantidadeTarefas={quantidadeTarefas}
        modoQuadro={modoQuadro}
      />
    </>
  );
};

export default ClienteTempoInfo;

