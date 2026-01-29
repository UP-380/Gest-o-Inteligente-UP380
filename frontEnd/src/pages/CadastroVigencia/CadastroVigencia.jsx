import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import VigenciaFormFields from '../../components/vigencia/VigenciaFormFields';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import Avatar from '../../components/user/Avatar';
import { useToast } from '../../hooks/useToast';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useVigenciaSubmit } from '../../hooks/useVigenciaSubmit';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useVigenciaCalculations } from '../../hooks/useVigenciaCalculations';
import {
  removerFormatacaoMoeda,
  formatarValorParaInput
} from '../../utils/vigenciaUtils';
import { calcularVigencia } from '../../utils/calcularVigencia';
import './CadastroVigencia.css';
import '../CadastroCliente/CadastroCliente.css';

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
    custo_hora: '0',
    custo_total_mensal: '0',
    custo_diario_total: '0'
  });
  const [formErrors, setFormErrors] = useState({});

  // Estados para tipos de contrato
  const [tiposContrato, setTiposContrato] = useState([]);
  const [loadingTiposContrato, setLoadingTiposContrato] = useState(false);

  // Estados para lista de colaboradores (apenas se não tiver membroId)
  const [colaboradores, setColaboradores] = useState([]);
  const [selectedMembroId, setSelectedMembroId] = useState(membroId ? parseInt(membroId, 10) : null);

  // Estado inicial do formulário para detectar mudanças
  const [initialFormData, setInitialFormData] = useState(null);
  
  // Estado para controlar o modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Estado para controlar o modal de confirmação da busca de custo colaborador
  const [showConfirmBuscarModal, setShowConfirmBuscarModal] = useState(false);

  // Hook de submissão
  const { submitting, createVigencia, updateVigencia } = useVigenciaSubmit(
    API_BASE_URL,
    removerFormatacaoMoeda,
    () => {
      showToast('success', vigenciaId ? 'Vigência atualizada com sucesso!' : 'Vigência criada com sucesso!');
      // Atualizar estado inicial para remover aviso de mudanças não salvas
      setInitialFormData(JSON.parse(JSON.stringify(formData)));
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

  // Hook para cálculos automáticos de vigência (custo total mensal, etc)
  // IMPORTANTE: Em modo de edição (vigenciaId existe), desabilitar cálculos automáticos
  // para não sobrescrever os valores que vêm do banco (custo_membro_vigencia)
  const isEditMode = !!vigenciaId;
  useVigenciaCalculations(
    formData,
    setFormData,
    formatarValorParaInput,
    removerFormatacaoMoeda,
    300,
    tiposContrato,
    isEditMode // Desabilitar cálculos automáticos em modo de edição
  );
  
  // Detectar se há mudanças não salvas (após submitting ser declarado)
  const hasUnsavedChanges = initialFormData && JSON.stringify(formData) !== JSON.stringify(initialFormData);

  // Aviso ao sair com dados não salvos
  useUnsavedChanges(hasUnsavedChanges && !submitting);

  // Ref para controlar se já carregou os tipos de contrato
  const tiposContratoCarregadosRef = useRef(false);
  
  // Ref para controlar se já preencheu automaticamente para evitar múltiplos preenchimentos
  const configPreenchidaRef = useRef(false);
  
  // Estado para armazenar dias úteis da configuração
  const [diasUteisConfig, setDiasUteisConfig] = useState(22); // Padrão: 22 dias
  
  // Estado para rastrear quais campos foram preenchidos automaticamente
  const [camposPreenchidosAuto, setCamposPreenchidosAuto] = useState(new Set());
  
  // Estado para armazenar a configuração atual (para restaurar valores padrão)
  const [configAtual, setConfigAtual] = useState(null);
  
  // Estado para controlar o loading da busca de custo colaborador
  const [buscandoCustoColaborador, setBuscandoCustoColaborador] = useState(false);

  // Carregar tipos de contrato
  const loadTiposContrato = useCallback(async () => {
    // Se já tem tipos carregados, não recarregar
    if (tiposContratoCarregadosRef.current) {
      return;
    }

    setLoadingTiposContrato(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-contrato-membro?limit=1000`, {
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
      if (result.success && result.data && Array.isArray(result.data)) {
        // Garantir que os dados sejam um array válido
        setTiposContrato(result.data);
        tiposContratoCarregadosRef.current = true;
      } else {
        throw new Error(result.error || 'Erro ao carregar tipos de contrato');
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de contrato:', error);
      setTiposContrato([]);
      showToast('error', 'Erro ao carregar tipos de contrato. Tente recarregar a página.');
    } finally {
      setLoadingTiposContrato(false);
    }
  }, [showToast]);

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

  // ============================================================================
  // IMPORTANTE: Carregar dados EXCLUSIVAMENTE de custo_membro_vigencia
  // ============================================================================
  // Esta função carrega dados APENAS da tabela custo_membro_vigencia.
  // NÃO busca dados de config_custo_membro automaticamente.
  // A busca de config_custo_membro só ocorre quando o usuário clica no botão.
  // ============================================================================
  const loadVigencia = useCallback(async () => {
    if (!vigenciaId) {
      // Se não tem vigenciaId, é uma nova vigência
      setLoading(false);
      setVigencia(null);
      const formDataInicial = {
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
        custo_hora: '0',
        custo_total_mensal: '0',
        custo_diario_total: '0'
      };
      setFormData(formDataInicial);
      setInitialFormData(JSON.parse(JSON.stringify(formDataInicial)));
      return;
    }

    setLoading(true);
    try {
      // Buscar dados EXCLUSIVAMENTE de custo_membro_vigencia
      // Endpoint: GET /api/custo-colaborador-vigencia/${vigenciaId}
      // Retorna dados da tabela custo_membro_vigencia
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
        
        // Log de debug: confirmar que os dados vêm de custo_membro_vigencia
        console.log('📊 [loadVigencia] Dados carregados EXCLUSIVAMENTE de custo_membro_vigencia:', {
          id: vigenciaData.id,
          dt_vigencia: vigenciaData.dt_vigencia,
          salariobase: vigenciaData.salariobase,
          tipo_contrato: vigenciaData.tipo_contrato,
          ajudacusto: vigenciaData.ajudacusto,
          valetransporte: vigenciaData.valetransporte,
          vale_refeicao: vigenciaData.vale_refeicao,
          ferias: vigenciaData.ferias,
          um_terco_ferias: vigenciaData.um_terco_ferias,
          decimoterceiro: vigenciaData.decimoterceiro,
          fgts: vigenciaData.fgts,
          custo_hora: vigenciaData.custo_hora,
          membro_id: vigenciaData.membro_id
        });
        
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

        // ========================================================================
        // Preencher formulário APENAS com dados de custo_membro_vigencia
        // ========================================================================
        // IMPORTANTE: Todos os valores vêm diretamente da tabela custo_membro_vigencia
        // NÃO há busca de config_custo_membro aqui
        // Campos mapeados diretamente do banco:
        // - dt_vigencia, horascontratadasdia, salariobase, tipo_contrato
        // - ajudacusto, valetransporte, vale_refeicao, descricao
        // - ferias, um_terco_ferias (mapeado para terco_ferias), decimoterceiro, fgts
        // - custo_hora
        // ========================================================================
        const formDataInicial = {
          dt_vigencia: vigenciaData.dt_vigencia || '',
          horascontratadasdia: vigenciaData.horascontratadasdia || '',
          salariobase: vigenciaData.salariobase ? formatarValorParaInput(vigenciaData.salariobase) : '',
          tipo_contrato: vigenciaData.tipo_contrato || '',
          diasuteis: vigenciaData.diasuteis || vigenciaData.dias_uteis || '',
          ajudacusto: vigenciaData.ajudacusto ? formatarValorParaInput(vigenciaData.ajudacusto) : '0',
          valetransporte: vigenciaData.valetransporte ? (() => {
            const valorOriginal = vigenciaData.valetransporte;
            const valorFormatado = formatarValorParaInput(valorOriginal);
            console.log('🔍 [loadVigencia] Vale Transporte - Original:', valorOriginal, 'Tipo:', typeof valorOriginal, 'Formatado:', valorFormatado);
            return valorFormatado;
          })() : '0',
          vale_refeicao: vigenciaData.vale_refeicao ? formatarValorParaInput(vigenciaData.vale_refeicao) : '0',
          descricao: vigenciaData.descricao || '',
          ferias: vigenciaData.ferias ? formatarValorParaInput(vigenciaData.ferias) : '0',
          // Campo um_terco_ferias do banco mapeado para terco_ferias no formulário
          terco_ferias: vigenciaData.um_terco_ferias ? formatarValorParaInput(vigenciaData.um_terco_ferias) : '0',
          decimoterceiro: vigenciaData.decimoterceiro ? formatarValorParaInput(vigenciaData.decimoterceiro) : '0',
          fgts: vigenciaData.fgts ? formatarValorParaInput(vigenciaData.fgts) : '0',
          custo_hora: vigenciaData.custo_hora ? formatarValorParaInput(vigenciaData.custo_hora) : '0',
          custo_total_mensal: '0', // Será calculado abaixo
          custo_diario_total: '0' // Será calculado abaixo
        };
        
        // ========================================================================
        // Calcular custo_diario_total e custo_total_mensal imediatamente
        // ========================================================================
        // Isso garante que os valores sejam calculados corretamente ao carregar
        // a vigência, mesmo em modo de edição
        // ========================================================================
        const salarioBaseMensal = parseFloat(removerFormatacaoMoeda(formDataInicial.salariobase || '0')) || 0;
        const feriasDiaria = parseFloat(removerFormatacaoMoeda(formDataInicial.ferias || '0')) || 0;
        const tercoFeriasDiaria = parseFloat(removerFormatacaoMoeda(formDataInicial.terco_ferias || '0')) || 0;
        const decimoTerceiroDiaria = parseFloat(removerFormatacaoMoeda(formDataInicial.decimoterceiro || '0')) || 0;
        const fgtsDiaria = parseFloat(removerFormatacaoMoeda(formDataInicial.fgts || '0')) || 0;
        const valeTransporteDiaria = parseFloat(removerFormatacaoMoeda(formDataInicial.valetransporte || '0')) || 0;
        const valeRefeicaoDiaria = parseFloat(removerFormatacaoMoeda(formDataInicial.vale_refeicao || '0')) || 0;
        const ajudaCustoDiaria = parseFloat(removerFormatacaoMoeda(formDataInicial.ajudacusto || '0')) || 0;
        
        // Buscar dias úteis da vigência ou usar padrão
        // Primeiro tentar buscar da própria vigência (se tiver campo dias_uteis ou diasuteis)
        // Se não tiver, usar 22 como padrão
        let diasUteis = 22;
        if (vigenciaData.dias_uteis) {
          diasUteis = parseFloat(vigenciaData.dias_uteis) || 22;
        } else if (vigenciaData.diasuteis) {
          diasUteis = parseFloat(vigenciaData.diasuteis) || 22;
        }
        
        // IMPORTANTE: Garantir que o campo diasuteis do formulário tenha o valor correto
        // Isso garante que quando clicar no botão, use o mesmo valor
        if (!formDataInicial.diasuteis || formDataInicial.diasuteis === '') {
          formDataInicial.diasuteis = String(diasUteis);
        }
        
        // Armazenar dias úteis no estado para uso posterior
        setDiasUteisConfig(diasUteis);
        
        // Calcular salário base diário
        const salarioBaseDiario = diasUteis > 0 ? salarioBaseMensal / diasUteis : 0;
        
        // Calcular custo diário total
        const custoDiarioTotal = salarioBaseDiario +
                                 feriasDiaria +
                                 tercoFeriasDiaria +
                                 decimoTerceiroDiaria +
                                 fgtsDiaria +
                                 valeTransporteDiaria +
                                 valeRefeicaoDiaria +
                                 ajudaCustoDiaria;
        
        // Calcular custo total mensal
        const custoTotalMensal = custoDiarioTotal * diasUteis;
        
        // Atualizar os campos calculados
        formDataInicial.custo_diario_total = formatarValorParaInput(custoDiarioTotal);
        formDataInicial.custo_total_mensal = formatarValorParaInput(custoTotalMensal);
        
        console.log('✅ [loadVigencia] FormData inicial preenchido com dados de custo_membro_vigencia:', formDataInicial);
        console.log('✅ [loadVigencia] Valores calculados:', {
          custoDiarioTotal,
          custoTotalMensal,
          diasUteis,
          salarioBaseMensal,
          salarioBaseDiario,
          componentesDiarios: {
            salarioBaseDiario,
            feriasDiaria,
            tercoFeriasDiaria,
            decimoTerceiroDiaria,
            fgtsDiaria,
            valeTransporteDiaria,
            valeRefeicaoDiaria,
            ajudaCustoDiaria
          }
        });
        
        setFormData(formDataInicial);
        setInitialFormData(JSON.parse(JSON.stringify(formDataInicial)));
        
        // ========================================================================
        // Limpar configuração padrão para garantir que não apareça mensagem
        // de "valores preenchidos automaticamente"
        // ========================================================================
        setConfigAtual(null);
        setCamposPreenchidosAuto(new Set());
        
        console.log('✅ [loadVigencia] ConfigAtual e camposPreenchidosAuto limpos - dados vêm apenas de custo_membro_vigencia');
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

  // Função auxiliar para preencher campos com valores da configuração
  const preencherCamposComConfig = useCallback((formDataAtual, config) => {
    const novosDados = { ...formDataAtual };
    
    // Preencher ajuda de custo (se não estiver preenchido)
    // Ajuda de custo é um valor fixo, não um percentual
    if ((!novosDados.ajudacusto || novosDados.ajudacusto === '0') && config.ajuda_custo) {
      novosDados.ajudacusto = formatarValorParaInput(config.ajuda_custo);
    }
    
    // Preencher vale transporte (se não estiver preenchido)
    // Vale transporte é um valor fixo por dia, não um percentual
    if ((!novosDados.valetransporte || novosDados.valetransporte === '0') && config.vale_transporte) {
      novosDados.valetransporte = formatarValorParaInput(config.vale_transporte);
    }
    
    // Preencher vale refeição (se não estiver preenchido)
    // Vale refeição é um valor fixo por dia, não um percentual
    if ((!novosDados.vale_refeicao || novosDados.vale_refeicao === '0') && config.vale_alimentacao) {
      novosDados.vale_refeicao = formatarValorParaInput(config.vale_alimentacao);
    }
    
    // IMPORTANTE: NÃO preencher percentuais diretamente nos campos!
    // Os campos ferias, terco_ferias, decimoterceiro e fgts devem ser calculados
    // usando calcularVigencia, que faz a divisão por 12 corretamente.
    // Os valores da config são PERCENTUAIS, não valores diários calculados.
    // 
    // Se preenchermos os percentuais diretamente, o cálculo do custo_total_mensal
    // vai multiplicar esses percentuais por dias úteis, o que está ERRADO.
    // 
    // Exemplo ERRADO:
    // - config.ferias = 100 (100%)
    // - Se colocarmos 100 no campo ferias
    // - custo_total_mensal vai fazer: 100 * 22 dias = 2.200 (ERRADO!)
    //
    // Exemplo CORRETO:
    // - config.ferias = 100 (100%)
    // - calcularVigencia calcula: feriasAnual = salario, feriasMensal = salario/12, ferias = feriasMensal/diasUteis
    // - Se salario = 3000 e diasUteis = 22: ferias = (3000/12)/22 = 11,36 (CORRETO!)
    // - custo_total_mensal faz: 11,36 * 22 = 250 (provisão mensal correta)
    //
    // Portanto, NÃO preencher esses campos aqui. Eles serão calculados pelo useVigenciaCalculations
    // quando o salário base for informado.
    
    return novosDados;
  }, [formatarValorParaInput]);

  // ============================================================================
  // Função para buscar configuração de custo colaborador (config_custo_membro)
  // ============================================================================
  // IMPORTANTE: Esta função NÃO é chamada automaticamente.
  // Ela só é chamada quando o usuário clica no botão de buscar.
  // Não há nenhum useEffect ou outra lógica que chame esta função automaticamente.
  // ============================================================================
  const buscarConfigCustoColaborador = useCallback(async (dataVigencia, tipoContrato) => {
    // Validar que tipo_contrato está presente e é válido
    if (!tipoContrato || tipoContrato === '' || tipoContrato === 'null' || tipoContrato === 'undefined') {
      console.warn('Busca de configuração: tipo_contrato não fornecido ou inválido', { tipoContrato });
      return null;
    }

    // Validar que tipo_contrato é um número válido
    const tipoContratoNum = parseInt(tipoContrato, 10);
    if (isNaN(tipoContratoNum)) {
      console.warn('Busca de configuração: tipo_contrato não é um número válido', { tipoContrato });
      return null;
    }

    // Garantir que sempre tenha data_vigencia (usar data atual se não tiver)
    let dataParaBusca = dataVigencia;
    if (!dataParaBusca || dataParaBusca === '') {
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const dia = String(hoje.getDate()).padStart(2, '0');
      dataParaBusca = `${ano}-${mes}-${dia}`;
      console.log('Busca de configuração: usando data atual como fallback', { dataParaBusca });
    }

    try {
      // Formatar data para YYYY-MM-DD
      let dataFormatada = dataParaBusca;
      let conversaoBemSucedida = true;

      if (dataParaBusca.includes('T')) {
        dataFormatada = dataParaBusca.split('T')[0];
      } else if (dataParaBusca.includes('/')) {
        // Se estiver no formato DD/MM/YYYY, converter para YYYY-MM-DD
        const partes = dataParaBusca.split('/');
        if (partes.length === 3) {
          const dia = partes[0].padStart(2, '0');
          const mes = partes[1].padStart(2, '0');
          const ano = partes[2];
          // Validar se a conversão foi bem-sucedida
          if (dia && mes && ano && ano.length === 4) {
            dataFormatada = `${ano}-${mes}-${dia}`;
          } else {
            conversaoBemSucedida = false;
          }
        } else {
          conversaoBemSucedida = false;
        }
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dataParaBusca)) {
        // Se não está em nenhum formato conhecido e não está em YYYY-MM-DD
        conversaoBemSucedida = false;
      }

      // Validar se a formatação foi bem-sucedida
      if (!conversaoBemSucedida || !/^\d{4}-\d{2}-\d{2}$/.test(dataFormatada)) {
        console.error('Busca de configuração: formato de data inválido após conversão', {
          dataOriginal: dataParaBusca,
          dataFormatada
        });
        return null;
      }

      // Log detalhado do que está sendo buscado
      console.log('Buscando configuração vigente:', {
        data_vigencia: dataFormatada,
        tipo_contrato: tipoContratoNum,
        url: `${API_BASE_URL}/config-custo-colaborador/mais-recente?data_vigencia=${dataFormatada}&tipo_contrato=${tipoContratoNum}`
      });

      const url = `${API_BASE_URL}/config-custo-colaborador/mais-recente?data_vigencia=${dataFormatada}&tipo_contrato=${tipoContratoNum}`;
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        console.warn('Busca de configuração: não autorizado, redirecionando para login');
        window.location.href = '/login';
        return null;
      }

      // Melhorar tratamento de erros: diferenciar tipos de erro
      if (!response.ok) {
        const errorText = await response.text();
        let errorData = null;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Se não conseguir parsear, usar o texto como erro
        }

        console.error('Erro ao buscar configuração vigente:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData || errorText,
          data_vigencia: dataFormatada,
          tipo_contrato: tipoContratoNum
        });

        // Retornar null para erros 400, 404, 500 (não há configuração ou erro no servidor)
        return null;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('Configuração vigente encontrada:', {
          id: result.data.id,
          vigencia: result.data.vigencia,
          tipo_contrato: result.data.tipo_contrato
        });
        return result.data;
      }
      
      console.log('Nenhuma configuração vigente encontrada para:', {
        data_vigencia: dataFormatada,
        tipo_contrato: tipoContratoNum
      });
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar configuração de custo colaborador:', error, {
        dataVigencia: dataParaBusca,
        tipoContrato: tipoContratoNum
      });
      return null;
    }
  }, []);

  // ============================================================================
  // Função para buscar e preencher custo colaborador MANUALMENTE
  // ============================================================================
  // IMPORTANTE: Esta função só é chamada quando o usuário clica no botão.
  // Ela busca dados de config_custo_membro e preenche os campos.
  // NÃO é chamada automaticamente em nenhum momento.
  // ============================================================================
  const handleBuscarCustoColaborador = useCallback(async () => {
    console.log('🔍 [handleBuscarCustoColaborador] Busca MANUAL de config_custo_membro iniciada');
    
    // Validar que tipo de contrato está selecionado
    if (!formData.tipo_contrato) {
      showToast('warning', 'Por favor, selecione um tipo de contrato antes de buscar as informações.');
      return null;
    }

    setBuscandoCustoColaborador(true);

    try {
      // Usar data de vigência se disponível, senão usar data atual
      let dataParaBusca = formData.dt_vigencia;
      if (!dataParaBusca) {
        // Se não tiver vigência, usar data atual
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        dataParaBusca = `${ano}-${mes}-${dia}`;
      }

      // Limpar campos relacionados à configuração antes de buscar novas configurações
      // Isso garante que campos antigos não permaneçam quando buscar novamente
      const dadosLimpos = {
        ...formData,
        ajudacusto: '0',
        valetransporte: '0',
        vale_refeicao: '0',
        ferias: '0',
        terco_ferias: '0',
        decimoterceiro: '0',
        fgts: '0'
      };

      console.log('🔍 [handleBuscarCustoColaborador] Buscando config_custo_membro para:', {
        dataParaBusca,
        tipo_contrato: formData.tipo_contrato
      });
      
      const config = await buscarConfigCustoColaborador(dataParaBusca, formData.tipo_contrato);
      
      if (config) {
        console.log('✅ [handleBuscarCustoColaborador] Config_custo_membro encontrada:', config);
        
        // Armazenar dias úteis da configuração
        if (config.dias_uteis) {
          setDiasUteisConfig(config.dias_uteis);
        }
        
        // Armazenar configuração atual para poder restaurar depois
        setConfigAtual(config);
        
        // Preencher campos com valores FIXOS da configuração (ajuda_custo, vale_transporte, vale_refeicao)
        // IMPORTANTE: Não preencher percentuais (ferias, terco_ferias, decimoterceiro, fgts) aqui!
        // Esses serão calculados pelo useVigenciaCalculations usando calcularVigencia
        const novosDados = preencherCamposComConfig(dadosLimpos, config);
        
        // Agora calcular os valores de férias, 1/3 férias, 13º e FGTS usando calcularVigencia
        // Isso garante que os valores sejam calculados corretamente (com divisão por 12)
        if (novosDados.salariobase && parseFloat(removerFormatacaoMoeda(novosDados.salariobase)) > 0) {
          try {
            // IMPORTANTE: Usar dias úteis do formulário se disponível, senão usar da config
            // Isso garante consistência com o valor que está sendo usado na vigência
            let diasUteisVigencia = 22;
            if (novosDados.diasuteis && parseFloat(novosDados.diasuteis) > 0) {
              diasUteisVigencia = parseFloat(novosDados.diasuteis);
            } else if (config.dias_uteis) {
              diasUteisVigencia = config.dias_uteis;
            }
            
            // Atualizar dias úteis no estado e no formulário
            setDiasUteisConfig(diasUteisVigencia);
            if (!novosDados.diasuteis || novosDados.diasuteis === '') {
              novosDados.diasuteis = String(diasUteisVigencia);
            }
            
            const horasContratadasDia = novosDados.horascontratadasdia ? parseFloat(novosDados.horascontratadasdia) : null;
            
            console.log('🔄 [handleBuscarCustoColaborador] Calculando benefícios com calcularVigencia...', {
              salarioBase: novosDados.salariobase,
              dataVigencia: dataParaBusca,
              diasUteis: diasUteisVigencia,
              tipoContrato: formData.tipo_contrato
            });
            
            const beneficios = await calcularVigencia(
              novosDados.salariobase,
              dataParaBusca,
              diasUteisVigencia,
              horasContratadasDia,
              formData.tipo_contrato
            );
            
            console.log('✅ [handleBuscarCustoColaborador] Benefícios calculados:', beneficios);
            
            // Preencher os campos calculados (valores diários corretos)
            novosDados.ferias = formatarValorParaInput(beneficios.ferias);
            novosDados.terco_ferias = formatarValorParaInput(beneficios.terco_ferias);
            novosDados.decimoterceiro = formatarValorParaInput(beneficios.decimoterceiro);
            novosDados.fgts = formatarValorParaInput(beneficios.fgts);
            novosDados.custo_hora = formatarValorParaInput(beneficios.custo_hora);
            
            // IMPORTANTE: NÃO usar custo_total_mensal de calcularVigencia diretamente
            // porque calcularVigencia NÃO inclui ajuda de custo no cálculo.
            // Vamos recalcular incluindo ajuda de custo para manter consistência
            // com o cálculo usado no loadVigencia e no useEffect.
            const salarioBaseMensal = parseFloat(removerFormatacaoMoeda(novosDados.salariobase || '0')) || 0;
            const feriasDiaria = parseFloat(removerFormatacaoMoeda(novosDados.ferias || '0')) || 0;
            const tercoFeriasDiaria = parseFloat(removerFormatacaoMoeda(novosDados.terco_ferias || '0')) || 0;
            const decimoTerceiroDiaria = parseFloat(removerFormatacaoMoeda(novosDados.decimoterceiro || '0')) || 0;
            const fgtsDiaria = parseFloat(removerFormatacaoMoeda(novosDados.fgts || '0')) || 0;
            const valeTransporteDiaria = parseFloat(removerFormatacaoMoeda(novosDados.valetransporte || '0')) || 0;
            const valeRefeicaoDiaria = parseFloat(removerFormatacaoMoeda(novosDados.vale_refeicao || '0')) || 0;
            const ajudaCustoDiaria = parseFloat(removerFormatacaoMoeda(novosDados.ajudacusto || '0')) || 0;
            
            // Calcular custo diário total (incluindo ajuda de custo)
            const salarioBaseDiario = diasUteisVigencia > 0 ? salarioBaseMensal / diasUteisVigencia : 0;
            const custoDiarioTotal = salarioBaseDiario +
                                     feriasDiaria +
                                     tercoFeriasDiaria +
                                     decimoTerceiroDiaria +
                                     fgtsDiaria +
                                     valeTransporteDiaria +
                                     valeRefeicaoDiaria +
                                     ajudaCustoDiaria;
            
            // Calcular custo total mensal (incluindo ajuda de custo)
            const custoTotalMensal = custoDiarioTotal * diasUteisVigencia;
            
            novosDados.custo_total_mensal = formatarValorParaInput(custoTotalMensal);
            novosDados.custo_diario_total = formatarValorParaInput(custoDiarioTotal);
            
            console.log('✅ [handleBuscarCustoColaborador] Custo recalculado incluindo ajuda de custo:', {
              custoDiarioTotal,
              custoTotalMensal,
              ajudaCustoDiaria,
              diasUteisVigencia,
              componentesDiarios: {
                salarioBaseDiario,
                feriasDiaria,
                tercoFeriasDiaria,
                decimoTerceiroDiaria,
                fgtsDiaria,
                valeTransporteDiaria,
                valeRefeicaoDiaria,
                ajudaCustoDiaria
              }
            });
          } catch (error) {
            console.error('❌ [handleBuscarCustoColaborador] Erro ao calcular benefícios:', error);
            // Continuar mesmo com erro, os valores serão calculados depois pelo useVigenciaCalculations
          }
        }
        
        setFormData(novosDados);
        
        // Rastrear quais campos foram preenchidos automaticamente
        const camposAuto = new Set();
        if (config.ajuda_custo) camposAuto.add('ajudacusto');
        if (config.vale_transporte) camposAuto.add('valetransporte');
        if (config.vale_refeicao) camposAuto.add('vale_refeicao');
        // Agora também marcar os campos calculados
        if (novosDados.ferias && novosDados.ferias !== '0') camposAuto.add('ferias');
        if (novosDados.terco_ferias && novosDados.terco_ferias !== '0') camposAuto.add('terco_ferias');
        if (novosDados.decimoterceiro && novosDados.decimoterceiro !== '0') camposAuto.add('decimoterceiro');
        if (novosDados.fgts && novosDados.fgts !== '0') camposAuto.add('fgts');
        setCamposPreenchidosAuto(camposAuto);
        
        console.log('✅ [handleBuscarCustoColaborador] Campos preenchidos de config_custo_membro:', Array.from(camposAuto));
        
        showToast('success', 'Configuração de custo colaborador carregada com sucesso. Você pode personalizar os valores conforme necessário.');
        return novosDados;
      } else {
        // Se não encontrou configuração, NÃO fazer nenhuma alteração
        // Apenas mostrar aviso e retornar sem modificar os dados
        console.log('⚠️ [handleBuscarCustoColaborador] Nenhuma configuração encontrada - mantendo dados atuais sem alteração');
        showToast('warning', 'Nenhuma configuração de custo encontrada para este tipo de contrato e vigência, por tanto nenhum calculo foi alterado');
        return null;
      }
    } catch (error) {
      console.error('Erro ao buscar custo colaborador:', error);
      showToast('error', 'Erro ao buscar informações do custo colaborador. Tente novamente.');
      return null;
    } finally {
      setBuscandoCustoColaborador(false);
    }
  }, [formData, buscarConfigCustoColaborador, preencherCamposComConfig, showToast]);

  // Calcular Custo Diário Total (soma de todos os valores diários)
  // IMPORTANTE: Todos os campos EXCETO o salário base já são diários
  // - Salário Base: é mensal, precisa converter para diário (dividir por dias úteis)
  // - Férias, 1/3 Férias, 13º Salário, FGTS: já são "média diária"
  // - Vale Transporte, Vale Refeição, Ajuda de Custo: já são por dia
  useEffect(() => {
    const calcularCustoDiarioTotal = () => {
      // removerFormatacaoMoeda retorna string no formato "1234.56" (já convertido)
      // Então precisamos apenas fazer parseFloat, NÃO dividir por 100
      const salarioBaseMensal = parseFloat(removerFormatacaoMoeda(formData.salariobase || '0')) || 0;
      
      // Todos os outros campos já são diários (não precisam conversão)
      const ferias = parseFloat(removerFormatacaoMoeda(formData.ferias || '0')) || 0; // já é diário
      const tercoFerias = parseFloat(removerFormatacaoMoeda(formData.terco_ferias || '0')) || 0; // já é diário
      const decimoTerceiro = parseFloat(removerFormatacaoMoeda(formData.decimoterceiro || '0')) || 0; // já é diário
      const fgts = parseFloat(removerFormatacaoMoeda(formData.fgts || '0')) || 0; // já é diário
      const valeTransporte = parseFloat(removerFormatacaoMoeda(formData.valetransporte || '0')) || 0; // já é diário
      const valeRefeicao = parseFloat(removerFormatacaoMoeda(formData.vale_refeicao || '0')) || 0; // já é diário
      const ajudaCusto = parseFloat(removerFormatacaoMoeda(formData.ajudacusto || '0')) || 0; // já é diário

      // Calcular salário base diário (converter de mensal para diário)
      // Usar dias úteis da configuração (armazenado no estado) ou 22 como padrão
      const diasUteis = diasUteisConfig || 22;
      const salarioBaseDiario = diasUteis > 0 ? salarioBaseMensal / diasUteis : 0;

      // Somar todos os valores diários
      // Salário Base Diário + todos os outros custos que já são diários
      const custoDiarioTotal = salarioBaseDiario +
                               ferias +
                               tercoFerias +
                               decimoTerceiro +
                               fgts +
                               valeTransporte +
                               valeRefeicao +
                               ajudaCusto;


      // Atualizar o campo custo_diario_total
      const custoDiarioTotalFormatado = formatarValorParaInput(custoDiarioTotal);
      if (formData.custo_diario_total !== custoDiarioTotalFormatado) {
        setFormData(prev => ({
          ...prev,
          custo_diario_total: custoDiarioTotalFormatado
        }));
      }
    };

    calcularCustoDiarioTotal();
  }, [
    formData.salariobase,
    formData.ferias,
    formData.terco_ferias,
    formData.decimoterceiro,
    formData.fgts,
    formData.valetransporte,
    formData.vale_refeicao,
    formData.ajudacusto,
    formData.tipo_contrato,
    formData.dt_vigencia,
    diasUteisConfig,
    formatarValorParaInput,
    removerFormatacaoMoeda
  ]);

  // Calcular Custo Total Mensal (soma de todos os valores mensais)
  // IMPORTANTE: Este cálculo deve refletir qualquer edição manual nos campos
  // - Salário Base: já é mensal
  // - Férias, 1/3 Férias, 13º Salário, FGTS: são diários, converter para mensal (× dias úteis)
  // - Vale Transporte, Vale Refeição, Ajuda de Custo: são diários, converter para mensal (× dias úteis)
  useEffect(() => {
    const calcularCustoTotalMensal = () => {
      // Converter todos os valores para número
      const salarioBaseMensal = parseFloat(removerFormatacaoMoeda(formData.salariobase || '0')) || 0;
      
      // Todos os outros campos são diários, precisam converter para mensal
      const feriasDiaria = parseFloat(removerFormatacaoMoeda(formData.ferias || '0')) || 0;
      const tercoFeriasDiaria = parseFloat(removerFormatacaoMoeda(formData.terco_ferias || '0')) || 0;
      const decimoTerceiroDiaria = parseFloat(removerFormatacaoMoeda(formData.decimoterceiro || '0')) || 0;
      const fgtsDiaria = parseFloat(removerFormatacaoMoeda(formData.fgts || '0')) || 0;
      const valeTransporteDiaria = parseFloat(removerFormatacaoMoeda(formData.valetransporte || '0')) || 0;
      const valeRefeicaoDiaria = parseFloat(removerFormatacaoMoeda(formData.vale_refeicao || '0')) || 0;
      const ajudaCustoDiaria = parseFloat(removerFormatacaoMoeda(formData.ajudacusto || '0')) || 0;

      // Usar dias úteis da configuração (armazenado no estado) ou 22 como padrão
      const diasUteis = diasUteisConfig || 22;

      // Converter valores diários para mensais (multiplicar por dias úteis)
      const feriasMensal = feriasDiaria * diasUteis;
      const tercoFeriasMensal = tercoFeriasDiaria * diasUteis;
      const decimoTerceiroMensal = decimoTerceiroDiaria * diasUteis;
      const fgtsMensal = fgtsDiaria * diasUteis;
      const valeTransporteMensal = valeTransporteDiaria * diasUteis;
      const valeRefeicaoMensal = valeRefeicaoDiaria * diasUteis;
      const ajudaCustoMensal = ajudaCustoDiaria * diasUteis;


      // ========================================================================
      // IMPORTANTE: Calcular custo_total_mensal a partir do custo_diario_total
      // ========================================================================
      // Em vez de converter cada valor diário para mensal (que acumula erros de arredondamento),
      // vamos calcular o custo_total_mensal diretamente a partir do custo_diario_total.
      // Isso garante consistência: custo_total_mensal = custo_diario_total × dias_uteis
      // ========================================================================
      
      // Primeiro, calcular o custo_diario_total (se ainda não foi calculado)
      const salarioBaseDiario = diasUteis > 0 ? salarioBaseMensal / diasUteis : 0;
      const custoDiarioTotal = salarioBaseDiario +
                               feriasDiaria +
                               tercoFeriasDiaria +
                               decimoTerceiroDiaria +
                               fgtsDiaria +
                               valeTransporteDiaria +
                               valeRefeicaoDiaria +
                               ajudaCustoDiaria;

      // Calcular custo_total_mensal a partir do custo_diario_total
      // Isso garante que: custo_total_mensal = custo_diario_total × dias_uteis
      const custoTotalMensal = custoDiarioTotal * diasUteis;

      // Calcular Custo Hora
      // Custo Hora = Custo Total Mensal / (jornada mensal em horas)
      // Jornada mensal = horas por dia × dias úteis
      let custoHora = 0;
      const horasContratadasDia = parseFloat(formData.horascontratadasdia || '0') || 0;
      if (horasContratadasDia > 0 && diasUteis > 0) {
        const jornadaMensalHoras = horasContratadasDia * diasUteis;
        if (jornadaMensalHoras > 0) {
          custoHora = custoTotalMensal / jornadaMensalHoras;
          custoHora = Math.round(custoHora * 100) / 100; // Arredondar para 2 casas decimais
        }
      }

      // Atualizar os campos calculados
      const custoTotalMensalFormatado = formatarValorParaInput(custoTotalMensal);
      const custoHoraFormatado = formatarValorParaInput(custoHora);
      
      // Atualizar apenas se os valores mudaram
      const updates = {};
      if (formData.custo_total_mensal !== custoTotalMensalFormatado) {
        updates.custo_total_mensal = custoTotalMensalFormatado;
      }
      if (formData.custo_hora !== custoHoraFormatado) {
        updates.custo_hora = custoHoraFormatado;
      }
      
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({
          ...prev,
          ...updates
        }));
      }
    };

    calcularCustoTotalMensal();
  }, [
    formData.salariobase,
    formData.ferias,
    formData.terco_ferias,
    formData.decimoterceiro,
    formData.fgts,
    formData.valetransporte,
    formData.vale_refeicao,
    formData.ajudacusto,
    formData.horascontratadasdia,
    diasUteisConfig,
    formatarValorParaInput,
    removerFormatacaoMoeda
  ]);

  // ============================================================================
  // CONFIRMAÇÃO: Não há busca automática de config_custo_membro
  // ============================================================================
  // REMOVIDO: useEffect que preenchia automaticamente ao mudar data ou tipo de contrato
  // Agora o preenchimento só acontece quando o usuário clica no botão de buscar
  // 
  // VERIFICAÇÃO FINAL:
  // - buscarConfigCustoColaborador só é chamada em handleBuscarCustoColaborador
  // - handleBuscarCustoColaborador só é chamada quando o botão é clicado
  // - Não há nenhum useEffect que busca config_custo_membro automaticamente
  // - loadVigencia carrega dados APENAS de custo_membro_vigencia
  // ============================================================================

  // Efeitos - Carregar tipos de contrato primeiro (prioridade)
  useEffect(() => {
    loadTiposContrato();
  }, []); // Executar apenas uma vez na montagem

  useEffect(() => {
    loadColaboradores();
  }, [loadColaboradores]);

  useEffect(() => {
    loadColaborador();
  }, [loadColaborador]);

  useEffect(() => {
    // Só carregar vigência após tipos de contrato estarem carregados
    if (!loadingTiposContrato) {
      loadVigencia();
    }
  }, [loadVigencia, loadingTiposContrato]);

  // Função para restaurar valores padrão da configuração
  // IMPORTANTE: Este hook deve estar ANTES de qualquer return condicional
  const restaurarValoresPadrao = useCallback(async () => {
    if (!configAtual || !formData.tipo_contrato) {
      showToast('warning', 'Não há configuração padrão disponível para restaurar.');
      return;
    }

    // Limpar campos relacionados à configuração
    const dadosLimpos = {
      ...formData,
      ajudacusto: '0',
      valetransporte: '0',
      vale_refeicao: '0',
      ferias: '0',
      terco_ferias: '0',
      decimoterceiro: '0',
      fgts: '0'
    };

    // Preencher campos com valores da configuração
    const novosDados = preencherCamposComConfig(dadosLimpos, configAtual);
    setFormData(novosDados);

    // Atualizar rastreamento de campos preenchidos automaticamente
    const camposAuto = new Set();
    if (configAtual.ajuda_custo) camposAuto.add('ajudacusto');
    if (configAtual.valetransporte) camposAuto.add('valetransporte');
    if (configAtual.vale_refeicao) camposAuto.add('vale_refeicao');
    if (configAtual.ferias) camposAuto.add('ferias');
    if (configAtual.um_terco_ferias) camposAuto.add('terco_ferias');
    if (configAtual.decimoterceiro) camposAuto.add('decimoterceiro');
    if (configAtual.fgts) camposAuto.add('fgts');
    setCamposPreenchidosAuto(camposAuto);

    showToast('success', 'Valores padrão restaurados com sucesso.');
  }, [configAtual, formData, preencherCamposComConfig, showToast]);

  // Formatar data para exibição
  const formatarDataExibicao = (data) => {
    if (!data) return '';
    try {
      const date = new Date(data);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando vigência..." />
            </CardContainer>
          </main>
        </div>
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
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="editar-cliente-container">
              {/* Header */}
              <div className="cadastro-cliente-header">
                <div className="cadastro-cliente-header-content">
                  <div className="cadastro-cliente-header-left">
                    <div className="cadastro-cliente-header-icon-container">
                      <div className="cadastro-cliente-header-icon">
                        <Avatar
                          avatarId={colaborador?.foto_perfil}
                          nomeUsuario={colaborador?.nome || 'Vigência'}
                          size="large"
                        />
                      </div>
                    </div>
                    <div>
                      <h2 className="cadastro-cliente-title">
                        {isEdit ? 'Editar Vigência' : 'Nova Vigência'}
                      </h2>
                      <p className="cadastro-cliente-subtitle">
                        {colaborador 
                          ? `Colaborador: ${colaborador.nome}${colaborador.cpf ? ` (${colaborador.cpf})` : ''}`
                          : isEdit 
                            ? 'Edite as informações da vigência'
                            : 'Preencha os dados para criar uma nova vigência'
                        }
                        {isEdit && formData.dt_vigencia && (
                          <span style={{ display: 'block', marginTop: '4px' }}>
                            Data: {formatarDataExibicao(formData.dt_vigencia)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-cliente-back-btn"
                      onClick={() => {
                        if (hasUnsavedChanges) {
                          setShowConfirmModal(true);
                        } else {
                          handleVoltar();
                        }
                      }}
                      disabled={submitting}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="vigencia-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : (isEdit ? 'Salvar' : 'Salvar Vigência')}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <form id="vigencia-form" onSubmit={handleSubmit}>
                {/* Seção de Dados da Vigência */}
                <div className="editar-cliente-form-section">
                  <div className="section-header">
                    <div className="section-icon" style={{ backgroundColor: '#10b98115', color: '#10b981' }}>
                      <i className="fas fa-calendar-alt"></i>
                    </div>
                    <h2 className="section-title">Dados da Vigência</h2>
                  </div>
                  <div className="section-content">
                    {/* Campo de seleção de colaborador (apenas para criar nova vigência sem membroId) */}
                    {!isEdit && !membroId && colaboradores.length > 0 && (
                      <div className="form-row" style={{ marginBottom: '20px' }}>
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
                    )}

                    {/* Mostrar colaborador como readonly se tiver membroId */}
                    {membroId && colaborador && (
                      <div className="form-row" style={{ marginBottom: '20px' }}>
                        <div className="form-group">
                          <label className="form-label-small">
                            Colaborador
                          </label>
                          <div style={{ 
                            padding: '12px 16px', 
                            backgroundColor: '#f9fafb', 
                            borderRadius: '6px',
                            fontSize: '14px',
                            color: '#374151',
                            border: '1px solid #e5e7eb'
                          }}>
                            {colaborador.nome}
                            {colaborador.cpf && ` (${colaborador.cpf})`}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mensagem informativa e botão restaurar */}
                    {configAtual && camposPreenchidosAuto.size > 0 && (
                      <div style={{
                        marginBottom: '20px',
                        padding: '12px 16px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #3b82f6',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <i className="fas fa-info-circle" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
                          <span style={{ color: '#1e40af', fontSize: '14px' }}>
                            Os valores foram preenchidos automaticamente com base na configuração padrão. 
                            Você pode personalizar qualquer valor conforme necessário para este colaborador.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={restaurarValoresPadrao}
                          disabled={submitting}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: submitting ? 0.6 : 1,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!submitting) e.target.style.opacity = '0.9';
                          }}
                          onMouseLeave={(e) => {
                            if (!submitting) e.target.style.opacity = '1';
                          }}
                        >
                          <i className="fas fa-undo"></i>
                          Restaurar Valores Padrão
                        </button>
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
                      camposPreenchidosAuto={camposPreenchidosAuto}
                      onBuscarCustoColaborador={() => setShowConfirmBuscarModal(true)}
                      buscandoCustoColaborador={buscandoCustoColaborador}
                      diasUteis={diasUteisConfig}
                    />
                  </div>
                </div>

                {formErrors.submit && (
                  <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c33' }}>
                    {formErrors.submit}
                  </div>
                )}
              </form>
            </div>
          </CardContainer>
        </main>
      </div>
      
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          handleVoltar();
        }}
        title="Alterações não salvas"
        message={
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '16px' }}></i>
            <p style={{ fontSize: '16px', color: '#374151', margin: '0 0 8px 0', fontWeight: '500' }}>
              Você tem alterações não salvas
            </p>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              Tem certeza que deseja sair? Todas as alterações serão perdidas.
            </p>
          </div>
        }
        confirmText="Sair sem salvar"
        cancelText="Cancelar"
        confirmButtonClass="btn-primary"
      />
      
      <ConfirmModal
        isOpen={showConfirmBuscarModal}
        onClose={() => setShowConfirmBuscarModal(false)}
        onConfirm={async () => {
          setShowConfirmBuscarModal(false);
          await handleBuscarCustoColaborador();
        }}
        title="Atualizar Valores"
        message={
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <i className="fas fa-info-circle" style={{ fontSize: '48px', color: '#3b82f6', marginBottom: '16px' }}></i>
            <p style={{ fontSize: '16px', color: '#374151', margin: '0 0 8px 0', fontWeight: '500' }}>
              Tem certeza que deseja atualizar os valores de Encargos e Benefícios conforme o Padrão cadastrado na vigência selecionada?
            </p>
          </div>
        }
        confirmText="Sim, atualizar"
        cancelText="Cancelar"
        confirmButtonClass="btn-primary"
        loading={buscandoCustoColaborador}
      />
    </Layout>
  );
};

export default CadastroVigencia;

