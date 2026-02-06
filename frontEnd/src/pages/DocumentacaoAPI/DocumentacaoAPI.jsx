import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ApiTester from '../../components/api/ApiTester';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import './DocumentacaoAPI.css';

// Constante para a URL base da API (usada na documentação)
const BASE_URL_DOC = 'http://localhost:3000';

const DocumentacaoAPI = () => {
  const [activeSection, setActiveSection] = useState('introducao');

  const sections = [
    { id: 'introducao', label: 'Introdução', icon: 'fa-info-circle' },
    { id: 'autenticacao', label: 'Autenticação', icon: 'fa-key' },
    { id: 'chave-api', label: 'Chave de API', icon: 'fa-shield-alt' },
    { id: 'clientes', label: 'Clientes', icon: 'fa-briefcase' },
    { id: 'colaboradores', label: 'Colaboradores', icon: 'fa-user-cog' },
    { id: 'produtos', label: 'Produtos', icon: 'fa-box' },
    { id: 'tarefas', label: 'Tarefas', icon: 'fa-tasks' },
    { id: 'bancos', label: 'Bancos', icon: 'fa-university' },
    { id: 'adquirentes', label: 'Adquirentes', icon: 'fa-credit-card' },
    { id: 'sistemas', label: 'Sistemas', icon: 'fa-server' },
    { id: 'atividades', label: 'Atividades', icon: 'fa-list' },
    { id: 'vinculacoes', label: 'Vinculações', icon: 'fa-link' },
    { id: 'tempo', label: 'Tempo', icon: 'fa-clock' },
    { id: 'base-conhecimento', label: 'Base de Conhecimento', icon: 'fa-book' },
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-bar' },
    { id: 'erros', label: 'Códigos de Erro', icon: 'fa-exclamation-triangle' }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'introducao':
        return <IntroducaoSection />;
      case 'autenticacao':
        return <AutenticacaoSection />;
      case 'chave-api':
        return <ChaveAPISection />;
      case 'clientes':
        return <ClientesSection />;
      case 'colaboradores':
        return <ColaboradoresSection />;
      case 'produtos':
        return <ProdutosSection />;
      case 'tarefas':
        return <TarefasSection />;
      case 'bancos':
        return <BancosSection />;
      case 'adquirentes':
        return <AdquirentesSection />;
      case 'sistemas':
        return <SistemasSection />;
      case 'atividades':
        return <AtividadesSection />;
      case 'vinculacoes':
        return <VinculacoesSection />;
      case 'tempo':
        return <TempoSection />;
      case 'base-conhecimento':
        return <BaseConhecimentoSection />;
      case 'dashboard':
        return <DashboardSection />;
      case 'erros':
        return <ErrosSection />;
      default:
        return <IntroducaoSection />;
    }
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="documentacao-api-container">
            <div className="documentacao-api-sidebar">
              <h2 className="documentacao-api-sidebar-title">
                <i className="fas fa-book"></i> Documentação API
              </h2>
              <nav className="documentacao-api-nav">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    className={`documentacao-api-nav-item ${activeSection === section.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <i className={`fas ${section.icon}`}></i>
                    <span>{section.label}</span>
                  </button>
                ))}
              </nav>
            </div>
            <div className="documentacao-api-content">
              <CardContainer>
                {renderContent()}
              </CardContainer>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

// Seções de conteúdo
const ChaveAPISection = () => {
  const showToast = useToast();
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false });

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/auth/api-key');
      if (data.success) {
        setHasKey(!!data.hasKey);
        setMaskedKey(data.maskedKey || null);
      } else {
        setError(data.error || 'Erro ao carregar status da chave.');
      }
    } catch (err) {
      setError(err.message || 'Erro de conexão. Verifique se o backend está rodando (porta 4000) e reinicie-o se alterou rotas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGerar = async () => {
    setActionLoading(true);
    setError(null);
    setNewKey(null);
    try {
      const data = await api.post('/auth/api-key', {});
      if (data.success && data.apiKey) {
        setNewKey(data.apiKey);
        setHasKey(true);
        setMaskedKey('up_••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••');
      } else {
        setError(data.error || 'Erro ao gerar chave.');
      }
    } catch (err) {
      setError(err.message || 'Erro ao gerar chave. Reinicie o backend (porta 4000) se a rota foi adicionada recentemente.');
    } finally {
      setActionLoading(false);
    }
  };

  const runRegenerar = async () => {
    setActionLoading(true);
    setError(null);
    setNewKey(null);
    try {
      const data = await api.post('/auth/api-key', {});
      if (data.success && data.apiKey) {
        setNewKey(data.apiKey);
        setHasKey(true);
        setMaskedKey('up_••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••');
      } else {
        setError(data.error || 'Erro ao regenerar chave.');
      }
    } catch (err) {
      setError(err.message || 'Erro ao regenerar chave.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerarClick = () => {
    setConfirmModal({
      open: true,
      title: 'Regenerar chave',
      message: 'Gerar uma nova chave irá invalidar a chave atual. Deseja continuar?',
      danger: false,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        runRegenerar();
      }
    });
  };

  const handleRevogarClick = () => {
    setConfirmModal({
      open: true,
      title: 'Revogar chave',
      message: 'Revogar a chave irá desativar o acesso à API por token. Deseja continuar?',
      danger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        runRevogar();
      }
    });
  };

  const runRevogar = async () => {
    setActionLoading(true);
    setError(null);
    setNewKey(null);
    try {
      const data = await api.delete('/auth/api-key');
      if (data.success) {
        setHasKey(false);
        setMaskedKey(null);
      } else {
        setError(data.error || 'Erro ao revogar chave.');
      }
    } catch (err) {
      setError(err.message || 'Erro ao revogar chave.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopiar = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey).then(() => {
      showToast('success', 'Chave copiada para a área de transferência.');
    }).catch(() => {});
  };

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, open: false }));
  };

  return (
    <div className="api-section">
      <h1 className="api-section-title">
        <i className="fas fa-shield-alt"></i> Chave de API
      </h1>
      <p className="api-section-intro">
        Gerencie sua chave de API (Security Key) para acessar os endpoints com o header <code>Authorization: Bearer &lt;sua_chave&gt;</code>.
        A chave pode ser usada em scripts, integrações e ferramentas que não utilizam cookies de sessão.
      </p>
      {error && (
        <div className="chave-api-error">
          <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
          {error}
        </div>
      )}
      {loading ? (
        <p className="chave-api-loading"><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Carregando...</p>
      ) : (
        <>
          {newKey ? (
            <div className="chave-api-key-card">
              <h3><i className="fas fa-key"></i> Sua chave (guarde em local seguro)</h3>
              <div className="chave-api-key-value">{newKey}</div>
              <button type="button" className="chave-api-btn chave-api-btn-primary" onClick={handleCopiar}>
                <i className="fas fa-copy"></i> Copiar
              </button>
              <p className="chave-api-key-warning" style={{ marginTop: '16px' }}>
                <i className="fas fa-exclamation-triangle"></i>
                Guarde esta chave em local seguro; ela não será mostrada novamente.
              </p>
            </div>
          ) : hasKey ? (
            <>
              <p className="chave-api-masked">Sua chave atual: <code>{maskedKey || 'up_••••••••••••••••'}</code></p>
              <div className="chave-api-actions">
                <button type="button" className="chave-api-btn chave-api-btn-primary" disabled={actionLoading} onClick={handleRegenerarClick}>
                  <i className="fas fa-sync-alt"></i> Regenerar chave
                </button>
                <button type="button" className="chave-api-btn chave-api-btn-danger" disabled={actionLoading} onClick={handleRevogarClick}>
                  <i className="fas fa-ban"></i> Revogar chave
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Você ainda não possui uma chave de API. Gere uma para usar a API com <code>Authorization: Bearer &lt;sua_chave&gt;</code>.</p>
              <button type="button" className="chave-api-btn chave-api-btn-primary" disabled={actionLoading} onClick={handleGerar} style={{ marginTop: '12px' }}>
                <i className="fas fa-plus-circle"></i> Gerar chave de API
              </button>
            </>
          )}
        </>
      )}

      {confirmModal.open && (
        <div className="chave-api-modal-overlay" onClick={closeConfirmModal} role="dialog" aria-modal="true" aria-labelledby="chave-api-modal-title">
          <div className="chave-api-modal-box" onClick={e => e.stopPropagation()}>
            <h2 id="chave-api-modal-title" className="chave-api-modal-title">
              <i className={`fas ${confirmModal.danger ? 'fa-exclamation-triangle' : 'fa-key'}`}></i>
              {confirmModal.title}
            </h2>
            <p className="chave-api-modal-message">{confirmModal.message}</p>
            <div className="chave-api-modal-actions">
              <button type="button" className="chave-api-modal-btn chave-api-modal-btn-cancel" onClick={closeConfirmModal}>
                Cancelar
              </button>
              <button type="button" className={`chave-api-modal-btn ${confirmModal.danger ? 'chave-api-modal-btn-danger' : 'chave-api-modal-btn-confirm'}`} onClick={() => confirmModal.onConfirm && confirmModal.onConfirm()}>
                {confirmModal.danger ? 'Revogar' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IntroducaoSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-info-circle"></i> Introdução à API
    </h1>
    <p className="api-section-intro">
      Bem-vindo à documentação da API do sistema <strong>UP Gestão Inteligente</strong>. Esta API RESTful fornece acesso completo
      aos recursos do sistema para integração com outras aplicações, automações e desenvolvimento de integrações personalizadas.
    </p>

    <div className="api-info-box" style={{ 
      background: '#e3f2fd', 
      border: '1px solid #2196F3', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '20px 0' 
    }}>
      <h3 style={{ marginTop: 0 }}>📚 Sobre esta Documentação</h3>
      <p style={{ marginBottom: 0 }}>
        Esta documentação fornece informações completas sobre todos os endpoints disponíveis, incluindo:
        parâmetros, exemplos de requisição/resposta, códigos de erro e guias práticos de integração.
        Use o menu lateral para navegar entre as seções.
      </p>
    </div>

    <h2>🌐 Base URL e Ambientes</h2>
    <p>A API está disponível em diferentes ambientes:</p>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Ambiente</th>
          <th>URL Base</th>
          <th>Porta Backend</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Desenvolvimento</strong></td>
          <td><code>http://localhost:3000/api</code></td>
          <td><code>4000</code></td>
          <td>Ambiente local para desenvolvimento e testes</td>
        </tr>
        <tr>
          <td><strong>Produção</strong></td>
          <td><code>https://seu-dominio.com/api</code></td>
          <td><code>4000</code></td>
          <td>Ambiente de produção (substitua pelo seu domínio)</td>
        </tr>
      </tbody>
    </table>
    
    <div className="api-info-box" style={{ 
      background: '#fff3cd', 
      border: '1px solid #ffc107', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '15px 0' 
    }}>
      <strong>💡 Nota:</strong> Em desenvolvimento, o frontend (porta 3000) faz proxy das requisições <code>/api</code> 
      para o backend (porta 4000) automaticamente. Em produção, o nginx faz o roteamento.
    </div>

    <h2>📦 Formato de Dados</h2>
    <p>Todas as requisições e respostas utilizam o formato <strong>JSON</strong> (JavaScript Object Notation).</p>
    
    <h3>Headers Obrigatórios</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Header</th>
          <th>Valor</th>
          <th>Obrigatório</th>
          <th>Quando</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>Content-Type</code></td>
          <td><code>application/json</code></td>
          <td>✅ Sim</td>
          <td>Em requisições com body (POST, PUT)</td>
        </tr>
        <tr>
          <td><code>Accept</code></td>
          <td><code>application/json</code></td>
          <td>❌ Não</td>
          <td>Recomendado para garantir resposta JSON</td>
        </tr>
        <tr>
          <td><code>Cookie</code></td>
          <td><code>connect.sid=...</code></td>
          <td>✅ Sim*</td>
          <td>Em todas as requisições autenticadas (*exceto login)</td>
        </tr>
      </tbody>
    </table>

    <h3>Encoding de Caracteres</h3>
    <p>Todas as requisições e respostas utilizam <strong>UTF-8</strong> como encoding padrão.</p>

    <h2>🔐 Autenticação</h2>
    <p>
      A API utiliza autenticação baseada em <strong>sessão HTTP</strong> (cookies). Após fazer login, 
      um cookie de sessão é criado e deve ser enviado automaticamente em todas as requisições subsequentes.
    </p>
    
    <h3>Fluxo de Autenticação</h3>
    <ol>
      <li>Faça uma requisição <code>POST /api/login</code> com email e senha</li>
      <li>O servidor retorna um cookie de sessão (enviado automaticamente pelo navegador)</li>
      <li>Use esse cookie em todas as requisições subsequentes</li>
      <li>Faça <code>POST /api/logout</code> para encerrar a sessão</li>
    </ol>

    <div className="api-info-box" style={{ 
      background: '#e8f5e9', 
      border: '1px solid #4caf50', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '15px 0' 
    }}>
      <strong>💡 Dica Rápida:</strong> Para testar rapidamente, use o exemplo abaixo:
      <div className="api-code-block" style={{ marginTop: '10px' }}>
        <pre>{`# 1. Fazer login e salvar cookie
curl -X POST http://localhost:3000/api/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "seu-email@exemplo.com", "senha": "sua-senha"}' \\
  -c cookies.txt

# 2. Usar cookie em requisições autenticadas
curl -X GET http://localhost:3000/api/clientes \\
  -H "Accept: application/json" \\
  -b cookies.txt`}</pre>
      </div>
      <p style={{ marginTop: '10px', marginBottom: 0 }}>
        <strong>📖 Veja mais:</strong> A seção <strong>"Autenticação"</strong> contém exemplos detalhados 
        para cURL, JavaScript, Python, Postman e outras ferramentas.
      </p>
    </div>

    <div className="api-info-box" style={{ 
      background: '#e3f2fd', 
      border: '1px solid #2196F3', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '15px 0' 
    }}>
      <strong>⚠️ Importante:</strong> Para testar a API com ferramentas como Postman, cURL ou scripts, 
      você precisa habilitar o envio de cookies. Veja a seção <strong>"Autenticação"</strong> para exemplos práticos 
      e configurações específicas de cada ferramenta.
    </div>

    <h2>📋 Estrutura de Resposta</h2>
    <p>Todas as respostas da API seguem um padrão consistente para facilitar o tratamento de erros e o parsing dos dados.</p>
    
    <h3>✅ Resposta de Sucesso</h3>
    <p>Quando uma requisição é bem-sucedida, a resposta contém:</p>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "data": { ... },           // Dados retornados (objeto ou array)
  "message": "Mensagem opcional",  // Mensagem de sucesso (opcional)
  "count": 25,               // Quantidade de itens (apenas em listas)
  "total": 100,               // Total de itens (apenas em listas paginadas)
  "page": 1,                  // Página atual (apenas em listas paginadas)
  "limit": 20,                // Itens por página (apenas em listas paginadas)
  "totalPages": 5             // Total de páginas (apenas em listas paginadas)
}`}</pre>
    </div>

    <h4>Exemplo Real - Lista de Clientes</h4>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "razao_social": "Empresa Exemplo LTDA",
      "nome_fantasia": "Exemplo",
      "status": "ativo"
    }
  ],
  "count": 1,
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}`}</pre>
    </div>

    <h4>Exemplo Real - Objeto Único</h4>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "message": "Cliente atualizado com sucesso",
  "cliente": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "razao_social": "Nova Razão Social LTDA",
    "status": "ativo"
  }
}`}</pre>
    </div>

    <h3>❌ Resposta de Erro</h3>
    <p>Quando ocorre um erro, a resposta contém:</p>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Descrição do erro principal",
  "message": "Mensagem adicional (opcional)",
  "details": "Detalhes técnicos (opcional)",
  "redirect": "/login"  // Apenas em erros 401 (não autenticado)
}`}</pre>
    </div>

    <h4>Exemplos de Erros</h4>
    <div className="api-code-block">
      <pre>{`// Erro 400 - Dados inválidos
{
  "success": false,
  "error": "Email e senha são obrigatórios"
}

// Erro 401 - Não autenticado
{
  "success": false,
  "error": "Acesso negado. Faça login primeiro.",
  "redirect": "/login"
}

// Erro 404 - Recurso não encontrado
{
  "success": false,
  "error": "Cliente não encontrado"
}

// Erro 409 - Conflito
{
  "success": false,
  "error": "Não é possível deletar cliente com relacionamentos ativos",
  "details": {
    "contratos": 2,
    "sistemas": 1
  }
}`}</pre>
    </div>
    <p><strong>📖 Veja mais:</strong> A seção <strong>"Códigos de Erro"</strong> contém informações detalhadas sobre todos os códigos HTTP e como tratá-los.</p>

    <h2>📄 Paginação</h2>
    <p>
      A maioria dos endpoints que retornam listas suporta paginação através de parâmetros de query. 
      Isso permite buscar grandes volumes de dados de forma eficiente.
    </p>
    
    <h3>Parâmetros de Paginação</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Parâmetro</th>
          <th>Tipo</th>
          <th>Padrão</th>
          <th>Mínimo</th>
          <th>Máximo</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>page</code></td>
          <td>integer</td>
          <td><code>1</code></td>
          <td><code>1</code></td>
          <td>-</td>
          <td>Número da página (começa em 1, não em 0)</td>
        </tr>
        <tr>
          <td><code>limit</code></td>
          <td>integer</td>
          <td><code>20</code></td>
          <td><code>1</code></td>
          <td><code>100</code>*</td>
          <td>Quantidade de itens por página (*recomendado: máximo 100)</td>
        </tr>
      </tbody>
    </table>

    <h3>Resposta de Paginação</h3>
    <p>A resposta inclui metadados de paginação:</p>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "data": [ ... ],           // Array com os itens da página atual
  "count": 25,               // Quantidade de itens nesta página
  "total": 100,              // Total de itens em todas as páginas
  "page": 1,                 // Página atual
  "limit": 20,               // Itens por página
  "totalPages": 5            // Total de páginas disponíveis
}`}</pre>
    </div>

    <h3>Exemplos de Uso</h3>
    
    <h4>Buscar primeira página (padrão)</h4>
    <div className="api-code-block">
      <pre><code>GET /api/clientes</code></pre>
    </div>
    <p>Equivale a: <code>GET /api/clientes?page=1&limit=20</code></p>

    <h4>Buscar segunda página</h4>
    <div className="api-code-block">
      <pre><code>GET /api/clientes?page=2</code></pre>
    </div>

    <h4>Buscar com limite customizado</h4>
    <div className="api-code-block">
      <pre><code>GET /api/clientes?page=1&limit=50</code></pre>
    </div>

    <h4>Buscar todos os itens (não recomendado para grandes volumes)</h4>
    <div className="api-code-block">
      <pre><code>GET /api/clientes?page=1&limit=10000</code></pre>
    </div>
    <div className="api-info-box" style={{ 
      background: '#fff3cd', 
      border: '1px solid #ffc107', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '15px 0' 
    }}>
      <strong>⚠️ Atenção:</strong> Evite buscar grandes volumes de dados de uma vez. Use paginação adequada 
      para melhor performance e experiência do usuário.
    </div>

    <h2>🔢 Códigos de Status HTTP</h2>
    <p>
      A API utiliza códigos de status HTTP padrão para indicar o resultado de cada requisição. 
      É importante tratar adequadamente cada código para uma melhor experiência de integração.
    </p>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Código</th>
          <th>Status</th>
          <th>Significado</th>
          <th>Quando Ocorre</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>200</code></td>
          <td>OK</td>
          <td>Requisição bem-sucedida</td>
          <td>Operação realizada com sucesso (GET, PUT, DELETE)</td>
        </tr>
        <tr>
          <td><code>201</code></td>
          <td>Created</td>
          <td>Recurso criado com sucesso</td>
          <td>Ao criar novos recursos (POST)</td>
        </tr>
        <tr>
          <td><code>400</code></td>
          <td>Bad Request</td>
          <td>Dados inválidos na requisição</td>
          <td>Campos obrigatórios faltando, formato inválido, validação falhou</td>
        </tr>
        <tr>
          <td><code>401</code></td>
          <td>Unauthorized</td>
          <td>Não autenticado ou sessão expirada</td>
          <td>Cookie de sessão inválido, não fez login, sessão expirada</td>
        </tr>
        <tr>
          <td><code>403</code></td>
          <td>Forbidden</td>
          <td>Acesso negado</td>
          <td>Usuário autenticado mas sem permissão para a ação</td>
        </tr>
        <tr>
          <td><code>404</code></td>
          <td>Not Found</td>
          <td>Recurso não encontrado</td>
          <td>ID inválido, recurso não existe no banco de dados</td>
        </tr>
        <tr>
          <td><code>409</code></td>
          <td>Conflict</td>
          <td>Conflito com estado atual</td>
          <td>CPF/CNPJ já cadastrado, relacionamentos ativos impedem exclusão</td>
        </tr>
        <tr>
          <td><code>500</code></td>
          <td>Internal Server Error</td>
          <td>Erro interno do servidor</td>
          <td>Erro inesperado no servidor, problema de banco de dados, exceção não tratada</td>
        </tr>
      </tbody>
    </table>
    <p><strong>📖 Veja mais:</strong> A seção <strong>"Códigos de Erro"</strong> contém exemplos detalhados de cada código 
    e guias de como tratá-los em diferentes linguagens.</p>

    <h2>🌍 CORS (Cross-Origin Resource Sharing)</h2>
    <p>
      A API está configurada para aceitar requisições de diferentes origens. Em desenvolvimento, 
      as origens permitidas são: <code>http://localhost:3000</code>, <code>http://127.0.0.1:3000</code> e <code>http://localhost:4000</code>.
    </p>
    <p>
      Em produção, o CORS é gerenciado pelo nginx, permitindo requisições de qualquer origem configurada.
    </p>
    <div className="api-info-box" style={{ 
      background: '#e3f2fd', 
      border: '1px solid #2196F3', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '15px 0' 
    }}>
      <strong>💡 Importante:</strong> Todas as requisições devem incluir <code>credentials: 'include'</code> 
      (ou equivalente na sua ferramenta) para que os cookies de sessão sejam enviados corretamente.
    </div>

    <h2>⚡ Rate Limiting e Performance</h2>
    <p>
      Atualmente, a API não possui rate limiting implementado. No entanto, recomendamos:
    </p>
    <ul>
      <li>Evitar requisições excessivas em curto período de tempo</li>
      <li>Usar paginação adequada para listas grandes</li>
      <li>Implementar cache quando apropriado</li>
      <li>Fazer requisições em paralelo quando possível (usando <code>Promise.all</code> em JavaScript)</li>
    </ul>

    <h2>📝 Convenções e Boas Práticas</h2>
    
    <h3>Nomenclatura</h3>
    <ul>
      <li><strong>Endpoints:</strong> Utilizam kebab-case (ex: <code>/api/clientes-kamino</code>)</li>
      <li><strong>Campos JSON:</strong> Utilizam snake_case (ex: <code>razao_social</code>, <code>nome_fantasia</code>)</li>
      <li><strong>IDs:</strong> Utilizam UUID v4 para a maioria dos recursos</li>
    </ul>

    <h3>Métodos HTTP</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Método</th>
          <th>Uso</th>
          <th>Exemplo</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>GET</code></td>
          <td>Buscar/listar recursos</td>
          <td><code>GET /api/clientes</code></td>
        </tr>
        <tr>
          <td><code>POST</code></td>
          <td>Criar novos recursos</td>
          <td><code>POST /api/clientes</code></td>
        </tr>
        <tr>
          <td><code>PUT</code></td>
          <td>Atualizar recursos existentes</td>
          <td><code>PUT /api/clientes/:id</code></td>
        </tr>
        <tr>
          <td><code>DELETE</code></td>
          <td>Deletar recursos</td>
          <td><code>DELETE /api/clientes/:id</code></td>
        </tr>
      </tbody>
    </table>

    <h3>IDs e UUIDs</h3>
    <p>
      A maioria dos recursos utiliza <strong>UUID v4</strong> como identificador único. 
      Exemplo: <code>550e8400-e29b-41d4-a716-446655440000</code>
    </p>
    <p>
      Alguns recursos podem utilizar IDs numéricos (inteiros) quando integrados com sistemas externos.
    </p>

    <h2>🛠️ Ferramentas Recomendadas</h2>
    <p>Para testar e integrar com a API, recomendamos as seguintes ferramentas:</p>
    <ul>
      <li><strong>Postman:</strong> Interface gráfica completa para testar APIs</li>
      <li><strong>cURL:</strong> Linha de comando para requisições HTTP</li>
      <li><strong>HTTPie:</strong> Cliente HTTP amigável para linha de comando</li>
      <li><strong>Insomnia:</strong> Cliente REST alternativo ao Postman</li>
      <li><strong>JavaScript Fetch API:</strong> Para integrações em aplicações web</li>
      <li><strong>Python requests:</strong> Para scripts e automações em Python</li>
    </ul>

    <h2>📚 Próximos Passos</h2>
    <p>Agora que você entende os conceitos básicos, recomendamos:</p>
    <ol>
      <li>Ler a seção <strong>"Autenticação"</strong> para aprender a fazer login e gerenciar sessões</li>
      <li>Explorar os endpoints específicos nas seções correspondentes (Clientes, Colaboradores, etc.)</li>
      <li>Consultar a seção <strong>"Códigos de Erro"</strong> para entender como tratar erros adequadamente</li>
      <li>Testar os exemplos práticos fornecidos em cada seção</li>
    </ol>

    <div className="api-info-box" style={{ 
      background: '#e8f5e9', 
      border: '1px solid #4caf50', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '20px 0' 
    }}>
      <strong>✅ Pronto para começar!</strong> Use o menu lateral para navegar entre as seções e explorar 
      todos os endpoints disponíveis. Cada seção contém exemplos práticos e detalhes completos.
    </div>
  </div>
);

const AutenticacaoSection = () => {
  return (
    <div className="api-section">
      <h1 className="api-section-title">
        <i className="fas fa-key"></i> Autenticação
      </h1>
      <p className="api-section-intro">
        A API utiliza autenticação baseada em <strong>sessão HTTP</strong> (cookies). Esta seção explica 
        como fazer login, gerenciar sessões e usar a autenticação em diferentes ferramentas e linguagens.
      </p>

    <div className="api-info-box" style={{ 
      background: '#e3f2fd', 
      border: '1px solid #2196F3', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '20px 0' 
    }}>
      <h3 style={{ marginTop: 0 }}>🔐 Como Funciona</h3>
      <p>
        A API utiliza <strong>autenticação baseada em sessão HTTP</strong> usando cookies. Após fazer login, 
        um cookie de sessão é criado e deve ser enviado automaticamente em todas as requisições subsequentes.
      </p>
      <p><strong>Fluxo Completo:</strong></p>
      <ol>
        <li>Faça uma requisição <code>POST /api/login</code> com email e senha</li>
        <li>O servidor valida as credenciais e cria uma sessão</li>
        <li>Um cookie de sessão é retornado no header <code>Set-Cookie</code></li>
        <li>O cookie é armazenado automaticamente pelo navegador/cliente HTTP</li>
        <li>Use esse cookie em todas as requisições subsequentes (enviado automaticamente)</li>
        <li>Faça <code>POST /api/logout</code> para encerrar a sessão quando necessário</li>
      </ol>
    </div>

    <div className="api-info-box" style={{ 
      background: '#fff3cd', 
      border: '1px solid #ffc107', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '20px 0' 
    }}>
      <h3 style={{ marginTop: 0 }}>🍪 Sobre Cookies de Sessão</h3>
      <ul style={{ marginBottom: 0 }}>
        <li><strong>Nome do Cookie:</strong> <code>connect.sid</code> (padrão do express-session)</li>
        <li><strong>Validade:</strong> A sessão expira após um período de inatividade ou quando o servidor é reiniciado</li>
        <li><strong>Segurança:</strong> Em produção, os cookies são enviados apenas via HTTPS</li>
        <li><strong>Domínio:</strong> O cookie é válido apenas para o domínio que o criou</li>
        <li><strong>HttpOnly:</strong> O cookie não é acessível via JavaScript (proteção contra XSS)</li>
      </ul>
    </div>

    <div className="api-info-box" style={{
      background: '#e3f2fd',
      border: '1px solid #2196F3',
      borderRadius: '4px',
      padding: '15px',
      margin: '20px 0'
    }}>
      <h3 style={{ marginTop: 0 }}>Autenticação por Chave de API (Bearer Token)</h3>
      <p>
        Além do cookie de sessão, é possível autenticar enviando o header <code>Authorization: Bearer &lt;sua_chave&gt;</code> em todas as requisições.
        A chave pode ser obtida e gerenciada na seção <strong>Chave de API</strong> desta documentação (menu lateral).
      </p>
      <p><strong>Exemplo com cURL:</strong></p>
      <div className="api-code-block" style={{ marginTop: '10px' }}>
        <pre>{`curl -X GET ${BASE_URL_DOC}/api/clientes \\
  -H "Accept: application/json" \\
  -H "Authorization: Bearer up_sua_chave_aqui"`}</pre>
      </div>
    </div>

    <h2>POST /api/login</h2>
    <p>Autentica um usuário no sistema e cria uma sessão.</p>
    
    <h3>📋 Endpoint</h3>
    <div className="api-code-block">
      <pre><code>{`POST ${BASE_URL_DOC}/api/login`}</code></pre>
    </div>

    <h3>📥 Request Body</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Campo</th>
          <th>Tipo</th>
          <th>Obrigatório</th>
          <th>Validação</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>email</code></td>
          <td>string</td>
          <td>✅ Sim</td>
          <td>Email válido</td>
          <td>Email do usuário. Será convertido para lowercase e trim() automaticamente pelo servidor</td>
        </tr>
        <tr>
          <td><code>senha</code></td>
          <td>string</td>
          <td>✅ Sim</td>
          <td>Não vazia</td>
          <td>Senha do usuário (comparação direta - em produção deve usar hash)</td>
        </tr>
      </tbody>
    </table>

    <h3>📋 Headers</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Header</th>
          <th>Valor</th>
          <th>Obrigatório</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>Content-Type</code></td>
          <td><code>application/json</code></td>
          <td>✅ Sim</td>
          <td>Indica que o body é JSON</td>
        </tr>
        <tr>
          <td><code>Accept</code></td>
          <td><code>application/json</code></td>
          <td>❌ Não</td>
          <td>Recomendado para garantir resposta JSON</td>
        </tr>
      </tbody>
    </table>

    <h3>📤 Response - Sucesso (200 OK)</h3>
    <p>Quando o login é bem-sucedido, a resposta contém:</p>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "message": "Login realizado com sucesso",
  "usuario": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email_usuario": "usuario@exemplo.com",
    "nome_usuario": "Nome do Usuário",
    "foto_perfil": "color-blue",
    "foto_perfil_path": null // DEPRECADO: Avatares são resolvidos via Supabase Storage
  }
}`}</pre>
    </div>

    <h4>Campos do Objeto Usuário</h4>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Campo</th>
          <th>Tipo</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>id</code></td>
          <td>UUID</td>
          <td>Identificador único do usuário</td>
        </tr>
        <tr>
          <td><code>email_usuario</code></td>
          <td>string</td>
          <td>Email do usuário (em lowercase)</td>
        </tr>
        <tr>
          <td><code>nome_usuario</code></td>
          <td>string</td>
          <td>Nome completo do usuário</td>
        </tr>
        <tr>
          <td><code>foto_perfil</code></td>
          <td>string</td>
          <td>ID do avatar: <code>&quot;color-&#123;cor&#125;&quot;</code>, <code>&quot;image-&#123;id&#125;&quot;</code> ou <code>&quot;custom-&#123;userId&#125;&quot;</code></td>
        </tr>
        <tr>
          <td><code>foto_perfil_path</code></td>
          <td>string | null</td>
          <td><strong>DEPRECADO:</strong> Avatares customizados são resolvidos automaticamente via Supabase Storage. O componente Avatar resolve via <code>resolveAvatarUrl</code>. Este campo não é mais usado.</td>
        </tr>
      </tbody>
    </table>

    <h4>Headers de Resposta</h4>
    <p>Além do JSON, a resposta inclui um header importante:</p>
    <div className="api-code-block">
      <pre><code>Set-Cookie: connect.sid=s%3A...; Path=/; HttpOnly; SameSite=Lax</code></pre>
    </div>
    <p><strong>⚠️ Importante:</strong> Este cookie será enviado automaticamente pelo navegador em requisições subsequentes. 
    Em ferramentas como cURL, Postman ou scripts, você precisa gerenciar o cookie manualmente.</p>

    <h3>❌ Response - Erro (400 Bad Request)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Email e senha são obrigatórios"
}`}</pre>
    </div>

    <h3>❌ Response - Erro (401 Unauthorized)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Email ou senha incorretos"
}`}</pre>
    </div>
    <p>ou</p>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Login não cadastrado, entre em contato com o desenvolvedor"
}`}</pre>
    </div>

    <h3>🧪 Testar API</h3>
    <ApiTester
      defaultMethod="POST"
      defaultEndpoint="/login"
      defaultBody={{
        email: "usuario@exemplo.com",
        senha: "senha123"
      }}
      requireAuth={false}
    />

    <h3>📝 Exemplos de Uso</h3>
    
    <h4>cURL</h4>
    <div className="api-code-block">
      <pre>{`# Login e salvar cookie em arquivo
curl -X POST http://localhost:3000/api/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "usuario@exemplo.com", "senha": "senha123"}' \\
  -c cookies.txt

# Usar cookie em requisições subsequentes
curl -X GET http://localhost:3000/api/clientes \\
  -b cookies.txt`}</pre>
    </div>

    <h4>JavaScript (Fetch API)</h4>
    <div className="api-code-block">
      <pre>{`// Login
const loginResponse = await fetch('http://localhost:3000/api/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // IMPORTANTE: permite envio de cookies
  body: JSON.stringify({
    email: 'usuario@exemplo.com',
    senha: 'senha123'
  })
});

const loginData = await loginResponse.json();
console.log('Login:', loginData);

// Requisição autenticada (cookie enviado automaticamente)
const clientesResponse = await fetch('http://localhost:3000/api/clientes', {
  credentials: 'include' // IMPORTANTE: envia cookies
});

const clientesData = await clientesResponse.json();
console.log('Clientes:', clientesData);`}</pre>
    </div>

    <h4>Postman</h4>
    <p><strong>Passo a passo:</strong></p>
    <ol>
      <li>Crie uma nova requisição <code>POST</code> para <code>http://localhost:3000/api/login</code></li>
      <li>Na aba <strong>Headers</strong>, adicione:
        <ul>
          <li><code>Content-Type: application/json</code></li>
          <li><code>Accept: application/json</code> (opcional, mas recomendado)</li>
        </ul>
      </li>
      <li>Na aba <strong>Body</strong>, selecione <strong>raw</strong> e escolha <strong>JSON</strong> no dropdown</li>
      <li>Cole o JSON: <code>{`{"email": "usuario@exemplo.com", "senha": "senha123"}`}</code></li>
      <li>Vá em <strong>Settings</strong> (⚙️) → <strong>General</strong> → Ative <strong>"Automatically follow redirects"</strong></li>
      <li>Envie a requisição clicando em <strong>Send</strong></li>
      <li>O cookie será salvo automaticamente. Para verificar, vá em <strong>Cookies</strong> (abaixo da URL)</li>
      <li>Nas próximas requisições, o Postman enviará o cookie automaticamente</li>
    </ol>
    
    <div className="api-info-box" style={{ 
      background: '#fff3cd', 
      border: '1px solid #ffc107', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '15px 0' 
    }}>
      <strong>💡 Dica:</strong> No Postman, você pode criar uma <strong>Collection</strong> e configurar 
      variáveis de ambiente para facilitar o gerenciamento de cookies e URLs base.
    </div>

    <h4>Python (requests)</h4>
    <div className="api-code-block">
      <pre>{`import requests

# Criar sessão para manter cookies
session = requests.Session()

# Login
login_response = session.post(
    'http://localhost:3000/api/login',
    json={
        'email': 'usuario@exemplo.com',
        'senha': 'senha123'
    }
)

if login_response.status_code == 200:
    login_data = login_response.json()
    if login_data.get('success'):
        print('✅ Login realizado:', login_data['usuario']['nome_usuario'])
        
        # Requisição autenticada (cookie enviado automaticamente pela sessão)
        clientes_response = session.get('http://localhost:3000/api/clientes')
        if clientes_response.status_code == 200:
            clientes_data = clientes_response.json()
            print('📋 Clientes encontrados:', clientes_data.get('count', 0))
            print('Dados:', clientes_data.get('data', []))
        else:
            print(f'❌ Erro ao buscar clientes: {clientes_response.status_code}')
    else:
        print('❌ Erro no login:', login_data.get('error'))
else:
    print(f'❌ Erro HTTP {login_response.status_code}:', login_response.text)`}</pre>
    </div>

    <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ddd' }} />

    <h2>POST /api/logout</h2>
    <p>Encerra a sessão do usuário autenticado e invalida o cookie de sessão no servidor.</p>
    <p><strong>⚠️ Requer autenticação:</strong> Sim (deve estar logado)</p>
    
    <h3>📋 Endpoint</h3>
    <div className="api-code-block">
      <pre><code>{`POST ${BASE_URL_DOC}/api/logout`}</code></pre>
    </div>

    <h3>📥 Request</h3>
    <p>Este endpoint não requer body. Apenas o cookie de sessão é necessário.</p>

    <h3>📤 Response - Sucesso (200 OK)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "message": "Logout realizado com sucesso"
}`}</pre>
    </div>
    <p><strong>Nota:</strong> Após o logout, o cookie de sessão é invalidado no servidor. 
    Requisições subsequentes com esse cookie retornarão erro 401.</p>

    <h3>❌ Response - Erro (401 Unauthorized)</h3>
    <p>Se você não estiver autenticado:</p>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Acesso negado. Faça login primeiro.",
  "redirect": "/login"
}`}</pre>
    </div>

    <h3>🧪 Testar API</h3>
    <ApiTester
      defaultMethod="POST"
      defaultEndpoint="/logout"
      requireAuth={true}
    />

    <h3>📝 Exemplos de Uso</h3>
    
    <h4>cURL</h4>
    <div className="api-code-block">
      <pre>{`curl -X POST http://localhost:3000/api/logout \\
  -H "Accept: application/json" \\
  -b cookies.txt`}</pre>
    </div>

    <h4>JavaScript (Fetch API)</h4>
    <div className="api-code-block">
      <pre>{`const logoutResponse = await fetch('http://localhost:3000/api/logout', {
  method: 'POST',
  credentials: 'include' // IMPORTANTE: envia cookies
});

const logoutData = await logoutResponse.json();
console.log('Logout:', logoutData);`}</pre>
    </div>

    <h4>Python (requests)</h4>
    <div className="api-code-block">
      <pre>{`# Usar a mesma sessão que foi usada para login
logout_response = session.post('http://localhost:3000/api/logout')

if logout_response.status_code == 200:
    print('✅ Logout realizado com sucesso')
else:
    print(f'❌ Erro: {logout_response.status_code}')`}</pre>
    </div>

    <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ddd' }} />

    <h2>GET /api/auth/check</h2>
    <p>Verifica se o usuário está autenticado e retorna os dados da sessão atual. Útil para validar se a sessão ainda está ativa.</p>
    <p><strong>⚠️ Requer autenticação:</strong> Não (mas retorna dados diferentes se autenticado ou não)</p>
    
    <h3>📋 Endpoint</h3>
    <div className="api-code-block">
      <pre><code>{`GET ${BASE_URL_DOC}/api/auth/check`}</code></pre>
    </div>

    <h3>📥 Request</h3>
    <p>Este endpoint não requer parâmetros. Se um cookie de sessão válido for enviado, retorna os dados do usuário.</p>

    <h3>📤 Response - Autenticado (200 OK)</h3>
    <p>Quando o usuário está autenticado e a sessão é válida:</p>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "authenticated": true,
  "usuario": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email_usuario": "usuario@exemplo.com",
    "nome_usuario": "Nome do Usuário",
    "foto_perfil": "color-blue",
    "foto_perfil_path": null // DEPRECADO: Avatares são resolvidos via Supabase Storage
  }
}`}</pre>
    </div>

    <h3>📤 Response - Não Autenticado (401 Unauthorized)</h3>
    <p>Quando não há cookie de sessão válido ou a sessão expirou:</p>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "authenticated": false,
  "error": "Acesso negado. Faça login primeiro.",
  "redirect": "/login"
}`}</pre>
    </div>

    <h3>🧪 Exemplos de Uso</h3>
    
    <h4>cURL</h4>
    <div className="api-code-block">
      <pre>{`# Verificar autenticação (com cookie)
curl -X GET http://localhost:3000/api/auth/check \\
  -H "Accept: application/json" \\
  -b cookies.txt

# Verificar sem cookie (retornará 401)
curl -X GET http://localhost:3000/api/auth/check \\
  -H "Accept: application/json"`}</pre>
    </div>

    <h4>JavaScript (Fetch API)</h4>
    <div className="api-code-block">
      <pre>{`// Verificar se está autenticado
const checkResponse = await fetch('http://localhost:3000/api/auth/check', {
  credentials: 'include' // IMPORTANTE: envia cookies
});

const checkData = await checkResponse.json();

if (checkData.authenticated) {
  console.log('✅ Usuário autenticado:', checkData.usuario.nome_usuario);
} else {
  console.log('❌ Não autenticado. Redirecionar para login.');
  // window.location.href = '/login';
}`}</pre>
    </div>

    <h4>Python (requests)</h4>
    <div className="api-code-block">
      <pre>{`# Verificar autenticação usando a sessão
check_response = session.get('http://localhost:3000/api/auth/check')

if check_response.status_code == 200:
    check_data = check_response.json()
    if check_data.get('authenticated'):
        print('✅ Autenticado:', check_data['usuario']['nome_usuario'])
    else:
        print('❌ Não autenticado')
else:
    print(f'❌ Erro: {check_response.status_code}')`}</pre>
    </div>

    <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ddd' }} />

    <h2>PUT /api/auth/profile</h2>
    <p>Atualiza o perfil do usuário autenticado.</p>
    
    <h3>📋 Endpoint</h3>
    <div className="api-code-block">
      <pre><code>{`PUT ${BASE_URL_DOC}/api/auth/profile`}</code></pre>
    </div>
    <p><strong>⚠️ Requer autenticação:</strong> Sim</p>

    <h3>📥 Request Body</h3>
    <p>Todos os campos são opcionais. Apenas os campos enviados serão atualizados.</p>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Campo</th>
          <th>Tipo</th>
          <th>Obrigatório</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>nome_usuario</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>Novo nome completo do usuário</td>
        </tr>
        <tr>
          <td><code>foto_perfil</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>ID do avatar: <code>&quot;color-&#123;cor&#125;&quot;</code>, <code>&quot;image-&#123;id&#125;&quot;</code> ou <code>&quot;custom-&#123;userId&#125;&quot;</code></td>
        </tr>
      </tbody>
    </table>

    <h3>📤 Response - Sucesso (200 OK)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "message": "Perfil atualizado com sucesso",
  "usuario": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email_usuario": "usuario@exemplo.com",
    "nome_usuario": "Novo Nome",
    "foto_perfil": "color-green",
    "foto_perfil_path": null
  }
}`}</pre>
    </div>

    <h3>❌ Response - Erro (401 Unauthorized)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Acesso negado. Faça login primeiro.",
  "redirect": "/login"
}`}</pre>
    </div>

    <h3>🧪 Exemplos de Uso</h3>
    
    <h4>Atualizar apenas o nome</h4>
    <div className="api-code-block">
      <pre>{`curl -X PUT http://localhost:3000/api/auth/profile \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -b cookies.txt \\
  -d '{"nome_usuario": "Novo Nome"}'`}</pre>
    </div>

    <h4>Atualizar nome e foto de perfil</h4>
    <div className="api-code-block">
      <pre>{`curl -X PUT http://localhost:3000/api/auth/profile \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -b cookies.txt \\
  -d '{
    "nome_usuario": "Novo Nome",
    "foto_perfil": "color-green"
  }'`}</pre>
    </div>

    <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ddd' }} />

    <h2>🔒 Segurança e Boas Práticas</h2>
    
    <h3>Gerenciamento de Sessão</h3>
    <ul>
      <li><strong>Sempre faça logout:</strong> Quando terminar de usar a API, faça logout para invalidar a sessão</li>
      <li><strong>Não compartilhe cookies:</strong> Cookies de sessão são pessoais e não devem ser compartilhados</li>
      <li><strong>Valide a sessão:</strong> Use <code>GET /api/auth/check</code> periodicamente para verificar se a sessão ainda está válida</li>
      <li><strong>Trate expiração:</strong> Sessões podem expirar após inatividade - sempre trate erros 401</li>
    </ul>

    <h3>Em Aplicações Web</h3>
    <ul>
      <li><strong>Use HTTPS:</strong> Em produção, sempre use HTTPS para proteger os cookies</li>
      <li><strong>Armazene dados com segurança:</strong> Não armazene senhas em localStorage ou sessionStorage</li>
      <li><strong>Implemente refresh de sessão:</strong> Verifique periodicamente se a sessão ainda está ativa</li>
      <li><strong>Trate erros 401:</strong> Redirecione para login quando receber erro 401</li>
    </ul>

    <h3>Em Scripts e Automações</h3>
    <ul>
      <li><strong>Mantenha a sessão:</strong> Use objetos de sessão (como <code>requests.Session</code> em Python) para manter cookies</li>
      <li><strong>Salve cookies:</strong> Em scripts longos, considere salvar cookies em arquivo para reutilização</li>
      <li><strong>Trate timeouts:</strong> Implemente retry logic para lidar com sessões expiradas</li>
      <li><strong>Limpe recursos:</strong> Sempre faça logout ao finalizar scripts</li>
    </ul>

    <div className="api-info-box" style={{ 
      background: '#e8f5e9', 
      border: '1px solid #4caf50', 
      borderRadius: '4px', 
      padding: '15px', 
      margin: '20px 0' 
    }}>
      <strong>✅ Resumo:</strong> A autenticação é baseada em cookies de sessão. Após fazer login, 
      o cookie é enviado automaticamente em todas as requisições. Use <code>credentials: 'include'</code> 
      (ou equivalente) para garantir que os cookies sejam enviados corretamente.
    </div>
    </div>
  );
};

const ClientesSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-briefcase"></i> Clientes
    </h1>
    <p className="api-section-intro">
      Endpoints para gerenciar clientes do sistema. Todos os endpoints requerem autenticação.
    </p>

    <h2>GET /api/clientes</h2>
    <p>Lista todos os clientes com paginação, busca e filtros.</p>
    
    <h3>📋 Endpoint</h3>
    <div className="api-code-block">
      <pre><code>{`GET ${BASE_URL_DOC}/api/clientes`}</code></pre>
    </div>
    <p><strong>⚠️ Requer autenticação:</strong> Sim</p>

    <h3>📥 Query Parameters</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Parâmetro</th>
          <th>Tipo</th>
          <th>Obrigatório</th>
          <th>Padrão</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>page</code></td>
          <td>integer</td>
          <td>❌ Não</td>
          <td>1</td>
          <td>Número da página (começa em 1)</td>
        </tr>
        <tr>
          <td><code>limit</code></td>
          <td>integer</td>
          <td>❌ Não</td>
          <td>20</td>
          <td>Quantidade de itens por página (máx recomendado: 100)</td>
        </tr>
        <tr>
          <td><code>search</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>-</td>
          <td>Busca por nome, razão social, nome fantasia ou nome amigável (case-insensitive, busca parcial)</td>
        </tr>
        <tr>
          <td><code>status</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>-</td>
          <td>Filtrar por status: <code>"ativo"</code> ou <code>"inativo"</code></td>
        </tr>
        <tr>
          <td><code>incompletos</code></td>
          <td>boolean</td>
          <td>❌ Não</td>
          <td>false</td>
          <td>Se <code>true</code>, retorna apenas clientes com cadastro incompleto (ignora filtro de status)</td>
        </tr>
      </tbody>
    </table>

    <h3>📤 Response - Sucesso (200 OK)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "razao_social": "Razão Social LTDA",
      "nome_fantasia": "Nome Fantasia",
      "nome_amigavel": "Nome Amigável",
      "cpf_cnpj": "12345678000190",
      "status": "ativo",
      "nome_cli_kamino": "Cliente Kamino",
      "id_cli_kamino": "123",
      "foto_perfil": "custom-550e8400-e29b-41d4-a716-446655440000",
      "foto_perfil_path": null, // DEPRECADO: Avatares são resolvidos via Supabase Storage
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 25,
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}`}</pre>
    </div>

    <h3>📊 Campos do Objeto Cliente</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Campo</th>
          <th>Tipo</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>id</code></td>
          <td>UUID</td>
          <td>Identificador único do cliente</td>
        </tr>
        <tr>
          <td><code>razao_social</code></td>
          <td>string</td>
          <td>Razão social da empresa</td>
        </tr>
        <tr>
          <td><code>nome_fantasia</code></td>
          <td>string</td>
          <td>Nome fantasia</td>
        </tr>
        <tr>
          <td><code>nome_amigavel</code></td>
          <td>string</td>
          <td>Nome amigável/nome de exibição</td>
        </tr>
        <tr>
          <td><code>cpf_cnpj</code></td>
          <td>string</td>
          <td>CPF ou CNPJ (sem formatação)</td>
        </tr>
        <tr>
          <td><code>status</code></td>
          <td>string</td>
          <td>Status do cliente: <code>"ativo"</code> ou <code>"inativo"</code></td>
        </tr>
        <tr>
          <td><code>nome_cli_kamino</code></td>
          <td>string</td>
          <td>Nome do cliente no sistema Kamino</td>
        </tr>
        <tr>
          <td><code>id_cli_kamino</code></td>
          <td>string</td>
          <td>ID do cliente no sistema Kamino</td>
        </tr>
        <tr>
          <td><code>foto_perfil</code></td>
          <td>string</td>
          <td>ID do avatar: <code>&quot;color-&#123;cor&#125;&quot;</code>, <code>&quot;image-&#123;id&#125;&quot;</code> ou <code>&quot;custom-&#123;clienteId&#125;&quot;</code></td>
        </tr>
        <tr>
          <td><code>foto_perfil_path</code></td>
          <td>string</td>
          <td>Caminho completo da foto (apenas se for avatar customizado)</td>
        </tr>
      </tbody>
    </table>

    <h3>🧪 Testar API</h3>
    <ApiTester
      defaultMethod="GET"
      defaultEndpoint="/clientes"
      defaultQueryParams={{
        page: "1",
        limit: "20"
      }}
      requireAuth={true}
    />

    <h3>📝 Exemplos de Uso</h3>
    
    <h4>Listar todos os clientes (primeira página)</h4>
    <div className="api-code-block">
      <pre>{`curl -X GET "http://localhost:3000/api/clientes?page=1&limit=20" \\
  -b cookies.txt`}</pre>
    </div>

    <h4>Buscar clientes por nome</h4>
    <div className="api-code-block">
      <pre>{`curl -X GET "http://localhost:3000/api/clientes?search=empresa&page=1&limit=20" \\
  -b cookies.txt`}</pre>
    </div>

    <h4>Filtrar apenas clientes ativos</h4>
    <div className="api-code-block">
      <pre>{`curl -X GET "http://localhost:3000/api/clientes?status=ativo&page=1&limit=20" \\
  -b cookies.txt`}</pre>
    </div>

    <h4>Listar clientes com cadastro incompleto</h4>
    <div className="api-code-block">
      <pre>{`curl -X GET "http://localhost:3000/api/clientes?incompletos=true" \\
  -b cookies.txt`}</pre>
    </div>

    <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ddd' }} />

    <h2>GET /api/clientes/:id</h2>
    <p>Obtém os detalhes completos de um cliente específico pelo ID.</p>
    
    <h3>📋 Endpoint</h3>
    <div className="api-code-block">
      <pre><code>{`GET ${BASE_URL_DOC}/api/clientes/:id`}</code></pre>
    </div>
    <p><strong>⚠️ Requer autenticação:</strong> Sim</p>

    <h3>📥 Path Parameters</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Parâmetro</th>
          <th>Tipo</th>
          <th>Obrigatório</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>id</code></td>
          <td>UUID</td>
          <td>✅ Sim</td>
          <td>ID único do cliente (UUID)</td>
        </tr>
      </tbody>
    </table>

    <h3>📤 Response - Sucesso (200 OK)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "cliente": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "razao_social": "Razão Social LTDA",
    "nome_fantasia": "Nome Fantasia",
    "nome_amigavel": "Nome Amigável",
    "cpf_cnpj": "12345678000190",
    "status": "ativo",
    "nome_cli_kamino": "Cliente Kamino",
    "id_cli_kamino": "123",
    "foto_perfil": "custom-550e8400-e29b-41d4-a716-446655440000",
    "foto_perfil_path": null, // DEPRECADO: Avatares são resolvidos via Supabase Storage
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}`}</pre>
    </div>

    <h3>❌ Response - Erro (404 Not Found)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Cliente não encontrado"
}`}</pre>
    </div>

    <h3>🧪 Testar API</h3>
    <ApiTester
      defaultMethod="GET"
      defaultEndpoint="/clientes/:id"
      requireAuth={true}
    />
    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
      <strong>Nota:</strong> Substitua <code>:id</code> pelo ID real do cliente (UUID)
    </p>

    <h3>📝 Exemplo de Uso</h3>
    <div className="api-code-block">
      <pre>{`curl -X GET "http://localhost:3000/api/clientes/550e8400-e29b-41d4-a716-446655440000" \\
  -b cookies.txt`}</pre>
    </div>

    <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ddd' }} />

    <h2>PUT /api/clientes/:id</h2>
    <p>Atualiza os dados de um cliente existente. Todos os campos são opcionais - apenas os campos enviados serão atualizados.</p>
    
    <h3>📋 Endpoint</h3>
    <div className="api-code-block">
      <pre><code>{`PUT ${BASE_URL_DOC}/api/clientes/:id`}</code></pre>
    </div>
    <p><strong>⚠️ Requer autenticação:</strong> Sim</p>

    <h3>📥 Path Parameters</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Parâmetro</th>
          <th>Tipo</th>
          <th>Obrigatório</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>id</code></td>
          <td>UUID</td>
          <td>✅ Sim</td>
          <td>ID único do cliente (UUID)</td>
        </tr>
      </tbody>
    </table>

    <h3>📥 Request Body</h3>
    <table className="api-table" style={{ width: '100%', marginBottom: '20px' }}>
      <thead>
        <tr>
          <th>Campo</th>
          <th>Tipo</th>
          <th>Obrigatório</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>razao_social</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>Razão social da empresa</td>
        </tr>
        <tr>
          <td><code>nome_fantasia</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>Nome fantasia</td>
        </tr>
        <tr>
          <td><code>nome_amigavel</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>Nome amigável/nome de exibição</td>
        </tr>
        <tr>
          <td><code>cpf_cnpj</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>CPF ou CNPJ (sem formatação)</td>
        </tr>
        <tr>
          <td><code>status</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>Status: <code>"ativo"</code> ou <code>"inativo"</code>. Ao alterar, sincroniza com contratos.</td>
        </tr>
        <tr>
          <td><code>nome_cli_kamino</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>Nome do cliente no sistema Kamino</td>
        </tr>
        <tr>
          <td><code>id_cli_kamino</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>ID do cliente no sistema Kamino</td>
        </tr>
        <tr>
          <td><code>foto_perfil</code></td>
          <td>string</td>
          <td>❌ Não</td>
          <td>ID do avatar: <code>&quot;color-&#123;cor&#125;&quot;</code>, <code>&quot;image-&#123;id&#125;&quot;</code> ou <code>&quot;custom-&#123;clienteId&#125;&quot;</code></td>
        </tr>
      </tbody>
    </table>

    <h3>📤 Response - Sucesso (200 OK)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "message": "Cliente atualizado com sucesso",
  "cliente": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "razao_social": "Nova Razão Social LTDA",
    "nome_fantasia": "Novo Nome Fantasia",
    "nome_amigavel": "Novo Nome Amigável",
    "cpf_cnpj": "12345678000190",
    "status": "ativo",
    "nome_cli_kamino": "Nome Kamino",
    "id_cli_kamino": "123",
    "foto_perfil": "color-blue",
    "updated_at": "2024-01-02T00:00:00.000Z"
  }
}`}</pre>
    </div>

    <h3>❌ Response - Erro (400 Bad Request)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Status inválido. Deve ser 'ativo' ou 'inativo'."
}`}</pre>
    </div>

    <h3>❌ Response - Erro (404 Not Found)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Cliente não encontrado"
}`}</pre>
    </div>

    <h3>🧪 Testar API</h3>
    <ApiTester
      defaultMethod="PUT"
      defaultEndpoint="/clientes/:id"
      defaultBody={{
        razao_social: "Nova Razão Social LTDA",
        nome_fantasia: "Novo Nome Fantasia",
        status: "ativo"
      }}
      requireAuth={true}
    />
    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
      <strong>Nota:</strong> Substitua <code>:id</code> pelo ID real do cliente (UUID). 
      Todos os campos do body são opcionais - apenas os enviados serão atualizados.
    </p>

    <h3>📝 Exemplos de Uso</h3>
    
    <h4>Atualizar apenas o status</h4>
    <div className="api-code-block">
      <pre>{`curl -X PUT "http://localhost:3000/api/clientes/550e8400-e29b-41d4-a716-446655440000" \\
  -H "Content-Type: application/json" \\
  -b cookies.txt \\
  -d '{"status": "inativo"}'`}</pre>
    </div>

    <h4>Atualizar múltiplos campos</h4>
    <div className="api-code-block">
      <pre>{`curl -X PUT "http://localhost:3000/api/clientes/550e8400-e29b-41d4-a716-446655440000" \\
  -H "Content-Type: application/json" \\
  -b cookies.txt \\
  -d '{
    "razao_social": "Nova Razão Social LTDA",
    "nome_fantasia": "Novo Nome Fantasia",
    "status": "ativo"
  }'`}</pre>
    </div>

    <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ddd' }} />

    <h2>DELETE /api/clientes/:id</h2>
    <p>Deleta um cliente existente. A exclusão é impedida se o cliente tiver relacionamentos ativos.</p>
    <h3>Response (200 OK)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "message": "Cliente deletado com sucesso",
  "cliente": {
    "id": "uuid",
    "nome": "Nome do Cliente"
  }
}`}</pre>
    </div>
    <h3>Response (409 Conflict)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Não é possível deletar cliente com relacionamentos ativos",
  "details": {
    "contratos": 2,
    "sistemas": 1,
    "contas": 0,
    "adquirentes": 0
  }
}`}</pre>
    </div>

    <h2>POST /api/clientes/:clienteId/upload-foto</h2>
    <p>Faz upload de foto de perfil do cliente.</p>
    <h3>Request</h3>
    <p>Form-data com campo <code>foto</code> (arquivo de imagem, máx. 15MB)</p>
    <h3>Response (200 OK)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "message": "Foto carregada com sucesso. Clique em 'Salvar' para confirmar.",
  "cliente": {
    "foto_perfil": "custom-uuid"
  },
  "imagePath": "/assets/images/avatars/clientes/cliente-uuid-timestamp.jpg"
}`}</pre>
    </div>

    <h3>Endpoints Especiais</h3>
    <ul>
      <li><strong>GET /api/clientes-kamino</strong> - Lista clientes do sistema Kamino</li>
      <li><strong>GET /api/clientes-incompletos-count</strong> - Retorna contagem de clientes incompletos</li>
    </ul>

    <h3>Recursos Relacionados</h3>
    <h4>Contas Bancárias</h4>
    <ul>
      <li><strong>GET /api/clientes/:cliente_id/contas-bancarias</strong> - Lista contas bancárias</li>
      <li><strong>GET /api/clientes-contas-bancarias/:id</strong> - Obtém conta bancária</li>
      <li><strong>POST /api/clientes-contas-bancarias</strong> - Cria conta bancária</li>
      <li><strong>PUT /api/clientes-contas-bancarias/:id</strong> - Atualiza conta bancária</li>
      <li><strong>DELETE /api/clientes-contas-bancarias/:id</strong> - Remove conta bancária</li>
    </ul>

    <h4>Sistemas</h4>
    <ul>
      <li><strong>GET /api/clientes/:cliente_id/sistemas</strong> - Lista sistemas</li>
      <li><strong>GET /api/clientes-sistemas/:id</strong> - Obtém sistema</li>
      <li><strong>POST /api/clientes-sistemas</strong> - Cria sistema</li>
      <li><strong>PUT /api/clientes-sistemas/:id</strong> - Atualiza sistema</li>
      <li><strong>DELETE /api/clientes-sistemas/:id</strong> - Remove sistema</li>
    </ul>

    <h4>Adquirentes</h4>
    <ul>
      <li><strong>GET /api/clientes/:cliente_id/adquirentes</strong> - Lista adquirentes</li>
      <li><strong>GET /api/clientes-adquirentes/:id</strong> - Obtém adquirente</li>
      <li><strong>POST /api/clientes-adquirentes</strong> - Cria adquirente</li>
      <li><strong>PUT /api/clientes-adquirentes/:id</strong> - Atualiza adquirente</li>
      <li><strong>DELETE /api/clientes-adquirentes/:id</strong> - Remove adquirente</li>
    </ul>
  </div>
);

const ColaboradoresSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-user-cog"></i> Colaboradores
    </h1>

    <h2>GET /api/colaboradores</h2>
    <p>Lista todos os colaboradores.</p>
    <h3>Query Parameters</h3>
    <ul>
      <li><code>page</code> - Número da página</li>
      <li><code>limit</code> - Itens por página</li>
      <li><code>search</code> - Busca por nome ou CPF</li>
      <li><code>status</code> - Filtrar por status (ativo/inativo)</li>
    </ul>

    <h2>GET /api/colaboradores/:id</h2>
    <p>Obtém detalhes de um colaborador específico.</p>

    <h2>POST /api/colaboradores</h2>
    <p>Cria um novo colaborador.</p>
    <h3>Request Body</h3>
    <div className="api-code-block">
      <pre>{`{
  "nome": "Nome do Colaborador",
  "cpf": "12345678900",
  "status": "ativo"
}`}</pre>
    </div>

    <h2>PUT /api/colaboradores/:id</h2>
    <p>Atualiza um colaborador existente.</p>
    <h3>Request Body</h3>
    <div className="api-code-block">
      <pre>{`{
  "nome": "Novo Nome",
  "cpf": "12345678900",
  "status": "ativo"
}`}</pre>
    </div>
    <p><strong>Nota:</strong> Para inativar/ativar, envie apenas o campo <code>status</code>.</p>

    <h2>DELETE /api/colaboradores/:id</h2>
    <p>Remove um colaborador.</p>
  </div>
);

const ProdutosSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-box"></i> Produtos
    </h1>

    <h2>GET /api/produtos</h2>
    <p>Lista todos os produtos.</p>
    <h3>Query Parameters:</h3>
    <ul>
      <li><code>page</code> - Número da página</li>
      <li><code>limit</code> - Itens por página</li>
      <li><code>search</code> - Busca por nome</li>
    </ul>

    <h2>GET /api/produtos/:id</h2>
    <p>Obtém detalhes de um produto específico.</p>

    <h2>POST /api/produtos</h2>
    <p>Cria um novo produto.</p>
    <h3>Request Body:</h3>
    <div className="api-code-block">
      <pre>{`{
  "nome": "Nome do Produto",
  "clickup_id": "123456"
}`}</pre>
    </div>

    <h2>PUT /api/produtos/:id</h2>
    <p>Atualiza um produto existente.</p>

    <h2>DELETE /api/produtos/:id</h2>
    <p>Remove um produto.</p>

    <h3>Endpoints Especiais</h3>
    <ul>
      <li><strong>GET /api/produtos-por-ids</strong> - Obtém produtos por IDs (query: ids=id1,id2,id3)</li>
      <li><strong>GET /api/produtos-por-ids-numericos</strong> - Obtém produtos por IDs numéricos</li>
    </ul>
  </div>
);

const TarefasSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-tasks"></i> Tarefas
    </h1>

    <h2>GET /api/tarefa</h2>
    <p>Lista todas as tarefas (cp_tarefa).</p>
    <h3>Query Parameters:</h3>
    <ul>
      <li><code>page</code> - Número da página</li>
      <li><code>limit</code> - Itens por página</li>
      <li><code>search</code> - Busca por nome</li>
    </ul>

    <h2>GET /api/tarefa/:id</h2>
    <p>Obtém detalhes de uma tarefa específica.</p>

    <h2>POST /api/tarefa</h2>
    <p>Cria uma nova tarefa.</p>

    <h2>PUT /api/tarefa/:id</h2>
    <p>Atualiza uma tarefa existente.</p>

    <h2>DELETE /api/tarefa/:id</h2>
    <p>Remove uma tarefa.</p>

    <h3>Endpoints Especiais</h3>
    <ul>
      <li><strong>GET /api/tarefas-incompletas</strong> - Lista tarefas incompletas</li>
      <li><strong>GET /api/tarefas-por-ids</strong> - Obtém tarefas por IDs (query: ids=id1,id2,id3)</li>
    </ul>

    <h3>Tipo de Tarefa</h3>
    <ul>
      <li><strong>GET /api/tipo-tarefa</strong> - Lista tipos de tarefa</li>
      <li><strong>GET /api/tipo-tarefa/:id</strong> - Obtém tipo de tarefa por ID</li>
      <li><strong>POST /api/tipo-tarefa</strong> - Cria novo tipo de tarefa</li>
      <li><strong>PUT /api/tipo-tarefa/:id</strong> - Atualiza tipo de tarefa</li>
      <li><strong>DELETE /api/tipo-tarefa/:id</strong> - Remove tipo de tarefa</li>
    </ul>
  </div>
);

const BancosSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-university"></i> Bancos
    </h1>

    <h2>GET /api/bancos</h2>
    <p>Lista todos os bancos cadastrados.</p>

    <h2>GET /api/bancos/:id</h2>
    <p>Obtém detalhes de um banco específico.</p>

    <h2>POST /api/bancos</h2>
    <p>Cria um novo banco.</p>

    <h2>PUT /api/bancos/:id</h2>
    <p>Atualiza um banco existente.</p>

    <h2>DELETE /api/bancos/:id</h2>
    <p>Remove um banco.</p>
  </div>
);

const AdquirentesSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-credit-card"></i> Adquirentes
    </h1>

    <h2>GET /api/adquirentes</h2>
    <p>Lista todos os adquirentes cadastrados.</p>

    <h2>GET /api/adquirentes/:id</h2>
    <p>Obtém detalhes de um adquirente específico.</p>

    <h2>POST /api/adquirentes</h2>
    <p>Cria um novo adquirente.</p>

    <h2>PUT /api/adquirentes/:id</h2>
    <p>Atualiza um adquirente existente.</p>

    <h2>DELETE /api/adquirentes/:id</h2>
    <p>Remove um adquirente.</p>
  </div>
);

const SistemasSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-server"></i> Sistemas
    </h1>

    <h2>GET /api/sistemas</h2>
    <p>Lista todos os sistemas cadastrados.</p>

    <h2>GET /api/sistemas/:id</h2>
    <p>Obtém detalhes de um sistema específico.</p>

    <h2>POST /api/sistemas</h2>
    <p>Cria um novo sistema.</p>

    <h2>PUT /api/sistemas/:id</h2>
    <p>Atualiza um sistema existente.</p>

    <h2>DELETE /api/sistemas/:id</h2>
    <p>Remove um sistema.</p>
  </div>
);

const BaseConhecimentoSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-book"></i> Base de Conhecimento
    </h1>

    <h2>GET /api/base-conhecimento/cliente/:cliente_id</h2>
    <p>Obtém a base de conhecimento completa de um cliente.</p>
    <h3>Response (200 OK)</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": true,
  "data": {
    "cliente": {
      "id": "uuid",
      "razao": "Razão Social",
      "fantasia": "Nome Fantasia",
      "status": "ativo",
      "foto_perfil_path": "..."
    },
    "sistemas": [
      {
        "id": "uuid",
        "servidor": "servidor.com",
        "usuario_servidor": "usuario",
        "cp_sistema": {
          "nome": "Nome do Sistema"
        }
      }
    ],
    "contasBancarias": [
      {
        "id": "uuid",
        "banco_id": "uuid",
        "agencia": "1234",
        "conta": "567890",
        "cp_banco": {
          "nome": "Banco Exemplo"
        }
      }
    ],
    "adquirentes": [
      {
        "id": "uuid",
        "cp_adquirente": {
          "nome": "Adquirente Exemplo"
        }
      }
    ]
  }
}`}</pre>
    </div>
  </div>
);

const AtividadesSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-list"></i> Atividades
    </h1>

    <h2>GET /api/atividades</h2>
    <p>Lista todas as atividades.</p>
    <h3>Query Parameters:</h3>
    <ul>
      <li><code>page</code> - Número da página</li>
      <li><code>limit</code> - Itens por página</li>
      <li><code>search</code> - Busca por nome</li>
    </ul>

    <h2>GET /api/atividades/:id</h2>
    <p>Obtém detalhes de uma atividade específica.</p>

    <h2>POST /api/atividades</h2>
    <p>Cria uma nova atividade.</p>

    <h2>PUT /api/atividades/:id</h2>
    <p>Atualiza uma atividade existente.</p>

    <h2>DELETE /api/atividades/:id</h2>
    <p>Remove uma atividade.</p>

    <h3>Tipo de Atividade</h3>
    <ul>
      <li><strong>GET /api/tipo-atividade</strong> - Lista tipos de atividade</li>
      <li><strong>GET /api/tipo-atividade/:id</strong> - Obtém tipo de atividade por ID</li>
      <li><strong>GET /api/tipo-atividade/por-clickup-id</strong> - Obtém por ClickUp ID</li>
      <li><strong>POST /api/tipo-atividade</strong> - Cria novo tipo de atividade</li>
      <li><strong>PUT /api/tipo-atividade/:id</strong> - Atualiza tipo de atividade</li>
      <li><strong>DELETE /api/tipo-atividade/:id</strong> - Remove tipo de atividade</li>
    </ul>
  </div>
);

const VinculacoesSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-link"></i> Vinculações
    </h1>

    <h2>GET /api/vinculacoes</h2>
    <p>Lista todas as vinculações.</p>

    <h2>GET /api/vinculacoes/:id</h2>
    <p>Obtém detalhes de uma vinculação específica.</p>

    <h2>POST /api/vinculacoes</h2>
    <p>Cria uma nova vinculação.</p>

    <h2>PUT /api/vinculacoes/:id</h2>
    <p>Atualiza uma vinculação existente.</p>

    <h2>DELETE /api/vinculacoes/:id</h2>
    <p>Remove uma vinculação.</p>

    <h3>Vinculados (Tarefas x Produtos x Clientes)</h3>
    <ul>
      <li><strong>GET /api/vinculados</strong> - Lista todos os vinculados</li>
      <li><strong>GET /api/vinculados/:id</strong> - Obtém vinculado por ID</li>
      <li><strong>POST /api/vinculados</strong> - Cria novo vinculado</li>
      <li><strong>POST /api/vinculados/multiplos</strong> - Cria múltiplos vinculados</li>
      <li><strong>PUT /api/vinculados/:id</strong> - Atualiza vinculado</li>
      <li><strong>DELETE /api/vinculados/:id</strong> - Remove vinculado</li>
    </ul>

    <h3>Consultas Especiais</h3>
    <ul>
      <li><strong>GET /api/tarefas-por-produtos</strong> - Lista tarefas por produtos</li>
      <li><strong>GET /api/tarefas-por-cliente</strong> - Lista tarefas por cliente</li>
      <li><strong>GET /api/tarefas-por-cliente-produtos</strong> - Lista tarefas por cliente e produtos</li>
      <li><strong>GET /api/produtos-por-cliente</strong> - Lista produtos por cliente</li>
    </ul>
  </div>
);

const TempoSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-clock"></i> Tempo Estimado e Registro
    </h1>

    <h2>Tempo Estimado</h2>
    <ul>
      <li><strong>GET /api/tempo-estimado</strong> - Lista tempos estimados</li>
      <li><strong>GET /api/tempo-estimado/:id</strong> - Obtém tempo estimado por ID</li>
      <li><strong>POST /api/tempo-estimado</strong> - Cria novo tempo estimado</li>
      <li><strong>PUT /api/tempo-estimado/:id</strong> - Atualiza tempo estimado</li>
      <li><strong>DELETE /api/tempo-estimado/:id</strong> - Remove tempo estimado</li>
    </ul>

    <h3>Endpoints Especiais de Tempo Estimado</h3>
    <ul>
      <li><strong>GET /api/tempo-estimado/agrupador/:agrupador_id</strong> - Obtém por agrupador</li>
      <li><strong>PUT /api/tempo-estimado/agrupador/:agrupador_id</strong> - Atualiza por agrupador</li>
      <li><strong>DELETE /api/tempo-estimado/agrupador/:agrupador_id</strong> - Remove por agrupador</li>
      <li><strong>POST /api/tempo-estimado/tempo-realizado</strong> - Obtém tempo realizado por tarefas estimadas</li>
    </ul>

    <h2>Registro de Tempo</h2>
    
    <h3>GET /api/registro-tempo</h3>
    <p>Lista registros de tempo com filtros e paginação (endpoint genérico consolidado).</p>
    <h4>Query Parameters:</h4>
    <ul>
      <li><code>usuario_id</code> - Filtrar por usuário (ou use <code>colaboradorId</code> para compatibilidade)</li>
      <li><code>cliente_id</code> - Filtrar por cliente (ou use <code>clienteId</code> para compatibilidade)</li>
      <li><code>tarefa_id</code> - Filtrar por tarefa</li>
      <li><code>tempo_estimado_id</code> - Filtrar por tempo estimado</li>
      <li><code>data_inicio</code> - Data início do período (formato: YYYY-MM-DD)</li>
      <li><code>data_fim</code> - Data fim do período (formato: YYYY-MM-DD)</li>
      <li><code>ativo</code> - true/false para filtrar apenas ativos ou finalizados</li>
      <li><code>page</code> - Número da página (padrão: 1)</li>
      <li><code>limit</code> - Itens por página (padrão: 50)</li>
    </ul>
    <h4>Exemplo:</h4>
    <div className="api-code-block">
      <pre>{`GET /api/registro-tempo?usuario_id=1&cliente_id=uuid&data_inicio=2024-01-01&data_fim=2024-12-31&ativo=false&page=1&limit=20`}</pre>
    </div>

    <h3>Endpoints Específicos</h3>
    <ul>
      <li><strong>POST /api/registro-tempo/iniciar</strong> - Inicia um registro de tempo</li>
      <li><strong>PUT /api/registro-tempo/finalizar/:id</strong> - Finaliza um registro de tempo</li>
      <li><strong>GET /api/registro-tempo/ativo</strong> - Obtém registro ativo específico (requer usuario_id, tarefa_id, cliente_id)</li>
      <li><strong>GET /api/registro-tempo/ativos</strong> - Lista todos os registros ativos de um usuário</li>
      <li><strong>GET /api/registro-tempo/realizado</strong> - Calcula tempo realizado total para uma tarefa</li>
      <li><strong>GET /api/registro-tempo/por-tempo-estimado</strong> - Obtém registros por tempo_estimado_id</li>
      <li><strong>GET /api/registro-tempo/historico</strong> - Obtém histórico de registros finalizados do usuário</li>
      <li><strong>GET /api/registro-tempo/debug/sem-tarefa</strong> - Lista registros sem tarefa_id (diagnóstico)</li>
      <li><strong>PUT /api/registro-tempo/:id</strong> - Atualiza registro de tempo</li>
      <li><strong>DELETE /api/registro-tempo/:id</strong> - Remove registro de tempo</li>
    </ul>
  </div>
);

const DashboardSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-chart-bar"></i> Dashboard e Relatórios
    </h1>

    <h2>GET /api/dashboard-clientes</h2>
    <p>Obtém dados do dashboard de clientes.</p>
    <p>Alias: <code>/api/relatorios-clientes</code></p>

    <h2>GET /api/dashboard-colaboradores</h2>
    <p>Obtém dados do dashboard de colaboradores.</p>
    <p>Alias: <code>/api/relatorios-colaboradores</code></p>

    <h2>GET /api/membros-por-cliente</h2>
    <p>Lista membros/colaboradores associados a um ou mais clientes.</p>
    <h3>Query Parameters</h3>
    <ul>
      <li><code>clienteId</code> - ID do cliente (pode ser múltiplo)</li>
      <li><code>periodoInicio</code> - Data de início (opcional)</li>
      <li><code>periodoFim</code> - Data de fim (opcional)</li>
    </ul>

    <h2>GET /api/clientes-por-colaborador</h2>
    <p>Lista clientes associados a um ou mais colaboradores.</p>
    <h3>Query Parameters</h3>
    <ul>
      <li><code>colaboradorId</code> - ID do colaborador (pode ser múltiplo)</li>
      <li><code>periodoInicio</code> - Data de início (opcional)</li>
      <li><code>periodoFim</code> - Data de fim (opcional)</li>
    </ul>
  </div>
);

const ErrosSection = () => (
  <div className="api-section">
    <h1 className="api-section-title">
      <i className="fas fa-exclamation-triangle"></i> Códigos de Erro e Tratamento
    </h1>

    <h2>🔢 Códigos HTTP</h2>
    <table className="api-table" style={{ width: '100%', marginBottom: '30px' }}>
      <thead>
        <tr>
          <th>Código</th>
          <th>Status</th>
          <th>Descrição</th>
          <th>Quando Ocorre</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>200</code></td>
          <td>OK</td>
          <td>Requisição processada com sucesso</td>
          <td>Operação bem-sucedida</td>
        </tr>
        <tr>
          <td><code>201</code></td>
          <td>Created</td>
          <td>Recurso criado com sucesso</td>
          <td>Ao criar novos recursos (POST)</td>
        </tr>
        <tr>
          <td><code>400</code></td>
          <td>Bad Request</td>
          <td>Dados inválidos na requisição</td>
          <td>Campos obrigatórios faltando, formato inválido, validação falhou</td>
        </tr>
        <tr>
          <td><code>401</code></td>
          <td>Unauthorized</td>
          <td>Não autenticado ou sessão expirada</td>
          <td>Token/cookie inválido, não fez login, sessão expirada</td>
        </tr>
        <tr>
          <td><code>403</code></td>
          <td>Forbidden</td>
          <td>Acesso negado</td>
          <td>Usuário autenticado mas sem permissão para a ação</td>
        </tr>
        <tr>
          <td><code>404</code></td>
          <td>Not Found</td>
          <td>Recurso não encontrado</td>
          <td>ID inválido, recurso não existe</td>
        </tr>
        <tr>
          <td><code>409</code></td>
          <td>Conflict</td>
          <td>Conflito com estado atual</td>
          <td>CPF/CNPJ já cadastrado, relacionamentos ativos impedem exclusão</td>
        </tr>
        <tr>
          <td><code>500</code></td>
          <td>Internal Server Error</td>
          <td>Erro interno do servidor</td>
          <td>Erro inesperado no servidor, problema de banco de dados</td>
        </tr>
      </tbody>
    </table>

    <h2>📋 Estrutura de Resposta de Erro</h2>
    <p>Todas as respostas de erro seguem este padrão:</p>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Mensagem de erro principal",
  "message": "Mensagem adicional (opcional)",
  "details": "Detalhes técnicos (opcional)"
}`}</pre>
    </div>

    <h2>📝 Exemplos de Erros Comuns</h2>

    <h3>400 Bad Request - Campos Obrigatórios</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Email e senha são obrigatórios"
}`}</pre>
    </div>

    <h3>401 Unauthorized - Não Autenticado</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Acesso negado. Faça login primeiro.",
  "message": "Acesso negado. Faça login primeiro.",
  "redirect": "/login"
}`}</pre>
    </div>

    <h3>404 Not Found - Recurso Não Encontrado</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Cliente não encontrado"
}`}</pre>
    </div>

    <h3>409 Conflict - Conflito</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Não é possível deletar cliente com relacionamentos ativos",
  "message": "O cliente possui contratos, sistemas, contas bancárias ou adquirentes vinculados.",
  "details": {
    "contratos": 2,
    "sistemas": 1,
    "contas": 0,
    "adquirentes": 0
  }
}`}</pre>
    </div>
    <p>ou</p>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "CPF já cadastrado",
  "details": "Este CPF já está cadastrado para outro colaborador"
}`}</pre>
    </div>

    <h3>500 Internal Server Error</h3>
    <div className="api-code-block">
      <pre>{`{
  "success": false,
  "error": "Erro interno do servidor",
  "details": "Mensagem técnica do erro (em desenvolvimento)"
}`}</pre>
    </div>

    <h2>🛠️ Como Tratar Erros</h2>
    
    <h3>JavaScript (Fetch API)</h3>
    <div className="api-code-block">
      <pre>{`try {
  const response = await fetch('http://localhost:3000/api/clientes', {
    credentials: 'include'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    // Erro HTTP (4xx, 5xx)
    if (response.status === 401) {
      // Redirecionar para login
      window.location.href = '/login';
    } else if (response.status === 404) {
      console.error('Recurso não encontrado:', data.error);
    } else {
      console.error('Erro:', data.error, data.details);
    }
    return;
  }
  
  // Sucesso
  console.log('Dados:', data.data);
} catch (error) {
  // Erro de rede
  console.error('Erro de conexão:', error);
}`}</pre>
    </div>

    <h3>Python (requests)</h3>
    <div className="api-code-block">
      <pre>{`import requests

try:
    response = session.get('http://localhost:3000/api/clientes')
    response.raise_for_status()  # Levanta exceção para códigos 4xx/5xx
    
    data = response.json()
    if data.get('success'):
        print('Dados:', data['data'])
    else:
        print('Erro:', data.get('error'))
        
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 401:
        print('Não autenticado - faça login')
    elif e.response.status_code == 404:
        print('Recurso não encontrado')
    else:
        print(f'Erro HTTP {e.response.status_code}:', e.response.json())
except requests.exceptions.RequestException as e:
    print('Erro de conexão:', e)`}</pre>
    </div>
  </div>
);

export default DocumentacaoAPI;

