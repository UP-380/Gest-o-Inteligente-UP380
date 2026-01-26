/**
 * Utilitários para formatação de datas
 */

/**
 * Formata uma data para o padrão brasileiro
 * @param {string|Date} dateString - Data a ser formatada
 * @param {boolean} includeTime - Se deve incluir hora
 * @returns {string} Data formatada ou '-'
 */
export const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);

    if (includeTime) {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

/**
 * Calcula a Páscoa para um determinado ano (algoritmo de Meeus/Jones/Butcher)
 * @param {number} year - Ano
 * @returns {Date} Data da Páscoa
 */
const calcularPascoa = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

/**
 * Obtém a lista de feriados brasileiros para um determinado ano
 * @param {number} year - Ano
 * @returns {Array<Date>} Array de datas de feriados
 */
const obterFeriadosBrasileiros = (year) => {
  const feriados = [];

  // Feriados fixos
  feriados.push(new Date(year, 0, 1));   // Ano Novo
  feriados.push(new Date(year, 3, 21));  // Tiradentes
  feriados.push(new Date(year, 4, 1));   // Dia do Trabalhador
  feriados.push(new Date(year, 8, 7));   // Independência
  feriados.push(new Date(year, 9, 12));  // Nossa Senhora Aparecida
  feriados.push(new Date(year, 10, 2));  // Finados
  feriados.push(new Date(year, 10, 15)); // Proclamação da República
  feriados.push(new Date(year, 10, 20)); // Dia da Consciência Negra (não é feriado nacional, mas comum em alguns estados)
  feriados.push(new Date(year, 11, 25)); // Natal

  // Feriados móveis baseados na Páscoa
  const pascoa = calcularPascoa(year);

  // Carnaval (48 dias antes da Páscoa)
  const carnaval = new Date(pascoa);
  carnaval.setDate(pascoa.getDate() - 48);
  feriados.push(carnaval);

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const sextaFeiraSanta = new Date(pascoa);
  sextaFeiraSanta.setDate(pascoa.getDate() - 2);
  feriados.push(sextaFeiraSanta);

  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(pascoa.getDate() + 60);
  feriados.push(corpusChristi);

  return feriados;
};

/**
 * Verifica se uma data é um feriado brasileiro
 * @param {Date} date - Data a ser verificada
 * @returns {boolean} True se for feriado
 */
const isFeriado = (date) => {
  const year = date.getFullYear();
  const feriados = obterFeriadosBrasileiros(year);

  return feriados.some(feriado => {
    return feriado.getDate() === date.getDate() &&
      feriado.getMonth() === date.getMonth() &&
      feriado.getFullYear() === date.getFullYear();
  });
};

/**
 * Verifica se uma data é final de semana
 * @param {Date} date - Data a ser verificada
 * @returns {boolean} True se for sábado ou domingo
 */
const isFinalDeSemana = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = domingo, 6 = sábado
};

/**
 * Calcula o número de dias úteis entre duas datas (excluindo finais de semana e feriados)
 * @param {string|Date} dataInicio - Data de início
 * @param {string|Date} dataFim - Data de fim
 * @returns {number} Número de dias úteis
 */
export const calcularDiasUteis = (dataInicio, dataFim) => {
  if (!dataInicio || !dataFim) return 0;

  try {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    // Normalizar para início do dia
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);

    if (inicio > fim) return 0;

    let diasUteis = 0;
    const dataAtual = new Date(inicio);

    // Iterar por cada dia no período
    while (dataAtual <= fim) {
      // Verificar se não é final de semana e não é feriado
      if (!isFinalDeSemana(dataAtual) && !isFeriado(dataAtual)) {
        diasUteis++;
      }

      // Avançar para o próximo dia
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    return diasUteis;
  } catch (error) {
    console.error('Erro ao calcular dias úteis:', error);
    return 0;
  }
};

/**
 * Calcula o número de dias entre duas datas considerando opções de incluir finais de semana e feriados
 * @param {string|Date} dataInicio - Data de início
 * @param {string|Date} dataFim - Data de fim
 * @param {boolean} incluirFinaisSemana - Se deve incluir finais de semana
 * @param {boolean} incluirFeriados - Se deve incluir feriados
 * @returns {number} Número de dias
 */
export const calcularDiasComOpcoes = (dataInicio, dataFim, incluirFinaisSemana = false, incluirFeriados = false) => {
  if (!dataInicio || !dataFim) return 0;

  try {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    // Normalizar para início do dia
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);

    if (inicio > fim) return 0;

    let dias = 0;
    const dataAtual = new Date(inicio);

    // Iterar por cada dia no período
    while (dataAtual <= fim) {
      const isWeekend = isFinalDeSemana(dataAtual);
      const isHoliday = isFeriado(dataAtual);

      // Se deve incluir o dia
      let incluirDia = true;

      // Se não deve incluir finais de semana e é final de semana, não incluir
      if (!incluirFinaisSemana && isWeekend) {
        incluirDia = false;
      }

      // Se não deve incluir feriados e é feriado, não incluir
      if (!incluirFeriados && isHoliday) {
        incluirDia = false;
      }

      if (incluirDia) {
        dias++;
      }

      // Avançar para o próximo dia
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    return dias;
  } catch (error) {
    console.error('Erro ao calcular dias com opções:', error);
    return 0;
  }
};

// Função auxiliar para formatar data no formato YYYY-MM-DD
const formatDateForInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Obter conjunto de datas válidas no período (considerando opções e datas individuais)
export const obterDatasValidasNoPeriodo = (dataInicio, dataFim, incluirFinaisSemana = false, incluirFeriados = false, datasIndividuais = []) => {
  if (!dataInicio || !dataFim) return new Set();

  try {
    // Garantir que as datas sejam interpretadas no timezone local, não UTC
    // Se a data vier como string "YYYY-MM-DD", criar Date manualmente para evitar problemas de timezone
    let inicio, fim;

    if (typeof dataInicio === 'string' && dataInicio.match(/^\d{4}-\d{2}-\d{2}/)) {
      // Formato YYYY-MM-DD: criar Date no timezone local
      const [ano, mes, dia] = dataInicio.split('T')[0].split('-');
      inicio = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0, 0);
    } else {
      inicio = new Date(dataInicio);
      inicio.setHours(0, 0, 0, 0);
    }

    if (typeof dataFim === 'string' && dataFim.match(/^\d{4}-\d{2}-\d{2}/)) {
      // Formato YYYY-MM-DD: criar Date no timezone local
      const [ano, mes, dia] = dataFim.split('T')[0].split('-');
      fim = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0, 0);
    } else {
      fim = new Date(dataFim);
      fim.setHours(0, 0, 0, 0);
    }

    if (inicio > fim) return new Set();

    // Criar Set de datas individuais desselecionadas para busca rápida
    const datasIndividuaisSet = new Set(datasIndividuais || []);

    const datasValidas = new Set();
    const dataAtual = new Date(inicio);

    // Iterar por cada dia no período
    while (dataAtual <= fim) {
      const dataStr = formatDateForInput(dataAtual);
      const isWeekend = isFinalDeSemana(dataAtual);
      const isHoliday = isFeriado(dataAtual);

      // Verificar se deve incluir o dia
      let incluirDia = true;

      // Se não deve incluir finais de semana e é final de semana, não incluir
      if (!incluirFinaisSemana && isWeekend) {
        incluirDia = false;
      }

      // Se não deve incluir feriados e é feriado, não incluir
      if (!incluirFeriados && isHoliday) {
        incluirDia = false;
      }

      // Se a data está em datasIndividuais, excluir (foi desselecionada)
      if (datasIndividuaisSet.has(dataStr)) {
        incluirDia = false;
      }

      if (incluirDia) {
        datasValidas.add(dataStr);
      }

      // Avançar para o próximo dia
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    return datasValidas;
  } catch (error) {
    console.error('Erro ao obter datas válidas no período:', error);
    return new Set();
  }
};

// Calcular dias considerando opções e datas individuais (selecionadas/desselecionadas)
export const calcularDiasComOpcoesEDatasIndividuais = (dataInicio, dataFim, incluirFinaisSemana = false, incluirFeriados = false, datasIndividuais = []) => {
  if (!dataInicio || !dataFim) return 0;

  try {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    // Normalizar para início do dia
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);

    if (inicio > fim) return 0;

    // Criar Set de datas individuais para busca rápida
    const datasIndividuaisSet = new Set(datasIndividuais || []);

    let dias = 0;
    const dataAtual = new Date(inicio);

    // Iterar por cada dia no período
    while (dataAtual <= fim) {
      const dataStr = formatDateForInput(dataAtual);
      const isWeekend = isFinalDeSemana(dataAtual);
      const isHoliday = isFeriado(dataAtual);

      // Se deve incluir o dia
      let incluirDia = true;

      // Se não deve incluir finais de semana e é final de semana, não incluir
      if (!incluirFinaisSemana && isWeekend) {
        incluirDia = false;
      }

      // Se não deve incluir feriados e é feriado, não incluir
      if (!incluirFeriados && isHoliday) {
        incluirDia = false;
      }

      // Se a data está em datasIndividuais, excluir do cálculo (foi desselecionada)
      if (datasIndividuaisSet.has(dataStr)) {
        incluirDia = false;
      }

      if (incluirDia) {
        dias++;
      }

      // Avançar para o próximo dia
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    return dias;
  } catch (error) {
    console.error('Erro ao calcular dias com opções e datas individuais:', error);
    return 0;
  }
};

/**
 * Calcula o número de dias válidos apenas com uma lista de datas individuais
 * Considera opções de incluir finais de semana e feriados
 * @param {Array<string>} datasIndividuais - Array de datas no formato YYYY-MM-DD
 * @param {boolean} incluirFinaisSemana - Se deve incluir finais de semana
 * @param {boolean} incluirFeriados - Se deve incluir feriados
 * @returns {number} Número de dias válidos
 */
export const calcularDiasApenasComDatasIndividuais = (datasIndividuais = [], incluirFinaisSemana = false, incluirFeriados = false) => {
  if (!Array.isArray(datasIndividuais) || datasIndividuais.length === 0) {
    return 0;
  }

  try {
    let dias = 0;

    // Iterar por cada data individual
    datasIndividuais.forEach(dataStr => {
      if (!dataStr || typeof dataStr !== 'string') return;

      try {
        // Converter string para Date
        const data = new Date(dataStr + 'T00:00:00');
        if (isNaN(data.getTime())) return;

        const isWeekend = isFinalDeSemana(data);
        const isHoliday = isFeriado(data);

        // Verificar se deve incluir o dia
        let incluirDia = true;

        // Se não deve incluir finais de semana e é final de semana, não incluir
        if (!incluirFinaisSemana && isWeekend) {
          incluirDia = false;
        }

        // Se não deve incluir feriados e é feriado, não incluir
        if (!incluirFeriados && isHoliday) {
          incluirDia = false;
        }

        if (incluirDia) {
          dias++;
        }
      } catch (error) {
        console.warn('Erro ao processar data individual:', dataStr, error);
      }
    });

    return dias;
  } catch (error) {
    console.error('Erro ao calcular dias apenas com datas individuais:', error);
    return 0;
  }
};

/**
 * Formata milissegundos para o formato "Xh Ymin Zs"
 * @param {number} ms - Milissegundos
 * @param {boolean} includeSeconds - Se deve incluir segundos
 * @returns {string} Tempo formatado
 */
export const formatTimeDuration = (ms, includeSeconds = false) => {
  if (!ms || ms === 0) return includeSeconds ? '0s' : '0h';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  if (includeSeconds && (seconds > 0 || (hours === 0 && minutes === 0))) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join(' ') : (includeSeconds ? '0s' : '0h');
};








