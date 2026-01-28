import React, { useState, useEffect } from 'react';
import { produtosAPI } from '../../../services/api';

const ProdutosContent = ({ clienteId, colaboradorId, registros }) => {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarProdutos = async () => {
      // Regra 1: Bloqueio imediato se solicitado globalmente (ex: filtro sem responsável ou backend sobrecarregado)
      if (window.blockDetailedFetches || window.backendOverloaded === true) {
        setLoading(false);
        return;
      }

      if (!registros || registros.length === 0) {
        setProdutos([]);
        setLoading(false);
        return;
      }

      // Coletar clickup_ids únicos dos produtos
      const clickupIdsSet = new Set();
      registros.forEach(registro => {
        if (registro.tarefa && registro.tarefa.produto_id) {
          const clickupId = String(registro.tarefa.produto_id).trim();
          if (clickupId) {
            clickupIdsSet.add(clickupId);
          }
        }
      });

      if (clickupIdsSet.size === 0) {
        setProdutos([]);
        setLoading(false);
        return;
      }

      // Buscar nomes dos produtos usando getById com controle de concorrência
      try {
        const clickupIds = Array.from(clickupIdsSet);
        const produtosArray = [];
        const batchSize = 5;

        for (let i = 0; i < clickupIds.length; i += batchSize) {
          const batch = clickupIds.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (id) => {
              try {
                const res = await produtosAPI.getById(id);
                let nome = `Produto #${id}`;
                if (res.success && res.data && res.data.nome) {
                  nome = res.data.nome;
                }
                return { clickup_id: id, nome };
              } catch (err) {
                console.error(`Erro ao buscar produto ${id}:`, err);
                return { clickup_id: id, nome: `Produto #${id}` };
              }
            })
          );
          produtosArray.push(...results);
        }

        setProdutos(produtosArray);
      } catch (error) {
        console.error('Erro ao buscar nomes dos produtos:', error);
        // Em caso de erro crítico, usar apenas os IDs
        const clickupIds = Array.from(clickupIdsSet);
        const produtosArray = clickupIds.map(clickupId => ({
          clickup_id: clickupId,
          nome: `Produto #${clickupId}`
        }));
        setProdutos(produtosArray);
      } finally {
        setLoading(false);
      }
    };

    carregarProdutos();
  }, [clienteId, colaboradorId, registros]);

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: '13px' }}>Carregando produtos...</div>;
  }

  if (produtos.length === 0) {
    return <div style={{ color: '#6b7280', fontSize: '13px' }}>Nenhum produto encontrado</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(50vh - 80px)', overflowY: 'auto', paddingRight: '8px' }}>
      {produtos.map((produto, index) => {
        return (
          <div
            key={produto.clickup_id || index}
            className="produto-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              background: '#fff3e0',
              borderLeft: '4px solid #ffb74d',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ffe0b2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff3e0')}
          >
            <i className="fas fa-folder" style={{ color: '#ff9800', fontSize: '18px' }}></i>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 500, color: '#ff9800', fontSize: '14px' }}>{produto.nome}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProdutosContent;

