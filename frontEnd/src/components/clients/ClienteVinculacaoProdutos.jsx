import React, { useState, useEffect } from 'react';
import CustomSelect from '../vinculacoes/CustomSelect';
import SelectedItemsList from '../vinculacoes/SelectedItemsList';
import { useToast } from '../../hooks/useToast';
import '../vinculacoes/VinculacaoModal.css';

const API_BASE_URL = '/api';

/**
 * Componente simplificado para vincular apenas produtos ao cliente
 */
const ClienteVinculacaoProdutos = ({ clienteId, onSaveVinculacao }) => {
  const showToast = useToast();
  const [produtos, setProdutos] = useState([]);
  const [selectedProdutos, setSelectedProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Carregar produtos e produtos já vinculados
  useEffect(() => {
    if (clienteId && !initialized) {
      loadAllData();
    }
  }, [clienteId, initialized]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Carregar todos os produtos
      const produtosRes = await fetch(`${API_BASE_URL}/produtos?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (produtosRes.ok) {
        const produtosData = await produtosRes.json();
        if (produtosData.success) {
          setProdutos(produtosData.data || []);
        }
      }

      // Carregar produtos já vinculados ao cliente
      await loadVinculados();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast('error', 'Erro ao carregar produtos. Tente novamente.');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  // Carregar produtos já vinculados ao cliente
  const loadVinculados = async () => {
    try {
      // Buscar todos os vinculados com filtro de produto
      const response = await fetch(`${API_BASE_URL}/vinculados?filtro_produto=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Filtrar apenas vinculados deste cliente com produtos
          const vinculadosCliente = result.data.filter(v => {
            const vClienteId = v.cp_cliente || v.cliente_id;
            return String(vClienteId) === String(clienteId) && (v.cp_produto || v.produto_id);
          });
          
          // Extrair IDs únicos dos produtos vinculados
          const produtosVinculados = new Set();
          vinculadosCliente.forEach(v => {
            const produtoId = v.cp_produto || v.produto_id;
            if (produtoId) {
              produtosVinculados.add(String(produtoId));
            }
          });

          setSelectedProdutos(Array.from(produtosVinculados));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar produtos vinculados:', error);
    }
  };

  const getProdutoLabel = (produtoId) => {
    const produto = produtos.find(p => String(p.id) === String(produtoId));
    return produto ? produto.nome : `Produto #${produtoId}`;
  };

  const handleProdutoChange = (value) => {
    if (!value) return;

    const valueStr = String(value);
    const isSelected = selectedProdutos.includes(valueStr);

    if (isSelected) {
      setSelectedProdutos(prev => prev.filter(id => id !== valueStr));
    } else {
      setSelectedProdutos(prev => [...prev, valueStr]);
    }
  };

  const handleRemoveProduto = (produtoId) => {
    setSelectedProdutos(prev => prev.filter(id => id !== String(produtoId)));
  };

  const handleSelectAll = () => {
    const allProdutoIds = produtos.map(p => String(p.id));
    const allSelected = allProdutoIds.every(id => selectedProdutos.includes(id));

    if (allSelected) {
      setSelectedProdutos([]);
    } else {
      setSelectedProdutos(allProdutoIds);
    }
  };

  const getProdutoOptions = () => {
    return produtos.map(produto => ({
      value: produto.id,
      label: produto.nome
    }));
  };

  const handleSave = async () => {
    if (!clienteId) {
      return { success: false, error: 'ID do cliente não informado' };
    }

    setSubmitting(true);

    try {
      // 1. Verificar/atualizar cp_vinculacao para garantir que cp_produto está marcado
      const responseVinculacao = await fetch(`${API_BASE_URL}/vinculacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cp_cliente: false,
          cp_produto: true,
          cp_tarefa: false,
          cp_tarefa_tipo: false
        }),
      });

      if (responseVinculacao.status === 401) {
        window.location.href = '/login';
        return { success: false, error: 'Não autorizado' };
      }

      const resultVinculacao = await responseVinculacao.json();
      if (!responseVinculacao.ok) {
        const errorMsg = resultVinculacao.error || resultVinculacao.details || 'Erro ao salvar vinculação';
        return { success: false, error: errorMsg };
      }

      // 2. Criar combinações cliente + produto
      const combinacoes = selectedProdutos.map(produtoIdStr => {
        const produtoId = parseInt(produtoIdStr, 10);
        return {
          cp_cliente: String(clienteId).trim(),
          cp_produto: produtoId,
          cp_tarefa: null,
          cp_tarefa_tipo: null
        };
      });

      // 3. Salvar na tabela vinculados
      if (combinacoes.length > 0) {
        const responseVinculados = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            vinculados: combinacoes
          }),
        });

        if (responseVinculados.status === 401) {
          window.location.href = '/login';
          return { success: false, error: 'Não autorizado' };
        }

        if (!responseVinculados.ok) {
          const contentTypeVinculados = responseVinculados.headers.get('content-type') || '';
          if (contentTypeVinculados.includes('application/json')) {
            const resultVinculados = await responseVinculados.json();
            const errorMsg = resultVinculados.error || resultVinculados.details || 'Erro ao salvar vinculados';
            return { success: false, error: errorMsg };
          } else {
            const text = await responseVinculados.text();
            return { success: false, error: text || `Erro HTTP ${responseVinculados.status}` };
          }
        }
      }

      // Recarregar produtos vinculados
      await loadVinculados();

      return { success: true };
    } catch (error) {
      console.error('Erro ao salvar vinculação de produtos:', error);
      return { success: false, error: error.message || 'Erro ao salvar vinculação. Verifique sua conexão e tente novamente.' };
    } finally {
      setSubmitting(false);
    }
  };

  // Expor função de salvar para o componente pai
  React.useEffect(() => {
    if (onSaveVinculacao) {
      onSaveVinculacao(handleSave);
    }
  }, [onSaveVinculacao, handleSave]);

  if (!clienteId) return null;

  return (
    <div className="cliente-vinculacao-section" style={{ marginTop: '32px' }}>
      <h4 className="section-title" style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginTop: '0', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <i className="fas fa-box" style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
        Vincular Produto
      </h4>
      <p className="section-description" style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
        Vincule produtos a este cliente
      </p>

      <div className="select-group-secondary" style={{ marginBottom: '20px' }}>
        <SelectedItemsList
          items={selectedProdutos}
          getItemLabel={(itemId) => getProdutoLabel(itemId)}
          onRemoveItem={(itemId) => handleRemoveProduto(itemId)}
          canRemove={true}
          isExpanded={expanded}
          onToggleExpand={() => setExpanded(!expanded)}
        />

        <div className="select-wrapper">
          <CustomSelect
            value=""
            options={getProdutoOptions()}
            onChange={(e) => handleProdutoChange(e.target.value)}
            placeholder="Selecione um produto"
            disabled={loading || submitting}
            keepOpen={false}
            selectedItems={selectedProdutos}
            onSelectAll={handleSelectAll}
            hideCheckboxes={false}
            maxVisibleOptions={5}
            enableSearch={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ClienteVinculacaoProdutos;

