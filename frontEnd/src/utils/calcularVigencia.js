/**
 * Calcula os benefícios trabalhistas baseados na configuração de custo-colaborador
 * Busca a configuração mais próxima da data de vigência e usa os valores cadastrados
 * 
 * @param {string|number} salarioBase - Salário base (pode vir formatado como string "1.000,00")
 * @param {string|null} dataVigencia - Data de vigência (obrigatória para buscar a config correta)
 * @param {number|null} diasUteis - Número de dias úteis do mês (opcional, padrão: 22)
 * @returns {Promise<Object>} Objeto com os benefícios calculados
 */
export const calcularVigencia = async (salarioBase, dataVigencia = null, diasUteis = null) => {
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
      insspatronal: 0,
      insscolaborador: 0,
      valetransporte: 0,
      vale_refeicao: 0
    };
  }

  // Buscar configuração de custo-colaborador mais recente até a data de vigência
  let config = null;
  try {
    const API_BASE_URL = '/api';
    let url = `${API_BASE_URL}/config-custo-colaborador/mais-recente`;
    
    // Se tiver data de vigência, usar para buscar a config mais próxima
    if (dataVigencia) {
      // Garantir formato YYYY-MM-DD
      const dataFormatada = dataVigencia.includes('T') 
        ? dataVigencia.split('T')[0] 
        : dataVigencia;
      url += `?data_vigencia=${dataFormatada}`;
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
      } else {
      }
    } else {
    }
  } catch (error) {
    // Continuar com valores zerados se der erro
  }

  // Se não encontrou config, retornar valores zerados
  if (!config) {
    return {
      ferias: 0,
      terco_ferias: 0,
      decimoterceiro: 0,
      fgts: 0,
      insspatronal: 0,
      insscolaborador: 0,
      valetransporte: 0,
      vale_refeicao: 0
    };
  }

  // Usar dias úteis padrão se não fornecido
  const diasUteisMes = diasUteis || 22;

  // CÁLCULOS BASEADOS NA CONFIGURAÇÃO:
  // Campos do tipo 'percent' (fgts, ferias, terco_ferias, decimo_terceiro):
  // - Valores são porcentagens (ex: 8 = 8%, 100 = 100%)
  // - Dividir por 100 e multiplicar pelo salário
  
  // FGTS: porcentagem sobre o salário
  const fgtsPercent = config.fgts || 0;
  const fgts = (fgtsPercent / 100) * salario;

  // Férias: porcentagem sobre o salário
  const feriasPercent = config.ferias || 0;
  const ferias = (feriasPercent / 100) * salario;

  // 1/3 de Férias: porcentagem sobre o salário
  const tercoFeriasPercent = config.terco_ferias || 0;
  const terco_ferias = (tercoFeriasPercent / 100) * salario;

  // 13º Salário: porcentagem sobre o salário
  const decimoTerceiroPercent = config.decimo_terceiro || 0;
  const decimoterceiro = (decimoTerceiroPercent / 100) * salario;

  // Vale Transporte: valor fixo mensal (independente do salário e dias úteis)
  const valetransporte = config.vale_transporte || 0;

  // Vale Refeição: valor fixo mensal (independente do salário e dias úteis)
  const vale_refeicao = config.vale_alimentacao || 0;

  // INSS Patronal: ~20% do salário (mantido como cálculo padrão, pois não está na config)
  const insspatronal = salario * 0.20;

  // INSS Colaborador: ~11% do salário (com teto)
  // Teto do INSS em 2024: R$ 7.507,49
  const tetoINSS = 7507.49;
  const baseINSS = Math.min(salario, tetoINSS);
  const insscolaborador = baseINSS * 0.11;

  return {
    ferias: Math.round(ferias * 100) / 100,
    terco_ferias: Math.round(terco_ferias * 100) / 100,
    decimoterceiro: Math.round(decimoterceiro * 100) / 100,
    fgts: Math.round(fgts * 100) / 100,
    insspatronal: Math.round(insspatronal * 100) / 100,
    insscolaborador: Math.round(insscolaborador * 100) / 100,
    valetransporte: Math.round(valetransporte * 100) / 100,
    vale_refeicao: Math.round(vale_refeicao * 100) / 100
  };
};
