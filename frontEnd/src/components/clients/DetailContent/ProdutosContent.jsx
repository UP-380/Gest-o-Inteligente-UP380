import React, { useState, useEffect } from 'react';

const ProdutosContent = ({ clienteId, colaboradorId, registros }) => {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarProdutos = async () => {
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

      // Buscar nomes dos produtos usando clickup_id
      try {
        const clickupIds = Array.from(clickupIdsSet);
        const idsParam = clickupIds.join(',');
        
        const getApiBaseUrl = () => {
          if (typeof window !== 'undefined' && window.ApiConfig) {
            return window.ApiConfig.baseURL;
          }
          return '/api';
        };
        
        const API_BASE_URL = getApiBaseUrl();
        const url = `${API_BASE_URL}/produtos-por-ids?ids=${encodeURIComponent(idsParam)}`;
        
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Criar array de produtos com clickup_id e nome
            const produtosArray = clickupIds.map(clickupId => ({
              clickup_id: clickupId,
              nome: result.data[clickupId] || `Produto #${clickupId}`
            }));
            setProdutos(produtosArray);
          } else {
            // Se não encontrou nomes, usar apenas os IDs
            const produtosArray = clickupIds.map(clickupId => ({
              clickup_id: clickupId,
              nome: `Produto #${clickupId}`
            }));
            setProdutos(produtosArray);
          }
        } else {
          // Se der erro, usar apenas os IDs
          const produtosArray = clickupIds.map(clickupId => ({
            clickup_id: clickupId,
            nome: `Produto #${clickupId}`
          }));
          setProdutos(produtosArray);
        }
      } catch (error) {
        console.error('Erro ao buscar nomes dos produtos:', error);
        // Em caso de erro, usar apenas os IDs
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

