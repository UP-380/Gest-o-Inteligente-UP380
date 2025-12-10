import React, { useState, useEffect } from 'react';

/**
 * Componente de formulário de cliente (usado no modal de editar)
 */
const ClienteForm = ({
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting,
  allClientesKamino = [],
  clientesKaminoMap,
  cnpjOptions = [],
  loadCnpjOptions
}) => {
  const [kaminoSearchTerm, setKaminoSearchTerm] = useState(formData.kaminoNome || '');
  const [showKaminoDropdown, setShowKaminoDropdown] = useState(false);

  useEffect(() => {
    if (formData.id && loadCnpjOptions) {
      loadCnpjOptions(formData.id, formData.clickupNome).then(options => {
        // Opções já são atualizadas via props
      });
    }
    setKaminoSearchTerm(formData.kaminoNome || '');
  }, [formData.id, formData.clickupNome, formData.kaminoNome, loadCnpjOptions]);

  // Filtrar clientes Kamino
  const filteredKamino = React.useMemo(() => {
    if (!allClientesKamino || !Array.isArray(allClientesKamino) || allClientesKamino.length === 0) {
      return [];
    }
    
    return allClientesKamino.filter(c => {
      if (!c || !c.nome_fantasia) return false;
      if (!kaminoSearchTerm || kaminoSearchTerm.trim() === '') {
        return true;
      }
      const nomeFantasia = (c.nome_fantasia || '').toLowerCase();
      const search = kaminoSearchTerm.toLowerCase();
      return nomeFantasia.includes(search);
    });
  }, [allClientesKamino, kaminoSearchTerm]);

  // Função para aplicar máscara de CPF/CNPJ
  const aplicarMascaraCpfCnpj = (valor) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    const numeroLimitado = apenasNumeros.substring(0, 14);
    return numeroLimitado
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  return (
    <div className="colaborador-form">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label-small">
            Razão Social <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.razao ? 'error' : ''}`}
            value={formData.razao || ''}
            onChange={(e) => {
              setFormData({ ...formData, razao: e.target.value });
              if (formErrors.razao) {
                setFormErrors({ ...formErrors, razao: '' });
              }
            }}
            placeholder="Digite a razão social"
            disabled={submitting}
            required
          />
          {formErrors.razao && (
            <span className="error-message">{formErrors.razao}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label-small">
            Nome Fantasia <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.fantasia ? 'error' : ''}`}
            value={formData.fantasia || ''}
            onChange={(e) => {
              setFormData({ ...formData, fantasia: e.target.value });
              if (formErrors.fantasia) {
                setFormErrors({ ...formErrors, fantasia: '' });
              }
            }}
            placeholder="Digite o nome fantasia"
            disabled={submitting}
            required
          />
          {formErrors.fantasia && (
            <span className="error-message">{formErrors.fantasia}</span>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label-small">
            Nome Amigável <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.amigavel ? 'error' : ''}`}
            value={formData.amigavel || ''}
            onChange={(e) => {
              setFormData({ ...formData, amigavel: e.target.value });
              if (formErrors.amigavel) {
                setFormErrors({ ...formErrors, amigavel: '' });
              }
            }}
            placeholder="Digite o nome amigável"
            disabled={submitting}
            required
          />
          {formErrors.amigavel && (
            <span className="error-message">{formErrors.amigavel}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label-small">
            CNPJ
            <span className="info-icon" title="O CNPJ vem do contrato que é cadastrado no CLICKUP">
              <i className="fas fa-info-circle" style={{ marginLeft: '4px', color: '#64748b', fontSize: '12px' }}></i>
            </span>
          </label>
          <div className="select-wrapper">
            <select
              className={`form-input-small select-with-icon ${formErrors.cnpj ? 'error' : ''}`}
              value={formData.cnpj ? formData.cnpj.replace(/\D/g, '') : ''}
              onChange={(e) => {
                setFormData({ ...formData, cnpj: e.target.value });
                if (formErrors.cnpj) {
                  setFormErrors({ ...formErrors, cnpj: '' });
                }
              }}
              disabled={submitting}
            >
              <option value="">Selecione o CNPJ</option>
              {cnpjOptions.map((cnpj) => {
                const cnpjLimpo = cnpj.replace(/\D/g, '');
                return (
                  <option key={cnpjLimpo} value={cnpjLimpo}>
                    {aplicarMascaraCpfCnpj(cnpjLimpo)}
                  </option>
                );
              })}
            </select>
            <i className="fas fa-chevron-down select-icon"></i>
          </div>
          {formErrors.cnpj && (
            <span className="error-message">{formErrors.cnpj}</span>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label-small">Status</label>
          <div className="select-wrapper">
            <select
              className={`form-input-small select-with-icon ${formErrors.status ? 'error' : ''}`}
              value={formData.status || ''}
              onChange={(e) => {
                setFormData({ ...formData, status: e.target.value });
                if (formErrors.status) {
                  setFormErrors({ ...formErrors, status: '' });
                }
              }}
              disabled={submitting}
            >
              <option value="">Selecione o status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
            <i className="fas fa-chevron-down select-icon"></i>
          </div>
          {formErrors.status && (
            <span className="error-message">{formErrors.status}</span>
          )}
        </div>

        <div className="form-group" style={{ position: 'relative', zIndex: showKaminoDropdown ? 1001 : 'auto' }}>
          <label className="form-label-small">
            Cliente Kamino <span className="required">*</span>
          </label>
          <div className="select-wrapper searchable-select" style={{ position: 'relative', zIndex: showKaminoDropdown ? 1002 : 'auto' }}>
            <input
              type="text"
              className={`form-input-small select-with-icon searchable-input ${formErrors.kaminoNome ? 'error' : ''}`}
              value={kaminoSearchTerm}
              onChange={(e) => {
                const newValue = e.target.value;
                setKaminoSearchTerm(newValue);
                setShowKaminoDropdown(true);
                if (!newValue || newValue.trim() === '') {
                  setFormData({
                    ...formData,
                    kaminoNome: '',
                    kaminoId: '',
                  });
                }
              }}
              onFocus={() => {
                setShowKaminoDropdown(true);
              }}
              onBlur={(e) => {
                const relatedTarget = e.relatedTarget;
                if (!relatedTarget || !relatedTarget.closest('.dropdown-list')) {
                  setTimeout(() => setShowKaminoDropdown(false), 200);
                }
              }}
              placeholder="Digite para pesquisar..."
              autoComplete="off"
              disabled={submitting}
              required
            />
            <i 
              className="fas fa-chevron-down select-icon" 
              onClick={() => {
                setShowKaminoDropdown(!showKaminoDropdown);
              }}
              style={{ cursor: 'pointer' }}
            ></i>
            {showKaminoDropdown && (
              <ul 
                className="dropdown-list" 
                style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  left: 'auto',
                  width: '150%',
                  minWidth: '300px',
                  maxWidth: '500px',
                  zIndex: 10000,
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  marginTop: '4px',
                  padding: 0,
                  listStyle: 'none',
                  display: 'block',
                  visibility: 'visible',
                  opacity: 1,
                  textAlign: 'left',
                  transform: 'translateX(0)'
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {filteredKamino.length > 0 ? (
                  filteredKamino.slice(0, 100).map((c) => {
                    const nomeExibicao = c.nome_fantasia || 'Cliente sem nome';
                    return (
                      <li
                        key={c.id || nomeExibicao}
                        className="dropdown-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const idMap = clientesKaminoMap?.get(c.nome_fantasia) || c.id;
                          setFormData({
                            ...formData,
                            kaminoNome: nomeExibicao,
                            kaminoId: idMap || c.id || '',
                          });
                          setKaminoSearchTerm(nomeExibicao);
                          setShowKaminoDropdown(false);
                        }}
                        style={{ 
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderBottom: '1px solid #f0f0f0',
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                      >
                        {nomeExibicao}
                      </li>
                    );
                  })
                ) : allClientesKamino && allClientesKamino.length > 0 ? (
                  <li className="dropdown-item" style={{ color: '#999', fontStyle: 'italic', padding: '8px 12px' }}>
                    Nenhum cliente encontrado para "{kaminoSearchTerm}"
                  </li>
                ) : (
                  <li className="dropdown-item" style={{ color: '#999', fontStyle: 'italic', padding: '8px 12px' }}>
                    Carregando clientes...
                  </li>
                )}
              </ul>
            )}
          </div>
          {formErrors.kaminoNome && (
            <span className="error-message">{formErrors.kaminoNome}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClienteForm;

