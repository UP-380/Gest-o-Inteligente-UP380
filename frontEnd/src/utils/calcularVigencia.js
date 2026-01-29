/**
 * Calcula os benefícios trabalhistas baseados na configuração de custo-colaborador
 * Busca a configuração vigente na data informada e usa os valores cadastrados
 * 
 * @param {string|number} salarioBase - Salário base (pode vir formatado como string "1.000,00")
 * @param {string|null} dataVigencia - Data de vigência (obrigatória para buscar a config correta)
 * @param {number|null} diasUteisVigencia - Número de dias úteis da vigência atual (usado em TODOS os cálculos)
 * @param {number|null} horasContratadasDia - Horas contratadas por dia (para cálculo do custo hora)
 * @param {number|string|null} tipoContrato - Tipo de contrato (para buscar a configuração correta)
 * @returns {Promise<Object>} Objeto com os benefícios calculados (valores diários)
 */
export const calcularVigencia = async (salarioBase, dataVigencia = null, diasUteisVigencia = null, horasContratadasDia = null, tipoContrato = null) => {
  // Remover formatação do salário base se for string
  let salario = 0;
  if (typeof salarioBase === 'string') {
    // Remove pontos e vírgulas, depois divide por 100 para converter centavos
    const valorLimpo = salarioBase.replace(/[^\d]/g, '');
    salario = parseFloat(valorLimpo) / 100;
  } else if (typeof salarioBase === 'number') {
    salario = salarioBase;
  }

  if (isNaN(salario) || salario <= 0) {
    return {
      ferias: 0,
      terco_ferias: 0,
      decimoterceiro: 0,
      fgts: 0,
      insscolaborador: 0,
      valetransporte: 0,
      vale_refeicao: 0,
      custo_total_mensal: 0,
      custo_hora: 0
    };
  }

  // Buscar configuração de custo-colaborador vigente na data informada
  let config = null;
  
  // data_vigencia é obrigatória para buscar a configuração vigente
  if (!dataVigencia) {
    console.warn('calcularVigencia: dataVigencia não fornecida, não será possível buscar configuração');
  } else {
    try {
      const API_BASE_URL = '/api';
      
      // Garantir formato YYYY-MM-DD
      let dataFormatada = dataVigencia;
      if (dataVigencia.includes('T')) {
        dataFormatada = dataVigencia.split('T')[0];
      } else if (dataVigencia.includes('/')) {
        // Se estiver no formato DD/MM/YYYY, converter para YYYY-MM-DD
        const partes = dataVigencia.split('/');
        if (partes.length === 3) {
          dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
      }
      
      let url = `${API_BASE_URL}/config-custo-colaborador/mais-recente?data_vigencia=${dataFormatada}`;
      
      // Adicionar tipo_contrato se fornecido
      if (tipoContrato !== null && tipoContrato !== undefined && tipoContrato !== '') {
        const tipoContratoNum = parseInt(tipoContrato, 10);
        if (!isNaN(tipoContratoNum)) {
          url += `&tipo_contrato=${tipoContratoNum}`;
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          config = result.data;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar configuração vigente:', error);
      // Continuar com valores zerados se der erro
    }
  }

  // Se não encontrou config, retornar valores zerados
  if (!config) {
    return {
      ferias: 0,
      terco_ferias: 0,
      decimoterceiro: 0,
      fgts: 0,
      insscolaborador: 0,
      valetransporte: 0,
      vale_refeicao: 0,
      custo_total_mensal: 0,
      custo_hora: 0
    };
  }

  // Usar dias_uteis da configuração como fallback (última vigência da tabela config_custo_membro)
  const diasUteisConfig = config.dias_uteis || 22;
  
  // Usar dias úteis da vigência atual (padronizado para TODOS os cálculos)
  // Se não fornecido, usar o mesmo da config
  const diasUteisVigenciaAtual = diasUteisVigencia || diasUteisConfig;

  // CÁLCULOS BASEADOS NA CONFIGURAÇÃO:
  // IMPORTANTE: Férias, 1/3 Férias e 13º Salário são PROVISÕES ANUAIS
  // Devem ser provisionadas mensalmente (dividir por 12 meses)
  // FGTS é um encargo mensal direto (não precisa dividir por 12)
  // TODOS os valores diários usam diasUteisVigenciaAtual para padronização
  
  // FGTS: porcentagem sobre o salário (encargo mensal direto), depois dividir por diasUteisVigenciaAtual
  const fgtsPercent = config.fgts || 0;
  const fgtsMensal = (fgtsPercent / 100) * salario;
  const fgts = diasUteisVigenciaAtual > 0 ? fgtsMensal / diasUteisVigenciaAtual : 0;

  // Férias: PROVISÃO ANUAL - porcentagem sobre o salário, dividir por 12 meses, depois dividir por diasUteisVigenciaAtual
  // Exemplo: 100% = 1 salário por ano = salario/12 por mês
  const feriasPercent = config.ferias || 0;
  const feriasAnual = (feriasPercent / 100) * salario; // Valor anual
  const feriasMensal = feriasAnual / 12; // Provisão mensal
  const ferias = diasUteisVigenciaAtual > 0 ? feriasMensal / diasUteisVigenciaAtual : 0;

  // 1/3 de Férias: PROVISÃO ANUAL - porcentagem sobre o salário, dividir por 12 meses, depois dividir por diasUteisVigenciaAtual
  // Exemplo: 33,33% = 1/3 de 1 salário por ano = (salario/3)/12 = salario/36 por mês
  const tercoFeriasPercent = config.terco_ferias || 0;
  const tercoFeriasAnual = (tercoFeriasPercent / 100) * salario; // Valor anual
  const tercoFeriasMensal = tercoFeriasAnual / 12; // Provisão mensal
  const terco_ferias = diasUteisVigenciaAtual > 0 ? tercoFeriasMensal / diasUteisVigenciaAtual : 0;

  // 13º Salário: PROVISÃO ANUAL - porcentagem sobre o salário, dividir por 12 meses, depois dividir por diasUteisVigenciaAtual
  // Exemplo: 100% = 1 salário por ano = salario/12 por mês
  const decimoTerceiroPercent = config.decimo_terceiro || 0;
  const decimoTerceiroAnual = (decimoTerceiroPercent / 100) * salario; // Valor anual
  const decimoTerceiroMensal = decimoTerceiroAnual / 12; // Provisão mensal
  const decimoterceiro = diasUteisVigenciaAtual > 0 ? decimoTerceiroMensal / diasUteisVigenciaAtual : 0;

  // Vale Transporte: valor fixo por dia (já está correto na config)
  const valetransporte = config.vale_transporte || 0;

  // Vale Refeição: valor fixo por dia (já está correto na config)
  const vale_refeicao = config.vale_alimentacao || 0;

  // INSS Colaborador: ~11% do salário (com teto), depois dividir por diasUteisVigenciaAtual
  // NOTA: Este valor é uma RETENÇÃO do colaborador, não é custo da empresa (não entra no custo total)
  const tetoINSS = 7507.49;
  const baseINSS = Math.min(salario, tetoINSS);
  const insscolaboradorMensal = baseINSS * 0.11;
  const insscolaborador = diasUteisVigenciaAtual > 0 ? insscolaboradorMensal / diasUteisVigenciaAtual : 0;

  // NOTA: Ajuda de Custo não é calculada automaticamente, é um campo manual
  // Por isso não está incluída nos cálculos automáticos

  // Calcular Custo Total Mensal
  // O custo total mensal deve ser a soma de TODOS os custos mensais da EMPRESA
  // NOTA: Ajuda de Custo não é incluída porque é um campo manual e não é calculado automaticamente
  // NOTA: INSS Colaborador NÃO é incluído porque é uma RETENÇÃO do colaborador, não um custo da empresa
  
  // Valores mensais (já calculados acima):
  // - Salário base mensal = salario (já é mensal)
  // - Férias mensal = feriasMensal (provisão mensal = valor anual / 12)
  // - 1/3 Férias mensal = tercoFeriasMensal (provisão mensal = valor anual / 12)
  // - 13º Salário mensal = decimoTerceiroMensal (provisão mensal = valor anual / 12)
  // - FGTS mensal = fgtsMensal
  // - INSS Colaborador mensal = insscolaboradorMensal (RETENÇÃO - NÃO incluir no custo total)
  // - Vale Transporte mensal = valetransporte * diasUteisVigenciaAtual (já é por dia)
  // - Vale Refeição mensal = vale_refeicao * diasUteisVigenciaAtual (já é por dia)
  
  const valetransporteMensal = valetransporte * diasUteisVigenciaAtual;
  const valeRefeicaoMensal = vale_refeicao * diasUteisVigenciaAtual;
  
  // Custo Total Mensal = Salário Base + Todos os Benefícios e Encargos Mensais da EMPRESA
  // IMPORTANTE: INSS Colaborador é uma retenção do colaborador, NÃO é custo da empresa
  const custo_total_mensal = salario + 
                            feriasMensal + 
                            tercoFeriasMensal + 
                            decimoTerceiroMensal + 
                            fgtsMensal + 
                            // insspatronalMensal REMOVIDO - campo não existe mais
                            // insscolaboradorMensal REMOVIDO - é retenção do colaborador, não custo da empresa
                            valetransporteMensal + 
                            valeRefeicaoMensal;

  // Calcular Custo Hora
  // Custo Hora = Custo Total Mensal / (jornada mensal em horas)
  // Jornada mensal = horas por dia × dias úteis da vigência atual
  let custo_hora = 0;
  if (horasContratadasDia && horasContratadasDia > 0 && diasUteisVigenciaAtual > 0) {
    const jornadaMensalHoras = horasContratadasDia * diasUteisVigenciaAtual;
    if (jornadaMensalHoras > 0) {
      custo_hora = custo_total_mensal / jornadaMensalHoras;
    }
  }

  return {
    ferias: Math.round(ferias * 100) / 100,
    terco_ferias: Math.round(terco_ferias * 100) / 100,
    decimoterceiro: Math.round(decimoterceiro * 100) / 100,
    fgts: Math.round(fgts * 100) / 100,
    // insspatronal REMOVIDO - campo não existe mais
    insscolaborador: Math.round(insscolaborador * 100) / 100,
    valetransporte: Math.round(valetransporte * 100) / 100,
    vale_refeicao: Math.round(vale_refeicao * 100) / 100,
    custo_total_mensal: Math.round(custo_total_mensal * 100) / 100,
    custo_hora: Math.round(custo_hora * 100) / 100
  };
};
