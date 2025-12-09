import React from 'react';

/**
 * Componente de tabela de clientes
 */
const ClienteTable = ({
  clientes,
  loading,
  onEdit,
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
                <div className="action-buttons">
                  <button
                    className="btn-icon btn-edit edit-anim"
                    onClick={() => onEdit(client)}
                    title="Editar cliente"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 512 512"
                      className="edit-anim-icon"
                      width="16"
                      height="16"
                    >
                      <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/>
                    </svg>
                  </button>
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
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default ClienteTable;

