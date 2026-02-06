import React from 'react';
import EditButton from '../common/EditButton';
import DeleteButton from '../common/DeleteButton';
import Avatar from '../user/Avatar';
import { DEFAULT_AVATAR } from '../../utils/avatars';

/**
 * Componente de tabela de clientes
 * Exibe lista de clientes com Nome Amigável, Status e Ações
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

  // Estado de loading
  if (loading) {
    return (
      <div className="loading-container">
        <i className="fas fa-spinner fa-spin"></i>
        <span>Carregando clientes...</span>
      </div>
    );
  }

  // Estado vazio
  if (!clientes || clientes.length === 0) {
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
          <th>Status</th>
          <th className="actions-column">Ações</th>
        </tr>
      </thead>
      <tbody>
        {clientes.map((client) => {
          // Os dados completos do backend estão em client.raw (definido em CadastroClientes.jsx)
          // Se raw não existir, usar client diretamente como fallback
          const dadosCliente = client.raw || client;
          
          // Verificar se tem contratos ativos (para destacar na tabela)
          const temContratosAtivos = showIncompleteClients && 
            clientesComContratosAtivos && 
            clientesComContratosAtivos.has(String(client.id));
          
          // Verificar se está ativo
          const statusCliente = dadosCliente.status || client.status || 'ativo';
          const isAtivo = statusCliente === 'ativo';
          
          // Extrair valores dos campos
          const nomeAmigavel = dadosCliente.nome_amigavel || dadosCliente.nome_fantasia || dadosCliente.razao_social || dadosCliente.nome || client.nome || '-';
          const fotoPerfil = dadosCliente.foto_perfil || null;
          
          return (
            <tr 
              key={client.id}
              style={temContratosAtivos ? {
                borderLeft: '4px solid #10b981',
                backgroundColor: '#f0fdf4'
              } : {}}
            >
              {/* Nome Amigável com Avatar */}
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar
                    avatarId={fotoPerfil || DEFAULT_AVATAR}
                    nomeUsuario={nomeAmigavel}
                    size="small"
                    entityType="cliente"
                    entityId={client.id}
                  />
                  <strong>{nomeAmigavel}</strong>
                </div>
              </td>
              
              {/* Status */}
              <td>
                <span className={`status-badge ${isAtivo ? 'status-ativo' : 'status-inativo'}`}>
                  {isAtivo ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              
              {/* Ações */}
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
