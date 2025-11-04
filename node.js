const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const routes = require('./routes');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 4000;

// ========================================
// 🚀 SISTEMA DE CACHE - Otimização de Performance
// ========================================
// Cache com TTL de 5 minutos (300 segundos)
// Isso reduz drasticamente as consultas ao banco de dados
const cache = new NodeCache({ 
  stdTTL: 300,           // Tempo padrão de vida: 5 minutos
  checkperiod: 60,       // Verificar itens expirados a cada 60 segundos
  useClones: false       // Performance: não clonar objetos
});

// Função helper para cache
function getCachedData(key) {
  const cached = cache.get(key);
  if (cached) {
    console.log(`✅ Cache HIT: ${key}`);
    return cached;
  }
  console.log(`❌ Cache MISS: ${key}`);
  return null;
}

function setCachedData(key, data, ttl = 300) {
  cache.set(key, data, ttl);
  console.log(`💾 Cache SAVED: ${key} (TTL: ${ttl}s)`);
}

// Função para limpar cache específico
function clearCache(pattern) {
  const keys = cache.keys();
  const keysToDelete = keys.filter(key => key.includes(pattern));
  keysToDelete.forEach(key => cache.del(key));
  console.log(`🗑️  Cache CLEARED: ${keysToDelete.length} keys with pattern "${pattern}"`);
}

console.log('✅ Sistema de Cache inicializado com sucesso!');

// Configuração do Supabase
const supabaseUrl = 'https://gijgjvfwxmkkihdmfmdg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpamdqdmZ3eG1ra2loZG1mbWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjEzNzIxNywiZXhwIjoyMDU3NzEzMjE3fQ.b9F3iLwtnpYp54kPyQORmfe8hW2fLxoKlXmIXuTY99U';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'up_gestaointeligente' },
  global: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
});

// Configurar middleware
app.use(cors());
app.use(express.json());

// Configurar sessões
app.use(session({
  secret: 'up-gestao-inteligente-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true apenas em HTTPS
    httpOnly: true
    // Removido maxAge para que o cookie expire quando o navegador for fechado
  }
}));

// Middleware customizado para bloquear acesso direto a páginas HTML protegidas
app.use((req, res, next) => {
  // Verificar se é uma requisição direta para páginas HTML protegidas
  if (req.path.endsWith('.html') && 
      (req.path.includes('clientes.html') || 
       req.path.includes('dashboard.html') || 
       req.path.includes('cadastro-cliente.html'))) {
    
    // Verificar se o usuário está autenticado
    if (!req.session || !req.session.usuario) {
      return res.redirect('/login');
    }
  }
  next();
});

// Middleware para servir arquivos estáticos
app.use(express.static('.'));

console.log('Supabase configurado com sucesso para o schema up_gestaointeligente');

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  } else {
    // Se for uma requisição AJAX/API, retornar JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(401).json({ 
        success: false, 
        message: 'Acesso negado. Faça login primeiro.',
        redirect: '/login'
      });
    }
    // Se for uma requisição normal, redirecionar para login
    return res.redirect('/login');
  }
}

// Rota para servir a página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Endpoint para autenticação de login
app.post('/api/login', async (req, res) => {
  try {
    console.log('🔍 DEBUG LOGIN - req.body completo:', JSON.stringify(req.body, null, 2));
    console.log('🔍 DEBUG LOGIN - req.headers:', JSON.stringify(req.headers, null, 2));
    
    const { email, senha } = req.body;
    
    console.log('🔍 DEBUG LOGIN - email extraído:', email);
    console.log('🔍 DEBUG LOGIN - senha extraída:', senha ? '[SENHA FORNECIDA]' : '[SENHA VAZIA]');
    
    // Validação básica
    if (!email || !senha) {
      console.log('❌ DEBUG LOGIN - Validação falhou: email=', email, 'senha=', senha ? '[FORNECIDA]' : '[VAZIA]');
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }


    
    // Buscar usuário na tabela usuarios do schema up_gestaointeligente
    const { data: usuarios, error } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .select('id, email_usuario, senha_login, nome_usuario')
      .eq('email_usuario', email.toLowerCase().trim())
      .limit(1);
    
    if (error) {
      console.error('Erro ao buscar usuário:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
    
    // Verificar se usuário existe
    if (!usuarios || usuarios.length === 0) {
      console.log('Usuário não encontrado:', email);
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }
    
    const usuario = usuarios[0];
    
    console.log('🔍 DEBUG LOGIN - Usuário encontrado:', JSON.stringify(usuario, null, 2));
    
    // Verificar senha (comparação simples - em produção usar hash)
    if (usuario.senha_login !== senha) {
      console.log('❌ DEBUG LOGIN - Senha incorreta para usuário:', email);
      console.log('🔍 DEBUG LOGIN - Senha no banco:', usuario.senha_login);
      console.log('🔍 DEBUG LOGIN - Senha fornecida:', senha);
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }
    
    // Login bem-sucedido - criar sessão
    console.log('✅ DEBUG LOGIN - Login bem-sucedido para usuário:', email);
    
    // Criar sessão do usuário
    req.session.usuario = {
      id: usuario.id,
      email_usuario: usuario.email_usuario,
      nome_usuario: usuario.nome_usuario
    };
    
    // Retornar dados do usuário (sem a senha)
    const { senha_login: _, ...usuarioSemSenha } = usuario;
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      usuario: usuarioSemSenha
    });
    
  } catch (error) {
    console.error('Erro no endpoint de login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para buscar clientes do Kamino (protegida)
app.get('/api/clientes-kamino', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cliente_kamino')
      .select('id, nome_fantasia, razao_social')
      .not('nome_fantasia', 'is', null)
      .order('nome_fantasia');
    
    if (error) {
      console.error('Erro ao buscar clientes Kamino:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    // Retornar dados completos para permitir mapeamento nome_fantasia -> id
    const clientesData = data.map(row => ({
      id: row.id,
      nome_fantasia: row.nome_fantasia,
      razao_social: row.razao_social
    })).filter(cliente => cliente.nome_fantasia);
    
    // Manter compatibilidade: extrair apenas nome_fantasia para o dropdown
    const nomesFantasia = clientesData.map(cliente => cliente.nome_fantasia);
    
    res.json({ 
      success: true, 
      data: nomesFantasia,
      clientes: clientesData, // Dados completos para mapeamento
      count: nomesFantasia.length 
    });
  } catch (error) {
    console.error('Erro ao buscar clientes Kamino:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para buscar clientes do ClickUp (protegida)
app.get('/api/clientes-clickup', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('nome, id')
      .not('nome', 'is', null)
      .order('nome');
    
    if (error) {
      console.error('Erro ao buscar clientes ClickUp:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    // Extrair apenas nome para o dropdown
    const nomes = data.map(row => row.nome).filter(Boolean);
    
    // Dados completos para mapeamento nome -> id
    const clientesData = data.filter(row => row.nome);
    
    console.log('=== DEBUG CLIENTES CLICKUP ===');
    console.log('Total de registros da query:', data.length);
    console.log('Primeiros 3 registros:', data.slice(0, 3));
    console.log('Total de nomes filtrados:', nomes.length);
    console.log('Total de clientesData:', clientesData.length);
    console.log('Primeiros 3 clientesData:', clientesData.slice(0, 3));
    
    const response = { 
      success: true, 
      data: nomes,
      clientes: clientesData, // Dados completos para mapeamento
      count: nomes.length 
    };
    
    console.log('Resposta que será enviada:', JSON.stringify(response, null, 2));
    
    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar clientes ClickUp:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para buscar dados específicos de um cliente ClickUp (protegida)
app.get('/api/cliente-dados/:nomeClienteClickup', requireAuth, async (req, res) => {
  try {
    const { nomeClienteClickup } = req.params;
    
    console.log('=== DEBUG CLIENTE DADOS ===');
    console.log('Nome do cliente ClickUp recebido:', nomeClienteClickup);
    
    if (!nomeClienteClickup) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome do cliente ClickUp é obrigatório' 
      });
    }
    
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino')
      .eq('nome', nomeClienteClickup)
      .limit(1);
    
    if (error) {
      console.error('Erro ao buscar dados do cliente ClickUp:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }
    
    if (!data || data.length === 0) {
      console.log('Cliente ClickUp não encontrado:', nomeClienteClickup);
      return res.status(404).json({ 
        success: false, 
        message: 'Cliente ClickUp não encontrado' 
      });
    }
    
    console.log('Dados do cliente encontrados:', data[0]);
    
    res.json({ 
      success: true, 
      data: {
        razao_social: data[0].razao_social || '',
        nome_fantasia: data[0].nome_fantasia || '',
        nome_amigavel: data[0].nome_amigavel || '',
        cpf_cnpj: data[0].cpf_cnpj || '',
        status: data[0].status || '',
        nome_cli_kamino: data[0].nome_cli_kamino || ''
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados do cliente ClickUp:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para listar todos os clientes com filtros opcionais (protegida)
// ========================================
// 🚀 ENDPOINT OTIMIZADO: GET /api/clientes
// ========================================
// Implementa: Cache, Paginação e Otimizações de Performance
app.get('/api/clientes', requireAuth, async (req, res) => {
  console.log('=== INÍCIO GET /api/clientes (OTIMIZADO) ===');
  
  try {
    // Verificar se supabase está disponível
    if (!supabase) {
      console.error('❌ Supabase não está configurado!');
      return res.status(500).json({ success: false, error: 'Supabase não configurado' });
    }
    
    // ========================================
    // 📄 PARÂMETROS DE PAGINAÇÃO
    // ========================================
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Padrão: 20 itens
    
    // Validar limite (apenas 10, 20 ou 30 permitidos)
    const validLimits = [10, 20, 30];
    const finalLimit = validLimits.includes(limit) ? limit : 20;
    
    const offset = (page - 1) * finalLimit;
    
    // ========================================
    // 🔍 PARÂMETROS DE FILTRO
    // ========================================
    const { status, startDate, endDate, clienteIds, colaboradorIds, search, incompletos } = req.query;
    
    console.log('🔍 Parâmetros recebidos:', { 
      page, 
      limit: finalLimit, 
      offset,
      status, 
      startDate, 
      endDate, 
      clienteIds,
      colaboradorIds,
      search,
      incompletos
    });
    
    // ========================================
    // 💾 VERIFICAR CACHE
    // ========================================
    const cacheKey = `clientes_${page}_${finalLimit}_${status || 'all'}_${startDate || ''}_${endDate || ''}_${clienteIds || ''}_${colaboradorIds || ''}_${search || ''}_${incompletos || ''}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      console.log('✅ Retornando dados do CACHE');
      return res.json(cachedData);
    }
    
    // ========================================
    // 🔎 BUSCAR DADOS DO BANCO
    // ========================================
    
    // Query para contar total de registros (sem paginação)
    let countQuery = supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id', { count: 'exact', head: true });
    
    // Query para buscar dados paginados
    let dataQuery = supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + finalLimit - 1);
    
    // ========================================
    // 🔧 APLICAR FILTROS
    // ========================================
    
    // Filtro de status (direto na tabela de clientes)
    if (status && status.trim() !== '') {
      const statusValue = status.trim();
      console.log('📊 Aplicando filtro de status do cliente:', statusValue);
      console.log('📊 Parâmetros recebidos - status:', status, 'statusValue:', statusValue);
      
      // Aplicar filtro direto na tabela de clientes
      countQuery = countQuery.eq('status', statusValue);
      dataQuery = dataQuery.eq('status', statusValue);
      
      console.log('📊 Filtro de status aplicado nas queries');
    } else {
      console.log('📊 Nenhum filtro de status aplicado - status:', status);
    }

    // Filtro de clientes incompletos (campos vazios/null)
    // Validar parâmetro incompletos (aceitar apenas 'true' ou boolean true)
    const incompletosParam = req.query.incompletos;
    const showIncompletos = incompletosParam === 'true' || incompletosParam === true;
    
    if (showIncompletos) {
      // Filtrar clientes onde QUALQUER um dos campos especificados está vazio ou null
      // Campos: razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino
      const incompletosFilter = `or(razao_social.is.null,razao_social.eq.,nome_fantasia.is.null,nome_fantasia.eq.,nome_amigavel.is.null,nome_amigavel.eq.,cpf_cnpj.is.null,cpf_cnpj.eq.,status.is.null,status.eq.,nome_cli_kamino.is.null,nome_cli_kamino.eq.)`;
      
      countQuery = countQuery.or(incompletosFilter);
      dataQuery = dataQuery.or(incompletosFilter);
    }
    
    // Filtro de IDs específicos de clientes
    if (clienteIds && clienteIds.trim() !== '') {
      const idsArray = clienteIds.split(',').map(id => id.trim()).filter(id => id);
      if (idsArray.length > 0) {
        countQuery = countQuery.in('id', idsArray);
        dataQuery = dataQuery.in('id', idsArray);
        console.log('🆔 Filtro de IDs aplicado:', idsArray.length, 'IDs');
      }
    }
    
    // Filtro de colaboradores (via tarefas)
    if (colaboradorIds && colaboradorIds.trim() !== '') {
      const colaboradorArray = colaboradorIds.split(',').map(id => id.trim()).filter(id => id);
      if (colaboradorArray.length > 0) {
        console.log('👥 Aplicando filtro de colaboradores:', colaboradorArray);
        
        // Buscar clientes que têm tarefas com os colaboradores especificados
        // A tabela 'tarefa' tem o campo 'responsavel_id' que é o ID do colaborador
        let tarefasQuery = supabase
          .schema('up_gestaointeligente')
          .from('tarefa')
          .select('cliente_id')
          .in('responsavel_id', colaboradorArray);
        
        // 🔗 VINCULAR COM PERÍODO: Se período foi selecionado, filtrar tarefas por data
    if (startDate && startDate.trim() !== '') {
          const dateInicialObj = new Date(startDate);
          // Filtrar tarefas que iniciaram no período ou foram criadas no período (se dt_inicio for null)
          tarefasQuery = tarefasQuery.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${new Date(endDate || startDate).toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${new Date(endDate || startDate).toISOString()})`);
          console.log(`📅👥 Filtrando tarefas dos colaboradores no período: ${startDate} até ${endDate || startDate}`);
        } else if (endDate && endDate.trim() !== '') {
          const dateFinalObj = new Date(endDate);
          dateFinalObj.setUTCHours(23, 59, 59, 999);
          tarefasQuery = tarefasQuery.or(`dt_inicio.lte.${dateFinalObj.toISOString()},and(dt_inicio.is.null,created_at.lte.${dateFinalObj.toISOString()})`);
          console.log(`📅👥 Filtrando tarefas dos colaboradores até: ${endDate}`);
        }
        
        const { data: tarefasComColaboradores, error: colaboradoresError } = await tarefasQuery;
        
        if (colaboradoresError) {
          console.error('Erro ao buscar tarefas dos colaboradores:', colaboradoresError);
          return res.status(500).json({ 
            success: false, 
            error: 'Erro ao filtrar por colaboradores' 
          });
        }
        
        if (tarefasComColaboradores && tarefasComColaboradores.length > 0) {
          // Extrair IDs únicos dos clientes (podem estar em UUID)
          const clienteIdsFromColaboradores = [...new Set(tarefasComColaboradores.map(t => t.cliente_id))].filter(id => id);
          
          const periodoMsg = (startDate && endDate) ? ` no período ${startDate} - ${endDate}` : '';
          console.log(`👥 Encontrados ${clienteIdsFromColaboradores.length} clientes únicos com tarefas dos colaboradores${periodoMsg}`);
          
          if (clienteIdsFromColaboradores.length > 0) {
            countQuery = countQuery.in('id', clienteIdsFromColaboradores);
            dataQuery = dataQuery.in('id', clienteIdsFromColaboradores);
          } else {
            // Se não encontrou clientes, retornar vazio
            return res.json({ 
              success: true, 
              data: [],
              count: 0,
              total: 0,
              page,
              limit: finalLimit,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
              filters: { status, startDate, endDate, clienteIds, colaboradorIds }
            });
          }
        } else {
          // Nenhuma tarefa encontrada para esses colaboradores
          const periodoMsg = (startDate && endDate) ? ` no período especificado` : '';
          console.log(`👥 Nenhuma tarefa encontrada para os colaboradores${periodoMsg}`);
          return res.json({ 
            success: true, 
            data: [],
            count: 0,
            total: 0,
            page,
            limit: finalLimit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
            filters: { status, startDate, endDate, clienteIds, colaboradorIds }
          });
        }
      }
    }
    
    // Filtros de data (aplicados no faturamento, não no cliente)
    // As datas serão usadas posteriormente para filtrar o faturamento
    if (startDate && startDate.trim() !== '') {
      console.log('📅 Filtro de data inicial configurado:', startDate);
    }
    
    if (endDate && endDate.trim() !== '') {
      console.log('📅 Filtro de data final configurado:', endDate);
    }
    
    // Filtro de busca por nome
    if (search && search.trim() !== '') {
      console.log('🔍 Aplicando filtro de busca por nome:', search);
      countQuery = countQuery.or(`nome.ilike.%${search}%,nome_amigavel.ilike.%${search}%,nome_fantasia.ilike.%${search}%,razao_social.ilike.%${search}%`);
      dataQuery = dataQuery.or(`nome.ilike.%${search}%,nome_amigavel.ilike.%${search}%,nome_fantasia.ilike.%${search}%,razao_social.ilike.%${search}%`);
    }
    
    // ========================================
    // 🚀 EXECUTAR QUERIES EM PARALELO
    // ========================================
    console.log('🚀 Executando queries em paralelo...');
    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery
    ]);
    
    if (countResult.error) {
      console.error('Erro ao contar clientes:', countResult.error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao contar clientes' 
      });
    }
    
    if (dataResult.error) {
      console.error('Erro ao buscar clientes:', dataResult.error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar clientes' 
      });
    }
    
    const totalClientes = countResult.count || 0;
    const clientes = dataResult.data || [];
    
    console.log(`✅ ${clientes.length} clientes encontrados de ${totalClientes} total`);
    

    
    // ========================================
    // 💰 BUSCAR FATURAMENTO (OTIMIZADO)
    // ========================================
    // Só buscar faturamento se houver clientes
    let clientesComFaturamento = [];
    
    if (clientes.length > 0) {
      // Buscar faturamento em paralelo para todos os clientes
      clientesComFaturamento = await Promise.all(clientes.map(async (cliente) => {
        try {
          if (!cliente.id_cli_kamino) {
            return { ...cliente, faturamento_registros: [], faturamento_total_registros: 0 };
          }
          
          // Cache individual por cliente
          const clienteCacheKey = `faturamento_${cliente.id_cli_kamino}_${startDate || ''}_${endDate || ''}`;
          const cachedFaturamento = getCachedData(clienteCacheKey);
          
          if (cachedFaturamento) {
            return { ...cliente, ...cachedFaturamento };
          }
          
          // Buscar faturamento do banco
          let faturamentoQuery = supabase
            .schema('up_gestaointeligente')
            .from('faturamento')
            .select('valor_bruto, data_solicitacao')
            .eq('id_pessoa', cliente.id_cli_kamino);
          
          if (startDate && startDate.trim() !== '') {
            faturamentoQuery = faturamentoQuery.gte('data_solicitacao', startDate);
          }
          
          if (endDate && endDate.trim() !== '') {
            const endDateTime = new Date(endDate);
            endDateTime.setUTCHours(23, 59, 59, 999);
            faturamentoQuery = faturamentoQuery.lte('data_solicitacao', endDateTime.toISOString());
          }
          
          const { data: faturamentoData, error: faturamentoError } = await faturamentoQuery;
          
          if (faturamentoError) {
            console.error(`❌ Erro ao buscar faturamento para cliente ${cliente.razao_social}:`, faturamentoError);
            return { ...cliente, faturamento_registros: [], faturamento_total_registros: 0 };
          }
          
          // Processar registros de faturamento
          const registros = (faturamentoData || []).map(item => ({
              valor_bruto: parseFloat(item.valor_bruto) || 0,
              data_solicitacao: item.data_solicitacao,
              mes_ano: (() => {
                const dataObj = new Date(item.data_solicitacao);
                return `${dataObj.getFullYear()}-${String(dataObj.getMonth() + 1).padStart(2, '0')}`;
              })()
            }));
          
          const faturamentoInfo = {
            faturamento_registros: registros,
            faturamento_total_registros: registros.length
          };
          
          // Cachear faturamento individual
          setCachedData(clienteCacheKey, faturamentoInfo, 300); // 5 minutos
          
          return { ...cliente, ...faturamentoInfo };
          
      } catch (error) {
        console.error(`❌ Erro ao processar faturamento para cliente ${cliente.razao_social}:`, error);
        return { ...cliente, faturamento_registros: [], faturamento_total_registros: 0 };
      }
    }));
    
      console.log('✅ Faturamento processado para todos os clientes');
    }
    
    // ========================================
    // 📊 PREPARAR RESPOSTA
    // ========================================
    const totalPages = Math.ceil(totalClientes / finalLimit);
    
    const response = {
      success: true, 
      data: clientesComFaturamento,
      count: clientes.length,
      total: totalClientes,
      page,
      limit: finalLimit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      filters: { status, startDate, endDate, clienteIds, colaboradorIds, search }
    };
    
    // ========================================
    // 💾 SALVAR NO CACHE
    // ========================================
    setCachedData(cacheKey, response, 300); // Cache de 5 minutos
    
    console.log(`✅ Resposta enviada: ${clientes.length} clientes (página ${page}/${totalPages})`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Erro ao buscar clientes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// Endpoint para editar cliente
app.put('/api/clientes/:id', requireAuth, async (req, res) => {
  try {
    console.log('=== INÍCIO PUT /api/clientes/:id ===');
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('ID recebido:', id);
    console.log('Dados para atualização:', JSON.stringify(updateData, null, 2));
    
    if (!id) {
      console.log('Erro: ID não fornecido');
      return res.status(400).json({ 
        success: false, 
        error: 'ID do cliente é obrigatório' 
      });
    }
    
    console.log('Verificando se cliente existe...');
    // Verificar se o cliente existe
    const { data: existingClient, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id')
      .eq('id', id)
      .limit(1);
    
    if (checkError) {
      console.error('Erro ao verificar cliente existente:', checkError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor - verificação' 
      });
    }
    
    console.log('Cliente existente encontrado:', existingClient);
    
    if (!existingClient || existingClient.length === 0) {
      console.log('Cliente não encontrado para ID:', id);
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }
    
    console.log('Iniciando atualização do cliente...');
    // Atualizar o cliente
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update({
        ...updateData,
        dt_alteracao: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor - atualização' 
      });
    }
    
    console.log('Cliente atualizado com sucesso:', data);
    
    res.json({ 
      success: true, 
      message: 'Cliente atualizado com sucesso',
      data: data[0]
    });
  } catch (error) {
    console.error('Erro geral ao atualizar cliente:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor - catch' 
    });
  }
});

// Endpoint para excluir cliente
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID do cliente é obrigatório' 
      });
    }
    
    // Verificar se o cliente existe
    const { data: existingClient, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, razao_social')
      .eq('id', id)
      .limit(1);
    
    if (checkError) {
      console.error('Erro ao verificar cliente existente:', checkError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    if (!existingClient || existingClient.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }
    
    // Excluir o cliente
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Erro ao excluir cliente:', deleteError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    res.json({ 
      success: true, 
      message: `Cliente '${existingClient[0].razao_social}' excluído com sucesso`
    });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para contar clientes inativos
app.get('/api/clientes-inativos-count', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id', { count: 'exact' })
      .eq('status', 'inativo');
    
    if (error) {
      console.error('Erro ao contar clientes inativos:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    res.json({ 
      success: true, 
      count: data.length
    });
  } catch (error) {
    console.error('Erro ao contar clientes inativos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para contar clientes incompletos
app.get('/api/clientes-incompletos-count', requireAuth, async (req, res) => {
  try {
    // Filtrar clientes onde QUALQUER um dos campos especificados está vazio ou null
    // Campos: razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino
    const incompletosFilter = `or(razao_social.is.null,razao_social.eq.,nome_fantasia.is.null,nome_fantasia.eq.,nome_amigavel.is.null,nome_amigavel.eq.,cpf_cnpj.is.null,cpf_cnpj.eq.,status.is.null,status.eq.,nome_cli_kamino.is.null,nome_cli_kamino.eq.)`;
    
    const { data, error, count } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id', { count: 'exact', head: true })
      .or(incompletosFilter);
    
    if (error) {
      console.error('Erro ao contar clientes incompletos:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    console.log('📋 Total de clientes incompletos:', count);
    
    res.json({ 
      success: true, 
      count: count || 0
    });
  } catch (error) {
    console.error('Erro ao contar clientes incompletos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para inativar cliente
app.put('/api/clientes/:id/inativar', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Inativando cliente com ID:', id);
    
    // Verificar se o cliente existe
    const { data: clienteExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, status, nome')
      .eq('id', id)
      .single();
    
    if (checkError) {
      console.error('Erro ao verificar cliente:', checkError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    if (!clienteExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }
    
    // Verificar se o cliente já está inativo
    if (clienteExistente.status === 'inativo') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cliente já está inativo' 
      });
    }
    
    // Atualizar status para inativo
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update({ 
        status: 'inativo',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Erro ao inativar cliente:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    // Limpar cache relacionado
    clearCache('clientes');
    
    console.log('Cliente inativado com sucesso:', clienteExistente.nome);
    
    res.json({ 
      success: true, 
      message: 'Cliente inativado com sucesso',
      data: data[0]
    });
  } catch (error) {
    console.error('Erro ao inativar cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para ativar cliente
app.put('/api/clientes/:id/ativar', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Ativando cliente com ID:', id);
    
    // Verificar se o cliente existe
    const { data: clienteExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, status, nome')
      .eq('id', id)
      .single();
    
    if (checkError) {
      console.error('Erro ao verificar cliente:', checkError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    if (!clienteExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }
    
    // Verificar se o cliente já está ativo
    if (clienteExistente.status === 'ativo') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cliente já está ativo' 
      });
    }
    
    // Atualizar status para ativo
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update({ 
        status: 'ativo',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Erro ao ativar cliente:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    // Limpar cache relacionado
    clearCache('clientes');
    
    console.log('Cliente ativado com sucesso:', clienteExistente.nome);
    
    res.json({ 
      success: true, 
      message: 'Cliente ativado com sucesso',
      data: data[0]
    });
  } catch (error) {
    console.error('Erro ao ativar cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para cadastrar cliente simples
app.post('/api/cliente-simples', async (req, res) => {
  try {
    console.log('=== INÍCIO DO POST ===');
    console.log('req.body completo:', JSON.stringify(req.body, null, 2));
    
    const { 
      razaoSocial, 
      nomeFantasia, 
      nomeAmigavel, 
      grupo, 
      clienteKamino,
      clienteClickup,
      idKamino, // Novo campo com o ID do cliente Kamino
      idClickup, // Novo campo com o ID do cliente ClickUp
      teste: cnpjCpf,  // Campo 'teste' do frontend corresponde ao cnpj_cpf
      testeDois: status, // Campo 'testeDois' do frontend corresponde ao status
      segmento,
      subsegmento
    } = req.body;

    console.log('Dados extraídos:', {
      razaoSocial, 
      nomeFantasia, 
      nomeAmigavel, 
      grupo, 
      clienteKamino,
      clienteClickup,
      idKamino,
      idClickup,
      cnpjCpf,
      status,
      segmento,
      subsegmento
    });
    
    console.log('Tipos dos dados:');
    console.log('clienteKamino tipo:', typeof clienteKamino, 'valor:', clienteKamino);
    console.log('clienteClickup tipo:', typeof clienteClickup, 'valor:', clienteClickup);
    console.log('idKamino tipo:', typeof idKamino, 'valor:', idKamino);
    console.log('idClickup tipo:', typeof idClickup, 'valor:', idClickup);

    console.log('cnpjCpf (teste) tipo:', typeof cnpjCpf, 'valor:', cnpjCpf);
    console.log('status (testeDois) tipo:', typeof status, 'valor:', status);
    console.log('segmento tipo:', typeof segmento, 'valor:', segmento);
    console.log('subsegmento tipo:', typeof subsegmento, 'valor:', subsegmento);

    // Usar a função RPC insert_cliente_simples atualizada
    // A função está no schema public, então precisamos criar um cliente sem schema específico
    const supabasePublic = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabasePublic
      .rpc('insert_cliente_simples', {
        p_razao_social: razaoSocial,
        p_nome_fantasia: nomeFantasia,
        p_nome_amigavel: nomeAmigavel,
        p_grupo: grupo,

        p_cli_kamino: clienteKamino,
        p_cli_clickup: clienteClickup,
        p_cnpj_cpf: cnpjCpf,
        p_status: status,
        p_segmento: segmento,
        p_subsegmento: subsegmento,
        p_id_kamino: idKamino, // Novo parâmetro com o ID do cliente Kamino
        p_id_clickup: idClickup // Novo parâmetro com o ID do cliente ClickUp
      });

    if (error) {
      console.error('Erro ao inserir cliente via RPC:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }

    console.log('Resultado da função RPC:', data);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Endpoint para buscar clientes ativos
app.get('/api/clientes-ativos', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, razao_social, nome_fantasia, nome_amigavel, cnpj_cpf, segmento, subsegmento, grupo, cli_kamino, cli_clickup, status')
      .eq('status', 'ativo')
      .order('razao_social');
    
    if (error) {
      console.error('Erro ao buscar clientes ativos:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    res.json({ 
      success: true, 
      data: data || [],
      count: data ? data.length : 0
    });
  } catch (error) {
    console.error('Erro ao buscar clientes ativos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para atualizar cliente na tabela cp_cliente baseado no nome ClickUp
app.put('/api/update-cliente-cp', async (req, res) => {
  try {
    console.log('=== INÍCIO PUT /api/update-cliente-cp ===');
    const { 
      clienteClickupNome, 
      nomeFantasia, 
      razaoSocial, 
      nomeAmigavel, 
      cpfCnpj, 
      status,
      grupo,
      segmento,
      subsegmento,
      nomeCliKamino,
      idCliKamino
    } = req.body;
    
    console.log('Dados recebidos:', { 
      clienteClickupNome, 
      nomeFantasia, 
      razaoSocial, 
      nomeAmigavel, 
      cpfCnpj, 
      status,
      grupo,
      segmento,
      subsegmento,
      nomeCliKamino,
      idCliKamino
    });
    
    if (!clienteClickupNome || !clienteClickupNome.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome do cliente ClickUp é obrigatório' 
      });
    }
    
    console.log('Verificando se cliente ClickUp existe na tabela cp_cliente...');
    // Verificar se o cliente ClickUp existe na tabela cp_cliente
    const { data: existingClient, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome, nome_fantasia')
      .eq('nome', clienteClickupNome.trim())
      .limit(1);
    
    if (checkError) {
      console.error('Erro ao verificar cliente ClickUp existente:', checkError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor - verificação' 
      });
    }
    
    console.log('Cliente ClickUp encontrado:', existingClient);
    
    if (!existingClient || existingClient.length === 0) {
      console.log('Cliente ClickUp não encontrado para nome:', clienteClickupNome);
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente ClickUp não encontrado na tabela cp_cliente' 
      });
    }
    
    console.log('Atualizando dados do cliente ClickUp...');
    
    // Preparar objeto de atualização apenas com campos preenchidos
    const updateData = {};
    
    if (nomeFantasia && nomeFantasia.trim()) {
      updateData.nome_fantasia = nomeFantasia.trim();
    }
    
    if (razaoSocial && razaoSocial.trim()) {
      updateData.razao_social = razaoSocial.trim();
    }
    
    if (nomeAmigavel && nomeAmigavel.trim()) {
      updateData.nome_amigavel = nomeAmigavel.trim();
    }
    
    if (cpfCnpj && cpfCnpj.trim()) {
      updateData.cpf_cnpj = cpfCnpj.trim();
    }
    
    if (status && status.trim()) {
      updateData.status = status.trim();
    }
    
    if (grupo && grupo.trim()) {
      updateData.grupo = grupo.trim();
    }
    
    if (segmento && segmento.trim()) {
      updateData.segmento = segmento.trim();
    }
    
    if (subsegmento && subsegmento.trim()) {
      updateData.subsegmento = subsegmento.trim();
    }
    
    if (nomeCliKamino && nomeCliKamino.trim()) {
      updateData.nome_cli_kamino = nomeCliKamino.trim();
    }
    
    if (idCliKamino) {
      updateData.id_cli_kamino = idCliKamino;
    }
    
    console.log('Dados para atualização:', updateData);
    
    // Verificar se há pelo menos um campo para atualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Pelo menos um campo deve ser preenchido para atualização' 
      });
    }
    
    // Atualizar os dados do cliente ClickUp
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update(updateData)
      .eq('nome', clienteClickupNome.trim())
      .select();
    
    if (error) {
      console.error('Erro ao atualizar cliente ClickUp:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor - atualização',
        details: error.message 
      });
    }
    
    console.log('Cliente ClickUp atualizado com sucesso:', data);
    
    const camposAtualizados = Object.keys(updateData).join(', ');
    
    res.json({ 
      success: true, 
      message: `Campos atualizados com sucesso para o cliente '${clienteClickupNome}': ${camposAtualizados}`,
      data: data[0],
      updatedFields: updateData
    });
  } catch (error) {
    console.error('Erro ao atualizar cliente ClickUp:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Endpoint para inserir/atualizar dados específicos de um cliente ClickUp
app.put('/api/cliente-dados/:nomeClienteClickup', async (req, res) => {
  try {
    const { nomeClienteClickup } = req.params;
    const { razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, clienteKamino, idCliKamino } = req.body;
    
    console.log('=== DEBUG INSERIR/ATUALIZAR CLIENTE DADOS ===');
    console.log('Nome do cliente ClickUp:', nomeClienteClickup);
    console.log('Dados para inserção/atualização:', { razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, clienteKamino, idCliKamino });
    console.log('🔥 === LOGS DETALHADOS ID KAMINO ===');
    console.log('🔥 clienteKamino recebido:', clienteKamino);
    console.log('🔥 idCliKamino recebido:', idCliKamino);
    console.log('🔥 Tipo do idCliKamino:', typeof idCliKamino);
    console.log('🔥 idCliKamino é null?', idCliKamino === null);
    console.log('🔥 idCliKamino é undefined?', idCliKamino === undefined);
    console.log('🔥 idCliKamino é string vazia?', idCliKamino === '');
    console.log('🔥 Valor convertido para string:', String(idCliKamino));
    
    if (!nomeClienteClickup) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome do cliente ClickUp é obrigatório' 
      });
    }
    
    // Verificar se pelo menos um campo foi fornecido
    if (!razao_social && !nome_fantasia && !nome_amigavel && !cpf_cnpj && !status && !clienteKamino && !idCliKamino) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pelo menos um campo deve ser fornecido para atualização' 
      });
    }
    
    // Verificar se o cliente existe
    const { data: existingClient, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome')
      .eq('nome', nomeClienteClickup)
      .limit(1);
    
    if (checkError) {
      console.error('Erro ao verificar cliente existente:', checkError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor - verificação',
        details: checkError.message
      });
    }
    
    let result;
    
    if (!existingClient || existingClient.length === 0) {
      // Cliente não existe, criar novo
      console.log('Cliente não encontrado, criando novo registro:', nomeClienteClickup);
      
      const insertData = {
        nome: nomeClienteClickup,
        razao_social: razao_social || null,
        nome_fantasia: nome_fantasia || null,
        nome_amigavel: nome_amigavel || null,
        cpf_cnpj: cpf_cnpj || null,
        status: status || null,
        nome_cli_kamino: clienteKamino || null,
        id_cli_kamino: idCliKamino || null
      };
      
      console.log('🔥 === DADOS PARA INSERÇÃO ===');
      console.log('🔥 insertData completo:', insertData);
      console.log('🔥 insertData.id_cli_kamino:', insertData.id_cli_kamino);
      console.log('🔥 insertData.nome_cli_kamino:', insertData.nome_cli_kamino);
      
      const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_cliente')
        .insert(insertData)
        .select('id, nome, razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino, id_cli_kamino');
      
      if (error) {
        console.error('Erro ao inserir novo cliente:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor - inserção',
          details: error.message
        });
      }
      
      result = data[0];
      console.log('Novo cliente criado com sucesso:', result);
      console.log('🔥 === RESULTADO DA INSERÇÃO ===');
      console.log('🔥 result.id_cli_kamino salvo:', result.id_cli_kamino);
      console.log('🔥 result.nome_cli_kamino salvo:', result.nome_cli_kamino);
      
    } else {
      // Cliente existe, atualizar dados
      console.log('Cliente encontrado, atualizando dados:', nomeClienteClickup);
      
      const updateData = {};
      if (razao_social !== undefined) updateData.razao_social = razao_social;
      if (nome_fantasia !== undefined) updateData.nome_fantasia = nome_fantasia;
      if (nome_amigavel !== undefined) updateData.nome_amigavel = nome_amigavel;
      if (cpf_cnpj !== undefined) updateData.cpf_cnpj = cpf_cnpj;
      if (status !== undefined) updateData.status = status;
      if (clienteKamino !== undefined) updateData.nome_cli_kamino = clienteKamino;
      if (idCliKamino !== undefined) updateData.id_cli_kamino = idCliKamino;
      
      console.log('Dados finais para atualização:', updateData);
      console.log('🔥 === DADOS PARA ATUALIZAÇÃO ===');
      console.log('🔥 updateData completo:', updateData);
      console.log('🔥 updateData.id_cli_kamino:', updateData.id_cli_kamino);
      console.log('🔥 updateData.nome_cli_kamino:', updateData.nome_cli_kamino);
      console.log('🔥 idCliKamino !== undefined?', idCliKamino !== undefined);
      console.log('🔥 clienteKamino !== undefined?', clienteKamino !== undefined);
      
      const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_cliente')
        .update(updateData)
        .eq('nome', nomeClienteClickup)
        .select('id, nome, razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino, id_cli_kamino');
      
      if (error) {
        console.error('Erro ao atualizar dados do cliente ClickUp:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Erro interno do servidor - atualização',
          details: error.message
        });
      }
      
      result = data[0];
      console.log('Cliente atualizado com sucesso:', result);
      console.log('🔥 === RESULTADO DA ATUALIZAÇÃO ===');
      console.log('🔥 result.id_cli_kamino salvo:', result.id_cli_kamino);
      console.log('🔥 result.nome_cli_kamino salvo:', result.nome_cli_kamino);
    }
    
    res.json({ 
      success: true, 
      message: 'Dados do cliente processados com sucesso',
      data: result
    });
    
  } catch (error) {
    console.error('Erro ao processar dados do cliente ClickUp:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});


app.get('/api/cliente-clickup/:nome', requireAuth, async (req, res) => {
  try {
    console.log('=== INÍCIO GET /api/cliente-clickup/:nome ===');
    const { nome } = req.params;
    
    console.log('Nome do cliente ClickUp solicitado:', nome);
    
    if (!nome || !nome.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome do cliente ClickUp é obrigatório' 
      });
    }
    
    console.log('Buscando dados do cliente ClickUp na tabela cp_cliente...');
    
    // Buscar os dados do cliente ClickUp na tabela cp_cliente
    const { data: clienteData, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('*')
      .eq('nome', nome.trim())
      .limit(1);
    
    if (error) {
      console.error('Erro ao buscar cliente ClickUp:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
    
    console.log('Dados do cliente ClickUp encontrados:', clienteData);
    
    if (!clienteData || clienteData.length === 0) {
      console.log('Cliente ClickUp não encontrado para nome:', nome);
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente ClickUp não encontrado' 
      });
    }
    
    res.json({ 
      success: true, 
      data: clienteData[0]
    });
  } catch (error) {
    console.error('Erro ao buscar cliente ClickUp:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Endpoint para buscar todos os contratos completos de um cliente
app.get('/api/contratos-cliente/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('🔍 [CONTRATOS-CLIENTE] Iniciando busca para cliente:', nomeClienteClickup);
        console.log('🔍 [CONTRATOS-CLIENTE] Parâmetros recebidos:', req.params);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        console.log('🔍 [CONTRATOS-CLIENTE] Resultado da busca do cliente:', { clienteData, clienteError });
        
        if (clienteError) {
            console.error('❌ [CONTRATOS-CLIENTE] Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            console.log('❌ [CONTRATOS-CLIENTE] Cliente não encontrado');
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('✅ [CONTRATOS-CLIENTE] ID do cliente encontrado:', clienteId);
        
        // Buscar todos os contratos do cliente com todos os campos necessários
        console.log('🔍 [CONTRATOS-CLIENTE] Iniciando busca de contratos para clienteId:', clienteId);
        
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('id_contrato, nome_contrato, id_grupo_cliente, id_segmento, id_subseguimento, periodo, dt_inicio, ultima_renovacao, proxima_renovacao, status, cpf_cnpj, url_atividade')
            .eq('id_cliente', clienteId);
        
        console.log('🔍 [CONTRATOS-CLIENTE] Resultado da busca de contratos:', { contratos, contratosError });
        console.log('🔍 [CONTRATOS-CLIENTE] Dados brutos dos contratos:', JSON.stringify(contratos, null, 2));
        
        if (contratosError) {
            console.error('❌ [CONTRATOS-CLIENTE] Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            console.log('ℹ️ [CONTRATOS-CLIENTE] Cliente encontrado, mas sem contratos - retornando array vazio');
            return res.json({ success: true, data: [], message: 'Cliente encontrado, mas sem contratos cadastrados' });
        }
        
        // Buscar dados relacionados (grupos, segmentos, subsegmentos, períodos)
        const grupoIds = [...new Set(contratos.map(c => c.id_grupo_cliente).filter(id => id))];
        const segmentoIds = [...new Set(contratos.map(c => c.id_segmento).filter(id => id))];
        const subsegmentoIds = [...new Set(contratos.map(c => c.id_subseguimento).filter(id => id))];
        const periodoIds = [...new Set(contratos.map(c => c.periodo).filter(id => id))];
        
        // Buscar grupos
        let grupos = [];
        if (grupoIds.length > 0) {
            const { data: gruposData } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_grupo')
                .select('id, nome')
                .in('id', grupoIds);
            grupos = gruposData || [];
        }
        
        // Buscar segmentos
        let segmentos = [];
        if (segmentoIds.length > 0) {
            const { data: segmentosData } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_segmento')
                .select('id, nome')
                .in('id', segmentoIds);
            segmentos = segmentosData || [];
        }
        
        // Buscar subsegmentos
        let subsegmentos = [];
        if (subsegmentoIds.length > 0) {
            const { data: subsegmentosData } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_subsegmento')
                .select('id, nome')
                .in('id', subsegmentoIds);
            subsegmentos = subsegmentosData || [];
        }
        
        // Buscar períodos
        let periodos = [];
        if (periodoIds.length > 0) {
            const { data: periodosData } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_periodo')
                .select('id, nome')
                .in('id', periodoIds);
            periodos = periodosData || [];
        }
        
        // Função para formatar timestamp para dd/mm/aaaa
        const formatarData = (timestamp) => {
            if (!timestamp) return null;
            const date = new Date(parseInt(timestamp));
            if (isNaN(date.getTime())) return null;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        };
        
        // Mapear contratos com dados completos
        const contratosCompletos = contratos.map((contrato, index) => {
            const grupo = grupos.find(g => g.id === contrato.id_grupo_cliente);
            const segmento = segmentos.find(s => s.id === contrato.id_segmento);
            const subsegmento = subsegmentos.find(ss => ss.id === contrato.id_subseguimento);
            const periodo = periodos.find(p => p.id === contrato.periodo);
            
            console.log(`Processando contrato ${index + 1}:`, {
                id_contrato: contrato.id_contrato,
                nome_contrato: contrato.nome_contrato,
                grupo_nome: grupo ? grupo.nome : 'N/A',
                url_atividade_raw: contrato.url_atividade,
                url_atividade_type: typeof contrato.url_atividade
            });
            
            return {
                id: contrato.id_contrato,
                nome_contrato: contrato.nome_contrato, // Usar apenas o nome real do banco, sem fallback
                numero: index + 1, // Numeração sequencial
                grupo: grupo ? grupo.nome : 'N/A',
                segmento: segmento ? segmento.nome : 'N/A',
                subsegmento: subsegmento ? subsegmento.nome : 'N/A',
                periodo: periodo ? periodo.nome : 'N/A',
                data_inicio: formatarData(contrato.dt_inicio),
                data_encerramento: formatarData(contrato.ultima_renovacao),
                proxima_renovacao: formatarData(contrato.proxima_renovacao),
                status: contrato.status || 'N/A',
                cpf_cnpj: contrato.cpf_cnpj || 'N/A',
                url_atividade: contrato.url_atividade || ''
            };
        });
        
        console.log('Contratos completos encontrados:', contratosCompletos.length);
        console.log('🔍 [DEBUG] Dados finais sendo enviados:', JSON.stringify(contratosCompletos, null, 2));
        res.json({ success: true, data: contratosCompletos });
        
    } catch (error) {
        console.error('❌ [CONTRATOS-CLIENTE] ERRO CRÍTICO no endpoint:', error);
        console.error('❌ [CONTRATOS-CLIENTE] Stack trace:', error.stack);
        console.error('❌ [CONTRATOS-CLIENTE] Mensagem:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar contratos por cliente ClickUp (mantido para compatibilidade)
app.get('/api/contratos/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('Buscando contratos para cliente ClickUp:', nomeClienteClickup);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar contratos do cliente na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('id_grupo_cliente')
            .eq('id_cliente', clienteId);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente' });
        }
        
        // Buscar nomes dos grupos na tabela cp_grupo
        const grupoIds = contratos.map(c => c.id_grupo_cliente).filter(id => id);
        
        if (grupoIds.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum grupo encontrado nos contratos' });
        }
        
        const { data: grupos, error: gruposError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_grupo')
            .select('id, nome')
            .in('id', grupoIds);
        
        if (gruposError) {
            console.error('Erro ao buscar grupos:', gruposError);
            return res.status(500).json({ success: false, error: gruposError.message });
        }
        
        // Mapear grupos com nomes
        const gruposComNomes = grupos.map(grupo => ({
            id_grupo: grupo.id,
            nome_grupo: grupo.nome
        }));
        
        console.log('Grupos encontrados:', gruposComNomes);
        res.json({ success: true, data: gruposComNomes });
        
    } catch (error) {
        console.error('Erro no endpoint de contratos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar segmentos por cliente ClickUp
app.get('/api/segmentos-cliente/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('Buscando segmentos para cliente ClickUp:', nomeClienteClickup);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar contratos do cliente na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('id_segmento')
            .eq('id_cliente', clienteId);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente' });
        }
        
        // Buscar nomes dos segmentos na tabela cp_segmento
        const segmentoIds = contratos.map(c => c.id_segmento).filter(id => id);
        
        if (segmentoIds.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum segmento encontrado nos contratos' });
        }
        
        const { data: segmentos, error: segmentosError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_segmento')
            .select('id, nome')
            .in('id', segmentoIds);
        
        if (segmentosError) {
            console.error('Erro ao buscar segmentos:', segmentosError);
            return res.status(500).json({ success: false, error: segmentosError.message });
        }
        
        // Mapear segmentos com nomes
        const segmentosComNomes = segmentos.map(segmento => ({
            id_segmento: segmento.id,
            nome_segmento: segmento.nome
        }));
        
        console.log('Segmentos encontrados:', segmentosComNomes);
        res.json({ success: true, data: segmentosComNomes });
        
    } catch (error) {
        console.error('Erro no endpoint de segmentos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar subsegmentos por cliente ClickUp
app.get('/api/subsegmentos-cliente/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('Buscando subsegmentos para cliente ClickUp:', nomeClienteClickup);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar contratos do cliente na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('id_subseguimento')
            .eq('id_cliente', clienteId);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente' });
        }
        
        // Buscar nomes dos subsegmentos na tabela cp_subsegmento
        const subsegmentoIds = contratos.map(c => c.id_subseguimento).filter(id => id);
        
        if (subsegmentoIds.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum subsegmento encontrado nos contratos' });
        }
        
        const { data: subsegmentos, error: subsegmentosError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_subsegmento')
            .select('id, nome')
            .in('id', subsegmentoIds);
        
        if (subsegmentosError) {
            console.error('Erro ao buscar subsegmentos:', subsegmentosError);
            return res.status(500).json({ success: false, error: subsegmentosError.message });
        }
        
        // Mapear subsegmentos com nomes
        const subsegmentosComNomes = subsegmentos.map(subsegmento => ({
            id_subsegmento: subsegmento.id,
            nome_subsegmento: subsegmento.nome
        }));
        
        console.log('Subsegmentos encontrados:', subsegmentosComNomes);
        res.json({ success: true, data: subsegmentosComNomes });
        
    } catch (error) {
        console.error('Erro no endpoint de subsegmentos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar períodos por cliente ClickUp
app.get('/api/periodos-cliente/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('Buscando períodos para cliente ClickUp:', nomeClienteClickup);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar contratos do cliente na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('periodo')
            .eq('id_cliente', clienteId);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente' });
        }
        
        // Buscar nomes dos períodos na tabela cp_periodo
        const periodoIds = contratos.map(c => c.periodo).filter(id => id);
        
        if (periodoIds.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum período encontrado nos contratos' });
        }
        
        const { data: periodos, error: periodosError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_periodo')
            .select('id, nome')
            .in('id', periodoIds);
        
        if (periodosError) {
            console.error('Erro ao buscar períodos:', periodosError);
            return res.status(500).json({ success: false, error: periodosError.message });
        }
        
        // Mapear períodos com nomes
        const periodosComNomes = periodos.map(periodo => ({
            id_periodo: periodo.id,
            nome_periodo: periodo.nome
        }));
        
        console.log('Períodos encontrados:', periodosComNomes);
        res.json({ success: true, data: periodosComNomes });
        
    } catch (error) {
        console.error('Erro no endpoint de períodos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar data de início por cliente ClickUp
app.get('/api/data-inicio-cliente/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('Buscando data de início para cliente ClickUp:', nomeClienteClickup);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar contratos do cliente na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('dt_inicio')
            .eq('id_cliente', clienteId);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente' });
        }
        
        // Filtrar e formatar datas de início
        console.log('🔍 CONTRATOS ENCONTRADOS:', contratos.length);
        console.log('🔍 DADOS BRUTOS DOS CONTRATOS:', JSON.stringify(contratos, null, 2));
        
        const datasInicio = contratos
            .map(c => {
                console.log('🔍 PROCESSANDO CONTRATO - dt_inicio original:', c.dt_inicio, 'tipo:', typeof c.dt_inicio);
                return c.dt_inicio;
            })
            .filter(dt => {
                const isValid = dt !== null && dt !== undefined;
                console.log('🔍 TIMESTAMP VÁLIDO?', dt, '→', isValid);
                return isValid;
            })
            .map(timestamp => {
                console.log('🔍 CONVERTENDO TIMESTAMP:', timestamp, 'tipo:', typeof timestamp);
                // Converter timestamp para data formatada dd/mm/aaaa
                const date = new Date(parseInt(timestamp));
                console.log('🔍 DATA CRIADA:', date, 'válida?', !isNaN(date.getTime()));
                
                if (isNaN(date.getTime())) {
                    console.log('🔍 DATA INVÁLIDA - retornando null');
                    return null; // Data inválida
                }
                
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                const dataFormatada = `${day}/${month}/${year}`;
                
                console.log('🔍 DATA FORMATADA:', dataFormatada);
                return dataFormatada;
            })
            .filter(data => {
                const isValid = data !== null;
                console.log('🔍 DATA FINAL VÁLIDA?', data, '→', isValid);
                return isValid;
            });
        
        if (datasInicio.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhuma data de início encontrada nos contratos' });
        }
        
        // Remover duplicatas
        const datasUnicas = [...new Set(datasInicio)];
        
        // Mapear para o formato esperado
        const datasFormatadas = datasUnicas.map(data => ({
            data_inicio: data
        }));
        
        console.log('Datas de início encontradas:', datasFormatadas);
        res.json({ success: true, data: datasFormatadas });
        
    } catch (error) {
        console.error('Erro no endpoint de data de início:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar data de encerramento por cliente ClickUp
app.get('/api/data-encerramento-cliente/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('Buscando data de encerramento para cliente ClickUp:', nomeClienteClickup);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar contratos do cliente na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('ultima_renovacao')
            .eq('id_cliente', clienteId);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente' });
        }
        
        // Filtrar e formatar datas de encerramento
        const datasEncerramento = contratos
            .map(c => c.ultima_renovacao)
            .filter(dt => dt) // Remove valores null/undefined
            .map(timestamp => {
                // Converter timestamp para data formatada dd/mm/aaaa
                const date = new Date(parseInt(timestamp));
                if (isNaN(date.getTime())) {
                    return null; // Data inválida
                }
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            })
            .filter(data => data); // Remove datas inválidas
        
        if (datasEncerramento.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhuma data de encerramento encontrada nos contratos' });
        }
        
        // Remover duplicatas
        const datasUnicas = [...new Set(datasEncerramento)];
        
        // Mapear para o formato esperado
        const datasFormatadas = datasUnicas.map(data => ({
            data_encerramento: data
        }));
        
        console.log('Datas de encerramento encontradas:', datasFormatadas);
        res.json({ success: true, data: datasFormatadas });
        
    } catch (error) {
        console.error('Erro no endpoint de data de encerramento:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar próxima renovação por cliente ClickUp
app.get('/api/proxima-renovacao-cliente/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('Buscando próxima renovação para cliente ClickUp:', nomeClienteClickup);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar contratos do cliente na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('proxima_renovacao')
            .eq('id_cliente', clienteId);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente' });
        }
        
        // Filtrar e formatar datas de próxima renovação
        const datasProximaRenovacao = contratos
            .map(c => c.proxima_renovacao)
            .filter(dt => dt) // Remove valores null/undefined
            .map(timestamp => {
                // Converter timestamp para data formatada dd/mm/aaaa
                const date = new Date(parseInt(timestamp));
                if (isNaN(date.getTime())) {
                    return null; // Data inválida
                }
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            })
            .filter(data => data); // Remove datas inválidas
        
        if (datasProximaRenovacao.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhuma data de próxima renovação encontrada nos contratos' });
        }
        
        // Remover duplicatas
        const datasUnicas = [...new Set(datasProximaRenovacao)];
        
        // Mapear para o formato esperado
        const datasFormatadas = datasUnicas.map(data => ({
            proxima_renovacao: data
        }));
        
        console.log('Datas de próxima renovação encontradas:', datasFormatadas);
        res.json({ success: true, data: datasFormatadas });
        
    } catch (error) {
        console.error('Erro no endpoint de próxima renovação:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar razão social por cliente ClickUp
app.get('/api/razao-social-cliente/:nomeClienteClickup/:idContrato', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup, idContrato } = req.params;
        console.log('Buscando razão social para cliente ClickUp:', nomeClienteClickup, 'contrato:', idContrato);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar razão social específica do contrato na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('razao_social')
            .eq('id_cliente', clienteId)
            .eq('id_contrato', idContrato);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente e ID' });
        }
        
        // Pegar a razão social do contrato específico
        const razaoSocial = contratos[0].razao_social;
        
        if (!razaoSocial || razaoSocial.trim() === '') {
            return res.status(404).json({ success: false, message: 'Razão social vazia para este contrato' });
        }
        
        console.log('Razão social encontrada:', razaoSocial);
        res.json({ success: true, data: razaoSocial });
        
    } catch (error) {
        console.error('Erro no endpoint de razão social:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar nome fantasia por cliente ClickUp e contrato específico
app.get('/api/nome-fantasia-cliente/:nomeClienteClickup/:idContrato', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup, idContrato } = req.params;
        console.log('Buscando nome fantasia para cliente ClickUp:', nomeClienteClickup, 'contrato:', idContrato);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar nome fantasia específico do contrato na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('nome_fantasia')
            .eq('id_cliente', clienteId)
            .eq('id_contrato', idContrato);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente e ID' });
        }
        
        // Pegar o nome fantasia do contrato específico
        const nomeFantasia = contratos[0].nome_fantasia;
        
        if (!nomeFantasia || nomeFantasia.trim() === '') {
            return res.status(404).json({ success: false, message: 'Nome fantasia vazio para este contrato' });
        }
        
        console.log('Nome fantasia encontrado:', nomeFantasia);
        res.json({ success: true, data: nomeFantasia });
        
    } catch (error) {
        console.error('Erro no endpoint de nome fantasia:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar dados do cliente para preenchimento automático dos campos do contrato
app.get('/api/dados-cliente-contrato/:nomeClienteClickup', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup } = req.params;
        console.log('Buscando dados do cliente ClickUp para preenchimento automático:', nomeClienteClickup);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar dados do cliente na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino')
            .eq('id_cliente', clienteId)
            .limit(1);
        
        if (contratosError) {
            console.error('Erro ao buscar dados do contrato:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Dados do cliente não encontrados na tabela de contratos' });
        }
        
        const dadosCliente = contratos[0];
        console.log('Dados do cliente encontrados:', dadosCliente);
        
        res.json({ 
            success: true, 
            data: {
                razaoSocial: dadosCliente.razao_social || '',
                nomeFantasia: dadosCliente.nome_fantasia || '',
                nomeAmigavel: dadosCliente.nome_amigavel || '',
                cpfCnpj: dadosCliente.cpf_cnpj || '',
                status: dadosCliente.status || '',
                clienteKamino: dadosCliente.nome_cli_kamino || ''
            }
        });
        
    } catch (error) {
        console.error('Erro no endpoint de dados do cliente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar nome amigável por cliente ClickUp e contrato específico
app.get('/api/nome-amigavel-cliente/:nomeClienteClickup/:idContrato', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup, idContrato } = req.params;
        console.log('Buscando nome amigável para cliente ClickUp:', nomeClienteClickup, 'contrato:', idContrato);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar nome amigável específico do contrato na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('nome_amigavel')
            .eq('id_cliente', clienteId)
            .eq('id_contrato', idContrato);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente e ID' });
        }
        
        // Pegar o nome amigável do contrato específico
        const nomeAmigavel = contratos[0].nome_amigavel;
        
        if (!nomeAmigavel || nomeAmigavel.trim() === '') {
            return res.status(404).json({ success: false, message: 'Nome amigável vazio para este contrato' });
        }
        
        console.log('Nome amigável encontrado:', nomeAmigavel);
        res.json({ success: true, data: nomeAmigavel });
        
    } catch (error) {
        console.error('Erro no endpoint de nome amigável:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar CPF/CNPJ por cliente ClickUp e contrato específico
app.get('/api/cpf-cnpj-cliente/:nomeClienteClickup/:idContrato', requireAuth, async (req, res) => {
    try {
        const { nomeClienteClickup, idContrato } = req.params;
        console.log('Buscando CPF/CNPJ para cliente ClickUp:', nomeClienteClickup, 'contrato:', idContrato);
        
        // Primeiro, buscar o ID do cliente na tabela cp_cliente pelo nome ClickUp
        const { data: clienteData, error: clienteError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id')
            .eq('nome', nomeClienteClickup.trim())
            .limit(1);
        
        if (clienteError) {
            console.error('Erro ao buscar cliente:', clienteError);
            return res.status(500).json({ success: false, error: clienteError.message });
        }
        
        if (!clienteData || clienteData.length === 0) {
            return res.status(404).json({ success: false, message: 'Cliente ClickUp não encontrado' });
        }
        
        const clienteId = clienteData[0].id;
        console.log('ID do cliente encontrado:', clienteId);
        
        // Buscar CPF/CNPJ específico do contrato na tabela contratos_clientes
        const { data: contratos, error: contratosError } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('cpf_cnpj')
            .eq('id_cliente', clienteId)
            .eq('id_contrato', idContrato);
        
        if (contratosError) {
            console.error('Erro ao buscar contratos:', contratosError);
            return res.status(500).json({ success: false, error: contratosError.message });
        }
        
        if (!contratos || contratos.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum contrato encontrado para este cliente e ID' });
        }
        
        // Pegar o CPF/CNPJ do contrato específico
        const cpfCnpj = contratos[0].cpf_cnpj;
        
        if (!cpfCnpj || cpfCnpj.trim() === '') {
            return res.status(404).json({ success: false, message: 'CPF/CNPJ vazio para este contrato' });
        }
        
        console.log('CPF/CNPJ encontrado:', cpfCnpj);
        res.json({ success: true, data: cpfCnpj });
        
    } catch (error) {
        console.error('Erro no endpoint de CPF/CNPJ:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar status disponíveis da tabela tarefa
app.get('/api/tarefas-status', requireAuth, async (req, res) => {
    try {
        console.log('Buscando status disponíveis da tabela contratos_clientes');
        
        // Buscar status únicos da tabela contratos_clientes
        const { data, error } = await supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('status')
            .not('status', 'is', null);
        
        if (error) {
            console.error('Erro ao buscar status:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Extrair status únicos
        const uniqueStatuses = [...new Set(data.map(item => item.status))].filter(status => status && status.trim() !== '');
        
        console.log('Status encontrados:', uniqueStatuses);
        res.json({ success: true, statuses: uniqueStatuses });
        
    } catch (error) {
        console.error('Erro no endpoint de status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar clientes disponíveis para filtro
app.get('/api/clientes-filtro', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('nome, id')
      .not('nome', 'is', null)
      .order('nome');
    
    if (error) {
      console.error('Erro ao buscar clientes para filtro:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    // Dados completos para filtro (mesma lógica do /api/clientes-clickup)
    const clientesData = data.filter(row => row.nome);
    
    console.log('=== DEBUG CLIENTES FILTRO ===');
    console.log('Total de registros da query:', data.length);
    console.log('Total de clientesData filtrados:', clientesData.length);
    console.log('Primeiros 3 clientesData:', clientesData.slice(0, 3));
    
    const response = { 
      success: true, 
      clientes: clientesData // Mesma estrutura do /api/clientes-clickup
    };
    
    console.log('Resposta do filtro que será enviada:', JSON.stringify(response, null, 2));
    
    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar clientes para filtro:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para contar tarefas por cliente com múltiplos filtros
app.get('/api/tarefas-count/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal, colaboradorIds } = req.query;
        
        console.log('Contando tarefas para cliente ID:', clienteId, 'com filtros:', { 
            status, startDate, endDate, dataInicial, dataFinal, colaboradorIds 
        });
        
        // Primeiro, buscar a contagem
        let countQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', clienteId);
        
        // Segundo, buscar a primeira tarefa com URL para o botão de redirecionamento
        let firstTaskQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('url')
            .eq('cliente_id', clienteId)
            .not('url', 'is', null)
            .neq('url', '')
            .order('created_at', { ascending: false })
            .limit(1);
        
        // Aplicar filtros em ambas as queries
        // Filtro de status (múltiplos valores separados por vírgula)
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                countQuery = countQuery.in('status', statusArray);
                firstTaskQuery = firstTaskQuery.in('status', statusArray);
            }
        }
        
        // Filtro de colaboradores
        if (colaboradorIds) {
            const colaboradorArray = colaboradorIds.split(',').map(id => id.trim()).filter(id => id);
            if (colaboradorArray.length > 0) {
                countQuery = countQuery.in('responsavel_id', colaboradorArray);
                firstTaskQuery = firstTaskQuery.in('responsavel_id', colaboradorArray);
                console.log('👥 Filtro de colaboradores aplicado na contagem de tarefas:', colaboradorArray);
            }
        }
        
        // Filtro de período - suporta tanto startDate/endDate quanto dataInicial/dataFinal
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            // Converter para objetos Date
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            
            // Para a data final, vamos até o final do dia (23:59:59.999)
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            console.log('Aplicando filtro de período:', {
                inicio: dateInicialObj.toISOString(),
                fim: dateFinalObj.toISOString()
            });
            
            // Filtrar tarefas que estão dentro do período:
            // Usar created_at como fallback quando dt_inicio for NULL
            const periodFilter = `and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`;
            countQuery = countQuery.or(periodFilter);
            firstTaskQuery = firstTaskQuery.or(periodFilter);
        }
        
        // Executar ambas as queries em paralelo
        const [countResult, firstTaskResult] = await Promise.all([
            countQuery,
            firstTaskQuery
        ]);
        
        if (countResult.error) {
            console.error('Erro ao contar tarefas:', countResult.error);
            return res.status(500).json({ success: false, error: countResult.error.message });
        }
        
        if (firstTaskResult.error) {
            console.warn('Erro ao buscar primeira tarefa com URL:', firstTaskResult.error);
        }
        
        const count = countResult.count || 0;
        const firstTaskUrl = firstTaskResult.data && firstTaskResult.data.length > 0 ? firstTaskResult.data[0].url : null;
        
        console.log('Total de tarefas encontradas:', count);
        console.log('URL da primeira tarefa:', firstTaskUrl);
        
        res.json({ 
            success: true, 
            total: count, 
            count: count,
            primeira_tarefa_url: firstTaskUrl
        });
        
    } catch (error) {
        console.error('Erro no endpoint de contagem de tarefas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para contar contratos por cliente
app.get('/api/contratos-count/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        
        console.log('Contando contratos para cliente ID:', clienteId);
        
        // Primeiro, verificar se clienteId é um UUID (da tabela cp_cliente) ou um nome
        let clienteNome = clienteId;
        
        // Se clienteId parece ser um UUID, buscar o nome correspondente na tabela cp_cliente
        if (clienteId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            console.log('ClienteId parece ser UUID, buscando nome na tabela cp_cliente...');
            const { data: clienteData, error: clienteError } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_cliente')
                .select('nome')
                .eq('id', clienteId)
                .single();
            
            if (clienteError || !clienteData) {
                console.log('Cliente não encontrado na tabela cp_cliente:', clienteError);
                return res.json({ success: true, total: 0, count: 0 });
            }
            
            clienteNome = clienteData.nome;
            console.log('Nome do cliente encontrado para contratos:', clienteNome);
        }
        
        // Buscar contratos usando o UUID ou nome do cliente
        let query = supabase
            .schema('up_gestaointeligente')
            .from('contratos_clientes')
            .select('*', { count: 'exact', head: true });
        
        // Se clienteId é UUID, usar id_cliente; senão, buscar por razao_social ou nome_fantasia
        if (clienteId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            query = query.eq('id_cliente', clienteId);
        } else {
            query = query.or(`razao_social.ilike.%${clienteNome}%,nome_fantasia.ilike.%${clienteNome}%`);
        }
        
        const { count, error } = await query;
        
        if (error) {
            console.error('Erro ao contar contratos:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        console.log('Total de contratos encontrados:', count);
        res.json({ success: true, total: count || 0, count: count || 0 });
        
    } catch (error) {
        console.error('Erro no endpoint de contagem de contratos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para calcular tempo estimado total por cliente
app.get('/api/tempo-estimado/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal, colaboradorIds } = req.query;
        
        console.log('Calculando tempo estimado para cliente ID:', clienteId);
        console.log('Parâmetros de filtro:', { status, startDate, endDate, dataInicial, dataFinal, colaboradorIds });
        
        // Agora cliente_id na tabela tarefa armazena o ID numérico do cliente
        let query = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('tempo_estimado')
            .eq('cliente_id', clienteId);
        
        // Filtro de status (múltiplos valores separados por vírgula)
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                query = query.in('status', statusArray);
            }
        }
        
        // 👥 FILTRO DE COLABORADORES - Apenas horas deles
        if (colaboradorIds) {
            const colaboradorArray = colaboradorIds.split(',').map(id => id.trim()).filter(id => id);
            if (colaboradorArray.length > 0) {
                query = query.in('responsavel_id', colaboradorArray);
                console.log('👥 Filtrando horas estimadas apenas dos colaboradores:', colaboradorArray);
            }
        }
        
        // Filtro de período - suporta tanto startDate/endDate quanto dataInicial/dataFinal
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            // Converter para objetos Date
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            
            // Para a data final, vamos até o final do dia (23:59:59.999)
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            console.log('Aplicando filtro de período para tempo estimado:', {
                inicio: dateInicialObj.toISOString(),
                fim: dateFinalObj.toISOString()
            });
            
            // Filtrar tarefas que estão dentro do período:
            // Usar created_at como fallback quando dt_inicio for NULL
            query = query.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Erro ao buscar tempo estimado:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Somar todos os tempos estimados
        const totalDecimal = data.reduce((sum, tarefa) => {
            const tempo = parseFloat(tarefa.tempo_estimado) || 0;
            return sum + tempo;
        }, 0);
        
        console.log(`Tempo estimado total para cliente ${clienteId}: ${totalDecimal} (${data.length} tarefas)`);
        
        res.json({ 
            success: true, 
            tempo_decimal: totalDecimal,
            total_tarefas: data.length
        });
        
    } catch (error) {
        console.error('Erro no endpoint de tempo estimado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para calcular tempo realizado total por cliente
app.get('/api/tempo-realizado/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal, colaboradorIds } = req.query;
        
        console.log('Calculando tempo realizado para cliente ID:', clienteId);
        console.log('Parâmetros de filtro:', { status, startDate, endDate, dataInicial, dataFinal, colaboradorIds });
        
        // Buscar tarefas com tempo_realizado aplicando todos os filtros
        let tarefasQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('tempo_realizado')
            .eq('cliente_id', clienteId);
        
        // Filtro de status (múltiplos valores separados por vírgula)
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                tarefasQuery = tarefasQuery.in('status', statusArray);
            }
        }
        
        // 👥 FILTRO DE COLABORADORES - Apenas horas deles
        if (colaboradorIds) {
            const colaboradorArray = colaboradorIds.split(',').map(id => id.trim()).filter(id => id);
            if (colaboradorArray.length > 0) {
                tarefasQuery = tarefasQuery.in('responsavel_id', colaboradorArray);
                console.log('👥 Filtrando horas realizadas apenas dos colaboradores:', colaboradorArray);
            }
        }
        
        // Filtro de período - suporta tanto startDate/endDate quanto dataInicial/dataFinal
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            // Converter para objetos Date
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            
            // Para a data final, vamos até o final do dia (23:59:59.999)
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            console.log('Aplicando filtro de período para tempo realizado:', {
                inicio: dateInicialObj.toISOString(),
                fim: dateFinalObj.toISOString()
            });
            
            // Filtrar tarefas que estão dentro do período:
            // Usar created_at como fallback quando dt_inicio for NULL
            tarefasQuery = tarefasQuery.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        }
        
        const { data: tarefasComTempoFiltradas, error: tempoFiltradoError } = await tarefasQuery;
        
        if (tempoFiltradoError) {
            console.error('Erro ao buscar tarefas com tempo realizado:', tempoFiltradoError);
            return res.status(500).json({ success: false, error: tempoFiltradoError.message });
        }
        
        if (!tarefasComTempoFiltradas || tarefasComTempoFiltradas.length === 0) {
            console.log(`Nenhuma tarefa encontrada para cliente ${clienteId}`);
            return res.json({ 
                success: true, 
                tempo_decimal: 0,
                total_tarefas: 0
            });
        }
        
        console.log(`Encontradas ${tarefasComTempoFiltradas.length} tarefas para o cliente ${clienteId}`);
        
        // Somar todos os tempos realizados (já em horas decimais)
        let totalHoras = 0;
        if (tarefasComTempoFiltradas && tarefasComTempoFiltradas.length > 0) {
            totalHoras = tarefasComTempoFiltradas.reduce((sum, tarefa) => {
                let tempo = tarefa.tempo_realizado;
                
                // Tratar valores null, undefined ou string vazia
                if (tempo === null || tempo === undefined || tempo === '') {
                    return sum;
                }
                
                // Converter string para número se necessário
                if (typeof tempo === 'string') {
                    tempo = parseFloat(tempo);
                }
                
                // Verificar se é um número válido
                if (isNaN(tempo)) {
                    return sum;
                }
                
                return sum + tempo;
            }, 0);
        }
        
        console.log(`Tempo realizado total para cliente ${clienteId}: ${totalHoras.toFixed(2)}h (${tarefasComTempoFiltradas?.length || 0} tarefas)`);
        
        res.json({ 
            success: true, 
            tempo_decimal: parseFloat(totalHoras.toFixed(2)),
            total_tarefas: tarefasComTempoFiltradas?.length || 0
        });
        
    } catch (error) {
        console.error('Erro no endpoint de tempo realizado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para contar colaboradores únicos por cliente
app.get('/api/colaboradores-count/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal } = req.query;
        
        console.log('Contando colaboradores únicos para cliente ID:', clienteId);
        console.log('Parâmetros de filtro:', { status, startDate, endDate, dataInicial, dataFinal });
        
        // Agora cliente_id na tabela tarefa armazena o ID numérico do cliente
        let tarefaQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('id')
            .eq('cliente_id', clienteId);
        
        // Filtro de status (múltiplos valores separados por vírgula)
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                tarefaQuery = tarefaQuery.in('status', statusArray);
            }
        }
        
        // Filtro de período - suporta tanto startDate/endDate quanto dataInicial/dataFinal
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            // Converter para objetos Date
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            
            // Para a data final, vamos até o final do dia (23:59:59.999)
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            console.log('Aplicando filtro de período para colaboradores:', {
                inicio: dateInicialObj.toISOString(),
                fim: dateFinalObj.toISOString()
            });
            
            // Filtrar tarefas que estão dentro do período:
            // Usar created_at como fallback quando dt_inicio for NULL
            tarefaQuery = tarefaQuery.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        }
        
        const { data: tarefas, error: tarefaError } = await tarefaQuery;
        
        if (tarefaError) {
            console.error('Erro ao buscar tarefas:', tarefaError);
            return res.status(500).json({ success: false, error: tarefaError.message });
        }
        
        if (!tarefas || tarefas.length === 0) {
            console.log(`Nenhuma tarefa encontrada para cliente ${clienteId}`);
            return res.json({ 
                success: true, 
                count: 0,
                total_tarefas: 0,
                total_registros: 0
            });
        }
        
        // Extrair os IDs das tarefas
        const tarefaIds = tarefas.map(tarefa => tarefa.id);
        console.log(`Encontradas ${tarefaIds.length} tarefas para o cliente ${clienteId}`);
        
        // Buscar tarefas com responsavel_id para contar colaboradores únicos (mesma lógica do endpoint de nomes)
        const { data: tarefasComResponsavel, error: responsavelError } = await supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('responsavel_id')
            .eq('cliente_id', clienteId)
            .not('responsavel_id', 'is', null);
        
        if (responsavelError) {
            console.error('Erro ao buscar tarefas com responsável:', responsavelError);
            return res.status(500).json({ success: false, error: responsavelError.message });
        }
        
        // Aplicar os mesmos filtros de status e período nas tarefas com responsável
        let tarefasComResponsavelFiltradas = tarefasComResponsavel || [];
        
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                // Buscar novamente com filtro de status
                let queryComFiltro = supabase
                    .schema('up_gestaointeligente')
                    .from('tarefa')
                    .select('responsavel_id')
                    .eq('cliente_id', clienteId)
                    .not('responsavel_id', 'is', null)
                    .in('status', statusArray);
                
                // Aplicar filtro de período se existir
                const dateStart = startDate || dataInicial;
                const dateEnd = endDate || dataFinal;
                
                if (dateStart && dateEnd) {
                    const dateInicialObj = new Date(dateStart);
                    const dateFinalObj = new Date(dateEnd);
                    dateFinalObj.setUTCHours(23, 59, 59, 999);
                    
                    queryComFiltro = queryComFiltro.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
                }
                
                const { data: tarefasFiltradas, error: filtroError } = await queryComFiltro;
                
                if (filtroError) {
                    console.error('Erro ao aplicar filtros:', filtroError);
                    return res.status(500).json({ success: false, error: filtroError.message });
                }
                
                tarefasComResponsavelFiltradas = tarefasFiltradas || [];
            }
        } else if (dateStart && dateEnd) {
            // Aplicar apenas filtro de período
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            let queryComPeriodo = supabase
                .schema('up_gestaointeligente')
                .from('tarefa')
                .select('responsavel_id')
                .eq('cliente_id', clienteId)
                .not('responsavel_id', 'is', null)
                .or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
            
            const { data: tarefasPeriodo, error: periodoError } = await queryComPeriodo;
            
            if (periodoError) {
                console.error('Erro ao aplicar filtro de período:', periodoError);
                return res.status(500).json({ success: false, error: periodoError.message });
            }
            
            tarefasComResponsavelFiltradas = tarefasPeriodo || [];
        }
        
        // Contar responsáveis únicos
        let colaboradoresUnicos = 0;
        if (tarefasComResponsavelFiltradas && tarefasComResponsavelFiltradas.length > 0) {
            const responsaveisUnicos = new Set(tarefasComResponsavelFiltradas.map(tarefa => tarefa.responsavel_id));
            colaboradoresUnicos = responsaveisUnicos.size;
        }
        
        console.log(`Colaboradores únicos para cliente ${clienteId}: ${colaboradoresUnicos} (${tarefasComResponsavelFiltradas.length} tarefas com responsável)`);
        
        res.json({ 
            success: true, 
            count: colaboradoresUnicos,
            total_tarefas: tarefasComResponsavelFiltradas.length,
            total_registros: 0 // Não usamos mais registros de tempo
        });
        
    } catch (error) {
        console.error('Erro no endpoint de colaboradores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar nomes dos colaboradores por cliente
app.get('/api/colaboradores-nomes/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal } = req.query;
        
        console.log('Buscando nomes dos colaboradores para cliente ID:', clienteId);
        console.log('Parâmetros de filtro:', { status, startDate, endDate, dataInicial, dataFinal });
        
        // Buscar tarefas com responsavel_id para calcular horas estimadas e realizadas
        let tarefaQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('responsavel_id, tempo_estimado, tempo_realizado')
            .eq('cliente_id', clienteId)
            .not('responsavel_id', 'is', null); // Apenas tarefas com responsável definido
        
        // Filtro de status (múltiplos valores separados por vírgula)
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                tarefaQuery = tarefaQuery.in('status', statusArray);
            }
        }
        
        // Filtro de período - suporta tanto startDate/endDate quanto dataInicial/dataFinal
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            // Converter para objetos Date
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            
            // Para a data final, vamos até o final do dia (23:59:59.999)
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            console.log('Aplicando filtro de período para nomes dos colaboradores:', {
                inicio: dateInicialObj.toISOString(),
                fim: dateFinalObj.toISOString()
            });
            
            // Filtrar tarefas que estão dentro do período:
            // Usar created_at como fallback quando dt_inicio for NULL
            tarefaQuery = tarefaQuery.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        }
        
        const { data: tarefasComResponsavel, error: tarefaError } = await tarefaQuery;
        
        if (tarefaError) {
            console.error('Erro ao buscar tarefas:', tarefaError);
            return res.status(500).json({ success: false, error: tarefaError.message });
        }
        
        if (!tarefasComResponsavel || tarefasComResponsavel.length === 0) {
            console.log(`Nenhuma tarefa com responsável encontrada para cliente ${clienteId}`);
            return res.json({ 
                success: true, 
                colaboradores: [],
                total_tarefas: 0,
                total_registros: 0
            });
        }
        
        console.log(`Encontradas ${tarefasComResponsavel.length} tarefas com responsável para o cliente ${clienteId}`);
        
        // Obter IDs únicos dos responsáveis
        const responsaveisUnicos = [...new Set(tarefasComResponsavel.map(tarefa => tarefa.responsavel_id))];
        console.log(`IDs únicos de responsáveis encontrados:`, responsaveisUnicos);
        
        // Calcular horas estimadas e realizadas por colaborador
        const horasEstimadasPorColaborador = {};
        const horasRealizadasPorColaborador = {};
        console.log('DEBUG: Dados das tarefas com responsável:', tarefasComResponsavel);
        
        tarefasComResponsavel.forEach(tarefa => {
            const responsavelId = tarefa.responsavel_id;
            const tempoEstimadoOriginal = tarefa.tempo_estimado;
            const tempoRealizadoOriginal = tarefa.tempo_realizado;
            
            // Tratar valores null, undefined, string vazia e NaN para tempo estimado
            let tempoEstimado = 0;
            if (tempoEstimadoOriginal !== null && tempoEstimadoOriginal !== undefined && tempoEstimadoOriginal !== '') {
                const parsed = parseFloat(tempoEstimadoOriginal);
                if (!isNaN(parsed)) {
                    tempoEstimado = parsed;
                }
            }
            
            // Tratar valores null, undefined, string vazia e NaN para tempo realizado
            let tempoRealizado = 0;
            if (tempoRealizadoOriginal !== null && tempoRealizadoOriginal !== undefined && tempoRealizadoOriginal !== '') {
                const parsed = parseFloat(tempoRealizadoOriginal);
                if (!isNaN(parsed)) {
                    tempoRealizado = parsed;
                }
            }
            
            console.log(`DEBUG: Tarefa responsavel_id=${responsavelId}, tempo_estimado_original="${tempoEstimadoOriginal}", tempo_estimado_parsed=${tempoEstimado}, tempo_realizado_original="${tempoRealizadoOriginal}", tempo_realizado_parsed=${tempoRealizado}`);
            
            if (!horasEstimadasPorColaborador[responsavelId]) {
                horasEstimadasPorColaborador[responsavelId] = 0;
            }
            if (!horasRealizadasPorColaborador[responsavelId]) {
                horasRealizadasPorColaborador[responsavelId] = 0;
            }
            
            horasEstimadasPorColaborador[responsavelId] += tempoEstimado;
            horasRealizadasPorColaborador[responsavelId] += tempoRealizado;
        });

        console.log('Horas estimadas por colaborador:', horasEstimadasPorColaborador);
        console.log('Horas realizadas por colaborador:', horasRealizadasPorColaborador);
        
        // Buscar nomes dos colaboradores na tabela membro
        // Converter responsavel_id (text) para bigint para fazer a busca correta
        const responsaveisNumericos = responsaveisUnicos
            .map(id => {
                const numericId = parseInt(id);
                return isNaN(numericId) ? null : numericId;
            })
            .filter(id => id !== null);

        console.log('IDs únicos de responsáveis (string):', responsaveisUnicos);
        console.log('IDs convertidos para numérico:', responsaveisNumericos);

        let membros = [];
        let horasContratadasPorMembro = {};
        const custoPorHoraPorMembro = {};
        
        if (responsaveisNumericos.length > 0) {
            // Buscar dados dos membros
            const { data: membrosData, error: membroError } = await supabase
                .schema('up_gestaointeligente')
                .from('membro')
                .select('id, nome')
                .in('id', responsaveisNumericos);

            if (membroError) {
                console.error('Erro ao buscar membros:', membroError);
                return res.status(500).json({ success: false, error: membroError.message });
            }

            membros = membrosData || [];
            
            // Buscar horas contratadas e custo por hora da view v_custo_hora_membro
            console.log('🔍 DEBUG - Buscando dados da view v_custo_hora_membro para responsaveisNumericos:', responsaveisNumericos);
            
            // Primeiro, vamos verificar se a view tem dados em geral
            const { data: testView, error: testError } = await supabase
                .schema('up_gestaointeligente')
                .from('v_custo_hora_membro')
                .select('membro_id, horas_mensal, custo_por_hora')
                .limit(5);
            
            console.log('🔍 DEBUG - Teste geral da view v_custo_hora_membro (primeiros 5 registros):');
            console.log('🔍 - Erro do teste:', testError);
            console.log('🔍 - Dados do teste:', testView);
            
            const { data: horasContratadas, error: horasError } = await supabase
                .schema('up_gestaointeligente')
                .from('v_custo_hora_membro')
                .select('membro_id, horas_mensal, custo_por_hora')
                .in('membro_id', responsaveisNumericos);

            console.log('🔍 DEBUG - Resultado da query v_custo_hora_membro:');
            console.log('🔍 - Erro:', horasError);
            console.log('🔍 - Dados retornados:', horasContratadas);
            console.log('🔍 - Quantidade de registros:', horasContratadas ? horasContratadas.length : 0);
            console.log('🔍 - Membros buscados:', responsaveisNumericos);

            // Identificar membros que não foram encontrados na view
            const membrosEncontradosNaView = (horasContratadas || []).map(item => item.membro_id);
            const membrosNaoEncontrados = responsaveisNumericos.filter(id => !membrosEncontradosNaView.includes(id));
            
            if (membrosNaoEncontrados.length > 0) {
                console.log('⚠️ AVISO - Membros não encontrados na view v_custo_hora_membro:', membrosNaoEncontrados);
                console.log('⚠️ Estes membros terão custo_por_hora = 0.00 (dados inconsistentes no banco)');
            }

            if (horasError) {
                console.error('❌ Erro ao buscar horas contratadas:', horasError);
                // Não retornar erro, apenas continuar sem as horas contratadas
            } else {
                // Organizar horas contratadas e custo por hora por membro_id
                (horasContratadas || []).forEach((item, index) => {
                    console.log(`🔍 DEBUG - Processando item ${index + 1}:`, {
                        membro_id: item.membro_id,
                        horas_mensal: item.horas_mensal,
                        custo_por_hora: item.custo_por_hora,
                        tipo_custo_por_hora: typeof item.custo_por_hora
                    });
                    
                    horasContratadasPorMembro[item.membro_id] = parseFloat(item.horas_mensal) || 0;
                    custoPorHoraPorMembro[item.membro_id] = parseFloat(item.custo_por_hora) || 0;
                    
                    console.log(`🔍 DEBUG - Valores processados para membro ${item.membro_id}:`, {
                        horas_contratadas: horasContratadasPorMembro[item.membro_id],
                        custo_por_hora: custoPorHoraPorMembro[item.membro_id]
                    });
                });
                
                // Definir valores padrão para membros não encontrados na view
                membrosNaoEncontrados.forEach(membroId => {
                    horasContratadasPorMembro[membroId] = 0;
                    custoPorHoraPorMembro[membroId] = 0;
                    console.log(`⚠️ DEBUG - Definindo valores padrão para membro ${membroId}: horas=0, custo=0`);
                });
            }
        }


        
        console.log(`Membros encontrados na tabela membro:`, membros);
        console.log(`Horas contratadas por membro:`, horasContratadasPorMembro);
        console.log(`Custo por hora por membro:`, custoPorHoraPorMembro);

        // Organizar os nomes dos colaboradores com horas estimadas, realizadas, contratadas e disponíveis
        const colaboradores = responsaveisUnicos.map(responsavelId => {
            const numericId = parseInt(responsavelId);
            const membro = membros.find(m => m.id === numericId);
            const horasEstimadas = horasEstimadasPorColaborador[responsavelId] || 0;
            const horasRealizadas = horasRealizadasPorColaborador[responsavelId] || 0;
            const horasContratadas = horasContratadasPorMembro[numericId] || 0;
            const horasDisponiveis = horasContratadas - horasRealizadas;
            const custoPorHora = custoPorHoraPorMembro[numericId] || 0;
            const custoRealizacao = horasRealizadas * custoPorHora;
            const custoEstimado = horasEstimadas * custoPorHora;
            const custoContratado = horasContratadas * custoPorHora;
            
            // Debug detalhado do cálculo dos custos
            console.log(`🔍 DEBUG CUSTOS - Colaborador ${responsavelId} (${membro ? membro.nome : 'não encontrado'}):`);            
            console.log(`  - Horas Estimadas: ${horasEstimadas}`);
            console.log(`  - Horas Realizadas: ${horasRealizadas}`);
            console.log(`  - Horas Contratadas: ${horasContratadas}`);
            console.log(`  - Custo Por Hora: ${custoPorHora}`);
            console.log(`  - Custo Estimado Calculado: ${custoEstimado}`);
            console.log(`  - Custo Realização: ${custoRealizacao}`);
            console.log(`  - Custo Contratado: ${custoContratado}`);
            
            // Função para formatar horas decimais em hora:minuto
            const formatarHoras = (horasDecimais) => {
                const horas = Math.floor(horasDecimais);
                const minutos = Math.round((horasDecimais - horas) * 60);
                return `${horas}h ${minutos.toString().padStart(2, '0')}min`;
            };
            
            // Formatar custos como moeda brasileira
            const custoRealizacaoFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(custoRealizacao);
            
            const custoEstimadoFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(custoEstimado);
            
            const custoContratadoFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(custoContratado);
            
            // Formatar horas estimadas
            const horasEstimadasFormatadas = formatarHoras(horasEstimadas);
            
            console.log(`Processando responsavel_id: ${responsavelId} (numérico: ${numericId}), membro encontrado:`, membro);
            
            return {
                id: responsavelId,
                nome: membro ? (membro.nome || `Usuário ${responsavelId}`) : `Usuário ${responsavelId} (não encontrado)`,
                horas_estimadas: horasEstimadas,
                horas_estimadas_formatadas: horasEstimadasFormatadas,
                horas_realizadas: horasRealizadas,
                horas_contratadas: horasContratadas,
                horas_disponiveis: horasDisponiveis,
                custo_por_hora: custoPorHora,
                custo_realizacao: custoRealizacao,
                custo_realizacao_formatado: custoRealizacaoFormatado,
                custo_estimado: custoEstimado,
                custo_estimado_formatado: custoEstimadoFormatado,
                custo_contratado: custoContratado,
                custo_contratado_formatado: custoContratadoFormatado
            };
        });
        
        console.log(`Nomes dos colaboradores para cliente ${clienteId}:`, colaboradores.map(c => `${c.nome} - Estimadas: ${c.horas_estimadas}h, Realizadas: ${c.horas_realizadas}h, Contratadas: ${c.horas_contratadas}h, Disponíveis: ${c.horas_disponiveis}h`));
        
        res.json({ 
            success: true, 
            colaboradores: colaboradores,
            total_tarefas: tarefasComResponsavel.length,
            total_registros: 0 // Não estamos mais usando registros de tempo
        });
        
    } catch (error) {
        console.error('Erro no endpoint de nomes dos colaboradores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para calcular custo total por cliente
app.get('/api/custo-total/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal } = req.query;
        
        console.log('💰 Calculando custo total para cliente ID:', clienteId);
        console.log('💰 Parâmetros de filtro:', { status, startDate, endDate, dataInicial, dataFinal });
        
        let clienteUuidParaQuery = clienteId;
        
        // Verificar se é um UUID válido
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);
        
        if (!isUuid) {
            // Buscar o UUID correspondente na tabela cp_cliente por nome
            const { data: clienteData, error: clienteError } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_cliente')
                .select('id, nome')
                .eq('nome', clienteId)
                .single();
            
            if (clienteError || !clienteData) {
                // Tentar busca parcial (case insensitive)
                const { data: clienteDataParcial, error: clienteErrorParcial } = await supabase
                    .schema('up_gestaointeligente')
                    .from('cp_cliente')
                    .select('id, nome')
                    .ilike('nome', `%${clienteId}%`)
                    .limit(1);
                
                if (clienteErrorParcial || !clienteDataParcial || clienteDataParcial.length === 0) {
                    return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
                }
                
                clienteUuidParaQuery = clienteDataParcial[0].id;
            } else {
                clienteUuidParaQuery = clienteData.id;
            }
        }
        
        // Buscar todas as tarefas do cliente com filtros aplicados
        let tarefasQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('responsavel_id, tempo_realizado')
            .eq('cliente_id', clienteUuidParaQuery)
            .not('responsavel_id', 'is', null);
        
        // Aplicar filtros de status
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                tarefasQuery = tarefasQuery.in('status', statusArray);
            }
        }
        
        // Aplicar filtros de data
        const dataInicialFiltro = dataInicial || startDate;
        const dataFinalFiltro = dataFinal || endDate;
        
        if (dataInicialFiltro && dataFinalFiltro) {
            const dateInicialObj = new Date(dataInicialFiltro);
            const dateFinalObj = new Date(dataFinalFiltro);
            console.log('💰💡 Aplicando filtro de período:', { dataInicialFiltro, dataFinalFiltro });
            
            // Usar a mesma lógica dos outros endpoints: dt_inicio primeiro, created_at como fallback
            tarefasQuery = tarefasQuery.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        } else if (dataInicialFiltro) {
            const dateInicialObj = new Date(dataInicialFiltro);
            console.log('💰💡 Aplicando filtro de data inicial:', dataInicialFiltro);
            tarefasQuery = tarefasQuery.or(`dt_inicio.gte.${dateInicialObj.toISOString()},and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()})`);
        } else if (dataFinalFiltro) {
            const dateFinalObj = new Date(dataFinalFiltro);
            console.log('💰💡 Aplicando filtro de data final:', dataFinalFiltro);
            tarefasQuery = tarefasQuery.or(`dt_inicio.lte.${dateFinalObj.toISOString()},and(dt_inicio.is.null,created_at.lte.${dateFinalObj.toISOString()})`);
        }
        
        const { data: tarefas, error: tarefasError } = await tarefasQuery;
        
        if (tarefasError) {
            console.error('💰 Erro ao buscar tarefas:', tarefasError);
            return res.status(500).json({ success: false, error: tarefasError.message });
        }
        
        console.log(`💰 Tarefas encontradas: ${tarefas?.length || 0}`);
        
        if (!tarefas || tarefas.length === 0) {
            return res.json({ 
                success: true, 
                custo_total: 0,
                custo_total_formatado: 'R$ 0,00',
                colaboradores_count: 0
            });
        }
        
        // Agrupar horas realizadas por responsável
        const horasRealizadasPorColaborador = {};
        tarefas.forEach(tarefa => {
            const responsavelId = tarefa.responsavel_id;
            const tempoRealizado = parseFloat(tarefa.tempo_realizado) || 0;
            
            if (!horasRealizadasPorColaborador[responsavelId]) {
                horasRealizadasPorColaborador[responsavelId] = 0;
            }
            horasRealizadasPorColaborador[responsavelId] += tempoRealizado;
        });
        
        const responsaveisUnicos = Object.keys(horasRealizadasPorColaborador);
        const responsaveisNumericos = responsaveisUnicos.map(id => parseInt(id)).filter(id => !isNaN(id));
        
        console.log(`💰 Responsáveis únicos: ${responsaveisUnicos.length}`);
        console.log(`💰 Responsáveis numéricos válidos: ${responsaveisNumericos.length}`);
        
        let custoTotal = 0;
        
        if (responsaveisNumericos.length > 0) {
            // Buscar custo por hora da view v_custo_hora_membro
            const { data: custosData, error: custosError } = await supabase
                .schema('up_gestaointeligente')
                .from('v_custo_hora_membro')
                .select('membro_id, custo_por_hora')
                .in('membro_id', responsaveisNumericos);
            
            if (custosError) {
                console.error('💰 Erro ao buscar custos por hora:', custosError);
            } else {
                // Calcular custo total
                responsaveisNumericos.forEach(membroId => {
                    const custoData = (custosData || []).find(c => c.membro_id === membroId);
                    const custoPorHora = custoData ? parseFloat(custoData.custo_por_hora) || 0 : 0;
                    const horasRealizadas = horasRealizadasPorColaborador[membroId.toString()] || 0;
                    const custoColaborador = custoPorHora * horasRealizadas;
                    
                    console.log(`💰 Membro ${membroId}: ${horasRealizadas}h × R$ ${custoPorHora} = R$ ${custoColaborador}`);
                    
                    custoTotal += custoColaborador;
                });
            }
        }
        
        // Formatar custo total como moeda brasileira
        const custoTotalFormatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(custoTotal);
        
        console.log(`💰 Custo total calculado para cliente ${clienteId}: ${custoTotalFormatado}`);
        
        res.json({ 
            success: true, 
            custo_total: custoTotal,
            custo_total_formatado: custoTotalFormatado,
            colaboradores_count: responsaveisUnicos.length
        });
        
    } catch (error) {
        console.error('💰 Erro no endpoint de custo total:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar custo contratado por cliente
app.get('/api/custo-contratado/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        console.log(`🔍 DEBUG - Buscando custo contratado para cliente: ${clienteId}`);

        // Validar se o clienteId é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(clienteId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'ID do cliente deve ser um UUID válido' 
            });
        }

        // NOVA LÓGICA: Buscar TODOS os colaboradores do cliente diretamente da view v_custo_hora_membro
        // que já tem a relação cliente -> membro através das tarefas
        console.log('🔍 DEBUG - Buscando todos os colaboradores do cliente na view v_custo_hora_membro');
        
        // Primeiro, buscar todos os responsáveis únicos que têm tarefas para este cliente
        const { data: tarefasResponsaveis, error: tarefasError } = await supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('responsavel_id')
            .eq('cliente_id', clienteId)
            .not('responsavel_id', 'is', null);

        if (tarefasError) {
            console.error('❌ Erro ao buscar responsáveis das tarefas:', tarefasError);
            return res.status(500).json({ 
                success: false, 
                error: 'Erro ao buscar responsáveis das tarefas' 
            });
        }

        console.log(`🔍 DEBUG - Encontradas ${tarefasResponsaveis?.length || 0} tarefas com responsáveis para o cliente ${clienteId}`);

        if (!tarefasResponsaveis || tarefasResponsaveis.length === 0) {
            console.log('🔍 DEBUG - Nenhuma tarefa com responsável encontrada para este cliente');
            return res.json({
                success: true,
                custo_contratado: 0,
                custo_contratado_formatado: 'R$ 0,00',
                colaboradores_count: 0
            });
        }

        // Obter responsáveis únicos das tarefas
        const responsaveisUnicos = [...new Set(tarefasResponsaveis.map(t => t.responsavel_id))];
        const responsaveisNumericos = responsaveisUnicos.map(id => parseInt(id)).filter(id => !isNaN(id));
        
        console.log('🔍 DEBUG - Responsáveis únicos:', responsaveisUnicos);
        console.log('🔍 DEBUG - Responsáveis numéricos:', responsaveisNumericos);
        
        if (responsaveisNumericos.length === 0) {
            console.log('🔍 DEBUG - Nenhum responsável numérico válido encontrado');
            return res.json({
                success: true,
                custo_contratado: 0,
                custo_contratado_formatado: 'R$ 0,00',
                colaboradores_count: 0
            });
        }

        // Buscar horas contratadas e custo por hora da view v_custo_hora_membro para TODOS os colaboradores
        const { data: horasContratadas, error: horasError } = await supabase
            .schema('up_gestaointeligente')
            .from('v_custo_hora_membro')
            .select('membro_id, horas_mensal, custo_por_hora')
            .in('membro_id', responsaveisNumericos);

        if (horasError) {
            console.error('❌ Erro ao buscar horas contratadas:', horasError);
            return res.status(500).json({ 
                success: false, 
                error: 'Erro ao buscar horas contratadas dos colaboradores' 
            });
        }

        console.log('🔍 DEBUG - Dados de horas contratadas da view:', horasContratadas);

        // Calcular custo contratado total
        let custoContratadoTotal = 0;
        let colaboradoresComDados = 0;
        
        (horasContratadas || []).forEach(colaborador => {
            const horasContratadas = parseFloat(colaborador.horas_mensal) || 0;
            const custoPorHora = parseFloat(colaborador.custo_por_hora) || 0;
            const custoColaborador = horasContratadas * custoPorHora;
            
            console.log(`🔍 DEBUG - Colaborador ${colaborador.membro_id}: ${horasContratadas}h × R$${custoPorHora} = R$${custoColaborador}`);
            
            custoContratadoTotal += custoColaborador;
            colaboradoresComDados++;
        });

        console.log(`🔍 DEBUG - Custo contratado total: R$${custoContratadoTotal}`);
        console.log(`🔍 DEBUG - Colaboradores com dados: ${colaboradoresComDados}`);

        // Formatar como moeda brasileira
        const custoContratadoFormatado = custoContratadoTotal.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });

        res.json({
            success: true,
            custo_contratado: custoContratadoTotal,
            custo_contratado_formatado: custoContratadoFormatado,
            colaboradores_count: colaboradoresComDados
        });

    } catch (error) {
        console.error('❌ Erro no endpoint custo-contratado:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// Endpoint para buscar custo estimado por cliente
app.get('/api/custo-estimado/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal } = req.query;
        
        console.log('💡 Calculando custo estimado para cliente ID:', clienteId);
        console.log('💡 Parâmetros de filtro:', { status, startDate, endDate, dataInicial, dataFinal });
        
        let clienteUuidParaQuery = clienteId;
        
        // Verificar se é um UUID válido
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);
        
        if (!isUuid) {
            // Buscar o UUID correspondente na tabela cp_cliente por nome
            const { data: clienteData, error: clienteError } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_cliente')
                .select('id, nome')
                .eq('nome', clienteId)
                .single();
            
            if (clienteError || !clienteData) {
                // Tentar busca parcial (case insensitive)
                const { data: clienteDataParcial, error: clienteErrorParcial } = await supabase
                    .schema('up_gestaointeligente')
                    .from('cp_cliente')
                    .select('id, nome')
                    .ilike('nome', `%${clienteId}%`)
                    .limit(1);
                
                if (clienteErrorParcial || !clienteDataParcial || clienteDataParcial.length === 0) {
                    return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
                }
                
                clienteUuidParaQuery = clienteDataParcial[0].id;
            } else {
                clienteUuidParaQuery = clienteData.id;
            }
        }
        
        // Buscar todas as tarefas do cliente com filtros aplicados
        let tarefasQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('responsavel_id, tempo_estimado')
            .eq('cliente_id', clienteUuidParaQuery)
            .not('responsavel_id', 'is', null);
        
        // Aplicar filtros de status
        if (status && status !== 'todos') {
            console.log('💰💡 Aplicando filtro de status:', status);
            if (status.includes(',')) {
                // Status múltiplos (array)
                const statusArray = status.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
                console.log('💰💡 Status array:', statusArray);
                tarefasQuery = tarefasQuery.in('status', statusArray);
            } else {
                // Status único
                const statusInt = parseInt(status);
                if (!isNaN(statusInt)) {
                    tarefasQuery = tarefasQuery.eq('status', statusInt);
                }
            }
        }
        
        // Aplicar filtros de data
        const dataInicialFiltro = dataInicial || startDate;
        const dataFinalFiltro = dataFinal || endDate;
        
        if (dataInicialFiltro) {
            tarefasQuery = tarefasQuery.gte('created_at', dataInicialFiltro);
        }
        
        if (dataFinalFiltro) {
            tarefasQuery = tarefasQuery.lte('created_at', dataFinalFiltro);
        }
        
        const { data: tarefas, error: tarefasError } = await tarefasQuery;
        
        if (tarefasError) {
            console.error('💡 Erro ao buscar tarefas:', tarefasError);
            return res.status(500).json({ success: false, error: tarefasError.message });
        }
        
        console.log(`💡 Tarefas encontradas: ${tarefas?.length || 0}`);
        
        if (!tarefas || tarefas.length === 0) {
            return res.json({ 
                success: true, 
                custo_estimado: 0,
                custo_estimado_formatado: 'R$ 0,00',
                colaboradores_count: 0
            });
        }
        
        // Agrupar horas estimadas por responsável
        const horasEstimadasPorColaborador = {};
        tarefas.forEach(tarefa => {
            const responsavelId = tarefa.responsavel_id;
            const tempoEstimado = parseFloat(tarefa.tempo_estimado) || 0;
            
            if (!horasEstimadasPorColaborador[responsavelId]) {
                horasEstimadasPorColaborador[responsavelId] = 0;
            }
            horasEstimadasPorColaborador[responsavelId] += tempoEstimado;
        });
        
        const responsaveisUnicos = Object.keys(horasEstimadasPorColaborador);
        const responsaveisNumericos = responsaveisUnicos.map(id => parseInt(id)).filter(id => !isNaN(id));
        
        console.log(`💡 Responsáveis únicos: ${responsaveisUnicos.length}`);
        console.log(`💡 Responsáveis numéricos válidos: ${responsaveisNumericos.length}`);
        
        let custoEstimadoTotal = 0;
        
        if (responsaveisNumericos.length > 0) {
            // Buscar custo por hora da view v_custo_hora_membro
            const { data: custosData, error: custosError } = await supabase
                .schema('up_gestaointeligente')
                .from('v_custo_hora_membro')
                .select('membro_id, custo_por_hora')
                .in('membro_id', responsaveisNumericos);
            
            if (custosError) {
                console.error('💡 Erro ao buscar custos por hora:', custosError);
            } else {
                // Calcular custo estimado total
                responsaveisNumericos.forEach(membroId => {
                    const custoData = (custosData || []).find(c => c.membro_id === membroId);
                    const custoPorHora = custoData ? parseFloat(custoData.custo_por_hora) || 0 : 0;
                    const horasEstimadas = horasEstimadasPorColaborador[membroId.toString()] || 0;
                    const custoColaborador = custoPorHora * horasEstimadas;
                    
                    console.log(`💡 Membro ${membroId}: ${horasEstimadas}h × R$ ${custoPorHora} = R$ ${custoColaborador}`);
                    
                    custoEstimadoTotal += custoColaborador;
                });
            }
        }
        
        // Formatar custo estimado total como moeda brasileira
        const custoEstimadoFormatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(custoEstimadoTotal);
        
        console.log(`💡 Custo estimado total calculado para cliente ${clienteId}: ${custoEstimadoFormatado}`);
        
        res.json({ 
            success: true, 
            custo_estimado: custoEstimadoTotal,
            custo_estimado_formatado: custoEstimadoFormatado,
            colaboradores_count: responsaveisUnicos.length
        });
        
    } catch (error) {
        console.error('💡 Erro no endpoint de custo estimado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para calcular custos totais (estimado e realizado) por cliente
app.get('/api/custos-totais/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal } = req.query;
        
        console.log('💰💡 Calculando custos totais (estimado e realizado) para cliente ID:', clienteId);
        console.log('💰💡 Parâmetros de filtro:', { status, startDate, endDate, dataInicial, dataFinal });
        
        let clienteUuidParaQuery = clienteId;
        
        // Verificar se é um UUID válido
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);
        
        if (!isUuid) {
            // Buscar o UUID correspondente na tabela cp_cliente por nome
            const { data: clienteData, error: clienteError } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_cliente')
                .select('id, nome')
                .eq('nome', clienteId)
                .single();
            
            if (clienteError || !clienteData) {
                // Tentar busca parcial (case insensitive)
                const { data: clienteDataParcial, error: clienteErrorParcial } = await supabase
                    .schema('up_gestaointeligente')
                    .from('cp_cliente')
                    .select('id, nome')
                    .ilike('nome', `%${clienteId}%`)
                    .limit(1);
                
                if (clienteErrorParcial || !clienteDataParcial || clienteDataParcial.length === 0) {
                    return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
                }
                
                clienteUuidParaQuery = clienteDataParcial[0].id;
            } else {
                clienteUuidParaQuery = clienteData.id;
            }
        }
        
        // Buscar todas as tarefas do cliente com filtros aplicados
        let tarefasQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('responsavel_id, tempo_estimado, tempo_realizado')
            .eq('cliente_id', clienteUuidParaQuery)
            .not('responsavel_id', 'is', null);
        
        // Aplicar filtros de status (múltiplos valores separados por vírgula)
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                tarefasQuery = tarefasQuery.in('status', statusArray);
            }
        }
        
        // Aplicar filtros de data - usar a mesma lógica dos detalhes de colaboradores
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            // Converter para objetos Date
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            
            // Para a data final, vamos até o final do dia (23:59:59.999)
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            console.log('💰💡 Aplicando filtro de período para custos totais:', {
                inicio: dateInicialObj.toISOString(),
                fim: dateFinalObj.toISOString()
            });
            
            // Filtrar tarefas que estão dentro do período:
            // Usar dt_inicio como campo principal e created_at como fallback quando dt_inicio for NULL
            tarefasQuery = tarefasQuery.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        }
        
        const { data: tarefas, error: tarefasError } = await tarefasQuery;
        
        if (tarefasError) {
            console.error('💰💡 Erro ao buscar tarefas:', tarefasError);
            return res.status(500).json({ success: false, error: tarefasError.message });
        }
        
        console.log(`💰💡 Tarefas encontradas: ${tarefas?.length || 0}`);
        
        if (!tarefas || tarefas.length === 0) {
            return res.json({ 
                success: true, 
                custo_estimado: 0,
                custo_estimado_formatado: 'R$ 0,00',
                custo_realizado: 0,
                custo_realizado_formatado: 'R$ 0,00',
                colaboradores_count: 0
            });
        }
        
        // Agrupar horas estimadas e realizadas por responsável - usar a mesma lógica dos detalhes
        const horasPorColaborador = {};
        console.log('💰💡 DEBUG: Dados das tarefas com responsável:', tarefas);
        
        tarefas.forEach(tarefa => {
            const responsavelId = tarefa.responsavel_id;
            const tempoEstimadoOriginal = tarefa.tempo_estimado;
            const tempoRealizadoOriginal = tarefa.tempo_realizado;
            
            // Tratar valores null, undefined, string vazia e NaN para tempo estimado
            let tempoEstimado = 0;
            if (tempoEstimadoOriginal !== null && tempoEstimadoOriginal !== undefined && tempoEstimadoOriginal !== '') {
                const parsed = parseFloat(tempoEstimadoOriginal);
                if (!isNaN(parsed)) {
                    tempoEstimado = parsed;
                }
            }
            
            // Tratar valores null, undefined, string vazia e NaN para tempo realizado
            let tempoRealizado = 0;
            if (tempoRealizadoOriginal !== null && tempoRealizadoOriginal !== undefined && tempoRealizadoOriginal !== '') {
                const parsed = parseFloat(tempoRealizadoOriginal);
                if (!isNaN(parsed)) {
                    tempoRealizado = parsed;
                }
            }
            
            console.log(`💰💡 DEBUG: Tarefa responsavel_id=${responsavelId}, tempo_estimado_original="${tempoEstimadoOriginal}", tempo_estimado_parsed=${tempoEstimado}, tempo_realizado_original="${tempoRealizadoOriginal}", tempo_realizado_parsed=${tempoRealizado}`);
            
            if (!horasPorColaborador[responsavelId]) {
                horasPorColaborador[responsavelId] = {
                    estimadas: 0,
                    realizadas: 0
                };
            }
            horasPorColaborador[responsavelId].estimadas += tempoEstimado;
            horasPorColaborador[responsavelId].realizadas += tempoRealizado;
        });
        
        console.log('💰💡 Horas estimadas e realizadas por colaborador:', horasPorColaborador);
        
        const responsaveisUnicos = Object.keys(horasPorColaborador);
        const responsaveisNumericos = responsaveisUnicos.map(id => parseInt(id)).filter(id => !isNaN(id));
        
        console.log(`💰💡 Responsáveis únicos: ${responsaveisUnicos.length}`);
        console.log(`💰💡 Responsáveis numéricos válidos: ${responsaveisNumericos.length}`);
        
        let custoEstimadoTotal = 0;
        let custoRealizadoTotal = 0;
        
        if (responsaveisNumericos.length > 0) {
            // Buscar custo por hora da view v_custo_hora_membro
            const { data: custosData, error: custosError } = await supabase
                .schema('up_gestaointeligente')
                .from('v_custo_hora_membro')
                .select('membro_id, custo_por_hora')
                .in('membro_id', responsaveisNumericos);
            
            if (custosError) {
                console.error('💰💡 Erro ao buscar custos por hora:', custosError);
            } else {
                // Calcular custos totais (estimado e realizado)
                responsaveisNumericos.forEach(membroId => {
                    const custoData = (custosData || []).find(c => c.membro_id === membroId);
                    const custoPorHora = custoData ? parseFloat(custoData.custo_por_hora) || 0 : 0;
                    const horasEstimadas = horasPorColaborador[membroId.toString()].estimadas || 0;
                    const horasRealizadas = horasPorColaborador[membroId.toString()].realizadas || 0;
                    
                    const custoEstimadoColaborador = custoPorHora * horasEstimadas;
                    const custoRealizadoColaborador = custoPorHora * horasRealizadas;
                    
                    console.log(`💰💡 Membro ${membroId}: Estimado ${horasEstimadas}h × R$ ${custoPorHora} = R$ ${custoEstimadoColaborador}`);
                    console.log(`💰💡 Membro ${membroId}: Realizado ${horasRealizadas}h × R$ ${custoPorHora} = R$ ${custoRealizadoColaborador}`);
                    
                    custoEstimadoTotal += custoEstimadoColaborador;
                    custoRealizadoTotal += custoRealizadoColaborador;
                });
            }
        }
        
        // Formatar custos como moeda brasileira
        const custoEstimadoFormatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(custoEstimadoTotal);
        
        const custoRealizadoFormatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(custoRealizadoTotal);
        
        console.log(`💰💡 Custos totais calculados para cliente ${clienteId}:`);
        console.log(`💰💡 - Estimado: ${custoEstimadoFormatado}`);
        console.log(`💰💡 - Realizado: ${custoRealizadoFormatado}`);
        
        res.json({ 
            success: true, 
            custo_estimado: custoEstimadoTotal,
            custo_estimado_formatado: custoEstimadoFormatado,
            custo_realizado: custoRealizadoTotal,
            custo_realizado_formatado: custoRealizadoFormatado,
            colaboradores_count: responsaveisUnicos.length
        });
        
    } catch (error) {
        console.error('💰💡 Erro no endpoint de custos totais:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar produtos únicos de um cliente
app.get('/api/produtos-cliente/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal } = req.query;
        
        console.log('🛍️ Buscando produtos únicos para cliente:', clienteId);
        
        let clienteUuidParaQuery = clienteId;
        
        // Verificar se é um UUID válido
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);
        
        if (!isUuid) {
            // Buscar o UUID correspondente na tabela cp_cliente por nome
            const { data: clienteData, error: clienteError } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_cliente')
                .select('id, nome')
                .eq('nome', clienteId)
                .single();
            
            if (clienteError || !clienteData) {
                // Tentar busca parcial (case insensitive)
                const { data: clienteDataParcial, error: clienteErrorParcial } = await supabase
                    .schema('up_gestaointeligente')
                    .from('cp_cliente')
                    .select('id, nome')
                    .ilike('nome', `%${clienteId}%`)
                    .limit(1);
                
                if (clienteErrorParcial || !clienteDataParcial || clienteDataParcial.length === 0) {
                    console.log('❌ Cliente não encontrado na tabela cp_cliente');
                    return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
                }
                
                clienteUuidParaQuery = clienteDataParcial[0].id;
            } else {
                clienteUuidParaQuery = clienteData.id;
            }
        }
        
        // Buscar nomes dos produtos únicos das tarefas do cliente usando JOIN manual
        // Primeiro buscar as tarefas do cliente
        let tarefasQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('produto_id')
            .eq('cliente_id', clienteUuidParaQuery)
            .not('produto_id', 'is', null);

        // Aplicar filtros de status
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                tarefasQuery = tarefasQuery.in('status', statusArray);
            }
        }

        // Aplicar filtros de data
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            tarefasQuery = tarefasQuery.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        }

        const { data: tarefas, error: tarefasError } = await tarefasQuery;
        
        if (tarefasError) {
            console.error('❌ Erro ao buscar tarefas do cliente:', tarefasError);
            return res.status(500).json({ success: false, error: tarefasError.message });
        }
        
        if (!tarefas || tarefas.length === 0) {
            console.log(`🛍️ Nenhuma tarefa encontrada para cliente ${clienteId}`);
            return res.json({ 
                success: true, 
                produtos: [],
                produtos_formatados: ''
            });
        }
        
        // Extrair IDs únicos dos produtos
        const produtoIds = [...new Set(tarefas.map(t => t.produto_id).filter(id => id))];
        
        if (produtoIds.length === 0) {
            console.log(`🛍️ Nenhum produto_id encontrado nas tarefas do cliente ${clienteId}`);
            return res.json({ 
                success: true, 
                produtos: [],
                produtos_formatados: ''
            });
        }
        
        // Buscar os nomes dos produtos na tabela cp_produto
        const { data: produtos, error } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_produto')
            .select('nome')
            .in('id', produtoIds);
        
        if (error) {
            console.error('❌ Erro ao buscar produtos do cliente:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Extrair nomes únicos dos produtos
        const nomesUnicos = [...new Set(produtos.map(p => p.nome).filter(nome => nome))];
        
        console.log(`🛍️ Produtos únicos encontrados para cliente ${clienteId}:`, nomesUnicos);
        
        res.json({ 
            success: true, 
            produtos: nomesUnicos,
            produtos_formatados: nomesUnicos.join(', ')
        });
        
    } catch (error) {
        console.error('🛍️ Erro no endpoint de produtos do cliente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar detalhes das tarefas por cliente
app.get('/api/tarefas-detalhes/:clienteId', requireAuth, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal, responsavel_id } = req.query;
        
        console.log('🔍 === DEBUG DETALHES DAS TAREFAS ===');
        console.log('🔍 Cliente ID recebido:', clienteId, 'Tipo:', typeof clienteId);
        console.log('🔍 Parâmetros de filtro completos:', { status, startDate, endDate, dataInicial, dataFinal, responsavel_id });
        console.log('🔍 Query string completa:', req.url);
        
        let clienteUuidParaQuery = clienteId;
        
        // Verificar se é um UUID válido
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);
        console.log('🔍 Cliente ID é UUID?', isUuid);
        
        if (!isUuid) {
            console.log('🔍 Não é UUID, buscando cliente por nome na tabela cp_cliente...');
            
            // Buscar o UUID correspondente na tabela cp_cliente por nome
            const { data: clienteData, error: clienteError } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_cliente')
                .select('id, nome')
                .eq('nome', clienteId)
                .single();
            
            console.log('🔍 Resultado da busca na cp_cliente por nome:', { clienteData, clienteError });
            
            if (clienteError || !clienteData) {
                console.log('❌ Cliente não encontrado na tabela cp_cliente por nome, tentando busca parcial...');
                
                // Tentar busca parcial (case insensitive)
                const { data: clienteDataParcial, error: clienteErrorParcial } = await supabase
                    .schema('up_gestaointeligente')
                    .from('cp_cliente')
                    .select('id, nome')
                    .ilike('nome', `%${clienteId}%`)
                    .limit(1);
                
                console.log('🔍 Resultado da busca parcial:', { clienteDataParcial, clienteErrorParcial });
                
                if (clienteErrorParcial || !clienteDataParcial || clienteDataParcial.length === 0) {
                    console.log('❌ Cliente não encontrado na tabela cp_cliente');
                    return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
                }
                
                clienteUuidParaQuery = clienteDataParcial[0].id;
                console.log('🔍 UUID encontrado por busca parcial:', clienteUuidParaQuery);
            } else {
                clienteUuidParaQuery = clienteData.id;
                console.log('🔍 UUID encontrado por nome exato:', clienteUuidParaQuery);
            }
        }
        
        console.log('🔍 Usando UUID para query na tabela tarefa:', clienteUuidParaQuery);
        
        // Primeiro, vamos verificar que tipos de cliente_id existem na tabela tarefa
        const { data: exemplosTarefas, error: debugError } = await supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('id, cliente_id')
            .limit(5);
        
        console.log('🔍 DEBUG - Exemplos de cliente_id na tabela tarefa:');
        if (exemplosTarefas) {
            exemplosTarefas.forEach((t, i) => {
                console.log(`🔍   ${i+1}. Tarefa ID: ${t.id}, cliente_id: '${t.cliente_id}' (tipo: ${typeof t.cliente_id})`);
            });
        }
        
        // A tabela tarefa usa cliente_id (UUID)
        let query = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('id, tarefa_nome, tempo_estimado, tempo_realizado, status, dt_inicio, created_at, url, cliente_id, responsavel_id')
            .eq('cliente_id', clienteUuidParaQuery);
        
        // Filtro por responsável específico (se fornecido)
        if (responsavel_id) {
            console.log('🔍 Aplicando filtro por responsavel_id:', responsavel_id);
            query = query.eq('responsavel_id', responsavel_id);
        }
        
        console.log('🔍 Query inicial construída para cliente_id:', clienteUuidParaQuery);
        
        // Filtro de status (múltiplos valores separados por vírgula)
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                query = query.in('status', statusArray);
            }
        }
        
        // Filtro de período - suporta tanto startDate/endDate quanto dataInicial/dataFinal
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            // Converter para objetos Date
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            
            // Para a data final, vamos até o final do dia (23:59:59.999)
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            console.log('Aplicando filtro de período para detalhes das tarefas:', {
                inicio: dateInicialObj.toISOString(),
                fim: dateFinalObj.toISOString()
            });
            
            // Filtrar tarefas que estão dentro do período:
            // Usar created_at como fallback quando dt_inicio for NULL
            query = query.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        }
        
        // Ordenar por data de criação (mais recentes primeiro)
        query = query.order('created_at', { ascending: false });
        
        const { data: tarefas, error } = await query;
        
        console.log('🔍 Resultado da query:');
        console.log('🔍 - Erro:', error);
        console.log('🔍 - Tarefas encontradas:', tarefas ? tarefas.length : 0);
        if (tarefas && tarefas.length > 0) {
            console.log('🔍 - Primeira tarefa exemplo:', tarefas[0]);
        }
        
        if (error) {
            console.error('❌ Erro ao buscar detalhes das tarefas:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Vamos também fazer uma query de debug para ver todas as tarefas disponíveis
        const { data: todasTarefas, error: debugError2 } = await supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('id, cliente_id')
            .limit(10);
        
        console.log('🔍 DEBUG - Primeiras 10 tarefas na tabela (para verificar formato cliente_id):');
        if (todasTarefas) {
            todasTarefas.forEach((t, i) => {
                console.log(`🔍   ${i+1}. ID: ${t.id}, cliente_id: '${t.cliente_id}' (tipo: ${typeof t.cliente_id})`);
            });
        }
        
        if (!tarefas || tarefas.length === 0) {
             console.log(`❌ Nenhuma tarefa encontrada para cliente ${clienteUuidParaQuery}`);
             console.log('🔍 Tentando buscar com diferentes formatos...');
             
             return res.json({ 
                 success: true, 
                 tarefas: [],
                 total: 0,
                 debug: {
                     clienteIdOriginal: clienteId,
                     clienteUuidUsado: clienteUuidParaQuery,
                     totalTarefasNaTabela: todasTarefas ? todasTarefas.length : 0
                 }
             });
         }
        
        // Formatar os dados das tarefas
        const tarefasFormatadas = tarefas.map(tarefa => ({
            id: tarefa.id,
            nome: tarefa.tarefa_nome || 'Tarefa sem nome',
            tempo_estimado: parseFloat(tarefa.tempo_estimado) || 0,
            tempo_realizado: parseFloat(tarefa.tempo_realizado) || 0,
            status: tarefa.status || 'Sem status',
            data_inicio: tarefa.dt_inicio || tarefa.created_at,
            url: tarefa.url || null,
            responsavel_id: tarefa.responsavel_id
        }));
        
        console.log(`Detalhes de ${tarefasFormatadas.length} tarefas encontradas para cliente ${clienteId}`);
        
        res.json({ 
            success: true, 
            tarefas: tarefasFormatadas,
            total: tarefasFormatadas.length
        });
        
    } catch (error) {
        console.error('Erro no endpoint de detalhes das tarefas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint de debug temporário para investigar dados
app.get('/api/debug-tarefas', requireAuth, async (req, res) => {
    try {
        console.log('🔍 DEBUG - Investigando estrutura dos dados...');
        
        // Buscar algumas tarefas com todos os campos relevantes
        const { data: tarefas, error } = await supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('id, cliente_id, responsavel_id, tarefa_nome, status')
            .limit(5);
        
        if (error) {
            console.error('❌ Erro ao buscar tarefas:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Buscar alguns clientes
        const { data: clientes, error: clientesError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id, nome')
            .limit(5);
        
        if (clientesError) {
            console.error('❌ Erro ao buscar clientes:', clientesError);
            return res.status(500).json({ success: false, error: clientesError.message });
        }
        
        res.json({ 
            success: true, 
            tarefas: tarefas,
            clientes: clientes,
            debug: {
                totalTarefas: tarefas ? tarefas.length : 0,
                totalClientes: clientes ? clientes.length : 0
            }
        });
        
    } catch (error) {
        console.error('Erro no endpoint de debug:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar tarefas por responsavel_id (sem filtro de cliente)
app.get('/api/tarefas-por-responsavel/:responsavelId', requireAuth, async (req, res) => {
    try {
        const { responsavelId } = req.params;
        const { status, startDate, endDate, dataInicial, dataFinal } = req.query;
        
        console.log('🔍 Buscando tarefas para responsavel_id:', responsavelId);
        console.log('🔍 Parâmetros de filtro:', { status, startDate, endDate, dataInicial, dataFinal });
        
        // Buscar tarefas do responsável específico
        let tarefaQuery = supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('id, tarefa_nome, status, tempo_estimado, tempo_realizado, responsavel_id, url, dt_inicio, created_at')
            .eq('responsavel_id', responsavelId);
        
        // Filtro de status (múltiplos valores separados por vírgula)
        if (status) {
            const statusArray = status.split(',').map(s => s.trim()).filter(s => s);
            if (statusArray.length > 0) {
                tarefaQuery = tarefaQuery.in('status', statusArray);
            }
        }
        
        // Filtro de período - suporta tanto startDate/endDate quanto dataInicial/dataFinal
        const dateStart = startDate || dataInicial;
        const dateEnd = endDate || dataFinal;
        
        if (dateStart && dateEnd) {
            // Converter para objetos Date
            const dateInicialObj = new Date(dateStart);
            const dateFinalObj = new Date(dateEnd);
            
            // Para a data final, vamos até o final do dia (23:59:59.999)
            dateFinalObj.setUTCHours(23, 59, 59, 999);
            
            console.log('🔍 Aplicando filtro de período:', {
                inicio: dateInicialObj.toISOString(),
                fim: dateFinalObj.toISOString()
            });
            
            // Filtrar tarefas que estão dentro do período:
            // Usar created_at como fallback quando dt_inicio for NULL
            tarefaQuery = tarefaQuery.or(`and(dt_inicio.gte.${dateInicialObj.toISOString()},dt_inicio.lte.${dateFinalObj.toISOString()}),and(dt_inicio.is.null,created_at.gte.${dateInicialObj.toISOString()},created_at.lte.${dateFinalObj.toISOString()})`);
        }
        
        // Ordenar por data de criação (mais recentes primeiro)
        tarefaQuery = tarefaQuery.order('created_at', { ascending: false });
        
        const { data: tarefas, error } = await tarefaQuery;
        
        if (error) {
            console.error('❌ Erro ao buscar tarefas do responsável:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        console.log(`✅ Encontradas ${tarefas?.length || 0} tarefas para responsavel_id ${responsavelId}`);
        
        // Processar tarefas para garantir campos corretos
        const tarefasProcessadas = (tarefas || []).map(tarefa => ({
            id: tarefa.id,
            nome: tarefa.tarefa_nome || tarefa.nome || 'Tarefa sem nome',
            status: tarefa.status || 'Sem status',
            tempo_estimado: tarefa.tempo_estimado || 0,
            tempo_realizado: tarefa.tempo_realizado || 0,
            responsavel_id: tarefa.responsavel_id,
            url: tarefa.url || ''
        }));
        
        res.json({
            success: true,
            tarefas: tarefasProcessadas,
            total: tarefasProcessadas.length
        });
        
    } catch (error) {
        console.error('❌ Erro no endpoint de tarefas por responsável:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar todos os colaboradores disponíveis
app.get('/api/colaboradores', requireAuth, async (req, res) => {
    try {
        console.log('🔍 Buscando todos os colaboradores disponíveis da tabela membro...');
        
        // Buscar todos os colaboradores da tabela membro
        const { data: colaboradores, error } = await supabase
            .schema('up_gestaointeligente')
            .from('membro')
            .select('id, nome')
            .order('nome', { ascending: true });
        
        if (error) {
            console.error('❌ Erro ao buscar colaboradores:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Filtrar colaboradores com nome válido
        const colaboradoresValidos = colaboradores
            .filter(colaborador => colaborador.nome && colaborador.nome.trim() !== '')
            .map(colaborador => ({
                id: colaborador.id,
                nome: colaborador.nome.trim()
            }));
        
        console.log(`✅ ${colaboradoresValidos.length} colaboradores encontrados na tabela membro`);
        
        res.json({ 
            success: true, 
            colaboradores: colaboradoresValidos
        });
        
    } catch (error) {
        console.error('Erro no endpoint de colaboradores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar clientes que têm colaboradores específicos
app.get('/api/clientes-por-colaboradores', requireAuth, async (req, res) => {
    try {
        const { colaboradores } = req.query;
        
        if (!colaboradores) {
            return res.status(400).json({ success: false, error: 'Parâmetro colaboradores é obrigatório' });
        }
        
        // Converter string de colaboradores em array
        const colaboradoresArray = colaboradores.split(',').map(id => id.trim()).filter(id => id);
        
        if (colaboradoresArray.length === 0) {
            return res.status(400).json({ success: false, error: 'Lista de colaboradores não pode estar vazia' });
        }
        
        console.log('🔍 Buscando clientes para colaboradores:', colaboradoresArray);
        
        // Buscar tarefas onde responsavel_id corresponde aos colaboradores selecionados
        const { data: tarefas, error: tarefasError } = await supabase
            .schema('up_gestaointeligente')
            .from('tarefa')
            .select('cliente_id')
            .in('responsavel_id', colaboradoresArray)
            .not('cliente_id', 'is', null);
        
        if (tarefasError) {
            console.error('❌ Erro ao buscar tarefas por colaboradores:', tarefasError);
            return res.status(500).json({ success: false, error: tarefasError.message });
        }
        
        // Extrair IDs únicos dos clientes
        const clienteIds = [...new Set(tarefas.map(tarefa => tarefa.cliente_id))];
        
        if (clienteIds.length === 0) {
            console.log('ℹ️ Nenhum cliente encontrado para os colaboradores especificados');
            return res.json({ 
                success: true, 
                clientes: []
            });
        }
        
        // Buscar informações dos clientes
        const { data: clientes, error: clientesError } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id, nome')
            .in('id', clienteIds)
            .not('nome', 'is', null)
            .order('nome', { ascending: true });
        
        if (clientesError) {
            console.error('❌ Erro ao buscar informações dos clientes:', clientesError);
            return res.status(500).json({ success: false, error: clientesError.message });
        }
        
        console.log(`✅ ${clientes.length} clientes únicos encontrados para os colaboradores especificados`);
        
        res.json({ 
            success: true, 
            clientes: clientes.map(cliente => ({
                id: cliente.id,
                nome: cliente.nome
            }))
        });
        
    } catch (error) {
        console.error('Erro no endpoint de clientes por colaboradores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Usar as rotas organizadas após todos os endpoints da API
app.use('/', routes);

// Middleware de tratamento de erro global
app.use((error, req, res, next) => {
  console.error('❌ Erro não tratado capturado pelo middleware global:', error);
  
  // Se a requisição é para uma API, retornar JSON
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
  
  // Para outras rotas, retornar erro padrão
  res.status(500).send('Erro interno do servidor');
});

// Middleware para capturar rotas de API não encontradas (DEVE SER O ÚLTIMO)
app.use('/api', (req, res, next) => {
  // Se chegou até aqui, significa que nenhuma rota de API foi encontrada
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint não encontrado' 
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`API disponível em http://localhost:${PORT}/api/clientes-kamino`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nEncerrando servidor...');
  process.exit(0);
});
