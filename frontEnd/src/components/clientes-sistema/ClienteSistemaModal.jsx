import React, { useEffect, useRef, useState } from 'react';

/**
 * Modal reutilizável para criar/editar sistema do cliente
 */
const ClienteSistemaModal = ({
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
  sistemas = []
}) => {
  const sistemaSelectRef = useRef(null);
  const [sistemasList, setSistemasList] = useState(sistemas);
  const [showSenhaVpn, setShowSenhaVpn] = useState(false);
  const [showSenhaSistema, setShowSenhaSistema] = useState(false);

  // Carregar sistemas se não foram fornecidos
  useEffect(() => {
    if (sistemas.length === 0 && isOpen) {
      fetch('/api/sistemas?limit=1000', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setSistemasList(result.data);
          }
        })
        .catch(err => console.error('Erro ao carregar sistemas:', err));
    } else {
      setSistemasList(sistemas);
    }
  }, [sistemas, isOpen]);

  // Focar no campo sistema quando o modal abrir
  useEffect(() => {
    if (isOpen && sistemaSelectRef.current) {
      setTimeout(() => {
        sistemaSelectRef.current?.focus();
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

  const handleSistemaChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, sistema_id: value });
    if (formErrors.sistema_id) {
      setFormErrors({ ...formErrors, sistema_id: '' });
    }
  };

  const handleFieldChange = (fieldName) => (e) => {
    const value = e.target.value;
    setFormData({ ...formData, [fieldName]: value });
    if (formErrors[fieldName]) {
      setFormErrors({ ...formErrors, [fieldName]: '' });
    }
  };

  const canSave = formData.sistema_id && !submitting;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ 
        maxWidth: '1000px', 
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
            <i className={`fas ${editingId ? 'fa-edit' : 'fa-server'}`} style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              {editingId ? 'Editar Sistema' : 'Novo Sistema'}
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
          <form onSubmit={handleSubmit} className="sistema-form">
            {/* Campo Sistema - Obrigatório */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                Sistema <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  ref={sistemaSelectRef}
                  className={`form-input ${formErrors.sistema_id ? 'error' : ''}`}
                  value={formData.sistema_id || ''}
                  onChange={handleSistemaChange}
                  disabled={submitting}
                  style={{
                    width: '100%',
                      padding: '9px 36px 9px 12px',
                    fontSize: '14px',
                    border: formErrors.sistema_id ? '2px solid #ef4444' : (formData.sistema_id ? '1px solid #10b981' : '1px solid #d1d5db'),
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
                  <option value="">Selecione o sistema</option>
                  {sistemasList.map((sistema) => (
                    <option key={sistema.id} value={sistema.id}>
                      {sistema.nome}
                    </option>
                  ))}
                </select>
                {formData.sistema_id && !formErrors.sistema_id && (
                  <i className="fas fa-check-circle" style={{
                    position: 'absolute',
                    right: '32px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#10b981',
                    fontSize: '16px'
                  }}></i>
                )}
              </div>
              {formErrors.sistema_id && (
                <span className="error-message" style={{ 
                  color: '#ef4444', 
                  fontSize: '11px', 
                  marginTop: '4px', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-exclamation-circle"></i>
                  {formErrors.sistema_id}
                </span>
              )}
              {!formErrors.sistema_id && formData.sistema_id && (
                <span style={{ 
                  color: '#10b981', 
                  fontSize: '11px', 
                  marginTop: '4px', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-check-circle"></i>
                  Sistema selecionado
                </span>
              )}
            </div>

            {/* Campos de Servidor */}
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
                  <i className="fas fa-server" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                  Informações do Servidor
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Servidor
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
                    className={`form-input ${formErrors.servidor ? 'error' : ''}`}
                    value={formData.servidor || ''}
                    onChange={handleFieldChange('servidor')}
                    placeholder="Ex: 192.168.1.100"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.servidor ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                  />
                  {formErrors.servidor && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.servidor}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Usuário do Servidor
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
                    className={`form-input ${formErrors.usuario_servidor ? 'error' : ''}`}
                    value={formData.usuario_servidor || ''}
                    onChange={handleFieldChange('usuario_servidor')}
                    placeholder="Ex: admin"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.usuario_servidor ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                  />
                  {formErrors.usuario_servidor && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.usuario_servidor}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Campos de VPN */}
            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ 
                  width: '4px', 
                  height: '20px', 
                  backgroundColor: '#8b5cf6', 
                  borderRadius: '2px',
                  marginRight: '12px'
                }}></div>
                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                  <i className="fas fa-network-wired" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>
                  Informações de VPN
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Servidor VPN
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
                    className={`form-input ${formErrors.vpn ? 'error' : ''}`}
                    value={formData.vpn || ''}
                    onChange={handleFieldChange('vpn')}
                    placeholder="Ex: vpn.empresa.com"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.vpn ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                  />
                  {formErrors.vpn && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.vpn}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Usuário VPN
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
                    className={`form-input ${formErrors.usuario_vpn ? 'error' : ''}`}
                    value={formData.usuario_vpn || ''}
                    onChange={handleFieldChange('usuario_vpn')}
                    placeholder="Ex: usuario.vpn"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.usuario_vpn ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                  />
                  {formErrors.usuario_vpn && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.usuario_vpn}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Senha VPN
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
                      type={showSenhaVpn ? 'text' : 'password'}
                      className={`form-input ${formErrors.senha_vpn ? 'error' : ''}`}
                      value={formData.senha_vpn || ''}
                      onChange={handleFieldChange('senha_vpn')}
                      placeholder="Digite a senha"
                      disabled={submitting}
                      style={{
                        width: '100%',
                        padding: '9px 40px 9px 12px',
                        fontSize: '14px',
                        border: formErrors.senha_vpn ? '2px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        transition: 'border-color 0.2s',
                        backgroundColor: submitting ? '#f3f4f6' : '#fff'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaVpn(!showSenhaVpn)}
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
                      title={showSenhaVpn ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      <i className={`fas ${showSenhaVpn ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  {formErrors.senha_vpn && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.senha_vpn}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Campos de Sistema */}
            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ 
                  width: '4px', 
                  height: '20px', 
                  backgroundColor: '#10b981', 
                  borderRadius: '2px',
                  marginRight: '12px'
                }}></div>
                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                  <i className="fas fa-key" style={{ marginRight: '8px', color: '#10b981' }}></i>
                  Credenciais do Sistema
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Usuário do Sistema
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
                    className={`form-input ${formErrors.usuario_sistema ? 'error' : ''}`}
                    value={formData.usuario_sistema || ''}
                    onChange={handleFieldChange('usuario_sistema')}
                    placeholder="Ex: admin"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.usuario_sistema ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                  />
                  {formErrors.usuario_sistema && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.usuario_sistema}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Senha do Sistema
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
                      type={showSenhaSistema ? 'text' : 'password'}
                      className={`form-input ${formErrors.senha_sistema ? 'error' : ''}`}
                      value={formData.senha_sistema || ''}
                      onChange={handleFieldChange('senha_sistema')}
                      placeholder="Digite a senha"
                      disabled={submitting}
                      style={{
                        width: '100%',
                        padding: '9px 40px 9px 12px',
                        fontSize: '14px',
                        border: formErrors.senha_sistema ? '2px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        transition: 'border-color 0.2s',
                        backgroundColor: submitting ? '#f3f4f6' : '#fff'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaSistema(!showSenhaSistema)}
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
                      title={showSenhaSistema ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      <i className={`fas ${showSenhaSistema ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  {formErrors.senha_sistema && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.senha_sistema}
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

export default ClienteSistemaModal;

