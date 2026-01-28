/**
 * Funções utilitárias para formatação e validação de vigências
 */

// Função auxiliar para formatar data em formato brasileiro (DD/MM/YYYY) - para exibição
export const formatarDataBR = (data) => {
  if (!data) return '';
  const d = new Date(data);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Função auxiliar para formatar número monetário
export const formatarMoeda = (valor) => {
  if (!valor && valor !== 0) return '';
  return parseFloat(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Função auxiliar para aplicar máscara de CPF
export const aplicarMascaraCpf = (valor) => {
  const apenasNumeros = valor.replace(/\D/g, '');
  const numeroLimitado = apenasNumeros.substring(0, 11);
  return numeroLimitado
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Função para remover formatação de moeda (formato brasileiro: 1.234,56)
export const removerFormatacaoMoeda = (valor) => {
  if (!valor || valor === '' || valor === null || valor === undefined) return '0';
  // Remove pontos (separadores de milhar) e substitui vírgula por ponto
  const valorLimpo = valor.toString().replace(/\./g, '').replace(',', '.');
  return valorLimpo || '0';
};

// Função auxiliar para formatar data (YYYY-MM-DD) - para inputs e envio ao backend
export const formatarData = (data) => {
  if (!data) return '';
  const d = new Date(data);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Função para formatar valor monetário para exibição no input
export const formatarValorParaInput = (valor) => {
  if (!valor && valor !== 0) return '0';
  
  // Se o valor já vem como string formatada (ex: "9,00" ou "9.00"), 
  // primeiro converter para número antes de formatar novamente
  let num;
  if (typeof valor === 'number') {
    num = valor;
  } else if (typeof valor === 'string') {
    // Se for string, pode vir formatada (com vírgula) ou como número puro
    // Remover formatação primeiro (pontos e vírgulas)
    const valorLimpo = valor.replace(/\./g, '').replace(',', '.');
    num = parseFloat(valorLimpo);
  } else {
    num = parseFloat(valor);
  }
  
  if (isNaN(num)) {
    console.warn('⚠️ [formatarValorParaInput] Valor inválido:', valor, 'tipo:', typeof valor);
    return '0';
  }
  
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

