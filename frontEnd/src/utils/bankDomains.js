/**
 * Mapeamento de códigos e nomes de bancos para seus domínios
 * Usado para buscar logos via API BankConv
 */

const bankDomainsMap = {
  // Bancos principais brasileiros
  '001': 'bb.com.br',
  '237': 'bradesco.com.br',
  '341': 'itau.com.br',
  '104': 'caixa.gov.br',
  '033': 'santander.com.br',
  '422': 'safra.com.br',
  '748': 'sicredi.com.br',
  '756': 'bancoob.com.br',
  '260': 'nubank.com.br',
  '290': 'pagbank.com.br',
  '336': 'c6bank.com.br',
  '208': 'btgpactual.com',
  '212': 'original.com.br',
  '077': 'bancointer.com.br',
  '085': 'coop.com.br',
  '070': 'bancoob.com.br',
  '136': 'unibancocredicoop.com.br',
  '218': 'bs2.com.br',
  '265': 'bancofator.com.br',
  '318': 'banco.com.br',
  '356': 'picpay.com',
  '380': 'picpay.com',
  '637': 'soberano.com.br',
  '655': 'votorantim.com.br',
  '707': 'daycoval.com.br',
  '712': 'bancoourinvest.com.br',
  '739': 'banco.com.br',
  '746': 'bancomodal.com.br',
  '747': 'banco.com.br',
  '748': 'sicredi.com.br',
  '751': 'scotiabank.com',
  '752': 'banco.com.br',
  '753': 'novobanco.com.br',
  '755': 'banco.com.br',
  '756': 'bancoob.com.br',
  '757': 'banco.com.br',
};

/**
 * Mapeamento de nomes de bancos para domínios (case-insensitive)
 */
const bankNamesMap = {
  'banco do brasil': 'bb.com.br',
  'bradesco': 'bradesco.com.br',
  'itau': 'itau.com.br',
  'itau unibanco': 'itau.com.br',
  'caixa': 'caixa.gov.br',
  'caixa economica federal': 'caixa.gov.br',
  'santander': 'santander.com.br',
  'safra': 'safra.com.br',
  'sicredi': 'sicredi.com.br',
  'bancoob': 'bancoob.com.br',
  'nubank': 'nubank.com.br',
  'pagbank': 'pagbank.com.br',
  'c6 bank': 'c6bank.com.br',
  'c6bank': 'c6bank.com.br',
  'btg pactual': 'btgpactual.com',
  'original': 'original.com.br',
  'banco inter': 'bancointer.com.br',
  'inter': 'bancointer.com.br',
  'picpay': 'picpay.com',
  'votorantim': 'votorantim.com.br',
  'daycoval': 'daycoval.com.br',
  'ourinvest': 'bancoourinvest.com.br',
  'scotiabank': 'scotiabank.com',
  'novo banco': 'novobanco.com.br',
};

/**
 * Obtém o domínio do banco baseado no código ou nome
 * @param {string} codigo - Código do banco (ex: "001")
 * @param {string} nome - Nome do banco (ex: "Banco do Brasil")
 * @returns {string|null} - Domínio do banco ou null se não encontrado
 */
export const getBankDomain = (codigo, nome) => {
  // Primeiro tenta pelo código
  if (codigo) {
    const codigoLimpo = String(codigo).trim().padStart(3, '0');
    if (bankDomainsMap[codigoLimpo]) {
      return bankDomainsMap[codigoLimpo];
    }
  }

  // Se não encontrou pelo código, tenta pelo nome
  if (nome) {
    const nomeLower = String(nome).toLowerCase().trim();
    
    // Busca exata
    if (bankNamesMap[nomeLower]) {
      return bankNamesMap[nomeLower];
    }

    // Busca parcial (caso o nome tenha variações)
    for (const [key, domain] of Object.entries(bankNamesMap)) {
      if (nomeLower.includes(key) || key.includes(nomeLower)) {
        return domain;
      }
    }
  }

  return null;
};

/**
 * Gera a URL do logo do banco usando BankConv API
 * @param {string} codigo - Código do banco
 * @param {string} nome - Nome do banco
 * @param {number} size - Tamanho do logo (padrão: 256)
 * @returns {string|null} - URL do logo ou null se não encontrado
 */
export const getBankLogoUrl = (codigo, nome, size = 256) => {
  const domain = getBankDomain(codigo, nome);
  if (!domain) {
    return null;
  }

  return `https://logo.bankconv.com/${domain}?size=${size}`;
};

export default {
  getBankDomain,
  getBankLogoUrl,
  bankDomainsMap,
  bankNamesMap,
};

