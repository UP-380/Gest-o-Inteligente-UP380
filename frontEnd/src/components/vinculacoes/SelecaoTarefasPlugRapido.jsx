import React, { useState, useEffect, useRef, useMemo } from 'react';
import CustomSelect from './CustomSelect';
import '../clients/SelecaoTarefasPorProduto.css';

const API_BASE_URL = '/api';

const SelecaoTarefasPlugRapido = ({
    clienteId,
    produtoId,
    onTarefaSelect, // (tarefaId) => ...
    selectedTarefaId
}) => {
    // Como é 'Plug Rápido', precisamos apenas listar as tarefas que o usuário pode escolher.
    // O usuário quer: "os campos de cliente e produto, use os mesmos componentes que usamos na página de nova atribuição... eu não posso ter que selecionar o produto, ele já deve vir selecionado... veja a imagem, não está trazendo as tarefas Vinculadas a X produto X cliente".
    // Isso significa que precisamos carregar as tarefas vinculadas a Cliente + Produto.
    // Usaremos a lógica de carregar tarefas do SelecaoTarefasPorProduto, mas simplificado para um dropdown único.

    const [tarefas, setTarefas] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (clienteId && produtoId) {
            loadTarefas();
        } else {
            setTarefas([]);
        }
    }, [clienteId, produtoId]);

    const loadTarefas = async () => {
        setLoading(true);
        try {
            // Endpoint que retorna tarefas vinculadas a Cliente e Produto
            const url = `${API_BASE_URL}/tarefas-por-cliente-produtos?clienteId=${clienteId}&produtoIds=${produtoId}`;
            const res = await fetch(url);
            const json = await res.json();

            if (json.success && json.data) {
                // A estrutura de resposta geralmente é [{ produtoId: ..., tarefas: [...] }] ou direto array dependendo do endpoint.
                // O endpoint /tarefas-por-cliente-produtos retorna [{ produtoId: 1, tarefas: [...] }]

                const data = json.data;
                const produtoData = data.find(p => String(p.produtoId) === String(produtoId));

                if (produtoData && produtoData.tarefas) {
                    // Mapear para o formato do CustomSelect
                    const options = produtoData.tarefas.map(t => ({
                        value: String(t.id),
                        label: t.nome
                    }));
                    setTarefas(options);
                } else {
                    setTarefas([]);
                }
            } else {
                setTarefas([]);
            }

        } catch (error) {
            console.error("Erro ao carregar tarefas para plug rápido", error);
            setTarefas([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="selecao-tarefa-plug-rapido">
            <CustomSelect
                value={selectedTarefaId}
                options={tarefas}
                onChange={(e) => onTarefaSelect(e.target.value)}
                placeholder={loading ? "Carregando tarefas..." : "Selecione a Tarefa"}
                disabled={loading || !produtoId}
                enableSearch={true}
            />
        </div>
    );
};

export default SelecaoTarefasPlugRapido;
