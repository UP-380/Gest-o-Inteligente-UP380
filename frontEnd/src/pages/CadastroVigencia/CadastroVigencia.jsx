import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import VigenciaFormFields from '../../components/vigencia/VigenciaFormFields';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import { useVigenciaSubmit } from '../../hooks/useVigenciaSubmit';
import {
  removerFormatacaoMoeda,
  formatarValorParaInput
} from '../../utils/vigenciaUtils';
import './CadastroVigencia.css';

const API_BASE_URL = '/api';

const CadastroVigencia = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();

  // Obter parâmetros da query string
  const membroId = searchParams.get('membroId');
  const vigenciaId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [vigencia, setVigencia] = useState(null);
  const [colaborador, setColaborador] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    dt_vigencia: '',
    horascontratadasdia: '',
    salariobase: '',
    tipo_contrato: '',
    ajudacusto: '0',
    valetransporte: '0',
    vale_refeicao: '0',
    descricao: '',
    ferias: '0',
    terco_ferias: '0',
    decimoterceiro: '0',
    fgts: '0',
    custo_hora: '0'
  });
  const [formErrors, setFormErrors] = useState({});

  // Estados para tipos de contrato
  const [tiposContrato, setTiposContrato] = useState([]);
  const [loadingTiposContrato, setLoadingTiposContrato] = useState(false);

  // Estados para lista de colaboradores (apenas se não tiver membroId)
  const [colaboradores, setColaboradores] = useState([]);
  const [selectedMembroId, setSelectedMembroId] = useState(membroId ? parseInt(membroId, 10) : null);

  // Hook de submissão
  const { submitting, createVigencia, updateVigencia } = useVigenciaSubmit(
    API_BASE_URL,
    removerFormatacaoMoeda,
    () => {
      showToast('success', vigenciaId ? 'Vigência atualizada com sucesso!' : 'Vigência criada com sucesso!');
      // Navegar de volta
      if (membroId) {
        navigate(`/cadastro/colaborador?id=${membroId}`);
      } else if (vigencia && vigencia.membro_id) {
        navigate(`/cadastro/colaborador?id=${vigencia.membro_id}`);
      } else {
        navigate('/cadastro/colaboradores');
      }
    },
    (error) => {
      showToast('error', error || 'Erro ao salvar vigência');
    }
  );

  // Carregar tipos de contrato
  const loadTiposContrato = useCallback(async () => {
    setLoadingTiposContrato(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipos-contrato-membro?limit=1000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`Erro ao carregar tipos de contrato: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setTiposContrato(result.data || []);
      } else {
        throw new Error(result.error || 'Erro ao carregar tipos de contrato');
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de contrato:', error);
      setTiposContrato([]);
    } finally {
      setLoadingTiposContrato(false);
    }
  }, []);

  // Carregar colaboradores (apenas se não tiver membroId)
  const loadColaboradores = useCallback(async () => {
    if (membroId) return; // Se já tem membroId, não precisa carregar lista

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores?limit=1000`, {
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
        setColaboradores(result.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    }
  }, [membroId]);

  // Carregar colaborador (se tiver membroId)
  const loadColaborador = useCallback(async () => {
    if (!membroId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${membroId}`, {
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

      if (result.success && result.data) {
        setColaborador(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar colaborador:', error);
    }
  }, [membroId]);

  // Carregar dados da vigência (se tiver vigenciaId)
  const loadVigencia = useCallback(async () => {
    if (!vigenciaId) {
      // Se não tem vigenciaId, é uma nova vigência
      setLoading(false);
      setVigencia(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/${vigenciaId}`, {
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

      if (result.success && result.data) {
        const vigenciaData = result.data;
        setVigencia(vigenciaData);
        
        // Se não tinha membroId, usar o da vigência
        if (!membroId && vigenciaData.membro_id) {
          setSelectedMembroId(vigenciaData.membro_id);
          // Carregar dados do colaborador
          const colaboradorResponse = await fetch(`${API_BASE_URL}/colaboradores/${vigenciaData.membro_id}`, {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          });
          if (colaboradorResponse.ok) {
            const colaboradorResult = await colaboradorResponse.json();
            if (colaboradorResult.success && colaboradorResult.data) {
              setColaborador(colaboradorResult.data);
            }
          }
        }

        // Preencher formulário
        setFormData({
          dt_vigencia: vigenciaData.dt_vigencia || '',
          horascontratadasdia: vigenciaData.horascontratadasdia || '',
          salariobase: vigenciaData.salariobase ? formatarValorParaInput(vigenciaData.salariobase) : '',
          tipo_contrato: vigenciaData.tipo_contrato || '',
          ajudacusto: vigenciaData.ajudacusto || '0',
          valetransporte: vigenciaData.valetransporte || '0',
          vale_refeicao: vigenciaData.vale_refeicao || '0',
          descricao: vigenciaData.descricao || '',
          ferias: vigenciaData.ferias || '0',
          terco_ferias: vigenciaData.um_terco_ferias || '0',
          decimoterceiro: vigenciaData.decimoterceiro || '0',
          fgts: vigenciaData.fgts || '0',
          custo_hora: vigenciaData.custo_hora || '0'
        });
      } else {
        throw new Error(result.error || 'Vigência não encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar vigência:', error);
      showToast('error', error.message || 'Erro ao carregar vigência. Tente novamente.');
      navigate('/cadastro/colaboradores');
    } finally {
      setLoading(false);
    }
  }, [vigenciaId, membroId, navigate, showToast]);

  // Salvar vigência
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    const errors = {};
    if (!formData.dt_vigencia || !formData.dt_vigencia.trim()) {
      errors.dt_vigencia = 'Data de vigência é obrigatória';
    }

    const membroIdParaSalvar = selectedMembroId || membroId;
    if (!membroIdParaSalvar && !vigenciaId) {
      errors.membro_id = 'Colaborador é obrigatório';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    try {
      if (vigenciaId) {
        // Atualizar
        await updateVigencia(vigenciaId, formData);
      } else {
        // Criar
        await createVigencia(formData, membroIdParaSalvar);
      }
    } catch (error) {
      console.error('Erro ao salvar vigência:', error);
      showToast('error', error.message || 'Erro ao salvar vigência. Verifique sua conexão e tente novamente.');
    }
  };

  // Efeitos
  useEffect(() => {
    loadTiposContrato();
  }, [loadTiposContrato]);

  useEffect(() => {
    loadColaboradores();
  }, [loadColaboradores]);

  useEffect(() => {
    loadColaborador();
  }, [loadColaborador]);

  useEffect(() => {
    loadVigencia();
  }, [loadVigencia]);

  if (loading) {
    return (
      <Layout>
        <LoadingState message="Carregando vigência..." />
      </Layout>
    );
  }

  const isEdit = !!vigenciaId;
  const membroIdFinal = selectedMembroId || membroId;

  // Determinar para onde voltar
  const handleVoltar = () => {
    if (membroIdFinal) {
      navigate(`/cadastro/colaborador?id=${membroIdFinal}`);
    } else {
      navigate('/cadastro/colaboradores');
    }
  };

  return (
    <Layout>
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>
              {isEdit ? 'Editar Vigência' : 'Nova Vigência'}
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
              {colaborador && `Colaborador: ${colaborador.nome}`}
              {!colaborador && membroIdFinal && `Colaborador ID: ${membroIdFinal}`}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleVoltar}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fas fa-arrow-left"></i>
            Voltar
          </button>
        </div>

        <CardContainer>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '20px' }}>
              {/* Campo de seleção de colaborador (apenas para criar nova vigência sem membroId) */}
              {!isEdit && !membroId && colaboradores.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div className="form-row-vigencia">
                    <div className="form-group">
                      <label className="form-label-small">
                        Colaborador <span className="required">*</span>
                      </label>
                      <select
                        className={`form-input-small ${formErrors.membro_id ? 'error' : ''}`}
                        value={selectedMembroId || ''}
                        onChange={(e) => {
                          const colaboradorId = e.target.value ? parseInt(e.target.value, 10) : null;
                          setSelectedMembroId(colaboradorId);
                          if (formErrors.membro_id) {
                            setFormErrors({ ...formErrors, membro_id: '' });
                          }
                          // Carregar dados do colaborador selecionado
                          if (colaboradorId) {
                            const colaboradorSelecionado = colaboradores.find(c => c.id === colaboradorId);
                            if (colaboradorSelecionado) {
                              setColaborador(colaboradorSelecionado);
                            }
                          }
                        }}
                        disabled={submitting}
                        required
                      >
                        <option value="">Selecione um colaborador</option>
                        {colaboradores.map((colaborador) => (
                          <option key={colaborador.id} value={colaborador.id}>
                            {colaborador.nome || `Colaborador #${colaborador.id}`}
                            {colaborador.cpf ? ` (${colaborador.cpf})` : ''}
                          </option>
                        ))}
                      </select>
                      {formErrors.membro_id && (
                        <span className="error-message">{formErrors.membro_id}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mostrar colaborador como readonly se tiver membroId */}
              {membroId && colaborador && (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                  <label className="form-label-small" style={{ marginBottom: '4px', display: 'block' }}>
                    Colaborador
                  </label>
                  <div style={{ fontSize: '14px', color: '#333' }}>
                    {colaborador.nome}
                    {colaborador.cpf && ` (${colaborador.cpf})`}
                  </div>
                </div>
              )}

              <VigenciaFormFields
                formData={formData}
                setFormData={setFormData}
                formErrors={formErrors}
                setFormErrors={setFormErrors}
                tiposContrato={tiposContrato}
                loadingTiposContrato={loadingTiposContrato}
                submitting={submitting}
                formatarValorParaInput={formatarValorParaInput}
                removerFormatacaoMoeda={removerFormatacaoMoeda}
              />

              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleVoltar}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <ButtonPrimary
                  type="submit"
                  disabled={submitting}
                  icon={submitting ? 'fa-spinner fa-spin' : 'fa-save'}
                >
                  {submitting ? 'Salvando...' : (isEdit ? 'Salvar Alterações' : 'Salvar Vigência')}
                </ButtonPrimary>
              </div>
            </div>
          </form>
        </CardContainer>
      </div>
    </Layout>
  );
};

export default CadastroVigencia;

