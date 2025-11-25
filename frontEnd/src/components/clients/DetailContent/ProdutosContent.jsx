import React, { useState, useEffect } from 'react';

const ProdutosContent = ({ clienteId, registros }) => {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarProdutos = async () => {
      if (!registros || registros.length === 0) {
        setLoading(false);
        return;
      }

      const produtosMap = new Map();
      registros.forEach(registro => {
        if (registro.tarefa && registro.tarefa.produto_id) {
          const produtoId = String(registro.tarefa.produto_id).trim();
          if (registro.tarefa.produto) {
            if (!produtosMap.has(produtoId)) {
              produtosMap.set(produtoId, registro.tarefa.produto);
            }
          } else if (!produtosMap.has(produtoId)) {
            produtosMap.set(produtoId, { id: produtoId, nome: null });
          }
        }
      });

      if (produtosMap.size === 0) {
        setLoading(false);
        return;
      }

      // Buscar nomes dos produtos se necessário
      const produtosParaBuscar = Array.from(produtosMap.entries()).filter(([id, produto]) => !produto.nome);
      if (produtosParaBuscar.length > 0) {
        try {
          const urlCliente = `${window.location.hostname === 'localhost' ? 'http://localhost:4001' : ''}/api/produtos-cliente/${clienteId}`;
          const responseCliente = await fetch(urlCliente);
          const resultCliente = await responseCliente.json();

          if (resultCliente.success && resultCliente.produtos && Array.isArray(resultCliente.produtos)) {
            resultCliente.produtos.forEach((nomeProduto, index) => {
              if (index < produtosParaBuscar.length) {
                const [produtoId] = produtosParaBuscar[index];
                const produtoAtual = produtosMap.get(produtoId);
                produtosMap.set(produtoId, { ...produtoAtual, id: produtoId, nome: nomeProduto });
              }
            });
          }
        } catch (error) {
          console.error('Erro ao buscar nomes dos produtos:', error);
        }
      }

      setProdutos(Array.from(produtosMap.values()));
      setLoading(false);
    };

    carregarProdutos();
  }, [clienteId, registros]);

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: '13px' }}>Carregando produtos...</div>;
  }

  if (produtos.length === 0) {
    return <div style={{ color: '#6b7280', fontSize: '13px' }}>Nenhum produto encontrado</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(50vh - 80px)', overflowY: 'auto', paddingRight: '8px' }}>
      {produtos.map((produto, index) => {
        const nomeProduto = produto.nome || `Produto #${produto.id}`;
        return (
          <div
            key={produto.id || index}
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
              <span style={{ fontWeight: 500, color: '#ff9800', fontSize: '14px' }}>{nomeProduto}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProdutosContent;

