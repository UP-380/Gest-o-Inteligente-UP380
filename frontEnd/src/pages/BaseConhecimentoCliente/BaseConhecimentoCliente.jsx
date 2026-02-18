import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import ContasBancariasContent from '../../components/clients/DetailContent/ContasBancariasContent';
import SistemasContent from '../../components/clients/DetailContent/SistemasContent';
import AdquirentesContent from '../../components/clients/DetailContent/AdquirentesContent';
import VinculacoesContent from '../../components/clients/DetailContent/VinculacoesContent';
import ClienteContasBancariasList from '../../components/clientes-conta-bancaria/ClienteContasBancariasList';
import ClienteSistemasList from '../../components/clientes-sistema/ClienteSistemasList';
import ClienteAdquirentesList from '../../components/clientes-adquirente/ClienteAdquirentesList';
import EditButton from '../../components/common/EditButton';
import Avatar from '../../components/user/Avatar';
import { DEFAULT_AVATAR } from '../../utils/avatars';
import { useToast } from '../../hooks/useToast';
import './BaseConhecimentoCliente.css';

const API_BASE_URL = '/api';

const stripHtml = (html) => {
  if (html == null || html === undefined) return '';
  const s = typeof html === 'string' ? html : String(html);
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/\n /g, '\n').trim();
};

const safeStr = (v) => (v == null || v === undefined ? '-' : typeof v === 'string' ? v : String(v));

const buildVinculacoesAgrupadas = (vinculacoes) => {
  if (!vinculacoes || vinculacoes.length === 0) return [];
  const grupos = new Map();
  vinculacoes.forEach((vinculo) => {
    const produtoId = vinculo.produto?.id || 'sem-produto';
    const produtoNome = vinculo.produto?.nome || 'Sem Produto';
    if (!grupos.has(produtoId)) {
      grupos.set(produtoId, { produto: vinculo.produto, tiposTarefa: new Map() });
    }
    const grupo = grupos.get(produtoId);
    const tipoTarefaId = vinculo.tipoTarefa?.id || 'sem-tipo';
    if (!grupo.tiposTarefa.has(tipoTarefaId)) {
      grupo.tiposTarefa.set(tipoTarefaId, { tipoTarefa: vinculo.tipoTarefa, tarefas: new Map() });
    }
    const tipoTarefaGrupo = grupo.tiposTarefa.get(tipoTarefaId);
    if (vinculo.tarefa) {
      const tarefaId = vinculo.tarefa.id;
      if (!tipoTarefaGrupo.tarefas.has(tarefaId)) {
        tipoTarefaGrupo.tarefas.set(tarefaId, {
          tarefa: { id: vinculo.tarefa.id, nome: vinculo.tarefa.nome, descricao: vinculo.tarefa.descricao },
          subtarefas: [],
        });
      }
      if (vinculo.subtarefa) {
        tipoTarefaGrupo.tarefas.get(tarefaId).subtarefas.push({
          id: vinculo.subtarefa.id,
          nome: vinculo.subtarefa.nome,
          descricao: vinculo.subtarefa.descricao,
          observacaoParticular: vinculo.subtarefa.observacaoParticular || null,
        });
      }
    }
  });
  return Array.from(grupos.values()).map((g) => ({
    ...g,
    tiposTarefa: Array.from(g.tiposTarefa.values()).map((t) => ({ ...t, tarefas: Array.from(t.tarefas.values()) })),
  }));
};

const BaseConhecimentoCliente = () => {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [loading, setLoading] = useState(false);
  const [dadosCliente, setDadosCliente] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Estados dos modais
  const [showModalContas, setShowModalContas] = useState(false);
  const [showModalSistemas, setShowModalSistemas] = useState(false);
  const [showModalAdquirentes, setShowModalAdquirentes] = useState(false);
  const [contaToClone, setContaToClone] = useState(null);
  const [sistemaToClone, setSistemaToClone] = useState(null);
  const [adquirenteToClone, setAdquirenteToClone] = useState(null);

  // Estado para controlar expansão das seções
  const [sistemasExpanded, setSistemasExpanded] = useState(false);
  const [contasBancariasExpanded, setContasBancariasExpanded] = useState(false);
  const [adquirentesExpanded, setAdquirentesExpanded] = useState(false);
  const [fluxoOperacaoExpanded, setFluxoOperacaoExpanded] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [vinculacoesExpandAll, setVinculacoesExpandAll] = useState(undefined);
  const [vinculacoesSectionExpanded, setVinculacoesSectionExpanded] = useState(false);

  // Função para expandir/recolher todas as seções
  const toggleAllSections = () => {
    const newState = !allExpanded;
    setAllExpanded(newState);
    setSistemasExpanded(newState);
    setContasBancariasExpanded(newState);
    setAdquirentesExpanded(newState);
    setFluxoOperacaoExpanded(newState);
    setVinculacoesExpandAll(newState);
    setVinculacoesSectionExpanded(newState);
  };

  // Sincronizar estado allExpanded quando seções individuais mudarem
  useEffect(() => {
    const allCurrentlyExpanded = sistemasExpanded &&
      contasBancariasExpanded &&
      adquirentesExpanded &&
      fluxoOperacaoExpanded;
    setAllExpanded(allCurrentlyExpanded);
  }, [sistemasExpanded, contasBancariasExpanded, adquirentesExpanded, fluxoOperacaoExpanded]);

  // Resetar estado da seção quando ela for fechada
  useEffect(() => {
    if (!fluxoOperacaoExpanded) {
      setVinculacoesSectionExpanded(false);
      setVinculacoesExpandAll(undefined);
    }
  }, [fluxoOperacaoExpanded]);

  // Função para copiar para a área de transferência
  const copyToClipboard = async (text, fieldId, e) => {
    if (e) e.stopPropagation();
    if (!text || text === '-') return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
      showToast('error', 'Erro ao copiar para a área de transferência');
    }
  };

  // Componente para valores com botão de copiar (apenas para Dados Básicos)
  const ValueWithCopy = ({ value, fieldId, isPassword = false, isHidden = false }) => {
    const fieldKey = fieldId;
    const isCopied = copiedField === fieldKey;

    if (!value || value === '-') {
      return <span>-</span>;
    }

    if (isPassword) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ flex: 1 }}>
            {isHidden ? '••••••••' : value}
          </span>
          <button
            onClick={(e) => copyToClipboard(value, fieldKey, e)}
            className="copy-button"
            title={isCopied ? 'Copiado!' : 'Copiar senha'}
          >
            <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`}></i>
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>{value}</span>
        <button
          onClick={(e) => copyToClipboard(value, fieldKey, e)}
          className="copy-button"
          title={isCopied ? 'Copiado!' : 'Copiar'}
        >
          <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`}></i>
        </button>
      </div>
    );
  };

  // Carregar dados do cliente
  const loadDadosCliente = useCallback(async () => {
    if (!clienteId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${clienteId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setDadosCliente(result.data);
      } else {
        throw new Error(result.error || 'Erro ao carregar dados do cliente');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados do cliente:', error);
      showToast('error', 'Erro ao carregar dados do cliente. Tente novamente.');
      setDadosCliente(null);
    } finally {
      setLoading(false);
    }
  }, [clienteId, showToast]);

  const getNomeArquivoExport = useCallback(() => {
    if (!dadosCliente?.cliente) return 'base-conhecimento';
    const c = dadosCliente.cliente;
    const nome = c.fantasia || c.razao || c.nome_amigavel || 'Cliente';
    return nome.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
  }, [dadosCliente]);


  const exportarWord = useCallback(() => {
    if (!dadosCliente?.cliente) return;
    setExporting(true);
    try {
      const { cliente, sistemas = [], contasBancarias = [], adquirentes = [], vinculacoes = [] } = dadosCliente;
      const nomeCliente = cliente.fantasia || cliente.razao || cliente.nome_amigavel || 'Cliente';
      const esc = (s) => (s == null || s === undefined ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      let body = `<h1>Base de Conhecimento - ${esc(nomeCliente)}</h1><p>Informações Consolidadas - ${new Date().toLocaleDateString('pt-BR')}</p>`;
      body += `<h2>1. Dados Básicos</h2><table border="1" cellpadding="6" cellspacing="0"><tr><th>Campo</th><th>Valor</th></tr>`;
      body += `<tr><td>Razão Social</td><td>${esc(cliente.razao)}</td></tr><tr><td>Nome Fantasia</td><td>${esc(cliente.fantasia)}</td></tr><tr><td>Nome Amigável</td><td>${esc(cliente.amigavel || cliente.nome_amigavel)}</td></tr><tr><td>CNPJ</td><td>${esc(cliente.cnpj || cliente.cpf_cnpj)}</td></tr><tr><td>Status</td><td>${cliente.status === 'ativo' ? 'Ativo' : cliente.status === 'inativo' ? 'Inativo' : esc(cliente.status)}</td></tr><tr><td>Cliente Kamino</td><td>${esc(cliente.kaminoNome || cliente.nome_cli_kamino)}</td></tr></table>`;
      body += `<h2>2. Acessos de Sistema</h2>`;
      if (sistemas.length === 0) body += '<p>Nenhum sistema cadastrado.</p>';
      else sistemas.forEach((s) => {
        const nomeSistema = s.cp_sistema?.nome || 'Sistema';
        body += `<h3>${esc(nomeSistema)}</h3><p>Servidor: ${esc(s.servidor)} | Usuário: ${esc(s.usuario_servidor)} | Senha: ${esc(s.senha_servidor)}</p>`;
        body += `<p>VPN: ${esc(s.vpn)} | Usuário VPN: ${esc(s.usuario_vpn)} | Senha VPN: ${esc(s.senha_vpn)}</p>`;
        body += `<p>Usuário Sistema: ${esc(s.usuario_sistema)} | Senha Sistema: ${esc(s.senha_sistema)}</p>`;
      });
      body += `<h2>3. Contas Bancárias</h2>`;
      if (contasBancarias.length === 0) body += '<p>Nenhuma conta cadastrada.</p>';
      else contasBancarias.forEach((c) => {
        const banco = c.cp_banco;
        const nomeBanco = banco?.codigo ? `${esc(banco.codigo)} - ${esc(banco.nome)}` : esc(banco?.nome) || 'Banco';
        body += `<h3>${nomeBanco}</h3><p>Agência: ${esc(c.agencia)} | Conta: ${esc(c.conta)} | Operador: ${esc(c.operador)} | Chave: ${esc(c.chave_acesso)} | Usuário: ${esc(c.usuario)} | Senha: ${esc(c.senha)}</p>`;
        if (c.senha_4digitos || c.senha_6digitos || c.senha_8digitos) body += `<p>4 dígitos: ${esc(c.senha_4digitos)} | 6 dígitos: ${esc(c.senha_6digitos)} | 8 dígitos: ${esc(c.senha_8digitos)}</p>`;
      });
      body += `<h2>4. Adquirentes</h2>`;
      if (adquirentes.length === 0) body += '<p>Nenhum adquirente cadastrado.</p>';
      else adquirentes.forEach((a) => {
        body += `<p><strong>${esc(a.cp_adquirente?.nome)}</strong>: Usuário ${esc(a.usuario)} | Senha ${esc(a.senha)}</p>`;
      });
      body += `<h2>5. Fluxo da Operação</h2>`;
      const grupos = buildVinculacoesAgrupadas(vinculacoes);
      if (grupos.length === 0) body += '<p>Nenhuma vinculação.</p>';
      else grupos.forEach((grupo) => {
        body += `<h3>Produto: ${esc(grupo.produto?.nome)}</h3>`;
        grupo.tiposTarefa.forEach((tipoGrupo) => {
          body += `<h4>Tipo: ${esc(tipoGrupo.tipoTarefa?.nome)}</h4>`;
          tipoGrupo.tarefas.forEach((t) => {
            body += `<p><strong>Tarefa: ${esc(t.tarefa.nome)}</strong></p>`;
            if (t.tarefa.descricao) body += `<div>${t.tarefa.descricao}</div>`;
            t.subtarefas.forEach((st) => {
              body += `<p><em>Subtarefa: ${esc(st.nome)}</em></p>`;
              if (st.descricao) body += `<div>${st.descricao}</div>`;
              if (st.observacaoParticular) body += `<p>Observação particular:</p><div>${st.observacaoParticular}</div>`;
            });
          });
        });
      });
      const fullHtml = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Base de Conhecimento</title><style>body{font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1e293b;margin:20px;}table{border-collapse:collapse;}th,td{border:1px solid #ccc;padding:8px;}h1,h2,h3,h4{margin:16px 0 8px;font-weight:600;}ul,ol{padding-left:1.5em;}</style></head><body>${body}</body></html>`;
      const blob = new Blob(['\ufeff' + fullHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Base_Conhecimento_${getNomeArquivoExport()}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', 'Documento exportado. Abra no Word e salve como .docx se desejar.');
    } catch (err) {
      console.error('Erro ao exportar Word:', err);
      showToast('error', 'Erro ao exportar. Tente novamente.');
    } finally {
      setExporting(false);
    }
  }, [dadosCliente, getNomeArquivoExport, showToast]);

  useEffect(() => {
    loadDadosCliente();
  }, [loadDadosCliente]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState />
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  if (!dadosCliente || !dadosCliente.cliente) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <i className="fas fa-exclamation-circle" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}></i>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Cliente não encontrado</h3>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>Não foi possível carregar os dados do cliente.</p>
                <button
                  className="btn-secondary"
                  onClick={() => navigate(-1)}
                >
                  Voltar
                </button>
              </div>
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  const { cliente, sistemas = [], contasBancarias = [], adquirentes = [], vinculacoes = [] } = dadosCliente;

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="base-conhecimento-cliente-container">
              {/* Header */}
              <div className="knowledge-page-header">
                <div className="knowledge-header-content">
                  <div className="knowledge-header-left">
                    <div className="knowledge-header-icon">
                      <Avatar
                        avatarId={cliente.foto_perfil || DEFAULT_AVATAR}
                        nomeUsuario={cliente.fantasia || cliente.razao || cliente.nome_amigavel || cliente.nome || 'Cliente'}
                        size="large"
                      />
                    </div>
                    <div>
                      <h2 className="knowledge-page-title">
                        {cliente.fantasia || cliente.razao || cliente.nome_amigavel || 'Cliente'}
                      </h2>
                      <p className="knowledge-page-subtitle">
                        Base de Conhecimento - Informações Consolidadas
                      </p>
                    </div>
                  </div>
                  <div className="knowledge-header-actions">
                    <button
                      className="btn-secondary knowledge-back-btn"
                      onClick={() => navigate(-1)}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      onClick={exportarWord}
                      icon="fas fa-file-word"
                      disabled={exporting}
                    >
                      Exportar Word
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Botão Expandir/Recolher Tudo */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Expandir/Recolher Tudo</span>
                <button
                  className="btn-icon btn-expand-all"
                  onClick={toggleAllSections}
                  title={allExpanded ? 'Recolher todas as seções' : 'Expandir todas as seções'}
                >
                  <i className={`fas ${allExpanded ? 'fa-compress-alt' : 'fa-expand-alt'}`}></i>
                </button>
              </div>

              {/* Dados Básicos do Cliente */}
              <div className="knowledge-section">
                <div className="section-header">
                  <div className="section-icon" style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}>
                    <i className="fas fa-briefcase"></i>
                  </div>
                  <h2 className="section-title">Dados Básicos</h2>
                  <div className="section-header-actions">
                    <EditButton
                      onClick={() => navigate(`/cadastro/cliente?id=${clienteId}`)}
                      title="Editar dados do cliente"
                    />
                  </div>
                </div>
                <div className="section-content">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Razão Social</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.razao} fieldId="cliente-razao" />
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Nome Fantasia</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.fantasia} fieldId="cliente-fantasia" />
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Nome Amigável</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.amigavel || cliente.nome_amigavel} fieldId="cliente-amigavel" />
                      </div>
                    </div>
                    <div className="info-item">
                      <label>CNPJ</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.cnpj || cliente.cpf_cnpj} fieldId="cliente-cnpj" />
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Status</label>
                      <div className="info-value">
                        <span className={`status-badge ${cliente.status === 'ativo' ? 'active' : 'inactive'}`}>
                          {cliente.status === 'ativo' ? 'Ativo' : cliente.status === 'inativo' ? 'Inativo' : cliente.status || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Cliente Kamino</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.kaminoNome || cliente.nome_cli_kamino} fieldId="cliente-kamino" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acessos de Sistema */}
              <div className="knowledge-section">
                <div
                  className="section-header section-header-collapsible"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSistemasExpanded(!sistemasExpanded)}
                >
                  <div className="section-icon" style={{ backgroundColor: '#10b98115', color: '#10b981' }}>
                    <i className="fas fa-server"></i>
                  </div>
                  <h2 className="section-title">Acessos de Sistema</h2>
                  <EditButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModalSistemas(true);
                    }}
                    title="Gerenciar sistemas"
                  />
                  <span className="section-badge">{sistemas.length}</span>
                  <div className="section-header-actions">
                    <button
                      type="button"
                      className="section-expand-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSistemasExpanded(!sistemasExpanded);
                      }}
                      aria-label={sistemasExpanded ? 'Recolher seção' : 'Expandir seção'}
                      style={{
                        transition: 'transform 0.2s ease, color 0.2s ease',
                        transform: sistemasExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}
                    >
                      <i className="fas fa-chevron-down" style={{ fontSize: '14px' }}></i>
                    </button>
                  </div>
                </div>
                {sistemasExpanded && (
                  <div className="section-content">
                    <SistemasContent
                      sistemas={sistemas}
                      onClone={(sistema) => {
                        setSistemaToClone(sistema);
                        setShowModalSistemas(true);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Contas Bancárias */}
              <div className="knowledge-section">
                <div
                  className="section-header section-header-collapsible"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setContasBancariasExpanded(!contasBancariasExpanded)}
                >
                  <div className="section-icon" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
                    <i className="fas fa-university"></i>
                  </div>
                  <h2 className="section-title">Contas Bancárias</h2>
                  <EditButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModalContas(true);
                    }}
                    title="Gerenciar contas bancárias"
                  />
                  <span className="section-badge">{contasBancarias.length}</span>
                  <div className="section-header-actions">
                    <button
                      type="button"
                      className="section-expand-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContasBancariasExpanded(!contasBancariasExpanded);
                      }}
                      aria-label={contasBancariasExpanded ? 'Recolher seção' : 'Expandir seção'}
                      style={{
                        transition: 'transform 0.2s ease, color 0.2s ease',
                        transform: contasBancariasExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}
                    >
                      <i className="fas fa-chevron-down" style={{ fontSize: '14px' }}></i>
                    </button>
                  </div>
                </div>
                {contasBancariasExpanded && (
                  <div className="section-content">
                    <ContasBancariasContent
                      contasBancarias={contasBancarias}
                      onClone={(conta) => {
                        setContaToClone(conta);
                        setShowModalContas(true);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Adquirentes */}
              <div className="knowledge-section">
                <div
                  className="section-header section-header-collapsible"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setAdquirentesExpanded(!adquirentesExpanded)}
                >
                  <div className="section-icon" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b' }}>
                    <i className="fas fa-credit-card"></i>
                  </div>
                  <h2 className="section-title">Adquirentes</h2>
                  <EditButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModalAdquirentes(true);
                    }}
                    title="Gerenciar adquirentes"
                  />
                  <span className="section-badge">{adquirentes.length}</span>
                  <div className="section-header-actions">
                    <button
                      type="button"
                      className="section-expand-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdquirentesExpanded(!adquirentesExpanded);
                      }}
                      aria-label={adquirentesExpanded ? 'Recolher seção' : 'Expandir seção'}
                      style={{
                        transition: 'transform 0.2s ease, color 0.2s ease',
                        transform: adquirentesExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}
                    >
                      <i className="fas fa-chevron-down" style={{ fontSize: '14px' }}></i>
                    </button>
                  </div>
                </div>
                {adquirentesExpanded && (
                  <div className="section-content">
                    <AdquirentesContent
                      adquirentes={adquirentes}
                      onClone={(adquirente) => {
                        setAdquirenteToClone(adquirente);
                        setShowModalAdquirentes(true);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Fluxo da Operação */}
              <div className="knowledge-section">
                <div
                  className="section-header section-header-collapsible"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setFluxoOperacaoExpanded(!fluxoOperacaoExpanded)}
                >
                  <div className="section-icon" style={{ backgroundColor: '#6366f115', color: '#6366f1' }}>
                    <i className="fas fa-project-diagram"></i>
                  </div>
                  <h2 className="section-title">Fluxo da Operação</h2>
                  <span className="section-badge">{vinculacoes.length}</span>
                  <div className="section-header-actions">
                    {fluxoOperacaoExpanded && (
                      <button
                        type="button"
                        className="btn-icon btn-expand-section"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newState = !vinculacoesSectionExpanded;
                          setVinculacoesSectionExpanded(newState);
                          // Forçar atualização passando undefined primeiro e depois o novo valor
                          setVinculacoesExpandAll(undefined);
                          setTimeout(() => {
                            setVinculacoesExpandAll(newState);
                          }, 10);
                        }}
                        title={vinculacoesSectionExpanded ? 'Recolher tudo nesta seção' : 'Expandir tudo nesta seção'}
                      >
                        <i className={`fas ${vinculacoesSectionExpanded ? 'fa-compress-alt' : 'fa-expand-alt'}`} style={{ fontSize: '11px' }}></i>
                      </button>
                    )}
                    <button
                      type="button"
                      className="section-expand-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFluxoOperacaoExpanded(!fluxoOperacaoExpanded);
                      }}
                      aria-label={fluxoOperacaoExpanded ? 'Recolher seção' : 'Expandir seção'}
                      style={{
                        transition: 'transform 0.2s ease, color 0.2s ease',
                        transform: fluxoOperacaoExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}
                    >
                      <i className="fas fa-chevron-down" style={{ fontSize: '14px' }}></i>
                    </button>
                  </div>
                </div>
                {fluxoOperacaoExpanded && (
                  <div className="section-content">
                    <VinculacoesContent
                      vinculacoes={vinculacoes}
                      clienteId={clienteId}
                      onObservacaoUpdated={loadDadosCliente}
                      expandAll={vinculacoesExpandAll}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContainer>
        </main>
      </div>


      {/* Modal de Sistemas */}
      {showModalSistemas && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalSistemas(false);
          setSistemaToClone(null);
          loadDadosCliente();
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-server" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Sistemas - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowModalSistemas(false);
                  setSistemaToClone(null);
                  loadDadosCliente();
                }}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteSistemasList
                clienteId={cliente?.id || clienteId}
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
                initialData={sistemaToClone}
                onDataUsed={() => setSistemaToClone(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Contas Bancárias */}
      {showModalContas && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalContas(false);
          setContaToClone(null);
          loadDadosCliente();
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-university" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Contas Bancárias - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowModalContas(false);
                  setContaToClone(null);
                  loadDadosCliente();
                }}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteContasBancariasList
                clienteId={cliente?.id || clienteId}
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
                initialData={contaToClone}
                onDataUsed={() => setContaToClone(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adquirentes */}
      {showModalAdquirentes && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalAdquirentes(false);
          loadDadosCliente();
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-credit-card" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Adquirentes - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowModalAdquirentes(false);
                  loadDadosCliente();
                }}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteAdquirentesList
                clienteId={cliente?.id || clienteId}
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
                initialData={adquirenteToClone}
                onDataUsed={() => setAdquirenteToClone(null)}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default BaseConhecimentoCliente;

