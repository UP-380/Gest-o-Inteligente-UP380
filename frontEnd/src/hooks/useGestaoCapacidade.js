import { useState, useCallback, useRef } from 'react';
import { fetchCapacidade } from '../services/gestaoCapacidadeAPI';

/**
 * Hook customizado para gerenciar dados da Gestão de Capacidade (nova API hierárquica).
 *
 * Aceita `ordem_niveis` diretamente do estado da UI — sem auto-gerar.
 * O usuário define 100% da ordem via HierarchyOrderBuilder.
 */
export default function useGestaoCapacidade() {
    // Estado principal
    const [hierarquia, setHierarquia] = useState(null);
    const [resumo, setResumo] = useState(null);
    const [periodo, setPeriodo] = useState(null);
    const [resumosPorNivel, setResumosPorNivel] = useState(null);
    const [ordemNiveis, setOrdemNiveis] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const abortRef = useRef(null);

    /**
     * Carrega dados da API hierárquica.
     *
     * @param {Object} params
     * @param {string} params.dataInicio - 'YYYY-MM-DD'
     * @param {string} params.dataFim - 'YYYY-MM-DD'
     * @param {string[]} params.ordemNiveis - Ordem EXATA definida pelo usuário (sem auto-gerar)
     * @param {Object} [params.filtros] - IDs de filtro { colaborador_id, cliente_id, ... }
     * @param {boolean} [params.ignorarFinaisSemana]
     * @param {boolean} [params.ignorarFeriados]
     * @param {boolean} [params.ignorarFolgas]
     */
    const carregarDados = useCallback(async ({
        dataInicio,
        dataFim,
        ordemNiveis: ordemNiveisParam,
        filtros = {},
        ignorarFinaisSemana = false,
        ignorarFeriados = false,
        ignorarFolgas = false,
    } = {}) => {
        // Validar que ordem_niveis foi fornecida
        if (!ordemNiveisParam || ordemNiveisParam.length === 0) {
            setError('Defina pelo menos um nível na hierarquia.');
            return;
        }

        // Cancelar requisição anterior se existir
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const resultado = await fetchCapacidade({
                data_inicio: dataInicio,
                data_fim: dataFim,
                ordem_niveis: ordemNiveisParam,
                filtros,
                ignorar_finais_semana: ignorarFinaisSemana,
                ignorar_feriados: ignorarFeriados,
                ignorar_folgas: ignorarFolgas,
            });

            // Se a requisição foi cancelada, não atualizar estado
            if (controller.signal.aborted) return;

            if (resultado.success) {
                setHierarquia(resultado.data || {});
                setResumo(resultado.resumo || {});
                setPeriodo(resultado.periodo || null);
                setOrdemNiveis(ordemNiveisParam);

                // Extrair resumos por nível
                const resumos = {};
                Object.keys(resultado).forEach(key => {
                    if (key.startsWith('resumo_')) {
                        resumos[key] = resultado[key];
                    }
                });
                setResumosPorNivel(Object.keys(resumos).length > 0 ? resumos : null);
            } else {
                setError(resultado.error || 'Erro desconhecido da API');
            }
        } catch (err) {
            if (controller.signal.aborted) return;
            setError(err.message || 'Erro ao carregar dados');
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    const limpar = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
        setHierarquia(null);
        setResumo(null);
        setPeriodo(null);
        setResumosPorNivel(null);
        setOrdemNiveis([]);
        setLoading(false);
        setError(null);
    }, []);

    return {
        hierarquia,
        resumo,
        periodo,
        resumosPorNivel,
        ordemNiveis,
        loading,
        error,
        carregarDados,
        limpar,
    };
}
