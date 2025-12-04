import React from 'react';
import { formatarMoeda, aplicarMascaraCpf } from '../../utils/vigenciaUtils';

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
          <th className="actions-column">Ações Colaborador/Vigência</th>
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
              <div className="action-buttons">
                <button
                  className="btn-icon btn-edit edit-anim"
                  onClick={() => onEdit(colaborador)}
                  title="Editar"
                  disabled={showForm}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 512 512"
                    className="edit-anim-icon"
                  >
                    <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/>
                  </svg>
                </button>
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
                <span className="action-divider"></span>
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
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ColaboradorTable;

