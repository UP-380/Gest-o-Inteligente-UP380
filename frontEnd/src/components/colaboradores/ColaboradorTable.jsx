import React from 'react';
import { formatarMoeda, aplicarMascaraCpf } from '../../utils/vigenciaUtils';
import EditButton from '../common/EditButton';

/**
 * Componente de tabela de colaboradores
 */
const ColaboradorTable = ({
  colaboradores,
  loading,
  mostrarInativos,
  onEdit,
  onInativar,
  onAtivar,
  onVerVigencias,
  onNovaVigencia,
  showForm
}) => {
  if (loading) {
    return (
      <div className="loading-container">
        <i className="fas fa-spinner fa-spin"></i>
        <span>Carregando colaboradores...</span>
      </div>
    );
  }

  if (colaboradores.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-users"></i>
        <p>Nenhum colaborador encontrado</p>
      </div>
    );
  }

  return (
    <table className="listing-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>CPF</th>
          <th>Salário Base</th>
          <th className="actions-column">Ações</th>
        </tr>
      </thead>
      <tbody>
        {colaboradores.map((colaborador) => (
          <tr key={colaborador.id}>
            <td>{colaborador.nome || '-'}</td>
            <td>
              {colaborador.cpf 
                ? aplicarMascaraCpf(colaborador.cpf)
                : '-'
              }
            </td>
            <td>
              {colaborador.salariobase 
                ? `R$ ${formatarMoeda(colaborador.salariobase)}`
                : '-'
              }
            </td>
            <td className="actions-column">
              <EditButton
                onClick={() => onEdit(colaborador)}
                title="Editar"
                disabled={showForm}
              />
              {mostrarInativos ? (
                <button
                  className="btn-icon activate-btn"
                  onClick={() => onAtivar(colaborador)}
                  title="Ativar"
                  disabled={showForm}
                  style={{ color: '#10b981' }}
                >
                  <svg viewBox="0 0 512 512" className="icon-check" width="22" height="22">
                    <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z" fill="currentColor"/>
                  </svg>
                </button>
              ) : (
                <button
                  className="btn-icon inactivate-btn"
                  onClick={() => onInativar(colaborador)}
                  title="Inativar"
                  disabled={showForm}
                  style={{ color: '#ef4444' }}
                >
                  <svg viewBox="0 0 512 512" className="icon-ban" width="22" height="22">
                    <circle cx="256" cy="256" r="200" fill="currentColor" opacity="0.1"/>
                    <circle cx="256" cy="256" r="200" fill="none" stroke="currentColor" strokeWidth="32"/>
                    <line x1="150" y1="150" x2="362" y2="362" stroke="currentColor" strokeWidth="32" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              <button
                className="btn-icon btn-vigencia calendar-anim"
                onClick={() => onVerVigencias(colaborador)}
                title="Ver Vigências"
                disabled={showForm}
                style={{ color: '#ed8936' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  className="calendar-svg"
                >
                  <rect x="3" y="4" width="18" height="17" rx="2" strokeWidth="1.6"></rect>
                  <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.6"></line>
                  <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.6"></line>
                  <line x1="3" y1="9" x2="21" y2="9" strokeWidth="1.6"></line>
                  <g className="calendar-sheet">
                    <rect
                      x="6"
                      y="11"
                      width="12"
                      height="9"
                      rx="1.5"
                      strokeWidth="1.2"
                    ></rect>
                    <line x1="8" y1="14" x2="14" y2="14" strokeWidth="1.2"></line>
                    <line x1="8" y1="17" x2="16" y2="17" strokeWidth="1.2"></line>
                  </g>
                </svg>
              </button>
              <button
                className="btn-icon btn-vigencia"
                onClick={() => onNovaVigencia(colaborador)}
                title="Nova Vigência"
                disabled={showForm}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  className="plus-anim"
                >
                  <circle cx="12" cy="12" r="9" strokeWidth="1.5" fill="none"></circle>
                  <line x1="8" y1="12" x2="16" y2="12" strokeWidth="1.5"></line>
                  <line x1="12" y1="16" x2="12" y2="8" strokeWidth="1.5"></line>
                </svg>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ColaboradorTable;

