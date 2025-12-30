import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import FilterColaborador from '../../components/filters/FilterColaborador';
import FilterDate from '../../components/filters/FilterDate';
import FiltersCard from '../../components/filters/FiltersCard';
import ToggleSwitch from '../../components/common/ToggleSwitch';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import InactiveButton from '../../components/common/InactiveButton';
import CardContainer from '../../components/common/CardContainer';
import { calcularVigencia } from '../../utils/calcularVigencia';
import { useVigenciaSubmit } from '../../hooks/useVigenciaSubmit';
import { useVigenciaCalculations } from '../../hooks/useVigenciaCalculations';
import { VigenciaModal } from '../../components/vigencia';
import ColaboradorModal from '../../components/colaboradores/ColaboradorModal';
import DataTable from '../../components/common/DataTable';
import LoadingState from '../../components/common/LoadingState';
import EditButton from '../../components/common/EditButton';
import VigenciaTable from '../../components/vigencia/VigenciaTable';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/user/Avatar';
import {
  formatarDataBR,
  formatarMoeda,
  aplicarMascaraCpf,
  removerFormatacaoMoeda,
  formatarData,
  formatarValorParaInput
} from '../../utils/vigenciaUtils';
import './ConfiguracoesColaboradores.css';

const API_BASE_URL = '/api';

const GestaoColaboradores = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estado para toggle de detalhes (vigências)
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  
  // Estado para mostrar colaboradores inativos
  const [mostrarInativos, setMostrarInativos] = useState(false);
  
  // Estados principais
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroColaboradorBusca, setFiltroColaboradorBusca] = useState(null); // Para o FilterColaborador
  const [todosColaboradoresParaFiltro, setTodosColaboradoresParaFiltro] = useState([]); // Lista completa para o filtro
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalColaboradores, setTotalColaboradores] = useState(0);

  // Estados para formulário
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [vigenciaAberta, setVigenciaAberta] = useState(false); // Estado para controlar se a seção de vigência está aberta
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    // Campos de vigência
    dt_vigencia: '',
    diasuteis: '',
    horascontratadasdia: '',
    salariobase: '',
    tipo_contrato: '',
    ajudacusto: '0',
    valetransporte: '0',
    vale_refeicao: '0',
    descricao: '',
    // Campos de benefícios e encargos
    ferias: '0', // Valor cheio das férias
    terco_ferias: '0', // 1/3 de férias
    decimoterceiro: '0',
    insspatronal: '0',
    insscolaborador: '0',
    fgts: '0',
    custo_hora: '0',
    descricao_beneficios: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [colaboradorToDelete, setColaboradorToDelete] = useState(null);
  
  // Estados para modal de confirmação de exclusão de vigência
  const [showDeleteModalVigencia, setShowDeleteModalVigencia] = useState(false);
  const [vigenciaToDelete, setVigenciaToDelete] = useState(null);

  // Estados para modal de nova vigência
  const [showModalNovaVigencia, setShowModalNovaVigencia] = useState(false);
  const [membroIdParaVigencia, setMembroIdParaVigencia] = useState(null);
  const [nomeMembroParaVigencia, setNomeMembroParaVigencia] = useState('');
  const [vigenciaFormData, setVigenciaFormData] = useState({
    dt_vigencia: '',
    diasuteis: '',
    horascontratadasdia: '',
    salariobase: '',
    tipo_contrato: '',
    ajudacusto: '0',
    valetransporte: '0',
    vale_refeicao: '0',
    descricao: '',
    ferias: '0', // Valor cheio das férias
    terco_ferias: '0', // 1/3 de férias
    decimoterceiro: '0',
    insspatronal: '0',
    insscolaborador: '0',
    fgts: '0',
    custo_hora: '0',
    descricao_beneficios: ''
  });
  const [vigenciaFormErrors, setVigenciaFormErrors] = useState({});
  // submittingVigencia agora vem do hook useVigenciaSubmit

  // Estados para modal de editar vigência
  const [showModalEditarVigencia, setShowModalEditarVigencia] = useState(false);
  const [vigenciaEditando, setVigenciaEditando] = useState(null);
  const [vigenciaEditFormData, setVigenciaEditFormData] = useState({
    dt_vigencia: '',
    diasuteis: '',
    horascontratadasdia: '',
    salariobase: '',
    tipo_contrato: '',
    ajudacusto: '0',
    valetransporte: '0',
    vale_refeicao: '0',
    descricao: '',
    ferias: '0', // Valor cheio das férias
    terco_ferias: '0', // 1/3 de férias
    decimoterceiro: '0',
    insspatronal: '0',
    insscolaborador: '0',
    fgts: '0',
    custo_hora: '0',
    descricao_beneficios: ''
  });
  const [vigenciaEditFormErrors, setVigenciaEditFormErrors] = useState({});
  // submittingEditVigencia agora usa o mesmo hook (submittingVigenciaHook)

  // Estados para modal de editar colaborador
  const [showModalEditarColaborador, setShowModalEditarColaborador] = useState(false);
  const [colaboradorEditando, setColaboradorEditando] = useState(null);
  const [colaboradorEditFormData, setColaboradorEditFormData] = useState({
    nome: '',
    cpf: ''
  });
  const [colaboradorEditFormErrors, setColaboradorEditFormErrors] = useState({});
  const [submittingEditColaborador, setSubmittingEditColaborador] = useState(false);

  // Estados para vigências (quando mostrarDetalhes está ativo)
  const [vigencias, setVigencias] = useState([]);
  const [membros, setMembros] = useState([]);
  const [loadingVigencias, setLoadingVigencias] = useState(false);
  const [loadingMembros, setLoadingMembros] = useState(false);
  
  // Estado para tipos de contrato
  const [tiposContrato, setTiposContrato] = useState([]);
  const [loadingTiposContrato, setLoadingTiposContrato] = useState(false);

  // Função auxiliar para verificar se o tipo de contrato é manual (PJ ou ESTAGIO)
  const isTipoContratoManual = useCallback((tipoContratoId) => {
    // Verificar se é PJ (tipo_contrato === '2')
    if (tipoContratoId === '2') {
      return true;
    }
    
    // Verificar se é ESTAGIO (comparando o nome do tipo de contrato)
    const tipoContratoSelecionado = tiposContrato.find(tipo => tipo.id === tipoContratoId);
    if (tipoContratoSelecionado && tipoContratoSelecionado.nome) {
      return tipoContratoSelecionado.nome.toUpperCase().includes('ESTAGIO');
    }
    
    return false;
  }, [tiposContrato]);
  
  const [currentPageVigencias, setCurrentPageVigencias] = useState(1);
  const [itemsPerPageVigencias, setItemsPerPageVigencias] = useState(20);
  const [totalPagesVigencias, setTotalPagesVigencias] = useState(1);
  const [totalVigencias, setTotalVigencias] = useState(0);
  const [filtroDataAPartirDe, setFiltroDataAPartirDe] = useState('');
  const [filtroColaboradorId, setFiltroColaboradorId] = useState(null); // Array de IDs ou null

  // Estado para ordem das colunas (drag and drop)
  const [colunasVigencias, setColunasVigencias] = useState([
    { key: 'membro', label: 'Nome' },
    { key: 'cpf', label: 'CPF' },
    { key: 'dt_vigencia', label: 'Data Vigência' },
    { key: 'salariobase', label: 'Salário Base' },
    { key: 'horascontratadasdia', label: 'Horas/Dia' },
    { key: 'ajudacusto', label: 'Ajuda de Custo' },
    { key: 'valetransporte', label: 'Vale Transporte/Dia' },
    { key: 'vale_refeicao', label: 'Vale Refeição/Dia' },
    { key: 'ferias', label: 'Férias' },
    { key: 'terco_ferias', label: '1/3 Férias' },
    { key: 'decimoterceiro', label: '13º Salário' },
    { key: 'fgts', label: 'FGTS' },
    { key: 'inss_patronal', label: 'INSS Patronal' },
    { key: 'horas_mensal', label: 'Horas Mensal' },
    { key: 'descricao', label: 'Descrição' }
  ]);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isSwapping, setIsSwapping] = useState(false);
  
  // Ref para sincronizar scroll horizontal
  const tableScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const scrollHandlersRef = useRef({ tableScroll: null, topScroll: null });

  // Carregar membros para exibir nomes nas vigências
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

      if (result.success) {
        setMembros(result.data || []);
      } else {
        throw new Error(result.error || 'Erro ao carregar membros');
      }
    } catch (error) {
      showToast('error', 'Erro ao carregar membros. Tente novamente.');
      setMembros([]);
      setTodosColaboradoresParaFiltro([]);
    } finally {
      setLoadingMembros(false);
    }
  }, [showToast]);

  // Carregar colaboradores para o filtro (sempre, independente de mostrarDetalhes)
  const loadColaboradoresParaFiltro = useCallback(async () => {
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

      // Verificar se é erro 503 (Service Unavailable) - não tentar novamente
      if (response.status === 503) {
        setTodosColaboradoresParaFiltro([]);
        // Não mostrar erro repetidamente
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Se não for JSON (ex: HTML de erro), não processar
        setTodosColaboradoresParaFiltro([]);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const colaboradores = result.data || [];
        setTodosColaboradoresParaFiltro(colaboradores);
      } else {
        throw new Error(result.error || 'Erro ao carregar colaboradores para filtro');
      }
    } catch (error) {
      setTodosColaboradoresParaFiltro([]);
    }
  }, []);

  // Carregar vigências (quando mostrarDetalhes está ativo)
  const loadVigencias = useCallback(async () => {
    if (!mostrarDetalhes) return;
    
    setLoadingVigencias(true);
    try {
      const params = new URLSearchParams({
        page: currentPageVigencias.toString(),
        limit: itemsPerPageVigencias.toString()
      });

      // Filtro por colaborador (suporta múltiplos)
      if (filtroColaboradorId && filtroColaboradorId.length > 0) {
        filtroColaboradorId.forEach(id => {
          // Garantir que o ID seja uma string
          params.append('membro_id', String(id));
        });
      }

      // Filtro "A partir de" - busca vigências com dt_vigencia >= data selecionada
      if (filtroDataAPartirDe) {
        params.append('dt_vigencia_inicio', filtroDataAPartirDe);
      }

      // Se mostrarInativos estiver ativo, filtrar apenas vigências de colaboradores inativos
      if (mostrarInativos) {
        params.append('status', 'inativo');
      }

      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia?${params}`, {
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

      // Verificar se é erro 503 (Service Unavailable) - não tentar novamente
      if (response.status === 503) {
        setVigencias([]);
        setTotalVigencias(0);
        setLoadingVigencias(false);
        // Não mostrar erro repetidamente
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Se não for JSON (ex: HTML de erro), não processar
        setVigencias([]);
        setTotalVigencias(0);
        setLoadingVigencias(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        let vigenciasData = result.data || [];
        
        // Se não há filtro de colaborador (Todos os colaboradores), mostrar apenas a mais recente de cada
        // Se HÁ filtro, mostrar TODAS as vigências dos colaboradores selecionados (sem agrupamento)
        if ((!filtroColaboradorId || filtroColaboradorId.length === 0) && vigenciasData.length > 0) {
          // Agrupar por membro_id e pegar a mais recente de cada
          const vigenciasPorMembro = {};
          
          vigenciasData.forEach(vigencia => {
            const membroId = vigencia.membro_id;
            
            if (!vigenciasPorMembro[membroId]) {
              vigenciasPorMembro[membroId] = vigencia;
            } else {
              // Comparar datas para pegar a mais recente
              const dataAtual = new Date(vigencia.dt_vigencia);
              const dataExistente = new Date(vigenciasPorMembro[membroId].dt_vigencia);
              
              // Se a data atual é mais recente, ou se for igual mas o ID for maior (mais recente)
              if (dataAtual > dataExistente || 
                  (dataAtual.getTime() === dataExistente.getTime() && vigencia.id > vigenciasPorMembro[membroId].id)) {
                vigenciasPorMembro[membroId] = vigencia;
              }
            }
          });
          
          // Converter objeto de volta para array
          vigenciasData = Object.values(vigenciasPorMembro);
        } else if (filtroColaboradorId && filtroColaboradorId.length > 0) {
          // Verificar se todas as vigências pertencem aos membros filtrados
          const membroIdsFiltrados = filtroColaboradorId.map(id => String(id));
          const vigenciasFiltradas = vigenciasData.filter(v => 
            membroIdsFiltrados.includes(String(v.membro_id))
          );
          if (vigenciasFiltradas.length !== vigenciasData.length) {
            vigenciasData = vigenciasFiltradas;
          }
        }
        setVigencias(vigenciasData);
        setTotalVigencias(vigenciasData.length);
        setTotalPagesVigencias(Math.ceil(vigenciasData.length / itemsPerPageVigencias));
      } else {
        throw new Error(result.error || 'Erro ao carregar vigências');
      }
    } catch (error) {
      // Não mostrar toast repetidamente para evitar spam (especialmente em loops)
      // Só mostrar se não for um erro de conexão/servidor
      if (!error.message || (!error.message.includes('503') && !error.message.includes('HTML'))) {
        // Usar um timeout para evitar múltiplos toasts simultâneos
        setTimeout(() => {
          showToast('error', error.message || 'Erro ao carregar vigências. Tente novamente.');
        }, 100);
      }
      setVigencias([]);
      setTotalVigencias(0);
    } finally {
      setLoadingVigencias(false);
    }
  }, [mostrarDetalhes, currentPageVigencias, itemsPerPageVigencias, filtroDataAPartirDe, filtroColaboradorId, mostrarInativos, showToast]);

  // Obter nome do membro
  const getNomeMembro = (membroId) => {
    const membro = membros.find(m => m.id === membroId);
    return membro ? membro.nome : `ID: ${membroId}`;
  };

  // Carregar tipos de contrato
  const loadTiposContrato = useCallback(async () => {
    setLoadingTiposContrato(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipos-contrato`, {
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
      showToast('error', 'Erro ao carregar tipos de contrato. Tente novamente.');
      setTiposContrato([]);
    } finally {
      setLoadingTiposContrato(false);
    }
  }, [showToast]);

  // Carregar colaboradores
  const loadColaboradores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Se houver colaboradores selecionados, carregar TODOS (sem paginação) para filtrar depois
      // Caso contrário, usar paginação normal
      if (filtroColaboradorBusca && filtroColaboradorBusca.length > 0) {
        // Carregar todos os colaboradores quando há filtro selecionado
        params.append('page', '1');
        params.append('limit', '10000'); // Limite alto para pegar todos
      } else {
        params.append('page', currentPage.toString());
        params.append('limit', itemsPerPage.toString());
      }

      // Usar o searchTerm apenas se não houver filtro de colaborador selecionado
      if (!filtroColaboradorBusca || filtroColaboradorBusca.length === 0) {
        if (searchTerm.trim()) {
          params.append('search', searchTerm.trim());
        }
      }

      // Se mostrarInativos estiver ativo, filtrar apenas inativos
      if (mostrarInativos) {
        params.append('status', 'inativo');
      }
      
      const response = await fetch(`${API_BASE_URL}/colaboradores?${params}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });



      if (response.status === 401) {
        await response.json().catch(() => ({ message: 'Não autenticado' }));
        window.location.href = '/login';
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        
        // Se for HTML ou erro 503 (Service Unavailable), não tentar novamente imediatamente
        if (contentType.includes('text/html') || response.status === 503) {
          // Limpar dados para evitar loops
          setColaboradores([]);
          setTotalColaboradores(0);
          setLoading(false);
          // Não mostrar toast de erro repetidamente para evitar spam
          return;
        }
        
        // Para outros erros, ainda lançar exceção mas sem loop
        throw new Error(`Servidor retornou resposta inválida. Status: ${response.status}`);
      }

      if (!response.ok) {
        // Se for erro 503 (Service Unavailable), não tentar novamente
        if (response.status === 503) {
          setColaboradores([]);
          setTotalColaboradores(0);
          setLoading(false);
          return;
        }
        
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        let colaboradoresData = result.data || [];
        
        // Se houver colaboradores selecionados no filtro, filtrar pelos IDs
        if (filtroColaboradorBusca && filtroColaboradorBusca.length > 0) {
          const idsSelecionados = filtroColaboradorBusca.map(id => String(id).trim());
          colaboradoresData = colaboradoresData.filter(colab => 
            idsSelecionados.includes(String(colab.id).trim())
          );
          // Atualizar total e páginas baseado nos resultados filtrados
          // Quando há filtro, mostrar todos os resultados filtrados (sem paginação)
          setTotalColaboradores(colaboradoresData.length);
          setTotalPages(1); // Sem paginação quando há filtro selecionado
        } else {
          setTotalColaboradores(result.total || 0);
          setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
        }
        
        setColaboradores(colaboradoresData);
      } else {
        throw new Error(result.error || 'Erro ao carregar colaboradores');
      }
    } catch (error) {
      const errorMessage = error.message || 'Erro ao carregar colaboradores. Tente novamente.';
      showToast('error', errorMessage);
      setColaboradores([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, mostrarInativos, filtroColaboradorBusca, todosColaboradoresParaFiltro, showToast]);

  // Carregar colaborador por ID para edição
  const loadColaboradorParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${id}`, {
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
        setFormData({
          nome: result.data.nome || '',
          cpf: result.data.cpf ? aplicarMascaraCpf(result.data.cpf) : '',
          // Campos de vigência (não preencher na edição, pois são apenas para criação)
          dt_vigencia: '',
          diasuteis: '',
          horascontratadasdia: '',
          salariobase: '',
          ajudacusto: '0',
          valetransporte: '0',
          descricao: '',
          // Campos de benefícios e encargos
          ferias: '0',
          decimoterceiro: '0',
          insspatronal: '0',
          insscolaborador: '0',
          fgts: '0',
          descricao_beneficios: ''
        });
        setEditingId(id);
        setShowForm(true);
        setFormErrors({});
      } else {
        throw new Error(result.error || 'Erro ao carregar colaborador');
      }
    } catch (error) {
      showToast('error', 'Erro ao carregar colaborador. Tente novamente.');
    }
  }, [showToast]);

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.nome || !formData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }

    if (formData.cpf && formData.cpf.trim()) {
      const cpfLimpo = formData.cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11) {
        errors.cpf = 'CPF deve conter 11 dígitos';
      }
    }

    // Validar data de vigência se fornecida (opcional, mas se preenchida deve ser válida)
    if (formData.dt_vigencia && formData.dt_vigencia.trim()) {
      const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dataRegex.test(formData.dt_vigencia)) {
        errors.dt_vigencia = 'Data deve estar no formato YYYY-MM-DD';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validar formulário de editar colaborador
  const validateColaboradorEditForm = () => {
    const errors = {};

    if (!colaboradorEditFormData.nome || !colaboradorEditFormData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }

    if (colaboradorEditFormData.cpf && colaboradorEditFormData.cpf.trim()) {
      const cpfLimpo = colaboradorEditFormData.cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11) {
        errors.cpf = 'CPF deve conter 11 dígitos';
      }
    }

    setColaboradorEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Salvar colaborador (criar ou atualizar)
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        nome: formData.nome.trim(),
        cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null
      };

      const url = editingId 
        ? `${API_BASE_URL}/colaboradores/${editingId}`
        : `${API_BASE_URL}/colaboradores`;
      
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
        // Se for criação de novo colaborador e houver dados de vigência, criar vigência também
        if (!editingId && result.data && result.data.id) {
          const membroId = result.data.id;
          
          // Verificar se há dados de vigência para criar
          const temDadosVigencia = formData.dt_vigencia && formData.dt_vigencia.trim();
          
          if (temDadosVigencia) {
            try {
              await createVigencia(formData, membroId);
              showToast('success', 'Colaborador e vigência criados com sucesso!');
            } catch (error) {
              // Colaborador foi criado, mas vigência falhou
              showToast(
                'error',
                'Colaborador criado com sucesso, mas houve erro ao criar a vigência: ' + (error.message || 'Erro desconhecido')
              );
            }
          } else {
            showToast('success', 'Colaborador criado com sucesso!');
          }
        } else {
          showToast(
            'success',
            editingId 
              ? 'Colaborador atualizado com sucesso!'
              : 'Colaborador criado com sucesso!'
          );
        }
        resetForm();
        await loadColaboradores();
        // Atualizar também as listas dos filtros
        await loadMembros();
        await loadColaboradoresParaFiltro();
      } else {
        throw new Error(result.error || 'Erro ao salvar colaborador');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao salvar colaborador. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingId, loadColaboradores, loadMembros, loadColaboradoresParaFiltro, showToast]);

  // Inativar colaborador
  const handleInativar = useCallback(async () => {
    if (!colaboradorToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorToDelete.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'inativo' }),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        await response.text();
        throw new Error(`Erro ao inativar colaborador. Resposta do servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Colaborador inativado com sucesso!');
        setShowDeleteModal(false);
        setColaboradorToDelete(null);
        await loadColaboradores();
        // Atualizar também as listas dos filtros
        await loadMembros();
        await loadColaboradoresParaFiltro();
      } else {
        throw new Error(result.error || 'Erro ao inativar colaborador');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao inativar colaborador. Tente novamente.');
      setShowDeleteModal(false);
    }
  }, [colaboradorToDelete, loadColaboradores, loadMembros, loadColaboradoresParaFiltro, showToast]);

  // Ativar colaborador
  const handleAtivar = useCallback(async () => {
    if (!colaboradorToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorToDelete.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ativo' }),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        await response.text();
        throw new Error(`Erro ao ativar colaborador. Resposta do servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Colaborador ativado com sucesso!');
        setShowDeleteModal(false);
        setColaboradorToDelete(null);
        await loadColaboradores();
        // Atualizar também as listas dos filtros
        await loadMembros();
        await loadColaboradoresParaFiltro();
      } else {
        throw new Error(result.error || 'Erro ao ativar colaborador');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao ativar colaborador. Tente novamente.');
      setShowDeleteModal(false);
    }
  }, [colaboradorToDelete, loadColaboradores, loadMembros, loadColaboradoresParaFiltro, showToast]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      // Campos de vigência
      dt_vigencia: '',
      diasuteis: '',
      horascontratadasdia: '',
      salariobase: '',
      tipo_contrato: '',
      ajudacusto: '0',
      valetransporte: '0',
      vale_refeicao: '0',
      descricao: '',
      // Campos de benefícios e encargos
      ferias: '0',
      terco_ferias: '0',
      decimoterceiro: '0',
      insspatronal: '0',
      insscolaborador: '0',
      fgts: '0',
      descricao_beneficios: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
    setVigenciaAberta(false); // Resetar estado de abertura da seção
  };

  // Abrir formulário para novo colaborador
  const handleNewColaborador = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir modal de editar colaborador
  const handleEdit = (colaborador) => {
    setColaboradorEditFormData({
      nome: colaborador.nome || '',
      cpf: colaborador.cpf ? aplicarMascaraCpf(colaborador.cpf) : ''
    });
    setColaboradorEditando(colaborador);
    setColaboradorEditFormErrors({});
    setShowModalEditarColaborador(true);
  };

  // Fechar modal de editar colaborador
  const fecharModalEditarColaborador = () => {
    setShowModalEditarColaborador(false);
    setColaboradorEditando(null);
    setColaboradorEditFormData({
      nome: '',
      cpf: ''
    });
    setColaboradorEditFormErrors({});
  };

  // Salvar edição de colaborador
  const handleSalvarEditarColaborador = useCallback(async (e) => {
    e.preventDefault();

    if (!validateColaboradorEditForm()) {
      return;
    }

    if (!colaboradorEditando) {
      showToast('error', 'Erro: Colaborador não encontrado');
      return;
    }

    setSubmittingEditColaborador(true);

    try {
      const payload = {
        nome: colaboradorEditFormData.nome.trim(),
        cpf: colaboradorEditFormData.cpf ? colaboradorEditFormData.cpf.replace(/\D/g, '') : null
      };

      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorEditando.id}`, {
        method: 'PUT',
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
        showToast('success', 'Colaborador atualizado com sucesso!');
        fecharModalEditarColaborador();
        await loadColaboradores();
      } else {
        throw new Error(result.error || 'Erro ao atualizar colaborador');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao atualizar colaborador. Tente novamente.');
    } finally {
      setSubmittingEditColaborador(false);
    }
  }, [colaboradorEditFormData, colaboradorEditando, loadColaboradores, showToast]);

  // Confirmar inativação
  const confirmInativar = (colaborador) => {
    setColaboradorToDelete(colaborador);
    setShowDeleteModal(true);
  };

  // Confirmar ativação
  const confirmAtivar = (colaborador) => {
    setColaboradorToDelete(colaborador);
    setShowDeleteModal(true);
  };

  // Redirecionar para vigências do membro
  const handleVerVigencias = (colaborador) => {
    // Ativa o toggle de detalhes e filtra automaticamente pelo colaborador selecionado
    setFiltroColaboradorId([colaborador.id.toString()]);
    setMostrarDetalhes(true);
    setCurrentPageVigencias(1);
  };

  // Abrir modal de nova vigência
  const handleNovaVigencia = (colaborador) => {
    setMembroIdParaVigencia(colaborador.id);
    setNomeMembroParaVigencia(colaborador.nome || '');
    setVigenciaFormData({
      dt_vigencia: '',
      diasuteis: '',
      horascontratadasdia: '',
      salariobase: '',
      tipo_contrato: '',
      ajudacusto: '0',
      valetransporte: '0',
      descricao: '',
      ferias: '0', // Valor cheio das férias
      terco_ferias: '0', // 1/3 de férias
      decimoterceiro: '0',
      insspatronal: '0',
      insscolaborador: '0',
      fgts: '0',
      descricao_beneficios: ''
    });
    setVigenciaFormErrors({});
    setShowModalNovaVigencia(true);
  };

  // Abrir modal de nova vigência a partir do filtro (quando está na visualização de Vigência)
  const handleNovaVigenciaDoFiltro = () => {
    // Inicializar sem colaborador selecionado - o usuário escolherá no modal
    setMembroIdParaVigencia(null);
    setNomeMembroParaVigencia('');
    setVigenciaFormData({
      dt_vigencia: '',
      diasuteis: '',
      horascontratadasdia: '',
      salariobase: '',
      tipo_contrato: '',
      ajudacusto: '0',
      valetransporte: '0',
      descricao: '',
      ferias: '0', // Valor cheio das férias
      terco_ferias: '0', // 1/3 de férias
      decimoterceiro: '0',
      insspatronal: '0',
      insscolaborador: '0',
      fgts: '0',
      descricao_beneficios: ''
    });
    setVigenciaFormErrors({});
    setShowModalNovaVigencia(true);
  };

  // Fechar modal de nova vigência
  const fecharModalNovaVigencia = () => {
    setShowModalNovaVigencia(false);
    setMembroIdParaVigencia(null);
    setNomeMembroParaVigencia('');
    setVigenciaFormData({
      dt_vigencia: '',
      diasuteis: '',
      horascontratadasdia: '',
      salariobase: '',
      tipo_contrato: '',
      ajudacusto: '0',
      valetransporte: '0',
      descricao: '',
      ferias: '0', // Valor cheio das férias
      terco_ferias: '0', // 1/3 de férias
      decimoterceiro: '0',
      insspatronal: '0',
      insscolaborador: '0',
      fgts: '0',
      descricao_beneficios: ''
    });
    setVigenciaFormErrors({});
  };

  // Editar vigência - redireciona para a tela de vigências
  // Abrir modal de editar vigência
  const handleEditVigencia = (vigencia) => {
    // Buscar nome do membro
    const membro = membros.find(m => m.id === vigencia.membro_id);
    const nomeMembro = membro?.nome || `Colaborador #${vigencia.membro_id}`;
    
    // Preencher formulário com dados da vigência
    setVigenciaEditFormData({
      dt_vigencia: vigencia.dt_vigencia ? formatarData(vigencia.dt_vigencia) : '',
      horascontratadasdia: vigencia.horascontratadasdia ? String(vigencia.horascontratadasdia) : '',
      salariobase: vigencia.salariobase ? formatarValorParaInput(vigencia.salariobase) : '',
      tipo_contrato: vigencia.tipo_contrato ? String(vigencia.tipo_contrato) : '',
      ajudacusto: vigencia.ajudacusto ? formatarValorParaInput(vigencia.ajudacusto) : '0',
      valetransporte: vigencia.valetransporte ? formatarValorParaInput(vigencia.valetransporte) : '0',
      vale_refeicao: vigencia.vale_refeicao || vigencia.vale_alimentacao ? formatarValorParaInput(vigencia.vale_refeicao || vigencia.vale_alimentacao) : '0',
      descricao: vigencia.descricao || '',
      ferias: vigencia.ferias ? formatarValorParaInput(vigencia.ferias) : '0',
      terco_ferias: (vigencia.um_terco_ferias || vigencia.terco_ferias) ? formatarValorParaInput(vigencia.um_terco_ferias || vigencia.terco_ferias) : '0', // Lê um_terco_ferias do banco
      decimoterceiro: vigencia.decimoterceiro ? formatarValorParaInput(vigencia.decimoterceiro) : '0',
      insspatronal: vigencia.insspatronal ? formatarValorParaInput(vigencia.insspatronal) : '0',
      insscolaborador: vigencia.insscolaborador ? formatarValorParaInput(vigencia.insscolaborador) : '0',
      fgts: vigencia.fgts ? formatarValorParaInput(vigencia.fgts) : '0',
      custo_hora: vigencia.custo_hora ? formatarValorParaInput(vigencia.custo_hora) : '0',
      descricao_beneficios: vigencia.descricao_beneficios || ''
    });
    
    setVigenciaEditando(vigencia);
    setVigenciaEditFormErrors({});
    setShowModalEditarVigencia(true);
  };

  // Fechar modal de editar vigência
  const fecharModalEditarVigencia = () => {
    setShowModalEditarVigencia(false);
    setVigenciaEditando(null);
    setVigenciaEditFormData({
      dt_vigencia: '',
      diasuteis: '',
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
      insspatronal: '0',
      insscolaborador: '0',
      fgts: '0',
      custo_hora: '0',
      descricao_beneficios: ''
    });
    setVigenciaEditFormErrors({});
  };

  // Funções para drag and drop de colunas com animação Swap
  const handleDragStart = (e, index) => {
    setDraggedColumn(index);
    setDragOverIndex(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
    
    // Adicionar classe dragging ao elemento
    const th = e.target;
    th.classList.add('dragging');
    
    // Criar um elemento fantasma personalizado
    const dragImage = th.cloneNode(true);
    dragImage.style.width = `${th.offsetWidth}px`;
    dragImage.style.opacity = '0.8';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = (e) => {
    // Remover todas as classes de drag
    const allThs = document.querySelectorAll('.listing-table-draggable th');
    allThs.forEach(th => {
      th.classList.remove('dragging', 'drag-over', 'drag-over-left', 'drag-over-right');
      th.style.backgroundColor = '';
    });
    
    setDraggedColumn(null);
    setDragOverIndex(null);
    setIsSwapping(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (e.target.tagName === 'TH' && draggedColumn !== null && draggedColumn !== index) {
      setDragOverIndex(index);
      const th = e.target;
      th.classList.add('drag-over');
      
      // Determinar direção do drag
      if (draggedColumn < index) {
        th.classList.add('drag-over-right');
        th.classList.remove('drag-over-left');
      } else {
        th.classList.add('drag-over-left');
        th.classList.remove('drag-over-right');
      }
    }
  };

  const handleDragLeave = (e) => {
    if (e.target.tagName === 'TH') {
      const th = e.target;
      th.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
      th.style.backgroundColor = '';
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    // Limpar classes visuais
    const allThs = document.querySelectorAll('.listing-table-draggable th');
    allThs.forEach(th => {
      th.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
      th.style.backgroundColor = '';
    });
    
    if (draggedColumn === null || draggedColumn === dropIndex) {
      setDraggedColumn(null);
      setDragOverIndex(null);
      return;
    }

    // Adicionar classe de animação swap
    setIsSwapping(true);
    const table = e.target.closest('.listing-table-draggable');
    if (table) {
      table.classList.add('swapping');
    }

    // Realizar a troca
    const newColunas = [...colunasVigencias];
    const draggedItem = newColunas[draggedColumn];
    newColunas.splice(draggedColumn, 1);
    newColunas.splice(dropIndex, 0, draggedItem);
    setColunasVigencias(newColunas);
    
    // Remover classe de animação após a transição
    setTimeout(() => {
      setIsSwapping(false);
      if (table) {
        table.classList.remove('swapping');
      }
    }, 300);
    
    setDraggedColumn(null);
    setDragOverIndex(null);
  };

  // Função para renderizar o valor da célula baseado na chave da coluna
  const renderCellValue = (vigencia, columnKey) => {
    switch (columnKey) {
      case 'membro':
        return getNomeMembro(vigencia.membro_id);
      case 'cpf':
        // Buscar CPF do membro usando membro_id
        const membro = membros.find(m => m.id === vigencia.membro_id);
        return membro && membro.cpf ? aplicarMascaraCpf(membro.cpf) : '-';
      case 'dt_vigencia':
        return formatarDataBR(vigencia.dt_vigencia);
      case 'salariobase':
        return vigencia.salariobase ? `R$ ${formatarMoeda(vigencia.salariobase)}` : '-';
      case 'horascontratadasdia':
        return vigencia.horascontratadasdia || '-';
      case 'ajudacusto':
        return vigencia.ajudacusto ? `R$ ${formatarMoeda(vigencia.ajudacusto)}` : '-';
      case 'valetransporte':
        return vigencia.valetransporte ? `R$ ${formatarMoeda(vigencia.valetransporte)}` : '-';
      case 'vale_refeicao':
        const valeRefeicao = vigencia.vale_refeicao || vigencia.vale_alimentacao;
        return valeRefeicao ? `R$ ${formatarMoeda(valeRefeicao)}` : '-';
      case 'ferias':
        return vigencia.ferias ? `R$ ${formatarMoeda(vigencia.ferias)}` : '-';
      case 'terco_ferias':
        const tercoFerias = vigencia.um_terco_ferias || vigencia.terco_ferias; // Lê um_terco_ferias do banco
        return tercoFerias ? `R$ ${formatarMoeda(tercoFerias)}` : '-';
      case 'decimoterceiro':
        return vigencia.decimoterceiro ? `R$ ${formatarMoeda(vigencia.decimoterceiro)}` : '-';
      case 'fgts':
        return vigencia.fgts ? `R$ ${formatarMoeda(vigencia.fgts)}` : '-';
      case 'inss_patronal':
        // Verifica tanto inss_patronal quanto insspatronal para compatibilidade
        const inssPatronal = vigencia.inss_patronal || vigencia.insspatronal;
        return inssPatronal ? `R$ ${formatarMoeda(inssPatronal)}` : '-';
      case 'horas_mensal':
        return vigencia.horas_mensal || '-';
      case 'descricao':
        return vigencia.descricao || '-';
      default:
        return '-';
    }
  };

  // Confirmar exclusão de vigência
  const confirmDeleteVigencia = (vigencia) => {
    setVigenciaToDelete(vigencia);
    setShowDeleteModalVigencia(true);
  };

  // Hook para gerenciar submissão de vigências
  const { submitting: submittingVigenciaHook, createVigencia, updateVigencia } = useVigenciaSubmit(
    API_BASE_URL,
    removerFormatacaoMoeda,
    () => {
      showToast('success', 'Vigência salva com sucesso!');
      fecharModalNovaVigencia();
      fecharModalEditarVigencia();
      if (mostrarDetalhes) {
        loadVigencias();
      }
    },
    (error) => {
      showToast('error', error.message || 'Erro ao salvar vigência. Tente novamente.');
    }
  );

  // Salvar nova vigência
  const handleSalvarNovaVigencia = useCallback(async (e) => {
    e.preventDefault();

    const errors = {};

    if (!membroIdParaVigencia) {
      errors.membro_id = 'Colaborador é obrigatório';
    }

    if (!vigenciaFormData.dt_vigencia || !vigenciaFormData.dt_vigencia.trim()) {
      errors.dt_vigencia = 'Data de Vigência é obrigatória';
    }

    if (Object.keys(errors).length > 0) {
      setVigenciaFormErrors(errors);
      return;
    }

    try {
      await createVigencia(vigenciaFormData, membroIdParaVigencia);
    } catch (error) {
      // Erro já tratado no hook
    }
  }, [vigenciaFormData, membroIdParaVigencia, createVigencia]);

  // Salvar edição de vigência
  const handleSalvarEditarVigencia = useCallback(async (e) => {
    e.preventDefault();

    if (!vigenciaEditFormData.dt_vigencia || !vigenciaEditFormData.dt_vigencia.trim()) {
      setVigenciaEditFormErrors({ dt_vigencia: 'Data de Vigência é obrigatória' });
      return;
    }

    if (!vigenciaEditando) {
      showToast('error', 'Erro: Vigência não encontrada');
      return;
    }

    try {
      await updateVigencia(vigenciaEditando.id, vigenciaEditFormData);
    } catch (error) {
      // Erro já tratado no hook
    }
  }, [vigenciaEditFormData, vigenciaEditando, updateVigencia, showToast]);

  // Deletar vigência
  const handleDeleteVigencia = useCallback(async () => {
    if (!vigenciaToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/${vigenciaToDelete.id}`, {
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
        showToast('success', 'Vigência deletada com sucesso!');
        setShowDeleteModalVigencia(false);
        setVigenciaToDelete(null);
        await loadVigencias();
      } else {
        throw new Error(result.error || 'Erro ao deletar vigência');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao deletar vigência. Tente novamente.');
      setShowDeleteModalVigencia(false);
    }
  }, [vigenciaToDelete, loadVigencias, showToast]);


  // Debounce para busca
  const searchTimeoutRef = useRef(null);
  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
  }, []);

  // Handler para mudança no filtro de colaborador
  const handleFiltroColaboradorBuscaChange = useCallback((e) => {
    const selectedIds = e.target.value;
    setFiltroColaboradorBusca(selectedIds ? (Array.isArray(selectedIds) ? selectedIds : [selectedIds]) : null);
    setSearchTerm(''); // Limpar searchTerm quando usar o filtro
    setCurrentPage(1); // Resetar para primeira página quando filtrar
  }, []);

  // Função para limpar filtros
  const limparFiltros = useCallback(() => {
    if (mostrarDetalhes) {
      // Limpar filtros da visualização de Vigência
      setFiltroColaboradorId(null);
      setFiltroDataAPartirDe('');
      setCurrentPageVigencias(1);
    } else {
      // Limpar filtros da visualização de Colaborador
      setFiltroColaboradorBusca(null);
      setSearchTerm('');
      setCurrentPage(1);
    }
  }, [mostrarDetalhes]);

  // Efeito para calcular benefícios automaticamente quando salariobase mudar
  useEffect(() => {
    // Não calcular se for PJ ou ESTAGIO
    if (isTipoContratoManual(formData.tipo_contrato)) {
      return;
    }

    // Usar um timeout para evitar cálculos muito frequentes durante a digitação
    const timeoutId = setTimeout(() => {
      // Verificar se há salário base válido (não vazio e não zero)
      const salarioValido = formData.salariobase && 
                            formData.salariobase.trim() !== '' && 
                            formData.salariobase !== '0' &&
                            formData.salariobase !== '0,00' &&
                            parseFloat(removerFormatacaoMoeda(formData.salariobase)) > 0;
      
      if (salarioValido) {
        const calcular = async () => {
          try {
            const dataVigencia = formData.dt_vigencia || null;
            const diasUteisVigencia = formData.diasuteis ? parseFloat(formData.diasuteis) : null;
            const horasContratadasDia = formData.horascontratadasdia ? parseFloat(formData.horascontratadasdia) : null;
            const beneficios = await calcularVigencia(formData.salariobase, dataVigencia, diasUteisVigencia, horasContratadasDia);
            
            setFormData(prev => ({
              ...prev,
              ferias: formatarValorParaInput(beneficios.ferias),
              terco_ferias: formatarValorParaInput(beneficios.terco_ferias),
              decimoterceiro: formatarValorParaInput(beneficios.decimoterceiro),
              insspatronal: formatarValorParaInput(beneficios.insspatronal),
              insscolaborador: formatarValorParaInput(beneficios.insscolaborador),
              fgts: formatarValorParaInput(beneficios.fgts),
              valetransporte: formatarValorParaInput(beneficios.valetransporte),
              vale_refeicao: formatarValorParaInput(beneficios.vale_refeicao),
              custo_total_mensal: formatarValorParaInput(beneficios.custo_total_mensal),
              // Custo hora já vem calculado da função calcularVigencia
              ...(formData.tipo_contrato && !isTipoContratoManual(formData.tipo_contrato) ? { 
                custo_hora: formatarValorParaInput(beneficios.custo_hora)
              } : {})
            }));
          } catch (error) {
            // Erro silencioso ao calcular benefícios
          }
        };
        calcular();
      } else {
        // Resetar valores se salário base for removido ou inválido
        setFormData(prev => ({
          ...prev,
          ferias: '0',
          terco_ferias: '0',
          decimoterceiro: '0',
          insspatronal: '0',
          insscolaborador: '0',
          fgts: '0',
          valetransporte: '0',
          vale_refeicao: '0',
          custo_total_mensal: '0',
          // Se não for PJ ou ESTAGIO, resetar custo hora também
          ...(formData.tipo_contrato && !isTipoContratoManual(formData.tipo_contrato) ? { custo_hora: '0' } : {})
        }));
      }
    }, 300); // Aguardar 300ms após a última mudança

    return () => clearTimeout(timeoutId);
  }, [formData.salariobase, formData.dt_vigencia, formData.diasuteis, formData.horascontratadasdia, formData.tipo_contrato, isTipoContratoManual]);

  // Efeito para calcular benefícios automaticamente quando salariobase mudar no modal de Nova Vigência
  useEffect(() => {
    // Não calcular se for PJ ou ESTAGIO
    if (isTipoContratoManual(vigenciaFormData.tipo_contrato)) {
      return;
    }

    if (showModalNovaVigencia && vigenciaFormData.salariobase) {
      const timeoutId = setTimeout(() => {
        const calcular = async () => {
          try {
            const dataVigencia = vigenciaFormData.dt_vigencia || null;
            const diasUteisVigencia = vigenciaFormData.diasuteis ? parseFloat(vigenciaFormData.diasuteis) : null;
            const horasContratadasDia = vigenciaFormData.horascontratadasdia ? parseFloat(vigenciaFormData.horascontratadasdia) : null;
            const beneficios = await calcularVigencia(vigenciaFormData.salariobase, dataVigencia, diasUteisVigencia, horasContratadasDia);
            
            setVigenciaFormData(prev => ({
              ...prev,
              ferias: formatarValorParaInput(beneficios.ferias),
              terco_ferias: formatarValorParaInput(beneficios.terco_ferias),
              decimoterceiro: formatarValorParaInput(beneficios.decimoterceiro),
              insspatronal: formatarValorParaInput(beneficios.insspatronal),
              insscolaborador: formatarValorParaInput(beneficios.insscolaborador),
              fgts: formatarValorParaInput(beneficios.fgts),
              valetransporte: formatarValorParaInput(beneficios.valetransporte),
              vale_refeicao: formatarValorParaInput(beneficios.vale_refeicao),
              custo_total_mensal: formatarValorParaInput(beneficios.custo_total_mensal),
              // Custo hora já vem calculado da função calcularVigencia
              ...(vigenciaFormData.tipo_contrato && !isTipoContratoManual(vigenciaFormData.tipo_contrato) ? { 
                custo_hora: formatarValorParaInput(beneficios.custo_hora)
              } : {})
            }));
          } catch (error) {
            // Erro silencioso ao calcular benefícios
          }
        };
        calcular();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (showModalNovaVigencia && (!vigenciaFormData.salariobase || vigenciaFormData.salariobase === '0' || vigenciaFormData.salariobase === '')) {
      // Resetar valores se salário base for removido (apenas se não for PJ ou ESTAGIO)
      if (!isTipoContratoManual(vigenciaFormData.tipo_contrato)) {
        setVigenciaFormData(prev => ({
          ...prev,
          ferias: '0',
          terco_ferias: '0',
          decimoterceiro: '0',
          insspatronal: '0',
          insscolaborador: '0',
          fgts: '0',
          valetransporte: '0',
          vale_refeicao: '0',
          custo_total_mensal: '0',
          custo_hora: '0'
        }));
      }
    }
  }, [vigenciaFormData.salariobase, vigenciaFormData.dt_vigencia, vigenciaFormData.diasuteis, vigenciaFormData.horascontratadasdia, vigenciaFormData.tipo_contrato, showModalNovaVigencia, isTipoContratoManual]);

  // Efeito para calcular benefícios automaticamente quando salariobase mudar no modal de Editar Vigência
  useEffect(() => {
    // Não calcular se for PJ ou ESTAGIO
    if (isTipoContratoManual(vigenciaEditFormData.tipo_contrato)) {
      return;
    }

    if (showModalEditarVigencia && vigenciaEditFormData.salariobase) {
      const timeoutId = setTimeout(() => {
        const calcular = async () => {
          try {
            const dataVigencia = vigenciaEditFormData.dt_vigencia || null;
            const diasUteisVigencia = vigenciaEditFormData.diasuteis ? parseFloat(vigenciaEditFormData.diasuteis) : null;
            const horasContratadasDia = vigenciaEditFormData.horascontratadasdia ? parseFloat(vigenciaEditFormData.horascontratadasdia) : null;
            const beneficios = await calcularVigencia(vigenciaEditFormData.salariobase, dataVigencia, diasUteisVigencia, horasContratadasDia);
            
            setVigenciaEditFormData(prev => ({
              ...prev,
              ferias: formatarValorParaInput(beneficios.ferias),
              terco_ferias: formatarValorParaInput(beneficios.terco_ferias),
              decimoterceiro: formatarValorParaInput(beneficios.decimoterceiro),
              insspatronal: formatarValorParaInput(beneficios.insspatronal),
              insscolaborador: formatarValorParaInput(beneficios.insscolaborador),
              fgts: formatarValorParaInput(beneficios.fgts),
              valetransporte: formatarValorParaInput(beneficios.valetransporte),
              vale_refeicao: formatarValorParaInput(beneficios.vale_refeicao),
              custo_total_mensal: formatarValorParaInput(beneficios.custo_total_mensal),
              // Custo hora já vem calculado da função calcularVigencia
              ...(vigenciaEditFormData.tipo_contrato && !isTipoContratoManual(vigenciaEditFormData.tipo_contrato) ? { 
                custo_hora: formatarValorParaInput(beneficios.custo_hora)
              } : {})
            }));
          } catch (error) {
            // Erro silencioso ao calcular benefícios
          }
        };
        calcular();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (showModalEditarVigencia && (!vigenciaEditFormData.salariobase || vigenciaEditFormData.salariobase === '0' || vigenciaEditFormData.salariobase === '')) {
      // Resetar valores se salário base for removido (apenas se não for PJ ou ESTAGIO)
      if (!isTipoContratoManual(vigenciaEditFormData.tipo_contrato)) {
        setVigenciaEditFormData(prev => ({
          ...prev,
          ferias: '0',
          terco_ferias: '0',
          decimoterceiro: '0',
          insspatronal: '0',
          insscolaborador: '0',
          fgts: '0',
          valetransporte: '0',
          vale_refeicao: '0',
          custo_total_mensal: '0',
          custo_hora: '0'
        }));
      }
    }
  }, [vigenciaEditFormData.salariobase, vigenciaEditFormData.dt_vigencia, vigenciaEditFormData.diasuteis, vigenciaEditFormData.horascontratadasdia, vigenciaEditFormData.tipo_contrato, showModalEditarVigencia, isTipoContratoManual]);

  // Carregar tipos de contrato quando o componente monta
  useEffect(() => {
    loadTiposContrato();
  }, [loadTiposContrato]);

  // Sincronizar scroll horizontal entre topo e tabela
  useEffect(() => {
    if (!mostrarDetalhes) return;

    let resizeObserver = null;

    // Aguardar um pouco para garantir que os elementos estejam no DOM
    const timeoutId = setTimeout(() => {
      const tableContainer = tableScrollRef.current;
      const topScroll = topScrollRef.current;
      
      if (!tableContainer || !topScroll) return;

      // Resetar scroll para o início
      tableContainer.scrollLeft = 0;
      topScroll.scrollLeft = 0;

      // Sincronizar largura da barra de scroll do topo com a tabela
      const syncWidth = () => {
        if (tableContainer && topScroll) {
          const table = tableContainer.querySelector('table');
          if (table) {
            const scrollContent = topScroll.querySelector('div');
            if (scrollContent) {
              scrollContent.style.minWidth = `${table.scrollWidth}px`;
            }
            // Forçar scrollbar a aparecer
            topScroll.style.overflowX = 'scroll';
          }
        }
      };

      // Sincronizar scroll - criar funções e armazenar no ref
      scrollHandlersRef.current.tableScroll = () => {
        if (topScroll && tableContainer) {
          topScroll.scrollLeft = tableContainer.scrollLeft;
        }
      };

      scrollHandlersRef.current.topScroll = () => {
        if (tableContainer && topScroll) {
          tableContainer.scrollLeft = topScroll.scrollLeft;
        }
      };

      // Sincronizar largura inicial
      syncWidth();
      
      // Observar mudanças de tamanho
      resizeObserver = new ResizeObserver(() => {
        syncWidth();
      });
      
      if (tableContainer) {
        resizeObserver.observe(tableContainer);
        const table = tableContainer.querySelector('table');
        if (table) {
          resizeObserver.observe(table);
        }
      }

      // Adicionar event listeners
      tableContainer.addEventListener('scroll', scrollHandlersRef.current.tableScroll);
      topScroll.addEventListener('scroll', scrollHandlersRef.current.topScroll);
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      const tableContainer = tableScrollRef.current;
      const topScroll = topScrollRef.current;
      if (tableContainer && scrollHandlersRef.current.tableScroll) {
        tableContainer.removeEventListener('scroll', scrollHandlersRef.current.tableScroll);
      }
      if (topScroll && scrollHandlersRef.current.topScroll) {
        topScroll.removeEventListener('scroll', scrollHandlersRef.current.topScroll);
      }
      // Limpar handlers
      scrollHandlersRef.current.tableScroll = null;
      scrollHandlersRef.current.topScroll = null;
    };
  }, [mostrarDetalhes, vigencias.length, colunasVigencias, loadingVigencias]);

  // Efeitos
  useEffect(() => {
    loadColaboradores();
  }, [loadColaboradores]);

  // Carregar colaboradores para o filtro na montagem do componente
  useEffect(() => {
    loadColaboradoresParaFiltro();
  }, [loadColaboradoresParaFiltro]);

  useEffect(() => {
    if (mostrarDetalhes) {
      loadMembros();
      loadVigencias();
    }
  }, [mostrarDetalhes, loadMembros, loadVigencias]);

  // Carregar vigências automaticamente quando o filtro mudar
  useEffect(() => {
    if (mostrarDetalhes) {
      loadVigencias();
    }
  }, [filtroColaboradorId, filtroDataAPartirDe, mostrarDetalhes, loadVigencias]);

  // Resetar scroll quando os dados são carregados
  useEffect(() => {
    if (mostrarDetalhes && !loadingVigencias && vigencias.length > 0) {
      const timeoutId = setTimeout(() => {
        const tableContainer = tableScrollRef.current;
        const topScroll = topScrollRef.current;
        if (tableContainer) {
          tableContainer.scrollLeft = 0;
        }
        if (topScroll) {
          topScroll.scrollLeft = 0;
        }
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [mostrarDetalhes, loadingVigencias, vigencias.length]);

  // Calcular range de itens exibidos
  const startItem = totalColaboradores === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, colaboradores.length) - 1, totalColaboradores);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="colaboradores-listing-section">
          <div className="form-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                <h2 className="form-title">Cadastro Colaboradores</h2>
                <p className="form-subtitle">
                  Gerencie os colaboradores do sistema
                </p>
              </div>
              <button
                onClick={() => navigate('/configuracoes/custo-colaborador')}
                className="custo-colaborador-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: 0.7
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.opacity = '0.7';
                }}
                title="Configurações de Custo Colaborador"
              >
                <i className="fas fa-cog custo-colaborador-icon" style={{ 
                  fontSize: '16px'
                }}></i>
                <span>Custo Colaborador</span>
              </button>
            </div>
          </div>

          {/* Filtros quando mostrarDetalhes está false (Lista) */}
          {!mostrarDetalhes && (
            <>
              {/* Controles acima dos filtros - Lista */}
              <div className="listing-controls" style={{ marginBottom: '16px', justifyContent: 'flex-end' }}>
                <div className="listing-controls-right">
                  {/* Toggle Detalhes */}
                  <ToggleSwitch
                    checked={mostrarDetalhes}
                    onChange={(novoValor) => {
                      // Sincronizar filtros entre as duas visualizações
                      if (novoValor && !mostrarDetalhes) {
                        // Trocando de Colaborador para Vigência
                        // Se houver filtro em filtroColaboradorBusca, aplicar em filtroColaboradorId
                        if (filtroColaboradorBusca) {
                          const idsArray = Array.isArray(filtroColaboradorBusca) 
                            ? filtroColaboradorBusca.map(id => String(id))
                            : [String(filtroColaboradorBusca)];
                          setFiltroColaboradorId(idsArray);
                        } else {
                          // Se não houver filtro, limpar o filtro de vigências
                          setFiltroColaboradorId(null);
                        }
                      } else if (!novoValor && mostrarDetalhes) {
                        // Trocando de Vigência para Colaborador
                        // Se houver filtro em filtroColaboradorId, aplicar em filtroColaboradorBusca
                        if (filtroColaboradorId && filtroColaboradorId.length > 0) {
                          const idsArray = filtroColaboradorId.map(id => String(id));
                          // Manter como array para compatibilidade com FilterColaborador
                          setFiltroColaboradorBusca(idsArray);
                        } else {
                          // Se não houver filtro, limpar o filtro de colaboradores
                          setFiltroColaboradorBusca(null);
                        }
                      }
                      setMostrarDetalhes(novoValor);
                      setCurrentPageVigencias(1);
                      if (!novoValor) {
                        setCurrentPage(1);
                      }
                    }}
                    leftLabel="Colaborador"
                    rightLabel="Vigência"
                    id="detalhesToggleInput"
                    className=""
                    style={{ marginRight: '16px' }}
                  />
                  <InactiveButton
                    active={mostrarInativos}
                    onClick={() => {
                      setMostrarInativos(!mostrarInativos);
                      if (!mostrarDetalhes) {
                        setCurrentPage(1);
                      } else {
                        setCurrentPageVigencias(1);
                      }
                    }}
                    label="Inativos"
                  />
                  <ButtonPrimary
                    onClick={mostrarDetalhes ? handleNovaVigenciaDoFiltro : handleNewColaborador}
                    disabled={showForm}
                    icon="fas fa-plus"
                    style={{ marginLeft: '12px' }}
                  >
                    {mostrarDetalhes ? 'Nova Vigência' : 'Novo Colaborador'}
                  </ButtonPrimary>
                </div>
              </div>
              <FiltersCard
                onClear={limparFiltros}
                showActions={true}
              >
                <div className="filter-group" style={{ flex: '1', minWidth: '300px' }}>
                  <FilterColaborador
                    value={filtroColaboradorBusca}
                    onChange={handleFiltroColaboradorBuscaChange}
                    options={todosColaboradoresParaFiltro}
                    disabled={false}
                  />
                </div>
              </FiltersCard>
            </>
          )}

          {/* Modal de Novo/Editar Colaborador */}
          <ColaboradorModal
            isOpen={showForm}
            onClose={resetForm}
            onSubmit={handleSubmit}
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            submitting={submitting}
            editingId={editingId}
            tiposContrato={tiposContrato}
            loadingTiposContrato={loadingTiposContrato}
            formatarValorParaInput={formatarValorParaInput}
            removerFormatacaoMoeda={removerFormatacaoMoeda}
            aplicarMascaraCpf={aplicarMascaraCpf}
            vigenciaAberta={vigenciaAberta}
            setVigenciaAberta={setVigenciaAberta}
          />

          {/* Filtros quando mostrarDetalhes está ativo */}
          {mostrarDetalhes && (
            <>
              {/* Controles acima dos filtros - Detalhes */}
              <div className="listing-controls" style={{ marginBottom: '16px', justifyContent: 'flex-end' }}>
                <div className="listing-controls-right">
                  {/* Toggle Detalhes */}
                  <ToggleSwitch
                    checked={mostrarDetalhes}
                    onChange={(novoValor) => {
                      // Sincronizar filtros entre as duas visualizações
                      if (novoValor && !mostrarDetalhes) {
                        // Trocando de Colaborador para Vigência
                        // Se houver filtro em filtroColaboradorBusca, aplicar em filtroColaboradorId
                        if (filtroColaboradorBusca) {
                          const idsArray = Array.isArray(filtroColaboradorBusca) 
                            ? filtroColaboradorBusca.map(id => String(id))
                            : [String(filtroColaboradorBusca)];
                          setFiltroColaboradorId(idsArray);
                        } else {
                          // Se não houver filtro, limpar o filtro de vigências
                          setFiltroColaboradorId(null);
                        }
                      } else if (!novoValor && mostrarDetalhes) {
                        // Trocando de Vigência para Colaborador
                        // Se houver filtro em filtroColaboradorId, aplicar em filtroColaboradorBusca
                        if (filtroColaboradorId && filtroColaboradorId.length > 0) {
                          const idsArray = filtroColaboradorId.map(id => String(id));
                          // Manter como array para compatibilidade com FilterColaborador
                          setFiltroColaboradorBusca(idsArray);
                        } else {
                          // Se não houver filtro, limpar o filtro de colaboradores
                          setFiltroColaboradorBusca(null);
                        }
                      }
                      setMostrarDetalhes(novoValor);
                      setCurrentPageVigencias(1);
                      if (!novoValor) {
                        setCurrentPage(1);
                      }
                    }}
                    leftLabel="Colaborador"
                    rightLabel="Vigência"
                    id="detalhesToggleInput"
                    className=""
                    style={{ marginRight: '16px' }}
                  />
                  <InactiveButton
                    active={mostrarInativos}
                    onClick={() => {
                      setMostrarInativos(!mostrarInativos);
                      setCurrentPageVigencias(1);
                    }}
                    label="Inativos"
                  />
                  <ButtonPrimary
                    onClick={mostrarDetalhes ? handleNovaVigenciaDoFiltro : handleNewColaborador}
                    disabled={showForm || showModalNovaVigencia}
                    icon="fas fa-plus"
                    style={{ marginLeft: '12px' }}
                  >
                    {mostrarDetalhes ? 'Nova Vigência' : 'Novo Colaborador'}
                  </ButtonPrimary>
                </div>
              </div>
              <FiltersCard
                onClear={limparFiltros}
                showActions={true}
              >
                <div className="filter-group" style={{ flex: '1', minWidth: '300px' }}>
                  <FilterColaborador
                    value={filtroColaboradorId}
                    onChange={(e) => {
                      const selectedIds = e.target.value;
                      // Converter para array de strings (IDs)
                      const idsArray = selectedIds 
                        ? (Array.isArray(selectedIds) 
                            ? selectedIds.map(id => String(id)) 
                            : [String(selectedIds)])
                        : null;
                      setFiltroColaboradorId(idsArray);
                    }}
                    options={membros}
                    disabled={false}
                  />
                </div>
                
                <div className="filter-group" style={{ flex: '0 0 auto', minWidth: '200px' }}>
                  <FilterDate
                    label="A partir de"
                    value={filtroDataAPartirDe}
                    onChange={(e) => {
                      setFiltroDataAPartirDe(e.target.value);
                    }}
                    disabled={false}
                  />
                </div>
              </FiltersCard>
            </>
          )}

          {/* Lista de colaboradores ou vigências */}
          {!mostrarDetalhes ? (
            <div className="listing-table-container view-transition view-enter">
              {loading ? (
                <LoadingState message="Carregando colaboradores..." />
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'nome',
                      label: 'Nome',
                      render: (colaborador) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar
                            avatarId={colaborador.foto_perfil}
                            nomeUsuario={colaborador.nome || ''}
                            size="small"
                            entityType="user"
                            entityId={colaborador.usuario_id}
                          />
                          <span>{colaborador.nome || '-'}</span>
                        </div>
                      )
                    },
                    {
                      key: 'cpf',
                      label: 'CPF',
                      render: (colaborador) => colaborador.cpf 
                        ? aplicarMascaraCpf(colaborador.cpf)
                        : '-'
                    },
                    {
                      key: 'salariobase',
                      label: 'Salário Base',
                      render: (colaborador) => colaborador.salariobase 
                        ? `R$ ${formatarMoeda(colaborador.salariobase)}`
                        : '-'
                    }
                  ]}
                  data={colaboradores}
                  renderActions={(colaborador) => (
                    <>
                      <EditButton
                        onClick={() => handleEdit(colaborador)}
                        title="Editar"
                        disabled={showForm}
                      />
                      {mostrarInativos ? (
                        <button
                          className="btn-icon activate-btn"
                          onClick={() => confirmAtivar(colaborador)}
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
                          onClick={() => confirmInativar(colaborador)}
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
                        onClick={() => handleVerVigencias(colaborador)}
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
                        onClick={() => handleNovaVigencia(colaborador)}
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
                    </>
                  )}
                  emptyMessage="Nenhum colaborador encontrado"
                  emptyIcon="fa-users"
                />
              )}
              {!loading && colaboradores.length > 0 && (
                <>
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
                    Mostrando {startItem} a {endItem} de {totalColaboradores} colaboradores
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Lista de vigências */
            <div className="listing-table-container with-horizontal-scroll view-transition view-enter">
              {/* Barra de scroll no topo */}
              <div 
                ref={topScrollRef}
                className="table-scroll-top"
                style={{
                  width: '100%',
                  overflowX: 'scroll',
                  overflowY: 'hidden',
                  marginBottom: '0',
                  borderBottom: '2px solid #e2e8f0',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#cbd5e1 #f1f5f9'
                }}
              >
                <div style={{ height: '1px', minWidth: '100%' }}></div>
              </div>
              <div 
                ref={tableScrollRef}
                className="table-scroll-container"
                style={{
                  width: '100%',
                  overflowX: 'auto',
                  overflowY: 'visible'
                }}
              >
                <VigenciaTable
                  vigencias={vigencias}
                  colunasVigencias={colunasVigencias}
                  membros={membros}
                  loading={loadingVigencias}
                  draggedColumn={draggedColumn}
                  dragOverIndex={dragOverIndex}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onEdit={handleEditVigencia}
                  onDelete={confirmDeleteVigencia}
                  renderCellValue={renderCellValue}
                />
              </div>
              {!loadingVigencias && vigencias.length > 0 && (
                <>
                  {/* Paginação */}
                  {totalPagesVigencias > 1 && (
                    <div className="pagination">
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPageVigencias(prev => Math.max(1, prev - 1))}
                        disabled={currentPageVigencias === 1 || loadingVigencias}
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <span className="pagination-info">
                        Página {currentPageVigencias} de {totalPagesVigencias}
                      </span>
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPageVigencias(prev => Math.min(totalPagesVigencias, prev + 1))}
                        disabled={currentPageVigencias === totalPagesVigencias || loadingVigencias}
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                  )}

                  {/* Info de paginação */}
                  <div className="pagination-info-bottom">
                    Mostrando {totalVigencias === 0 ? 0 : ((currentPageVigencias - 1) * itemsPerPageVigencias) + 1} a {Math.min(currentPageVigencias * itemsPerPageVigencias, totalVigencias)} de {totalVigencias} vigências
                  </div>
                </>
              )}
            </div>
          )}
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de confirmação de exclusão de colaborador */}
      <ConfirmModal
        isOpen={showDeleteModal && !!colaboradorToDelete}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={mostrarInativos ? handleAtivar : handleInativar}
        title="Confirmar Ação"
        message={
          <>
            <p>
              Tem certeza que deseja {mostrarInativos ? 'ativar' : 'inativar'} o colaborador{' '}
              <strong>{colaboradorToDelete?.nome}</strong>?
            </p>
            <p className="warning-text">
              {mostrarInativos 
                ? 'O colaborador será marcado como ativo e aparecerá novamente nas listagens ativas.'
                : 'O colaborador será marcado como inativo e não aparecerá mais nas listagens ativas.'}
            </p>
          </>
        }
        confirmText={mostrarInativos ? 'Ativar' : 'Inativar'}
        confirmButtonClass={mostrarInativos ? "btn-success btn-ativar" : "btn-danger btn-inativar"}
      />

      {/* Modal de confirmação de exclusão de vigência */}
      <ConfirmModal
        isOpen={showDeleteModalVigencia && !!vigenciaToDelete}
        onClose={() => setShowDeleteModalVigencia(false)}
        onConfirm={handleDeleteVigencia}
        title="Confirmar Exclusão"
        message={
          <>
            <p>
              Tem certeza que deseja excluir a vigência do colaborador <strong>{vigenciaToDelete ? getNomeMembro(vigenciaToDelete.membro_id) : ''}</strong>?
            </p>
            <p>
              Data: <strong>{vigenciaToDelete ? formatarDataBR(vigenciaToDelete.dt_vigencia) : ''}</strong>
            </p>
            <p className="warning-text">
              Esta ação não pode ser desfeita.
            </p>
          </>
        }
        confirmText={
          <>
            <i className="fas fa-trash"></i>
            Excluir
          </>
        }
        confirmButtonClass="btn-danger"
      />

      {/* Modal de Nova Vigência */}
      <VigenciaModal
        isOpen={showModalNovaVigencia}
        onClose={fecharModalNovaVigencia}
        onSubmit={handleSalvarNovaVigencia}
        formData={vigenciaFormData}
        setFormData={setVigenciaFormData}
        formErrors={vigenciaFormErrors}
        setFormErrors={setVigenciaFormErrors}
        submitting={submittingVigenciaHook}
        tiposContrato={tiposContrato}
        loadingTiposContrato={loadingTiposContrato}
        formatarValorParaInput={formatarValorParaInput}
        removerFormatacaoMoeda={removerFormatacaoMoeda}
        title="Nova Vigência"
        isEdit={false}
        membroId={membroIdParaVigencia}
        setMembroId={setMembroIdParaVigencia}
        colaboradores={todosColaboradoresParaFiltro}
      />

      {/* Modal de Editar Vigência */}
      <VigenciaModal
        isOpen={showModalEditarVigencia && !!vigenciaEditando}
        onClose={fecharModalEditarVigencia}
        onSubmit={handleSalvarEditarVigencia}
        formData={vigenciaEditFormData}
        setFormData={setVigenciaEditFormData}
        formErrors={vigenciaEditFormErrors}
        setFormErrors={setVigenciaEditFormErrors}
        submitting={submittingVigenciaHook}
        tiposContrato={tiposContrato}
        loadingTiposContrato={loadingTiposContrato}
        formatarValorParaInput={formatarValorParaInput}
        removerFormatacaoMoeda={removerFormatacaoMoeda}
        title={vigenciaEditando ? `Editar Vigência - ${membros.find(m => m.id === vigenciaEditando.membro_id)?.nome || `Colaborador #${vigenciaEditando.membro_id}`}` : 'Editar Vigência'}
        isEdit={true}
      />

      {/* Modal antigo - removido, usando VigenciaModal acima */}
      {false && showModalEditarVigencia && vigenciaEditando && (
        <div className="modal-overlay" onClick={fecharModalEditarVigencia}>
          <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>
                Editar Vigência - {membros.find(m => m.id === vigenciaEditando.membro_id)?.nome || `Colaborador #${vigenciaEditando.membro_id}`}
              </h3>
              <button
                className="btn-icon"
                onClick={fecharModalEditarVigencia}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSalvarEditarVigencia}>
                <div style={{ marginBottom: '20px' }}>
                  <div className="form-row-vigencia">
                    <div className="form-group">
                      <label className="form-label-small">
                        Data de Vigência <span className="required">*</span>
                      </label>
                      <input
                        type="date"
                        className={`form-input-small ${vigenciaEditFormErrors.dt_vigencia ? 'error' : ''}`}
                        value={vigenciaEditFormData.dt_vigencia}
                        onChange={(e) => {
                          setVigenciaEditFormData({ ...vigenciaEditFormData, dt_vigencia: e.target.value });
                          if (vigenciaEditFormErrors.dt_vigencia) {
                            setVigenciaEditFormErrors({ ...vigenciaEditFormErrors, dt_vigencia: '' });
                          }
                        }}
                        disabled={submittingVigenciaHook}
                        required
                      />
                      {vigenciaEditFormErrors.dt_vigencia && (
                        <span className="error-message">{vigenciaEditFormErrors.dt_vigencia}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label-small">Horas Contratadas/Dia</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input-small"
                        value={vigenciaEditFormData.horascontratadasdia}
                        onChange={(e) => setVigenciaEditFormData({ ...vigenciaEditFormData, horascontratadasdia: e.target.value })}
                        placeholder="Ex: 8"
                        disabled={submittingVigenciaHook}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label-small">Tipo Contrato</label>
                      <div className="select-wrapper">
                        <select
                          className="form-input-small select-with-icon"
                          value={vigenciaEditFormData.tipo_contrato || ''}
                          onChange={(e) => setVigenciaEditFormData({ ...vigenciaEditFormData, tipo_contrato: e.target.value })}
                          disabled={submittingEditVigencia || loadingTiposContrato}
                        >
                          <option value="">Selecione o tipo de contrato</option>
                          {tiposContrato.map((tipo) => (
                            <option key={tipo.id} value={tipo.id}>
                              {tipo.nome}
                            </option>
                          ))}
                        </select>
                        <i className="fas fa-chevron-down select-icon"></i>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label-small">Salário Base</label>
                      <input
                        type="text"
                        className="form-input-small"
                        value={vigenciaEditFormData.salariobase}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setVigenciaEditFormData({ ...vigenciaEditFormData, salariobase: valorFormatado });
                          } else {
                            setVigenciaEditFormData({ ...vigenciaEditFormData, salariobase: '' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submittingVigenciaHook}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label-small">Descrição</label>
                      <input
                        type="text"
                        className="form-input-small"
                        value={vigenciaEditFormData.descricao}
                        onChange={(e) => setVigenciaEditFormData({ ...vigenciaEditFormData, descricao: e.target.value })}
                        placeholder="Descrição opcional"
                        disabled={submittingVigenciaHook}
                      />
                    </div>
                  </div>

                  {/* Seção de Benefícios e Encargos */}
                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                    <h4 className="form-section-title" style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Benefícios e Encargos</h4>
                  
                    <div className="form-row-vigencia">
                      <div className="form-group">
                        <label className="form-label-small">Ajuda de Custo</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.ajudacusto}
                          onChange={(e) => {
                            const valor = e.target.value.replace(/\D/g, '');
                            if (valor) {
                              const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              });
                              setVigenciaEditFormData({ ...vigenciaEditFormData, ajudacusto: valorFormatado });
                            } else {
                              setVigenciaEditFormData({ ...vigenciaEditFormData, ajudacusto: '0' });
                            }
                          }}
                          placeholder="0,00"
                          disabled={submittingVigenciaHook}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">Vale Transporte/Dia</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.valetransporte}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigenciaHook}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">Vale Refeição/Dia</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.vale_refeicao || '0'}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigenciaHook}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">Férias</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.ferias}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigenciaHook}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">1/3 Férias</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.terco_ferias}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigenciaHook}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">13º Salário</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.decimoterceiro}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigenciaHook}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">FGTS</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.fgts}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigenciaHook}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">INSS Patronal</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.insspatronal || '0'}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigenciaHook}
                          title="Calculado automaticamente"
                        />
                      </div>
                    </div>

                    <div className="form-row-vigencia">
                      <div className="form-group">
                        <label className="form-label-small">Custo Hora</label>
                        {vigenciaEditFormData.tipo_contrato === '2' ? (
                          // Se for PJ (id: 2), campo editável
                          <input
                            type="text"
                            className="form-input-small"
                            value={vigenciaEditFormData.custo_hora || '0'}
                            onChange={(e) => {
                              const valor = e.target.value.replace(/\D/g, '');
                              if (valor) {
                                const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                });
                                setVigenciaEditFormData({ ...vigenciaEditFormData, custo_hora: valorFormatado });
                              } else {
                                setVigenciaEditFormData({ ...vigenciaEditFormData, custo_hora: '0' });
                              }
                            }}
                            placeholder="0,00"
                            disabled={submittingVigenciaHook}
                          />
                        ) : (
                          // Se não for PJ, campo calculado automaticamente
                          <input
                            type="text"
                            className="form-input-small"
                            value={vigenciaEditFormData.custo_hora || '0'}
                            readOnly
                            style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                            placeholder="0,00"
                            disabled={submittingVigenciaHook}
                            title="Calculado automaticamente"
                          />
                        )}
                      </div>
                    </div>

                    <div className="form-row-vigencia">
                      <div className="form-group">
                        <label className="form-label-small">Descrição</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.descricao_beneficios}
                          onChange={(e) => setVigenciaEditFormData({ ...vigenciaEditFormData, descricao_beneficios: e.target.value })}
                          placeholder="Descrição opcional"
                          disabled={submittingVigenciaHook}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={fecharModalEditarVigencia}
                    disabled={submittingVigenciaHook}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submittingVigenciaHook}
                  >
                    {submittingVigenciaHook ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Colaborador */}
      {showModalEditarColaborador && colaboradorEditando && (
        <div className="modal-overlay" onClick={fecharModalEditarColaborador}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>Editar Colaborador</h3>
              <button
                className="btn-icon"
                onClick={fecharModalEditarColaborador}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSalvarEditarColaborador}>
                <div style={{ marginBottom: '20px' }}>
                  <div className="form-row-vigencia">
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label-small">
                        Nome <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-input-small ${colaboradorEditFormErrors.nome ? 'error' : ''}`}
                        value={colaboradorEditFormData.nome}
                        onChange={(e) => {
                          setColaboradorEditFormData({ ...colaboradorEditFormData, nome: e.target.value });
                          if (colaboradorEditFormErrors.nome) {
                            setColaboradorEditFormErrors({ ...colaboradorEditFormErrors, nome: '' });
                          }
                        }}
                        placeholder="Digite o nome do colaborador"
                        disabled={submittingEditColaborador}
                        required
                      />
                      {colaboradorEditFormErrors.nome && (
                        <span className="error-message">{colaboradorEditFormErrors.nome}</span>
                      )}
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label-small">CPF</label>
                    <input
                      type="text"
                      className={`form-input-small ${colaboradorEditFormErrors.cpf ? 'error' : ''}`}
                      value={colaboradorEditFormData.cpf}
                      onChange={(e) => {
                        const masked = aplicarMascaraCpf(e.target.value);
                        setColaboradorEditFormData({ ...colaboradorEditFormData, cpf: masked });
                        if (colaboradorEditFormErrors.cpf) {
                          setColaboradorEditFormErrors({ ...colaboradorEditFormErrors, cpf: '' });
                        }
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      disabled={submittingEditColaborador}
                    />
                      {colaboradorEditFormErrors.cpf && (
                        <span className="error-message">{colaboradorEditFormErrors.cpf}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={fecharModalEditarColaborador}
                    disabled={submittingEditColaborador}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submittingEditColaborador}
                  >
                    {submittingEditColaborador ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default GestaoColaboradores;


