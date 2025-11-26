import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import './CustoMembroVigencia.css';

const API_BASE_URL = '/api';

// Função auxiliar para formatar data (YYYY-MM-DD)
const formatarData = (data) => {
  if (!data) return '';
  const d = new Date(data);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Função auxiliar para formatar número monetário
const formatarMoeda = (valor) => {
  if (!valor && valor !== 0) return '';
  return parseFloat(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Função para remover formatação de moeda (formato brasileiro: 1.234,56)
const removerFormatacaoMoeda = (valor) => {
  if (!valor && valor !== '0') return '0';
  // Remove pontos (separadores de milhar) e substitui vírgula por ponto
  return valor.toString().replace(/\./g, '').replace(',', '.');
};

const CustoMembroVigencia = () => {
  // Estados principais
  const [vigencias, setVigencias] = useState([]);
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVigencias, setTotalVigencias] = useState(0);

  // Filtros
  const [filtroMembroId, setFiltroMembroId] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Estados para formulário
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    membro_id: '',
    dt_vigencia: '',
    diasuteis: '',
    horascontratadasdia: '',
    salariobase: '',
    ajudacusto: '0',
    valetransporte: '0',
    ferias: '0',
    decimoterceiro: '0',
    insspatronal: '0',
    insscolaborador: '0',
    fgts: '0',
    horas_mensal: '',
    descricao: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vigenciaToDelete, setVigenciaToDelete] = useState(null);

  // Carregar membros para o select
  const loadMembros = useCallback(async () => {
    setLoadingMembros(true);
    try {
      const response = await fetch(`${API_BASE_URL}/membros-id-nome`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setMembros(result.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      showMessage('Erro ao carregar membros. Tente novamente.', 'error');
    } finally {
      setLoadingMembros(false);
    }
  }, []);

  // Carregar vigências
  const loadVigencias = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (filtroMembroId) {
        params.append('membro_id', filtroMembroId);
      }
      if (filtroDataInicio) {
        params.append('dt_vigencia_inicio', filtroDataInicio);
      }
      if (filtroDataFim) {
        params.append('dt_vigencia_fim', filtroDataFim);
      }

      const response = await fetch(`${API_BASE_URL}/custo-membro-vigencia?${params}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setVigencias(result.data || []);
        setTotalVigencias(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar vigências');
      }
    } catch (error) {
      console.error('Erro ao carregar vigências:', error);
      showMessage(error.message || 'Erro ao carregar vigências. Tente novamente.', 'error');
      setVigencias([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filtroMembroId, filtroDataInicio, filtroDataFim]);

  // Carregar vigência por ID para edição
  const loadVigenciaParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/custo-membro-vigencia/${id}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;
        
        // Função auxiliar para formatar valor monetário
        const formatarValorMonetario = (valor) => {
          if (!valor && valor !== 0) return '';
          return parseFloat(valor).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        };
        
        setFormData({
          membro_id: data.membro_id?.toString() || '',
          dt_vigencia: formatarData(data.dt_vigencia),
          diasuteis: data.diasuteis?.toString() || '',
          horascontratadasdia: data.horascontratadasdia?.toString() || '',
          salariobase: formatarValorMonetario(data.salariobase),
          ajudacusto: formatarValorMonetario(data.ajudacusto || 0),
          valetransporte: formatarValorMonetario(data.valetransporte || 0),
          ferias: formatarValorMonetario(data.ferias || 0),
          decimoterceiro: formatarValorMonetario(data.decimoterceiro || 0),
          insspatronal: formatarValorMonetario(data.insspatronal || 0),
          insscolaborador: formatarValorMonetario(data.insscolaborador || 0),
          fgts: formatarValorMonetario(data.fgts || 0),
          horas_mensal: data.horas_mensal?.toString() || '',
          descricao: data.descricao || ''
        });
        setEditingId(id);
        setShowForm(true);
        setFormErrors({});
      } else {
        throw new Error(result.error || 'Erro ao carregar vigência');
      }
    } catch (error) {
      console.error('Erro ao carregar vigência:', error);
      showMessage('Erro ao carregar vigência. Tente novamente.', 'error');
    }
  }, []);

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.membro_id || !formData.membro_id.trim()) {
      errors.membro_id = 'Membro é obrigatório';
    }

    if (!formData.dt_vigencia || !formData.dt_vigencia.trim()) {
      errors.dt_vigencia = 'Data de vigência é obrigatória';
    } else {
      const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dataRegex.test(formData.dt_vigencia)) {
        errors.dt_vigencia = 'Data deve estar no formato YYYY-MM-DD';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Salvar vigência (criar ou atualizar)
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        membro_id: parseInt(formData.membro_id, 10),
        dt_vigencia: formData.dt_vigencia.trim(),
        diasuteis: formData.diasuteis ? parseFloat(formData.diasuteis) : null,
        horascontratadasdia: formData.horascontratadasdia ? parseFloat(formData.horascontratadasdia) : null,
        salariobase: formData.salariobase ? parseFloat(removerFormatacaoMoeda(formData.salariobase)) : null,
        ajudacusto: formData.ajudacusto ? parseFloat(removerFormatacaoMoeda(formData.ajudacusto)) : 0,
        valetransporte: formData.valetransporte ? parseFloat(removerFormatacaoMoeda(formData.valetransporte)) : 0,
        ferias: formData.ferias ? parseFloat(removerFormatacaoMoeda(formData.ferias)) : 0,
        decimoterceiro: formData.decimoterceiro ? parseFloat(removerFormatacaoMoeda(formData.decimoterceiro)) : 0,
        insspatronal: formData.insspatronal ? parseFloat(removerFormatacaoMoeda(formData.insspatronal)) : 0,
        insscolaborador: formData.insscolaborador ? parseFloat(removerFormatacaoMoeda(formData.insscolaborador)) : 0,
        fgts: formData.fgts ? parseFloat(removerFormatacaoMoeda(formData.fgts)) : 0,
        horas_mensal: formData.horas_mensal ? parseFloat(formData.horas_mensal) : null,
        descricao: formData.descricao?.trim() || null
      };

      const url = editingId 
        ? `${API_BASE_URL}/custo-membro-vigencia/${editingId}`
        : `${API_BASE_URL}/custo-membro-vigencia`;
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showMessage(
          editingId 
            ? 'Vigência atualizada com sucesso!'
            : 'Vigência criada com sucesso!',
          'success'
        );
        resetForm();
        await loadVigencias();
      } else {
        throw new Error(result.error || 'Erro ao salvar vigência');
      }
    } catch (error) {
      console.error('Erro ao salvar vigência:', error);
      showMessage(error.message || 'Erro ao salvar vigência. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingId, loadVigencias]);

  // Deletar vigência
  const handleDelete = useCallback(async () => {
    if (!vigenciaToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/custo-membro-vigencia/${vigenciaToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showMessage('Vigência deletada com sucesso!', 'success');
        setShowDeleteModal(false);
        setVigenciaToDelete(null);
        await loadVigencias();
      } else {
        throw new Error(result.error || 'Erro ao deletar vigência');
      }
    } catch (error) {
      console.error('Erro ao deletar vigência:', error);
      showMessage(error.message || 'Erro ao deletar vigência. Tente novamente.', 'error');
      setShowDeleteModal(false);
    }
  }, [vigenciaToDelete, loadVigencias]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      membro_id: '',
      dt_vigencia: '',
      diasuteis: '',
      horascontratadasdia: '',
      salariobase: '',
      ajudacusto: '0',
      valetransporte: '0',
      ferias: '0',
      decimoterceiro: '0',
      insspatronal: '0',
      insscolaborador: '0',
      fgts: '0',
      horas_mensal: '',
      descricao: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
  };

  // Abrir formulário para nova vigência
  const handleNewVigencia = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (vigencia) => {
    loadVigenciaParaEdicao(vigencia.id);
  };

  // Confirmar exclusão
  const confirmDelete = (vigencia) => {
    setVigenciaToDelete(vigencia);
    setShowDeleteModal(true);
  };

  // Mostrar mensagem
  const showMessage = useCallback((message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }, []);

  // Obter nome do membro
  const getNomeMembro = (membroId) => {
    const membro = membros.find(m => m.id === membroId);
    return membro ? membro.nome : `ID: ${membroId}`;
  };

  // Aplicar filtros
  const aplicarFiltros = () => {
    setCurrentPage(1);
    loadVigencias();
  };

  // Limpar filtros
  const limparFiltros = () => {
    setFiltroMembroId('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setCurrentPage(1);
  };

  // Efeitos
  useEffect(() => {
    loadMembros();
  }, [loadMembros]);

  useEffect(() => {
    loadVigencias();
  }, [loadVigencias]);

  // Calcular range de itens exibidos
  const startItem = totalVigencias === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, vigencias.length) - 1, totalVigencias);

  return (
    <Layout>
      <div className="custo-membro-vigencia-container">
        <main className="vigencias-listing-section">
          <div className="form-header">
            <h2 className="form-title">Custo Membro Vigência</h2>
            <p className="form-subtitle">
              Gerencie as vigências de custo dos membros
            </p>
          </div>

          {/* Filtros */}
          <div className="filters-card">
            <div className="filters-header">
              <h3>Filtros</h3>
              <button
                className="btn-icon"
                onClick={limparFiltros}
                title="Limpar filtros"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="filters-content">
              <div className="filter-row">
                <div className="filter-group">
                  <label className="filter-label">Membro</label>
                  <select
                    className="filter-select"
                    value={filtroMembroId}
                    onChange={(e) => setFiltroMembroId(e.target.value)}
                  >
                    <option value="">Todos os membros</option>
                    {membros.map((membro) => (
                      <option key={membro.id} value={membro.id}>
                        {membro.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Data Início</label>
                  <input
                    type="date"
                    className="filter-input"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Data Fim</label>
                  <input
                    type="date"
                    className="filter-input"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                  />
                </div>
                <div className="filter-actions">
                  <button
                    className="btn-primary"
                    onClick={aplicarFiltros}
                  >
                    <i className="fas fa-search"></i>
                    Filtrar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Controles de busca e botão adicionar */}
          <div className="listing-controls">
            <div className="listing-controls-right">
              <button
                className="btn-primary"
                onClick={handleNewVigencia}
                disabled={showForm}
              >
                <i className="fas fa-plus"></i>
                Nova Vigência
              </button>
            </div>
          </div>

          {/* Formulário de cadastro/edição */}
          {showForm && (
            <div className="form-card">
              <div className="form-card-header">
                <h3>{editingId ? 'Editar Vigência' : 'Nova Vigência'}</h3>
                <button
                  className="btn-icon"
                  onClick={resetForm}
                  title="Fechar"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="vigencia-form">
                <div className="form-section">
                  <h4 className="form-section-title">Informações Básicas</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        Membro <span className="required">*</span>
                      </label>
                      <select
                        className={`form-input ${formErrors.membro_id ? 'error' : ''}`}
                        value={formData.membro_id}
                        onChange={(e) => {
                          setFormData({ ...formData, membro_id: e.target.value });
                          if (formErrors.membro_id) {
                            setFormErrors({ ...formErrors, membro_id: '' });
                          }
                        }}
                        disabled={submitting || loadingMembros}
                      >
                        <option value="">Selecione um membro</option>
                        {membros.map((membro) => (
                          <option key={membro.id} value={membro.id}>
                            {membro.nome}
                          </option>
                        ))}
                      </select>
                      {formErrors.membro_id && (
                        <span className="error-message">{formErrors.membro_id}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Data de Vigência <span className="required">*</span>
                      </label>
                      <input
                        type="date"
                        className={`form-input ${formErrors.dt_vigencia ? 'error' : ''}`}
                        value={formData.dt_vigencia}
                        onChange={(e) => {
                          setFormData({ ...formData, dt_vigencia: e.target.value });
                          if (formErrors.dt_vigencia) {
                            setFormErrors({ ...formErrors, dt_vigencia: '' });
                          }
                        }}
                        disabled={submitting}
                      />
                      {formErrors.dt_vigencia && (
                        <span className="error-message">{formErrors.dt_vigencia}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Dias Úteis</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={formData.diasuteis}
                        onChange={(e) => setFormData({ ...formData, diasuteis: e.target.value })}
                        placeholder="Ex: 22"
                        disabled={submitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Horas Contratadas/Dia</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={formData.horascontratadasdia}
                        onChange={(e) => setFormData({ ...formData, horascontratadasdia: e.target.value })}
                        placeholder="Ex: 8"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Horas Mensal</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={formData.horas_mensal}
                        onChange={(e) => setFormData({ ...formData, horas_mensal: e.target.value })}
                        placeholder="Ex: 176"
                        disabled={submitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Salário Base</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.salariobase}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setFormData({ ...formData, salariobase: valorFormatado });
                          } else {
                            setFormData({ ...formData, salariobase: '' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="form-section-title">Benefícios e Encargos</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Ajuda de Custo</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.ajudacusto}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setFormData({ ...formData, ajudacusto: valorFormatado });
                          } else {
                            setFormData({ ...formData, ajudacusto: '0' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Vale Transporte</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.valetransporte}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setFormData({ ...formData, valetransporte: valorFormatado });
                          } else {
                            setFormData({ ...formData, valetransporte: '0' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Férias</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.ferias}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setFormData({ ...formData, ferias: valorFormatado });
                          } else {
                            setFormData({ ...formData, ferias: '0' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">13º Salário</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.decimoterceiro}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setFormData({ ...formData, decimoterceiro: valorFormatado });
                          } else {
                            setFormData({ ...formData, decimoterceiro: '0' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">INSS Patronal</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.insspatronal}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setFormData({ ...formData, insspatronal: valorFormatado });
                          } else {
                            setFormData({ ...formData, insspatronal: '0' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">INSS Colaborador</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.insscolaborador}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setFormData({ ...formData, insscolaborador: valorFormatado });
                          } else {
                            setFormData({ ...formData, insscolaborador: '0' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">FGTS</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.fgts}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setFormData({ ...formData, fgts: valorFormatado });
                          } else {
                            setFormData({ ...formData, fgts: '0' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submitting}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Descrição</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder="Descrição opcional"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        {editingId ? 'Atualizar' : 'Salvar'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de vigências */}
          <div className="listing-table-container">
            {loading ? (
              <div className="loading-container">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Carregando vigências...</span>
              </div>
            ) : vigencias.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-calendar-alt"></i>
                <p>Nenhuma vigência encontrada</p>
              </div>
            ) : (
              <>
                <table className="listing-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Membro</th>
                      <th>Data Vigência</th>
                      <th>Salário Base</th>
                      <th>Dias Úteis</th>
                      <th>Horas/Dia</th>
                      <th className="actions-column">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vigencias.map((vigencia) => (
                      <tr key={vigencia.id}>
                        <td>{vigencia.id}</td>
                        <td>{getNomeMembro(vigencia.membro_id)}</td>
                        <td>{formatarData(vigencia.dt_vigencia)}</td>
                        <td>
                          {vigencia.salariobase 
                            ? `R$ ${formatarMoeda(vigencia.salariobase)}`
                            : '-'
                          }
                        </td>
                        <td>{vigencia.diasuteis || '-'}</td>
                        <td>{vigencia.horascontratadasdia || '-'}</td>
                        <td className="actions-column">
                          <div className="action-buttons">
                            <button
                              className="btn-icon btn-edit"
                              onClick={() => handleEdit(vigencia)}
                              title="Editar"
                              disabled={showForm}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              className="btn-icon btn-delete"
                              onClick={() => confirmDelete(vigencia)}
                              title="Deletar"
                              disabled={showForm}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span className="pagination-info">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || loading}
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}

                {/* Info de paginação */}
                <div className="pagination-info-bottom">
                  Mostrando {startItem} a {endItem} de {totalVigencias} vigências
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && vigenciaToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmar Exclusão</h3>
              <button
                className="btn-icon"
                onClick={() => setShowDeleteModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Tem certeza que deseja deletar a vigência do membro{' '}
                <strong>{getNomeMembro(vigenciaToDelete.membro_id)}</strong> de{' '}
                <strong>{formatarData(vigenciaToDelete.dt_vigencia)}</strong>?
              </p>
              <p className="warning-text">
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
              >
                <i className="fas fa-trash"></i>
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CustoMembroVigencia;

