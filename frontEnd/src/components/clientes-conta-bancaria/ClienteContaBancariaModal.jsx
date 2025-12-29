import React, { useEffect, useRef, useState } from 'react';

/**
 * Modal reutilizável para criar/editar conta bancária do cliente
 */
const ClienteContaBancariaModal = ({
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
  bancos = []
}) => {
  const bancoSelectRef = useRef(null);
  const [bancosList, setBancosList] = useState(bancos);
  const [showSenha, setShowSenha] = useState(false);

  // Carregar bancos se não foram fornecidos
  useEffect(() => {
    if (bancos.length === 0 && isOpen) {
      fetch('/api/bancos?limit=1000', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setBancosList(result.data);
          }
        })
        .catch(err => console.error('Erro ao carregar bancos:', err));
    } else {
      setBancosList(bancos);
    }
  }, [bancos, isOpen]);

  // Focar no campo banco quando o modal abrir
  useEffect(() => {
    if (isOpen && bancoSelectRef.current) {
      setTimeout(() => {
        bancoSelectRef.current?.focus();
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

  const handleBancoChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, banco_id: value });
    if (formErrors.banco_id) {
      setFormErrors({ ...formErrors, banco_id: '' });
    }
  };

  const handleFieldChange = (fieldName) => (e) => {
    const value = e.target.value;
    setFormData({ ...formData, [fieldName]: value });
    if (formErrors[fieldName]) {
      setFormErrors({ ...formErrors, [fieldName]: '' });
    }
  };

  const canSave = formData.banco_id && !submitting;

  return (
    <div className="modal-overlay" onClick={onClose}>
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
            <i className={`fas ${editingId ? 'fa-edit' : 'fa-university'}`} style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              {editingId ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
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
          <form onSubmit={handleSubmit} className="conta-bancaria-form">
            {/* Campo Banco - Obrigatório */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                Banco <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  ref={bancoSelectRef}
                  className={`form-input ${formErrors.banco_id ? 'error' : ''}`}
                  value={formData.banco_id || ''}
                  onChange={handleBancoChange}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 12px',
                    fontSize: '14px',
                    border: formErrors.banco_id ? '2px solid #ef4444' : (formData.banco_id ? '1px solid #10b981' : '1px solid #d1d5db'),
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
                  <option value="">Selecione o banco</option>
                  {bancosList.map((banco) => (
                    <option key={banco.id} value={banco.id}>
                      {banco.codigo ? `${banco.codigo} - ` : ''}{banco.nome}
                    </option>
                  ))}
                </select>
                {formData.banco_id && !formErrors.banco_id && (
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
              {formErrors.banco_id && (
                <span className="error-message" style={{ 
                  color: '#ef4444', 
                  fontSize: '11px', 
                  marginTop: '4px', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-exclamation-circle"></i>
                  {formErrors.banco_id}
                </span>
              )}
              {!formErrors.banco_id && formData.banco_id && (
                <span style={{ 
                  color: '#10b981', 
                  fontSize: '11px', 
                  marginTop: '4px', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-check-circle"></i>
                  Banco selecionado
                </span>
              )}
            </div>

            {/* Campos de Dados Bancários */}
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
                  <i className="fas fa-building-columns" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                  Dados Bancários
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Agência
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
                    className={`form-input ${formErrors.agencia ? 'error' : ''}`}
                    value={formData.agencia || ''}
                    onChange={handleFieldChange('agencia')}
                    placeholder="Ex: 1234"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.agencia ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={10}
                  />
                  {formErrors.agencia && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.agencia}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Conta
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
                    className={`form-input ${formErrors.conta ? 'error' : ''}`}
                    value={formData.conta || ''}
                    onChange={handleFieldChange('conta')}
                    placeholder="Ex: 123456-7"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.conta ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={20}
                  />
                  {formErrors.conta && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.conta}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Operador
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
                    className={`form-input ${formErrors.operador ? 'error' : ''}`}
                    value={formData.operador || ''}
                    onChange={handleFieldChange('operador')}
                    placeholder="Ex: 001"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.operador ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={10}
                  />
                  {formErrors.operador && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.operador}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Campos de Credenciais */}
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
                  Credenciais de Acesso
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '0' }}>
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
                    placeholder="Ex: usuario.banco"
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
                    maxLength={100}
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
                      maxLength={100}
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

export default ClienteContaBancariaModal;
