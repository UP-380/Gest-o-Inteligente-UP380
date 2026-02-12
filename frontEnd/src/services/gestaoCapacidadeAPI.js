/**
 * Serviço para comunicação com a nova API hierárquica de Gestão de Capacidade (Bun)
 * Proxied via Node backend: POST /api/gestao-capacidade-v2
 */

const API_ENDPOINT = '/api/gestao-capacidade-v2';

/**
 * Mapeamento de filtro UI → nível da API
 * O frontend usa nomes legados, a API usa nomes padronizados
 */
const FILTRO_PARA_NIVEL = {
    responsavel: 'colaborador',
    cliente: 'cliente',
    produto: 'produto',
    atividade: 'tarefa',
    tipoTarefa: 'tipo_tarefa',
};

/**
 * Mapeamento reverso: nível API → filtro UI
 */
const NIVEL_PARA_FILTRO = {
    colaborador: 'responsavel',
    cliente: 'cliente',
    produto: 'produto',
    tarefa: 'atividade',
    tipo_tarefa: 'tipoTarefa',
};

/**
 * Ícone por nível (para renderização nos cards)
 */
const ICONE_POR_NIVEL = {
    colaborador: 'fas fa-user-tie',
    cliente: 'fas fa-briefcase',
    produto: 'fas fa-box',
    tarefa: 'fas fa-list',
    tipo_tarefa: 'fas fa-tags',
};

/**
 * Label por nível (para exibição nos cards)
 */
const LABEL_POR_NIVEL = {
    colaborador: 'Responsável',
    cliente: 'Cliente',
    produto: 'Produto',
    tarefa: 'Tarefa',
    tipo_tarefa: 'Tipo de Tarefa',
};

/**
 * Busca dados hierárquicos de capacidade na nova API Bun
 *
 * @param {Object} params
 * @param {string} params.data_inicio - Data início (YYYY-MM-DD)
 * @param {string} params.data_fim - Data fim (YYYY-MM-DD)
 * @param {string[]} params.ordem_niveis - Níveis na ordem desejada (ex: ['colaborador', 'cliente', 'tarefa'])
 * @param {Object} [params.filtros] - Filtros opcionais { colaborador_id, cliente_id, produto_id, tipo_tarefa_id, tarefa_id }
 * @param {boolean} [params.ignorar_finais_semana] - Excluir finais de semana
 * @param {boolean} [params.ignorar_feriados] - Excluir feriados
 * @param {boolean} [params.ignorar_folgas] - Excluir folgas
 * @returns {Promise<{success: boolean, data: Object, resumo: Object, periodo: Object}>}
 */
export async function fetchCapacidade({
    data_inicio,
    data_fim,
    ordem_niveis,
    filtros = {},
    ignorar_finais_semana = false,
    ignorar_feriados = false,
    ignorar_folgas = false,
}) {
    const body = {
        data_inicio,
        data_fim,
        ordem_niveis,
        ignorar_finais_semana,
        ignorar_feriados,
        ignorar_folgas,
    };

    // Adicionar filtros se existirem (remover vazios)
    if (filtros.colaborador_id) body.colaborador_id = Array.isArray(filtros.colaborador_id) ? filtros.colaborador_id : [filtros.colaborador_id];
    if (filtros.cliente_id) body.cliente_id = Array.isArray(filtros.cliente_id) ? filtros.cliente_id : [filtros.cliente_id];
    if (filtros.produto_id) body.produto_id = Array.isArray(filtros.produto_id) ? filtros.produto_id : [filtros.produto_id];
    if (filtros.tipo_tarefa_id) body.tipo_tarefa_id = Array.isArray(filtros.tipo_tarefa_id) ? filtros.tipo_tarefa_id : [filtros.tipo_tarefa_id];
    if (filtros.tarefa_id) body.tarefa_id = Array.isArray(filtros.tarefa_id) ? filtros.tarefa_id : [filtros.tarefa_id];

    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Converte filtros do frontend (nomes legados) para o payload da API
 *
 * @param {string} filtroPrincipal - Filtro UI ativo ('responsavel', 'cliente', etc.)
 * @param {Object} filtrosSelecionados - IDs selecionados por tipo
 * @returns {{ nivel_raiz: string, ordem_niveis: string[] }}
 */
export function montarOrdemNiveis(filtroPrincipal, niveisDetalhe = []) {
    const nivelRaiz = FILTRO_PARA_NIVEL[filtroPrincipal] || 'colaborador';

    // Montar ordem dos níveis: raiz + detalhes (sem duplicar a raiz)
    const todos = [nivelRaiz, ...niveisDetalhe.filter(n => n !== nivelRaiz)];

    return todos;
}

/**
 * Formata milissegundos para exibição "Xh Ymin Zs"
 */
export function formatarMs(ms, incluirSegundos = false) {
    if (!ms || ms <= 0) return '0h 0min';
    const totalSegundos = Math.floor(ms / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    let resultado = `${horas}h ${minutos}min`;
    if (incluirSegundos && segundos > 0) {
        resultado += ` ${segundos}s`;
    }
    return resultado;
}

/**
 * Formata valor monetário em BRL
 */
export function formatarMoeda(valor) {
    if (valor == null || isNaN(valor)) return 'R$ 0,00';
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
    });
}

export {
    FILTRO_PARA_NIVEL,
    NIVEL_PARA_FILTRO,
    ICONE_POR_NIVEL,
    LABEL_POR_NIVEL,
};
