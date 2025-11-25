import React from 'react';
import ClientCardSummary from './ClientCardSummary';
import './ClientCard.css';

const ClientCard = ({ cliente, resumo, contratos, registros, onOpenDetail }) => {
  return (
    <div className="client-card" data-client-id={cliente.id}>
      <div className="client-card-header">
        <h3 className="client-card-title">{cliente.nome || 'Cliente sem nome'}</h3>
      </div>
      <div className="client-card-body">
        <ClientCardSummary
          resumo={resumo}
          clienteId={cliente.id}
          contratos={contratos}
          registros={registros}
          onOpenDetail={onOpenDetail}
        />
      </div>
    </div>
  );
};

export default ClientCard;


