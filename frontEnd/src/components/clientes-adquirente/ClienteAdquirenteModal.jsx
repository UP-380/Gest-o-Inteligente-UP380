import React, { useEffect, useRef, useState } from 'react';

/**
 * Modal reutilizável para criar/editar adquirente do cliente
 */
const ClienteAdquirenteModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting,
  editingId,
  clienteId,
  adquirentes = []
}) => {
  const adquirenteSelectRef = useRef(null);
  const [adquirentesList, setAdquirentesList] = useState(adquirentes);
  const [showSenha, setShowSenha] = useState(false);
  const [showNovoAdquirente, setShowNovoAdquirente] = useState(false);
  const [adquirenteFormData, setAdquirenteFormData] = useState({ nome: '' });
  const [adquirenteFormErrors, setAdquirenteFormErrors] = useState({});
  const [adquirenteSubmitting, setAdquirenteSubmitting] = useState(false);

  // Carregar adquirentes se não foram fornecidos
  useEffect(() => {
    if (adquirentes.length === 0 && isOpen) {
      fetch('/api/adquirentes?limit=1000', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setAdquirentesList(result.data);
          }
        })
        .catch(err => console.error('Erro ao carregar adquirentes:', err));
    } else {
      setAdquirentesList(adquirentes);
    }
  }, [adquirentes, isOpen]);

  // Focar no campo adquirente quando o modal abrir
  useEffect(() => {
    if (isOpen && adquirenteSelectRef.current) {
      setTimeout(() => {
        adquirenteSelectRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Fechar modal com ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  const handleAdquirenteChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, adquirente_id: value });
    if (formErrors.adquirente_id) {
      setFormErrors({ ...formErrors, adquirente_id: '' });
    }
  };

  const handleFieldChange = (fieldName) => (e) => {
    const value = e.target.value;
    setFormData({ ...formData, [fieldName]: value });
    if (formErrors[fieldName]) {
      setFormErrors({ ...formErrors, [fieldName]: '' });
    }
  };

  // Função para salvar novo adquirente
  const handleSalvarAdquirente = async (e) => {
    e.preventDefault();

    // Validações
    const errors = {};
    if (!adquirenteFormData.nome || !adquirenteFormData.nome.trim()) {
      errors.nome = 'Nome do adquirente é obrigatório';
    }

    if (Object.keys(errors).length > 0) {
      setAdquirenteFormErrors(errors);
      return;
    }

    setAdquirenteSubmitting(true);
    setAdquirenteFormErrors({});

    try {
      const response = await fetch('/api/adquirentes', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          nome: adquirenteFormData.nome.trim()
        }),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Adicionar o novo adquirente à lista
        const novoAdquirente = result.data;
        setAdquirentesList([...adquirentesList, novoAdquirente]);

        // Selecionar automaticamente o adquirente criado
        setFormData({ ...formData, adquirente_id: novoAdquirente.id });
        if (formErrors.adquirente_id) {
          setFormErrors({ ...formErrors, adquirente_id: '' });
        }

        // Fechar os campos de novo adquirente
        setShowNovoAdquirente(false);
        setAdquirenteFormData({ nome: '' });
      } else {
        setAdquirenteFormErrors({
          nome: result.error || 'Erro ao salvar adquirente. Tente novamente.'
        });
      }
    } catch (error) {
      console.error('Erro ao salvar adquirente:', error);
      setAdquirenteFormErrors({
        nome: 'Erro ao salvar adquirente. Tente novamente.'
      });
    } finally {
      setAdquirenteSubmitting(false);
    }
  };

  const canSave = formData.adquirente_id && !submitting;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{
        maxWidth: '900px',
        width: '95%',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid #eee',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <i className={`fas ${editingId ? 'fa-edit' : 'fa-credit-card'}`} style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              {editingId ? 'Editar Adquirente' : 'Novo Adquirente'}
            </h3>
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Fechar (ESC)"
            disabled={submitting}
            style={{ fontSize: '18px' }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body" style={{
          padding: '20px 24px',
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0
        }}>
          <form onSubmit={handleSubmit} className="adquirente-form">
            {/* Campo Adquirente - Obrigatório */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                Adquirente <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <select
                    ref={adquirenteSelectRef}
                    className={`form-input ${formErrors.adquirente_id ? 'error' : ''}`}
                    value={formData.adquirente_id || ''}
                    onChange={handleAdquirenteChange}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 36px 9px 12px',
                      fontSize: '14px',
                      border: formErrors.adquirente_id ? '2px solid #ef4444' : (formData.adquirente_id ? '1px solid #10b981' : '1px solid #d1d5db'),
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff',
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '12px',
                      cursor: submitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="">Selecione o adquirente</option>
                    {adquirentesList.map((adquirente) => (
                      <option key={adquirente.id} value={adquirente.id}>
                        {adquirente.nome}
                      </option>
                    ))}
                  </select>
                  {formData.adquirente_id && !formErrors.adquirente_id && (
                    <i className="fas fa-check-circle" style={{
                      position: 'absolute',
                      right: '32px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#10b981',
                      fontSize: '16px',
                      pointerEvents: 'none'
                    }}></i>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (showNovoAdquirente) {
                      setShowNovoAdquirente(false);
                      setAdquirenteFormData({ nome: '' });
                      setAdquirenteFormErrors({});
                    } else {
                      setShowNovoAdquirente(true);
                      setAdquirenteFormData({ nome: '' });
                      setAdquirenteFormErrors({});
                    }
                  }}
                  disabled={submitting}
                  title={showNovoAdquirente ? "Cancelar adicionar adquirente" : "Adicionar novo adquirente"}
                  style={{
                    padding: '9px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: showNovoAdquirente ? '#ef4444' : '#fff',
                    color: showNovoAdquirente ? '#fff' : '#0e3b6f',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                    opacity: submitting ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!submitting && !showNovoAdquirente) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#0e3b6f';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submitting && !showNovoAdquirente) {
                      e.currentTarget.style.backgroundColor = '#fff';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                >
                  <i className={`fas ${showNovoAdquirente ? 'fa-times' : 'fa-plus'}`} style={{ fontSize: '12px' }}></i>
                </button>
              </div>
              {formErrors.adquirente_id && (
                <span className="error-message" style={{
                  color: '#ef4444',
                  fontSize: '11px',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-exclamation-circle"></i>
                  {formErrors.adquirente_id}
                </span>
              )}
              {!formErrors.adquirente_id && formData.adquirente_id && (
                <span style={{
                  color: '#10b981',
                  fontSize: '11px',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-check-circle"></i>
                  Adquirente selecionado
                </span>
              )}

              {/* Campos para adicionar novo adquirente */}
              {showNovoAdquirente && (
                <div style={{
                  marginTop: '12px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}>
                  <div style={{ marginBottom: '12px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                    <i className="fas fa-plus-circle" style={{ marginRight: '6px', color: '#0e3b6f' }}></i>
                    Novo Adquirente
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '12px' }}>
                      Nome do Adquirente <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-input ${adquirenteFormErrors.nome ? 'error' : ''}`}
                      value={adquirenteFormData.nome}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAdquirenteFormData({ ...adquirenteFormData, nome: value });
                        if (adquirenteFormErrors.nome) {
                          setAdquirenteFormErrors({ ...adquirenteFormErrors, nome: '' });
                        }
                      }}
                      placeholder="Ex: Cielo, Rede, Stone..."
                      disabled={adquirenteSubmitting}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: adquirenteFormErrors.nome ? '2px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        transition: 'border-color 0.2s'
                      }}
                      maxLength={100}
                    />
                    {adquirenteFormErrors.nome && (
                      <span className="error-message" style={{
                        color: '#ef4444',
                        fontSize: '11px',
                        marginTop: '4px',
                        display: 'block'
                      }}>
                        {adquirenteFormErrors.nome}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNovoAdquirente(false);
                        setAdquirenteFormData({ nome: '' });
                        setAdquirenteFormErrors({});
                      }}
                      disabled={adquirenteSubmitting}
                      style={{
                        padding: '6px 16px',
                        fontSize: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: '#fff',
                        color: '#374151',
                        cursor: adquirenteSubmitting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSalvarAdquirente}
                      disabled={adquirenteSubmitting || !adquirenteFormData.nome?.trim()}
                      style={{
                        padding: '6px 16px',
                        fontSize: '12px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: adquirenteSubmitting || !adquirenteFormData.nome?.trim() ? '#9ca3af' : '#0e3b6f',
                        color: '#fff',
                        cursor: adquirenteSubmitting || !adquirenteFormData.nome?.trim() ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: adquirenteSubmitting || !adquirenteFormData.nome?.trim() ? 0.6 : 1
                      }}
                    >
                      {adquirenteSubmitting ? (
                        <>
                          <i className="fas fa-spinner fa-spin" style={{ marginRight: '4px' }}></i>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save" style={{ marginRight: '4px' }}></i>
                          Salvar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Campos de Credenciais */}
            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{
                  width: '4px',
                  height: '20px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '2px',
                  marginRight: '12px'
                }}></div>
                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                  <i className="fas fa-key" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                  Credenciais do Adquirente
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    E-mail
                    <span style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="email"
                    className={`form-input ${formErrors.email ? 'error' : ''}`}
                    value={formData.email || ''}
                    onChange={handleFieldChange('email')}
                    placeholder="Ex: contato@adquirente.com"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.email ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                  />
                  {formErrors.email && (
                    <span className="error-message" style={{
                      color: '#ef4444',
                      fontSize: '11px',
                      marginTop: '3px',
                      display: 'block'
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.email}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Usuário
                    <span style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.usuario ? 'error' : ''}`}
                    value={formData.usuario || ''}
                    onChange={handleFieldChange('usuario')}
                    placeholder="Ex: usuario.adquirente"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.usuario ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                  />
                  {formErrors.usuario && (
                    <span className="error-message" style={{
                      color: '#ef4444',
                      fontSize: '11px',
                      marginTop: '3px',
                      display: 'block'
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.usuario}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Senha
                    <span style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSenha ? 'text' : 'password'}
                      className={`form-input ${formErrors.senha ? 'error' : ''}`}
                      value={formData.senha || ''}
                      onChange={handleFieldChange('senha')}
                      placeholder="Digite a senha"
                      disabled={submitting}
                      style={{
                        width: '100%',
                        padding: '9px 40px 9px 12px',
                        fontSize: '14px',
                        border: formErrors.senha ? '2px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        transition: 'border-color 0.2s',
                        backgroundColor: submitting ? '#f3f4f6' : '#fff'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#374151'}
                      onMouseLeave={(e) => e.target.style.color = '#6b7280'}
                      title={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      <i className={`fas ${showSenha ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  {formErrors.senha && (
                    <span className="error-message" style={{
                      color: '#ef4444',
                      fontSize: '11px',
                      marginTop: '3px',
                      display: 'block'
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.senha}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Estabelecimento
                    <span style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.estabelecimento ? 'error' : ''}`}
                    value={formData.estabelecimento || ''}
                    onChange={handleFieldChange('estabelecimento')}
                    placeholder="Ex: 123456"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.estabelecimento ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                  />
                  {formErrors.estabelecimento && (
                    <span className="error-message" style={{
                      color: '#ef4444',
                      fontSize: '11px',
                      marginTop: '3px',
                      display: 'block'
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.estabelecimento}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer" style={{
          padding: '14px 24px',
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          flexShrink: 0,
          marginTop: 'auto'
        }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              fontSize: '14px'
            }}
          >
            <i className="fas fa-times" style={{ marginRight: '6px' }}></i>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!canSave}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              opacity: !canSave ? 0.6 : 1,
              cursor: !canSave ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                Salvando...
              </>
            ) : (
              <>
                <i className={`fas ${editingId ? 'fa-save' : 'fa-plus'}`} style={{ marginRight: '6px' }}></i>
                {editingId ? 'Atualizar' : 'Salvar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClienteAdquirenteModal;
