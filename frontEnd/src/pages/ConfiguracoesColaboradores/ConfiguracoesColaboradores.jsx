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
import './ConfiguracoesColaboradores.css';

const API_BASE_URL = '/api';

// Função auxiliar para formatar data em formato brasileiro (DD/MM/YYYY) - para exibição
const formatarDataBR = (data) => {
  if (!data) return '';
  const d = new Date(data);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Função auxiliar para formatar número monetário
const formatarMoeda = (valor) => {
  if (!valor && valor !== 0) return '';
  return parseFloat(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Função auxiliar para aplicar máscara de CPF
const aplicarMascaraCpf = (valor) => {
  const apenasNumeros = valor.replace(/\D/g, '');
  const numeroLimitado = apenasNumeros.substring(0, 11);
  return numeroLimitado
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Função para remover formatação de moeda (formato brasileiro: 1.234,56)
const removerFormatacaoMoeda = (valor) => {
  if (!valor || valor === '' || valor === null || valor === undefined) return '0';
  // Remove pontos (separadores de milhar) e substitui vírgula por ponto
  const valorLimpo = valor.toString().replace(/\./g, '').replace(',', '.');
  return valorLimpo || '0';
};

// Função auxiliar para formatar data (YYYY-MM-DD) - para inputs e envio ao backend
const formatarData = (data) => {
  if (!data) return '';
  const d = new Date(data);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Funções de cálculo de benefícios e encargos (replicam as fórmulas do banco de dados)
const calcularBeneficios = (salariobase) => {
  const salario = parseFloat(removerFormatacaoMoeda(salariobase)) || 0;
  
  if (salario === 0) {
    return {
      ferias: 0,
      decimoterceiro: 0,
      insspatronal: 0,
      insscolaborador: 0,
      fgts: 0
    };
  }

  // Fórmulas baseadas nas práticas trabalhistas brasileiras
  // Férias: 1/3 do salário base
  const ferias = salario / 3;
  
  // 13º Salário: igual ao salário base
  const decimoterceiro = salario;
  
  // INSS Patronal: 20% sobre o salário base
  const insspatronal = salario * 0.20;
  
  // INSS Colaborador: 11% sobre o salário base (pode variar conforme faixa salarial)
  const insscolaborador = salario * 0.11;
  
  // FGTS: 8% sobre o salário base
  const fgts = salario * 0.08;

  return {
    ferias,
    decimoterceiro,
    insspatronal,
    insscolaborador,
    fgts
  };
};

// Função para formatar valor monetário para exibição no input
const formatarValorParaInput = (valor) => {
  if (!valor && valor !== 0) return '0';
  const num = typeof valor === 'number' ? valor : parseFloat(valor);
  if (isNaN(num)) return '0';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const GestaoColaboradores = () => {
  const navigate = useNavigate();
  
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
    ajudacusto: '0',
    valetransporte: '0',
    descricao: '',
    ferias: '0',
    decimoterceiro: '0',
    insspatronal: '0',
    insscolaborador: '0',
    fgts: '0',
    descricao_beneficios: ''
  });
  const [vigenciaFormErrors, setVigenciaFormErrors] = useState({});
  const [submittingVigencia, setSubmittingVigencia] = useState(false);

  // Estados para modal de editar vigência
  const [showModalEditarVigencia, setShowModalEditarVigencia] = useState(false);
  const [vigenciaEditando, setVigenciaEditando] = useState(null);
  const [vigenciaEditFormData, setVigenciaEditFormData] = useState({
    dt_vigencia: '',
    diasuteis: '',
    horascontratadasdia: '',
    salariobase: '',
    ajudacusto: '0',
    valetransporte: '0',
    descricao: '',
    ferias: '0',
    decimoterceiro: '0',
    insspatronal: '0',
    insscolaborador: '0',
    fgts: '0',
    descricao_beneficios: ''
  });
  const [vigenciaEditFormErrors, setVigenciaEditFormErrors] = useState({});
  const [submittingEditVigencia, setSubmittingEditVigencia] = useState(false);

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
    { key: 'valetransporte', label: 'Vale Transporte' },
    { key: 'ferias', label: 'Férias' },
    { key: 'decimoterceiro', label: '13º Salário' },
    { key: 'fgts', label: 'FGTS' },
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
      console.error('Erro ao carregar membros:', error);
      showMessage('Erro ao carregar membros. Tente novamente.', 'error');
      setMembros([]);
      setTodosColaboradoresParaFiltro([]);
    } finally {
      setLoadingMembros(false);
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
        console.log('🔍 Filtrando por colaboradores:', filtroColaboradorId);
        filtroColaboradorId.forEach(id => {
          // Garantir que o ID seja uma string
          params.append('membro_id', String(id));
        });
        console.log('📤 Parâmetros da requisição:', params.toString());
        console.log('📤 URL completa:', `${API_BASE_URL}/custo-membro-vigencia?${params.toString()}`);
      } else {
        console.log('ℹ️ Sem filtro de colaborador - mostrando todos');
      }

      // Filtro "A partir de" - busca vigências com dt_vigencia >= data selecionada
      if (filtroDataAPartirDe) {
        params.append('dt_vigencia_inicio', filtroDataAPartirDe);
      }

      // Se mostrarInativos estiver ativo, filtrar apenas vigências de colaboradores inativos
      if (mostrarInativos) {
        params.append('status', 'inativo');
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
      console.log('📦 Resultado da API:', result);

      if (result.success) {
        let vigenciasData = result.data || [];
        console.log(`✅ Recebidas ${vigenciasData.length} vigências da API`);
        console.log('🔍 IDs dos membros nas vigências recebidas:', vigenciasData.map(v => v.membro_id));
        
        // Se não há filtro de colaborador (Todos os colaboradores), mostrar apenas a mais recente de cada
        // Se HÁ filtro, mostrar TODAS as vigências dos colaboradores selecionados (sem agrupamento)
        if ((!filtroColaboradorId || filtroColaboradorId.length === 0) && vigenciasData.length > 0) {
          console.log('📊 Sem filtro - agrupando por membro e pegando a mais recente de cada');
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
          console.log(`📊 Após agrupamento: ${vigenciasData.length} vigências`);
        } else if (filtroColaboradorId && filtroColaboradorId.length > 0) {
          console.log('✅ Com filtro - mostrando TODAS as vigências dos colaboradores selecionados');
          console.log('🔍 IDs filtrados:', filtroColaboradorId);
          // Verificar se todas as vigências pertencem aos membros filtrados
          const membroIdsFiltrados = filtroColaboradorId.map(id => String(id));
          const vigenciasFiltradas = vigenciasData.filter(v => 
            membroIdsFiltrados.includes(String(v.membro_id))
          );
          console.log(`🔍 Vigências após filtro: ${vigenciasFiltradas.length} de ${vigenciasData.length}`);
          if (vigenciasFiltradas.length !== vigenciasData.length) {
            console.warn('⚠️ Algumas vigências foram filtradas - pode haver problema na API');
            vigenciasData = vigenciasFiltradas;
          }
        }
        
        console.log(`📊 Total de vigências a exibir: ${vigenciasData.length}`);
        setVigencias(vigenciasData);
        setTotalVigencias(vigenciasData.length);
        setTotalPagesVigencias(Math.ceil(vigenciasData.length / itemsPerPageVigencias));
      } else {
        throw new Error(result.error || 'Erro ao carregar vigências');
      }
    } catch (error) {
      console.error('Erro ao carregar vigências:', error);
      showMessage(error.message || 'Erro ao carregar vigências. Tente novamente.', 'error');
      setVigencias([]);
    } finally {
      setLoadingVigencias(false);
    }
  }, [mostrarDetalhes, currentPageVigencias, itemsPerPageVigencias, filtroDataAPartirDe, filtroColaboradorId, mostrarInativos]);

  // Obter nome do membro
  const getNomeMembro = (membroId) => {
    const membro = membros.find(m => m.id === membroId);
    return membro ? membro.nome : `ID: ${membroId}`;
  };

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
        const errorData = await response.json().catch(() => ({ message: 'Não autenticado' }));
        console.error('❌ Não autenticado:', errorData);
        window.location.href = '/login';
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Resposta não é JSON! Status:', response.status);
        console.error('❌ Content-Type:', contentType);
        console.error('❌ Body (primeiros 500 chars):', text.substring(0, 500));
        
        // Se for HTML, pode ser erro 404 ou redirecionamento
        if (contentType.includes('text/html')) {
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/colaboradores existe no backend. Status: ${response.status}`);
        }
        
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error('❌ Erro na resposta:', errorData);
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
      console.error('❌ Erro ao carregar colaboradores:', error);
      const errorMessage = error.message || 'Erro ao carregar colaboradores. Tente novamente.';
      showMessage(errorMessage, 'error');
      setColaboradores([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, mostrarInativos, filtroColaboradorBusca, todosColaboradoresParaFiltro]);

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
      console.error('Erro ao carregar colaborador:', error);
      showMessage('Erro ao carregar colaborador. Tente novamente.', 'error');
    }
  }, []);

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
            // Função auxiliar para converter para número válido ou null
            const toNumberOrNull = (value) => {
              if (!value || value === '') return null;
              const num = parseFloat(value);
              return isNaN(num) ? null : num;
            };

            // Função auxiliar para converter para número válido ou 0
            const toNumberOrZero = (value) => {
              if (!value || value === '') return 0;
              const num = parseFloat(value);
              return isNaN(num) ? 0 : num;
            };

            const payloadVigencia = {
              membro_id: membroId,
              dt_vigencia: formData.dt_vigencia.trim(),
              horascontratadasdia: toNumberOrNull(formData.horascontratadasdia),
              salariobase: formData.salariobase ? toNumberOrNull(removerFormatacaoMoeda(formData.salariobase)) : null,
              ajudacusto: formData.ajudacusto ? toNumberOrZero(removerFormatacaoMoeda(formData.ajudacusto)) : 0,
              valetransporte: formData.valetransporte ? toNumberOrZero(removerFormatacaoMoeda(formData.valetransporte)) : 0,
              descricao: formData.descricao?.trim() || null,
              // NOTA: Campos ferias, decimoterceiro, insspatronal, insscolaborador, fgts são calculados automaticamente pelo banco
              // Não devem ser enviados no payload
              descricao_beneficios: formData.descricao_beneficios?.trim() || null
            };

            console.log('📤 Criando vigência para o novo colaborador:', payloadVigencia);

            const responseVigencia = await fetch(`${API_BASE_URL}/custo-membro-vigencia`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify(payloadVigencia),
            });

            if (responseVigencia.status === 401) {
              window.location.href = '/login';
              return;
            }

            const resultVigencia = await responseVigencia.json();

            if (resultVigencia.success) {
              showMessage(
                'Colaborador e vigência criados com sucesso!',
                'success'
              );
            } else {
              // Colaborador foi criado, mas vigência falhou
              showMessage(
                'Colaborador criado com sucesso, mas houve erro ao criar a vigência: ' + (resultVigencia.error || 'Erro desconhecido'),
                'error'
              );
            }
          } else {
            showMessage(
              'Colaborador criado com sucesso!',
              'success'
            );
          }
        } else {
          showMessage(
            editingId 
              ? 'Colaborador atualizado com sucesso!'
              : 'Colaborador criado com sucesso!',
            'success'
          );
        }
        resetForm();
        await loadColaboradores();
      } else {
        throw new Error(result.error || 'Erro ao salvar colaborador');
      }
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error);
      showMessage(error.message || 'Erro ao salvar colaborador. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingId, loadColaboradores]);

  // Inativar colaborador
  const handleInativar = useCallback(async () => {
    if (!colaboradorToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorToDelete.id}/inativar`, {
        method: 'PUT',
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

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Resposta não é JSON:', text);
        throw new Error(`Erro ao inativar colaborador. Resposta do servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        showMessage('Colaborador inativado com sucesso!', 'success');
        setShowDeleteModal(false);
        setColaboradorToDelete(null);
        await loadColaboradores();
      } else {
        throw new Error(result.error || 'Erro ao inativar colaborador');
      }
    } catch (error) {
      console.error('Erro ao inativar colaborador:', error);
      showMessage(error.message || 'Erro ao inativar colaborador. Tente novamente.', 'error');
      setShowDeleteModal(false);
    }
  }, [colaboradorToDelete, loadColaboradores]);

  // Ativar colaborador
  const handleAtivar = useCallback(async () => {
    if (!colaboradorToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorToDelete.id}/ativar`, {
        method: 'PUT',
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

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Resposta não é JSON:', text);
        throw new Error(`Erro ao ativar colaborador. Resposta do servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        showMessage('Colaborador ativado com sucesso!', 'success');
        setShowDeleteModal(false);
        setColaboradorToDelete(null);
        await loadColaboradores();
      } else {
        throw new Error(result.error || 'Erro ao ativar colaborador');
      }
    } catch (error) {
      console.error('Erro ao ativar colaborador:', error);
      showMessage(error.message || 'Erro ao ativar colaborador. Tente novamente.', 'error');
      setShowDeleteModal(false);
    }
  }, [colaboradorToDelete, loadColaboradores]);

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
      showMessage('Erro: Colaborador não encontrado', 'error');
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
        showMessage('Colaborador atualizado com sucesso!', 'success');
        fecharModalEditarColaborador();
        await loadColaboradores();
      } else {
        throw new Error(result.error || 'Erro ao atualizar colaborador');
      }
    } catch (error) {
      console.error('Erro ao atualizar colaborador:', error);
      showMessage(error.message || 'Erro ao atualizar colaborador. Tente novamente.', 'error');
    } finally {
      setSubmittingEditColaborador(false);
    }
  }, [colaboradorEditFormData, colaboradorEditando, loadColaboradores]);

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
      ajudacusto: '0',
      valetransporte: '0',
      descricao: '',
      ferias: '0',
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
      ajudacusto: '0',
      valetransporte: '0',
      descricao: '',
      ferias: '0',
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
      ajudacusto: '0',
      valetransporte: '0',
      descricao: '',
      ferias: '0',
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
      ajudacusto: vigencia.ajudacusto ? formatarValorParaInput(vigencia.ajudacusto) : '0',
      valetransporte: vigencia.valetransporte ? formatarValorParaInput(vigencia.valetransporte) : '0',
      descricao: vigencia.descricao || '',
      ferias: vigencia.ferias ? formatarValorParaInput(vigencia.ferias) : '0',
      decimoterceiro: vigencia.decimoterceiro ? formatarValorParaInput(vigencia.decimoterceiro) : '0',
      insspatronal: vigencia.insspatronal ? formatarValorParaInput(vigencia.insspatronal) : '0',
      insscolaborador: vigencia.insscolaborador ? formatarValorParaInput(vigencia.insscolaborador) : '0',
      fgts: vigencia.fgts ? formatarValorParaInput(vigencia.fgts) : '0',
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
      ajudacusto: '0',
      valetransporte: '0',
      descricao: '',
      ferias: '0',
      decimoterceiro: '0',
      insspatronal: '0',
      insscolaborador: '0',
      fgts: '0',
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
      case 'ferias':
        return vigencia.ferias ? `R$ ${formatarMoeda(vigencia.ferias)}` : '-';
      case 'decimoterceiro':
        return vigencia.decimoterceiro ? `R$ ${formatarMoeda(vigencia.decimoterceiro)}` : '-';
      case 'fgts':
        return vigencia.fgts ? `R$ ${formatarMoeda(vigencia.fgts)}` : '-';
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

    setSubmittingVigencia(true);

    try {
      const toNumberOrNull = (value) => {
        if (!value || value === '') return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      };

      const toNumberOrZero = (value) => {
        if (!value || value === '') return 0;
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      };

      const payloadVigencia = {
        membro_id: membroIdParaVigencia,
        dt_vigencia: vigenciaFormData.dt_vigencia.trim(),
        horascontratadasdia: toNumberOrNull(vigenciaFormData.horascontratadasdia),
        salariobase: vigenciaFormData.salariobase ? toNumberOrNull(removerFormatacaoMoeda(vigenciaFormData.salariobase)) : null,
        ajudacusto: vigenciaFormData.ajudacusto ? toNumberOrZero(removerFormatacaoMoeda(vigenciaFormData.ajudacusto)) : 0,
        valetransporte: vigenciaFormData.valetransporte ? toNumberOrZero(removerFormatacaoMoeda(vigenciaFormData.valetransporte)) : 0,
        descricao: vigenciaFormData.descricao?.trim() || null,
        descricao_beneficios: vigenciaFormData.descricao_beneficios?.trim() || null
      };

      const response = await fetch(`${API_BASE_URL}/custo-membro-vigencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payloadVigencia),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showMessage('Vigência criada com sucesso!', 'success');
        fecharModalNovaVigencia();
        if (mostrarDetalhes) {
          await loadVigencias();
        }
      } else {
        throw new Error(result.error || 'Erro ao criar vigência');
      }
    } catch (error) {
      console.error('Erro ao criar vigência:', error);
      showMessage(error.message || 'Erro ao criar vigência. Tente novamente.', 'error');
    } finally {
      setSubmittingVigencia(false);
    }
  }, [vigenciaFormData, membroIdParaVigencia, mostrarDetalhes, loadVigencias]);

  // Salvar edição de vigência
  const handleSalvarEditarVigencia = useCallback(async (e) => {
    e.preventDefault();

    if (!vigenciaEditFormData.dt_vigencia || !vigenciaEditFormData.dt_vigencia.trim()) {
      setVigenciaEditFormErrors({ dt_vigencia: 'Data de Vigência é obrigatória' });
      return;
    }

    if (!vigenciaEditando) {
      showMessage('Erro: Vigência não encontrada', 'error');
      return;
    }

    setSubmittingEditVigencia(true);

    try {
      const toNumberOrNull = (value) => {
        if (!value || value === '') return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      };

      const toNumberOrZero = (value) => {
        if (!value || value === '') return 0;
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      };

      const payloadVigencia = {
        dt_vigencia: vigenciaEditFormData.dt_vigencia.trim(),
        horascontratadasdia: toNumberOrNull(vigenciaEditFormData.horascontratadasdia),
        salariobase: vigenciaEditFormData.salariobase ? toNumberOrNull(removerFormatacaoMoeda(vigenciaEditFormData.salariobase)) : null,
        ajudacusto: vigenciaEditFormData.ajudacusto ? toNumberOrZero(removerFormatacaoMoeda(vigenciaEditFormData.ajudacusto)) : 0,
        valetransporte: vigenciaEditFormData.valetransporte ? toNumberOrZero(removerFormatacaoMoeda(vigenciaEditFormData.valetransporte)) : 0,
        descricao: vigenciaEditFormData.descricao?.trim() || null
      };

      const response = await fetch(`${API_BASE_URL}/custo-membro-vigencia/${vigenciaEditando.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payloadVigencia),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showMessage('Vigência atualizada com sucesso!', 'success');
        fecharModalEditarVigencia();
        if (mostrarDetalhes) {
          await loadVigencias();
        }
      } else {
        throw new Error(result.error || 'Erro ao atualizar vigência');
      }
    } catch (error) {
      console.error('Erro ao atualizar vigência:', error);
      showMessage(error.message || 'Erro ao atualizar vigência. Tente novamente.', 'error');
    } finally {
      setSubmittingEditVigencia(false);
    }
  }, [vigenciaEditFormData, vigenciaEditando, mostrarDetalhes, loadVigencias]);

  // Deletar vigência
  const handleDeleteVigencia = useCallback(async () => {
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
        setShowDeleteModalVigencia(false);
        setVigenciaToDelete(null);
        await loadVigencias();
      } else {
        throw new Error(result.error || 'Erro ao deletar vigência');
      }
    } catch (error) {
      console.error('Erro ao deletar vigência:', error);
      showMessage(error.message || 'Erro ao deletar vigência. Tente novamente.', 'error');
      setShowDeleteModalVigencia(false);
    }
  }, [vigenciaToDelete, loadVigencias]);

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
    if (!editingId && formData.salariobase) {
      const beneficios = calcularBeneficios(formData.salariobase);
      setFormData(prev => ({
        ...prev,
        ferias: formatarValorParaInput(beneficios.ferias),
        decimoterceiro: formatarValorParaInput(beneficios.decimoterceiro),
        insspatronal: formatarValorParaInput(beneficios.insspatronal),
        insscolaborador: formatarValorParaInput(beneficios.insscolaborador),
        fgts: formatarValorParaInput(beneficios.fgts)
      }));
    } else if (!formData.salariobase || formData.salariobase === '0' || formData.salariobase === '') {
      // Resetar valores se salário base for removido
      setFormData(prev => ({
        ...prev,
        ferias: '0',
        decimoterceiro: '0',
        insspatronal: '0',
        insscolaborador: '0',
        fgts: '0'
      }));
    }
  }, [formData.salariobase, editingId]);

  // Efeito para calcular benefícios automaticamente quando salariobase mudar no modal de Nova Vigência
  useEffect(() => {
    if (showModalNovaVigencia && vigenciaFormData.salariobase) {
      const beneficios = calcularBeneficios(vigenciaFormData.salariobase);
      setVigenciaFormData(prev => ({
        ...prev,
        ferias: formatarValorParaInput(beneficios.ferias),
        decimoterceiro: formatarValorParaInput(beneficios.decimoterceiro),
        insspatronal: formatarValorParaInput(beneficios.insspatronal),
        insscolaborador: formatarValorParaInput(beneficios.insscolaborador),
        fgts: formatarValorParaInput(beneficios.fgts)
      }));
    } else if (showModalNovaVigencia && (!vigenciaFormData.salariobase || vigenciaFormData.salariobase === '0' || vigenciaFormData.salariobase === '')) {
      // Resetar valores se salário base for removido
      setVigenciaFormData(prev => ({
        ...prev,
        ferias: '0',
        decimoterceiro: '0',
        insspatronal: '0',
        insscolaborador: '0',
        fgts: '0'
      }));
    }
  }, [vigenciaFormData.salariobase, showModalNovaVigencia]);

  // Efeito para calcular benefícios automaticamente quando salariobase mudar no modal de Editar Vigência
  useEffect(() => {
    if (showModalEditarVigencia && vigenciaEditFormData.salariobase) {
      const beneficios = calcularBeneficios(vigenciaEditFormData.salariobase);
      setVigenciaEditFormData(prev => ({
        ...prev,
        ferias: formatarValorParaInput(beneficios.ferias),
        decimoterceiro: formatarValorParaInput(beneficios.decimoterceiro),
        insspatronal: formatarValorParaInput(beneficios.insspatronal),
        insscolaborador: formatarValorParaInput(beneficios.insscolaborador),
        fgts: formatarValorParaInput(beneficios.fgts)
      }));
    } else if (showModalEditarVigencia && (!vigenciaEditFormData.salariobase || vigenciaEditFormData.salariobase === '0' || vigenciaEditFormData.salariobase === '')) {
      // Resetar valores se salário base for removido
      setVigenciaEditFormData(prev => ({
        ...prev,
        ferias: '0',
        decimoterceiro: '0',
        insspatronal: '0',
        insscolaborador: '0',
        fgts: '0'
      }));
    }
  }, [vigenciaEditFormData.salariobase, showModalEditarVigencia]);

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

  // Carregar colaboradores para o filtro (sempre, independente de mostrarDetalhes)
  const loadColaboradoresParaFiltro = useCallback(async () => {
    try {
      console.log('🔄 Carregando colaboradores para filtro...');
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
      console.log('📦 Resultado da API membros-id-nome:', result);

      if (result.success) {
        const colaboradores = result.data || [];
        console.log(`✅ Carregados ${colaboradores.length} colaboradores para o filtro`);
        setTodosColaboradoresParaFiltro(colaboradores);
      } else {
        throw new Error(result.error || 'Erro ao carregar colaboradores para filtro');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar colaboradores para filtro:', error);
      setTodosColaboradoresParaFiltro([]);
    }
  }, []);

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
                <h2 className="form-title">Gestão de Colaboradores</h2>
                <p className="form-subtitle">
                  Gerencie os colaboradores do sistema
                </p>
              </div>
              <button
                onClick={() => navigate('/configuracoes/custo-membro')}
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
                title="Configurações de Custo Membro"
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
          {showForm && (
            <div className="modal-overlay" onClick={resetForm}>
              <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ fontSize: '16px' }}>{editingId ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
                  <button
                    className="btn-icon"
                    onClick={resetForm}
                    title="Fechar"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleSubmit} className="colaborador-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label-small">
                      Nome <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-input-small ${formErrors.nome ? 'error' : ''}`}
                      value={formData.nome}
                      onChange={(e) => {
                        setFormData({ ...formData, nome: e.target.value });
                        if (formErrors.nome) {
                          setFormErrors({ ...formErrors, nome: '' });
                        }
                      }}
                      placeholder="Digite o nome do colaborador"
                      disabled={submitting}
                      required
                    />
                    {formErrors.nome && (
                      <span className="error-message">{formErrors.nome}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label-small">CPF</label>
                    <input
                      type="text"
                      className={`form-input-small ${formErrors.cpf ? 'error' : ''}`}
                      value={formData.cpf}
                      onChange={(e) => {
                        const masked = aplicarMascaraCpf(e.target.value);
                        setFormData({ ...formData, cpf: masked });
                        if (formErrors.cpf) {
                          setFormErrors({ ...formErrors, cpf: '' });
                        }
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      disabled={submitting}
                    />
                    {formErrors.cpf && (
                      <span className="error-message">{formErrors.cpf}</span>
                    )}
                  </div>
                </div>

                {/* Campos de Vigência - apenas para criação de novo colaborador */}
                {!editingId && (
                  <>
                    <div className="form-section" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          marginBottom: vigenciaAberta ? '12px' : '0'
                        }}
                        onClick={() => setVigenciaAberta(!vigenciaAberta)}
                      >
                        <h4 className="form-section-title" style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>Dados de Vigência</h4>
                        <i 
                          className={`fas fa-chevron-${vigenciaAberta ? 'down' : 'right'}`}
                          style={{ 
                            fontSize: '12px', 
                            color: '#64748b',
                            transition: 'transform 0.2s',
                            marginLeft: '8px'
                          }}
                        ></i>
                      </div>
                      
                      {vigenciaAberta && (
                        <div style={{ marginTop: '12px' }}>
                          <div className="form-row-vigencia">
                            <div className="form-group">
                              <label className="form-label-small">
                                Data de Vigência
                              </label>
                              <input
                                type="date"
                                className={`form-input-small ${formErrors.dt_vigencia ? 'error' : ''}`}
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

                            <div className="form-group">
                              <label className="form-label-small">Horas Contratadas/Dia</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-input-small"
                                value={formData.horascontratadasdia}
                                onChange={(e) => setFormData({ ...formData, horascontratadasdia: e.target.value })}
                                placeholder="Ex: 8"
                                disabled={submitting}
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label-small">Salário Base</label>
                              <input
                                type="text"
                                className="form-input-small"
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

                            <div className="form-group" style={{ gridColumn: 'span 1' }}>
                              <label className="form-label-small">Descrição</label>
                              <input
                                type="text"
                                className="form-input-small"
                                value={formData.descricao}
                                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                placeholder="Descrição opcional"
                                disabled={submitting}
                              />
                            </div>
                          </div>

                          {/* Seção de Benefícios e Encargos dentro de Dados de Vigência */}
                          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                            <h4 className="form-section-title" style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Benefícios e Encargos</h4>
                      
                            <div className="form-row-vigencia">
                              <div className="form-group">
                                <label className="form-label-small">Ajuda de Custo</label>
                                <input
                                  type="text"
                                  className="form-input-small"
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
                                <label className="form-label-small">Vale Transporte</label>
                                <input
                                  type="text"
                                  className="form-input-small"
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

                              <div className="form-group">
                                <label className="form-label-small">Férias</label>
                                <input
                                  type="text"
                                  className="form-input-small"
                                  value={formData.ferias}
                                  readOnly
                                  style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                                  placeholder="0,00"
                                  disabled={submitting}
                                  title="Calculado automaticamente"
                                />
                              </div>

                              <div className="form-group">
                                <label className="form-label-small">13º Salário</label>
                                <input
                                  type="text"
                                  className="form-input-small"
                                  value={formData.decimoterceiro}
                                  readOnly
                                  style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                                  placeholder="0,00"
                                  disabled={submitting}
                                  title="Calculado automaticamente"
                                />
                              </div>
                            </div>

                            <div className="form-row-vigencia">
                              <div className="form-group">
                                <label className="form-label-small">FGTS</label>
                                <input
                                  type="text"
                                  className="form-input-small"
                                  value={formData.fgts}
                                  readOnly
                                  style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                                  placeholder="0,00"
                                  disabled={submitting}
                                  title="Calculado automaticamente"
                                />
                              </div>

                              <div className="form-group">
                                <label className="form-label-small">Descrição</label>
                                <input
                                  type="text"
                                  className="form-input-small"
                                  value={formData.descricao_beneficios}
                                  onChange={(e) => setFormData({ ...formData, descricao_beneficios: e.target.value })}
                                  placeholder="Descrição opcional"
                                  disabled={submitting}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                    <div className="modal-footer">
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
              </div>
            </div>
          )}

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
                      console.log('🔍 Filtro de colaborador alterado:', { selectedIds, idsArray });
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
                <div className="loading-container">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Carregando colaboradores...</span>
                </div>
              ) : colaboradores.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-users"></i>
                  <p>Nenhum colaborador encontrado</p>
                </div>
              ) : (
                <>
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
                                onClick={() => handleEdit(colaborador)}
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
                              <span className="action-divider"></span>
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
                                  {/* Moldura */}
                                  <rect x="3" y="4" width="18" height="17" rx="2" strokeWidth="1.6"></rect>
                                  {/* Argolas */}
                                  <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.6"></line>
                                  <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.6"></line>
                                  {/* Linha superior */}
                                  <line x1="3" y1="9" x2="21" y2="9" strokeWidth="1.6"></line>
                                  {/* Folha animada */}
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
                    Mostrando {startItem} a {endItem} de {totalColaboradores} colaboradores
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Lista de vigências */
            <div className="listing-table-container with-horizontal-scroll view-transition view-enter">
              {loadingVigencias ? (
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
                  <table className="listing-table listing-table-draggable">
                    <thead>
                      <tr>
                        {colunasVigencias.map((coluna, index) => (
                          <th
                            key={coluna.key}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            className={
                              draggedColumn === index ? 'dragging' :
                              dragOverIndex === index ? 'drag-over' : ''
                            }
                            style={{
                              cursor: 'grab',
                              userSelect: 'none',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {coluna.label}
                          </th>
                        ))}
                        <th className="actions-column" style={{ whiteSpace: 'nowrap' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vigencias.map((vigencia) => (
                        <tr key={vigencia.id}>
                          {colunasVigencias.map((coluna) => (
                            <td key={coluna.key}>
                              {renderCellValue(vigencia, coluna.key)}
                            </td>
                          ))}
                          <td className="actions-column">
                            <div className="action-buttons">
                              <button
                                className="btn-icon btn-edit edit-anim"
                                onClick={() => handleEditVigencia(vigencia)}
                                title="Editar"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 512 512"
                                  className="edit-anim-icon"
                                >
                                  <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/>
                                </svg>
                              </button>
                              <button
                                className="btn-icon btn-delete bin-button"
                                onClick={() => confirmDeleteVigencia(vigencia)}
                                title="Deletar"
                              >
                                <svg
                                  className="bin-top"
                                  viewBox="0 0 39 7"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <line y1="5" x2="39" y2="5" stroke="currentColor" strokeWidth="7"></line>
                                  <line
                                    x1="12"
                                    y1="1.5"
                                    x2="26.0357"
                                    y2="1.5"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></line>
                                </svg>
                                <svg
                                  className="bin-bottom"
                                  viewBox="0 0 33 39"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <mask id="path-1-inside-1_8_19_vigencia" fill="white">
                                    <path
                                      d="M0 0H33V35C33 37.2091 31.2091 39 29 39H4C1.79086 39 0 37.2091 0 35V0Z"
                                    ></path>
                                  </mask>
                                  <path
                                    d="M0 0H33H0ZM37 35C37 39.4183 33.4183 43 29 43H4C-0.418278 43 -4 39.4183 -4 35H4H29H37ZM4 43C-0.418278 43 -4 39.4183 -4 35V0H4V35V43ZM37 0V35C37 39.4183 33.4183 43 29 43V35V0H37Z"
                                    fill="currentColor"
                                    mask="url(#path-1-inside-1_8_19_vigencia)"
                                  ></path>
                                  <path d="M12 6L12 29" stroke="currentColor" strokeWidth="4"></path>
                                  <path d="M21 6V29" stroke="currentColor" strokeWidth="4"></path>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>

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
      {showDeleteModal && colaboradorToDelete && (
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
                Tem certeza que deseja {mostrarInativos ? 'ativar' : 'inativar'} o colaborador{' '}
                <strong>{colaboradorToDelete.nome}</strong>?
              </p>
              <p className="warning-text">
                {mostrarInativos 
                  ? 'O colaborador será marcado como ativo e aparecerá novamente nas listagens ativas.'
                  : 'O colaborador será marcado como inativo e não aparecerá mais nas listagens ativas.'}
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
                className={mostrarInativos ? "btn-success btn-ativar" : "btn-danger btn-inativar"}
                onClick={mostrarInativos ? handleAtivar : handleInativar}
              >
                {mostrarInativos ? (
                  <>
                    <svg viewBox="0 0 512 512" className="icon-check" width="18" height="18">
                      <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z" fill="currentColor"/>
                    </svg>
                    Ativar
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 512 512" className="icon-ban" width="18" height="18">
                      <circle cx="256" cy="256" r="200" fill="currentColor" opacity="0.1"/>
                      <circle cx="256" cy="256" r="200" fill="none" stroke="currentColor" strokeWidth="32"/>
                      <line x1="150" y1="150" x2="362" y2="362" stroke="currentColor" strokeWidth="32" strokeLinecap="round"/>
                    </svg>
                    Inativar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão de vigência */}
      {showDeleteModalVigencia && vigenciaToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModalVigencia(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmar Exclusão</h3>
              <button
                className="btn-icon"
                onClick={() => setShowDeleteModalVigencia(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Tem certeza que deseja excluir a vigência do colaborador <strong>{getNomeMembro(vigenciaToDelete.membro_id)}</strong>?
              </p>
              <p>
                Data: <strong>{formatarDataBR(vigenciaToDelete.dt_vigencia)}</strong>
              </p>
              <p className="warning-text">
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowDeleteModalVigencia(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={handleDeleteVigencia}
              >
                <i className="fas fa-trash"></i>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Vigência */}
      {showModalNovaVigencia && (
        <div className="modal-overlay" onClick={fecharModalNovaVigencia}>
          <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>Nova Vigência</h3>
              <button
                className="btn-icon"
                onClick={fecharModalNovaVigencia}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSalvarNovaVigencia}>
                <div style={{ marginBottom: '20px' }}>
                  <div className="form-row-vigencia">
                    <div className="form-group">
                      <label className="form-label-small">
                        Colaborador <span className="required">*</span>
                      </label>
                      <select
                        className={`form-input-small ${vigenciaFormErrors.membro_id ? 'error' : ''}`}
                        value={membroIdParaVigencia || ''}
                        onChange={(e) => {
                          const colaboradorId = e.target.value ? parseInt(e.target.value) : null;
                          const colaborador = todosColaboradoresParaFiltro.find(c => c.id === colaboradorId);
                          setMembroIdParaVigencia(colaboradorId);
                          setNomeMembroParaVigencia(colaborador ? colaborador.nome || '' : '');
                          if (vigenciaFormErrors.membro_id) {
                            setVigenciaFormErrors({ ...vigenciaFormErrors, membro_id: '' });
                          }
                        }}
                        disabled={submittingVigencia}
                        required
                      >
                        <option value="">Selecione um colaborador</option>
                        {todosColaboradoresParaFiltro.map((colaborador) => (
                          <option key={colaborador.id} value={colaborador.id}>
                            {colaborador.nome || `Colaborador #${colaborador.id}`}
                            {colaborador.cpf ? ` (${colaborador.cpf})` : ''}
                          </option>
                        ))}
                      </select>
                      {vigenciaFormErrors.membro_id && (
                        <span className="error-message">{vigenciaFormErrors.membro_id}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label-small">
                        Data de Vigência <span className="required">*</span>
                      </label>
                      <input
                        type="date"
                        className={`form-input-small ${vigenciaFormErrors.dt_vigencia ? 'error' : ''}`}
                        value={vigenciaFormData.dt_vigencia}
                        onChange={(e) => {
                          setVigenciaFormData({ ...vigenciaFormData, dt_vigencia: e.target.value });
                          if (vigenciaFormErrors.dt_vigencia) {
                            setVigenciaFormErrors({ ...vigenciaFormErrors, dt_vigencia: '' });
                          }
                        }}
                        disabled={submittingVigencia}
                        required
                      />
                      {vigenciaFormErrors.dt_vigencia && (
                        <span className="error-message">{vigenciaFormErrors.dt_vigencia}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label-small">Horas Contratadas/Dia</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input-small"
                        value={vigenciaFormData.horascontratadasdia}
                        onChange={(e) => setVigenciaFormData({ ...vigenciaFormData, horascontratadasdia: e.target.value })}
                        placeholder="Ex: 8"
                        disabled={submittingVigencia}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label-small">Salário Base</label>
                      <input
                        type="text"
                        className="form-input-small"
                        value={vigenciaFormData.salariobase}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, '');
                          if (valor) {
                            const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            });
                            setVigenciaFormData({ ...vigenciaFormData, salariobase: valorFormatado });
                          } else {
                            setVigenciaFormData({ ...vigenciaFormData, salariobase: '' });
                          }
                        }}
                        placeholder="0,00"
                        disabled={submittingVigencia}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label-small">Descrição</label>
                      <input
                        type="text"
                        className="form-input-small"
                        value={vigenciaFormData.descricao}
                        onChange={(e) => setVigenciaFormData({ ...vigenciaFormData, descricao: e.target.value })}
                        placeholder="Descrição opcional"
                        disabled={submittingVigencia}
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
                          value={vigenciaFormData.ajudacusto}
                          onChange={(e) => {
                            const valor = e.target.value.replace(/\D/g, '');
                            if (valor) {
                              const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              });
                              setVigenciaFormData({ ...vigenciaFormData, ajudacusto: valorFormatado });
                            } else {
                              setVigenciaFormData({ ...vigenciaFormData, ajudacusto: '0' });
                            }
                          }}
                          placeholder="0,00"
                          disabled={submittingVigencia}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">Vale Transporte</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaFormData.valetransporte}
                          onChange={(e) => {
                            const valor = e.target.value.replace(/\D/g, '');
                            if (valor) {
                              const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              });
                              setVigenciaFormData({ ...vigenciaFormData, valetransporte: valorFormatado });
                            } else {
                              setVigenciaFormData({ ...vigenciaFormData, valetransporte: '0' });
                            }
                          }}
                          placeholder="0,00"
                          disabled={submittingVigencia}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">Férias</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaFormData.ferias}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigencia}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">13º Salário</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaFormData.decimoterceiro}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigencia}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">FGTS</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaFormData.fgts}
                          readOnly
                          style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                          placeholder="0,00"
                          disabled={submittingVigencia}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label-small">Descrição</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaFormData.descricao_beneficios}
                          onChange={(e) => setVigenciaFormData({ ...vigenciaFormData, descricao_beneficios: e.target.value })}
                          placeholder="Descrição opcional"
                          disabled={submittingVigencia}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={fecharModalNovaVigencia}
                    disabled={submittingVigencia}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submittingVigencia}
                  >
                    {submittingVigencia ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        Salvar Vigência
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Vigência */}
      {showModalEditarVigencia && vigenciaEditando && (
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
                        disabled={submittingEditVigencia}
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
                        disabled={submittingEditVigencia}
                      />
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
                        disabled={submittingEditVigencia}
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
                        disabled={submittingEditVigencia}
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
                          disabled={submittingEditVigencia}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">Vale Transporte</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.valetransporte}
                          onChange={(e) => {
                            const valor = e.target.value.replace(/\D/g, '');
                            if (valor) {
                              const valorFormatado = (parseFloat(valor) / 100).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              });
                              setVigenciaEditFormData({ ...vigenciaEditFormData, valetransporte: valorFormatado });
                            } else {
                              setVigenciaEditFormData({ ...vigenciaEditFormData, valetransporte: '0' });
                            }
                          }}
                          placeholder="0,00"
                          disabled={submittingEditVigencia}
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
                          disabled={submittingEditVigencia}
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
                          disabled={submittingEditVigencia}
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
                          disabled={submittingEditVigencia}
                          title="Calculado automaticamente"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-small">Descrição</label>
                        <input
                          type="text"
                          className="form-input-small"
                          value={vigenciaEditFormData.descricao_beneficios}
                          onChange={(e) => setVigenciaEditFormData({ ...vigenciaEditFormData, descricao_beneficios: e.target.value })}
                          placeholder="Descrição opcional"
                          disabled={submittingEditVigencia}
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
                    disabled={submittingEditVigencia}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submittingEditVigencia}
                  >
                    {submittingEditVigencia ? (
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


