import React from 'react';
import ColaboradorCardSummary from './ColaboradorCardSummary';
import './ColaboradorCard.css';

const ColaboradorCard = ({ colaborador, resumo, registros, onOpenDetail }) => {
  return (
    <div className="colaborador-card" data-colaborador-id={colaborador.id}>
      <div className="colaborador-card-header">
        <h3 className="colaborador-card-title">{colaborador.nome || 'Colaborador sem nome'}</h3>
      </div>
      <div className="colaborador-card-body">
        <ColaboradorCardSummary
          resumo={resumo}
          colaboradorId={colaborador.id}
          registros={registros}
          onOpenDetail={onOpenDetail}
        />
      </div>
    </div>
  );
};

export default ColaboradorCard;

