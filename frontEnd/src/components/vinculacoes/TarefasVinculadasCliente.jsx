import React, { useState, useEffect } from 'react';
import './TarefasVinculadasCliente.css';

const API_BASE_URL = '/api';

/**
 * Componente reutilizável para exibir tarefas vinculadas a um cliente
 * Busca tarefas diretamente na tabela vinculados usando cp_cliente e cp_tarefa
 */
const TarefasVinculadasCliente = ({ clienteId, produtos = [] }) => {
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [tarefasPorProduto, setTarefasPorProduto] = useState({}); // { produtoId: [{ id, nome }] }

  // Buscar tarefas vinculadas ao cliente e produtos
  useEffect(() => {
    if (clienteId) {
      if (produtos && produtos.length > 0) {
        // Se há produtos, buscar tarefas por cliente E produtos
        loadTarefasPorClienteEProdutos(clienteId, produtos);
      } else {
        // Se não há produtos, buscar todas as tarefas do cliente
        loadTarefasPorCliente(clienteId);
      }
    } else {
      setTarefas([]);
      setTarefasPorProduto({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, JSON.stringify(produtos)]);

  const loadTarefasPorClienteEProdutos = async (clienteIdParam, produtosParam) => {
    if (!clienteIdParam || !produtosParam || produtosParam.length === 0) {
      setTarefas([]);
      setTarefasPorProduto({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const produtoIds = produtosParam.map(p => {
        const produtoId = typeof p === 'object' ? p.id : p;
        return parseInt(produtoId, 10);
      }).filter(id => !isNaN(id) && id > 0);

      if (produtoIds.length === 0) {
        setTarefas([]);
        setTarefasPorProduto({});
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/tarefas-por-cliente-produtos?clienteId=${clienteIdParam}&produtoIds=${produtoIds.join(',')}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Converter array em objeto { produtoId: tarefas }
          const tarefasMap = {};
          const todasTarefas = [];
          const tarefasIds = new Set();

          result.data.forEach(item => {
            // Garantir que produtoId seja número para consistência
            const produtoIdKey = typeof item.produtoId === 'number' ? item.produtoId : parseInt(item.produtoId, 10);
            if (!isNaN(produtoIdKey)) {
              tarefasMap[produtoIdKey] = item.tarefas || [];
              (item.tarefas || []).forEach(tarefa => {
                if (!tarefasIds.has(tarefa.id)) {
                  tarefasIds.add(tarefa.id);
                  todasTarefas.push(tarefa);
                }
              });
            }
          });
          setTarefasPorProduto(tarefasMap);
          setTarefas(todasTarefas);
        } else {
          console.warn('⚠️ Resposta sem dados:', result);
          setTarefas([]);
          setTarefasPorProduto({});
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Erro ao buscar tarefas');
        setTarefas([]);
        setTarefasPorProduto({});
      }
    } catch (error) {
      console.error('Erro ao buscar tarefas vinculadas:', error);
      setError('Erro ao buscar tarefas vinculadas');
      setTarefas([]);
      setTarefasPorProduto({});
    } finally {
      setLoading(false);
    }
  };

  const loadTarefasPorCliente = async (clienteIdParam) => {
    if (!clienteIdParam) {
      setTarefas([]);
      setTarefasPorProduto({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/tarefas-por-cliente?clienteId=${clienteIdParam}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTarefas(result.data || []);
          setTarefasPorProduto({});
        } else {
          setTarefas([]);
          setTarefasPorProduto({});
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Erro ao buscar tarefas');
        setTarefas([]);
        setTarefasPorProduto({});
      }
    } catch (error) {
      console.error('Erro ao buscar tarefas vinculadas:', error);
      setError('Erro ao buscar tarefas vinculadas');
      setTarefas([]);
      setTarefasPorProduto({});
    } finally {
      setLoading(false);
    }
  };

  // Se não há cliente, não renderizar nada
  if (!clienteId) {
    return null;
  }

  // Se há produtos, mostrar tarefas agrupadas por produto
  if (produtos && produtos.length > 0) {
    return (
      <div className="tarefas-vinculadas-container">
        {produtos.map(produto => {
          const produtoId = typeof produto === 'object' ? produto.id : produto;
          const produtoIdNum = parseInt(produtoId, 10);
          const produtoNome = typeof produto === 'object' ? produto.nome : `Produto #${produtoId}`;
          // Tentar buscar com número e também com string para garantir
          // Buscar tarefas do produto - tentar com número e string
          let tarefasDoProduto = tarefasPorProduto[produtoIdNum];
          if (!tarefasDoProduto) {
            // Tentar com string
            tarefasDoProduto = tarefasPorProduto[String(produtoIdNum)];
          }
          if (!tarefasDoProduto) {
            // Tentar com o ID original
            tarefasDoProduto = tarefasPorProduto[produtoId];
          }
          if (!tarefasDoProduto) {
            tarefasDoProduto = [];
          }
          
          return (
            <div key={produtoId} className="tarefas-vinculadas-item">
              <div className="produto-nome">
                <i className="fas fa-box" style={{ marginRight: '6px', color: '#64748b' }}></i>
                {produtoNome}
              </div>
              {loading ? (
                <div className="loading-tarefas">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Carregando tarefas...</span>
                </div>
              ) : error ? (
                <div className="error-message">
                  <i className="fas fa-exclamation-circle"></i>
                  <span>{error}</span>
                </div>
              ) : tarefasDoProduto.length > 0 ? (
                <ul className="tarefas-list">
                  {tarefasDoProduto.map(tarefa => (
                    <li key={tarefa.id}>
                      {tarefa.nome || `Tarefa #${tarefa.id}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-message">
                  Nenhuma tarefa vinculada a este produto
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Se não há produtos, mostrar todas as tarefas do cliente
  return (
    <div className="tarefas-vinculadas-container">
      <div className="tarefas-vinculadas-item">
        {loading ? (
          <div className="loading-tarefas">
            <i className="fas fa-spinner fa-spin"></i>
            <span>Carregando tarefas...</span>
          </div>
        ) : error ? (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        ) : tarefas.length > 0 ? (
          <ul className="tarefas-list">
            {tarefas.map(tarefa => (
              <li key={tarefa.id}>
                {tarefa.nome || `Tarefa #${tarefa.id}`}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-message">
            Nenhuma tarefa vinculada a este cliente
          </div>
        )}
      </div>
    </div>
  );
};

export default TarefasVinculadasCliente;

