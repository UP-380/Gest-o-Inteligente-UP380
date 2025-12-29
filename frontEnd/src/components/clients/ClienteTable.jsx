import React from 'react';
import EditButton from '../common/EditButton';
import DeleteButton from '../common/DeleteButton';

/**
 * Componente de tabela de clientes
 */
const ClienteTable = ({
  clientes,
  loading,
  onEdit,
  onDelete,
  onInativar,
  onAtivar,
  clientesComContratosAtivos,
  showIncompleteClients
}) => {
  // Função para aplicar máscara de CPF/CNPJ
  const aplicarMascaraCpfCnpj = (valor) => {
    if (!valor) return '-';
    const apenasNumeros = valor.replace(/\D/g, '');
    const numeroLimitado = apenasNumeros.substring(0, 14);
    return numeroLimitado
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <i className="fas fa-spinner fa-spin"></i>
        <span>Carregando clientes...</span>
      </div>
    );
  }

  if (clientes.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-users"></i>
        <p>Nenhum cliente encontrado</p>
      </div>
    );
  }

  return (
    <table className="listing-table">
      <thead>
        <tr>
          <th>Nome Amigável</th>
          <th>Razão Social</th>
          <th>Nome Fantasia</th>
          <th>CNPJ</th>
          <th>Cliente Kamino</th>
          <th className="actions-column">Ações</th>
        </tr>
      </thead>
      <tbody>
        {clientes.map((client) => {
          const temContratosAtivos = showIncompleteClients && clientesComContratosAtivos.has(String(client.id));
          const isAtivo = client.status === 'ativo';
          
          return (
            <tr 
              key={client.id}
              style={temContratosAtivos ? {
                borderLeft: '4px solid #10b981',
                backgroundColor: '#f0fdf4'
              } : {}}
            >
              <td>
                <strong>{client.nome || '-'}</strong>
              </td>
              <td>{client.raw?.razao_social || '-'}</td>
              <td>{client.raw?.nome_fantasia || '-'}</td>
              <td>{aplicarMascaraCpfCnpj(client.raw?.cpf_cnpj || client.raw?.cnpj_cpf || '')}</td>
              <td>{client.raw?.nome_cli_kamino || client.raw?.cli_kamino || '-'}</td>
              <td className="actions-column">
                <EditButton
                  onClick={() => onEdit(client)}
                  title="Editar cliente"
                />
                <DeleteButton
                  onClick={() => onDelete && onDelete(client)}
                  title="Deletar cliente"
                />
                {isAtivo ? (
                  <button
                    className="btn-icon inactivate-btn"
                    onClick={() => onInativar(client)}
                    title="Inativar"
                    style={{ color: '#ef4444' }}
                  >
                    <svg viewBox="0 0 512 512" className="icon-ban" width="22" height="22">
                      <circle cx="256" cy="256" r="200" fill="currentColor" opacity="0.1"/>
                      <circle cx="256" cy="256" r="200" fill="none" stroke="currentColor" strokeWidth="32"/>
                      <line x1="150" y1="150" x2="362" y2="362" stroke="currentColor" strokeWidth="32" strokeLinecap="round"/>
                    </svg>
                  </button>
                ) : (
                  <button
                    className="btn-icon activate-btn"
                    onClick={() => onAtivar(client)}
                    title="Ativar"
                    style={{ color: '#10b981' }}
                  >
                    <svg viewBox="0 0 512 512" className="icon-check" width="22" height="22">
                      <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z" fill="currentColor"/>
                    </svg>
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default ClienteTable;

