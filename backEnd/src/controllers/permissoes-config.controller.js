// =============================================================
// === CONTROLLER DE CONFIGURAÇÕES DE PERMISSÕES ===
// =============================================================

const supabase = require('../config/database');

// GET - Buscar configurações de permissões por nível
async function getPermissoesConfig(req, res) {
  try {
    const { nivel } = req.query;

    let query = supabase
      
      .from('permissoes_config')
      .select('*')
      .order('nivel', { ascending: true });

    if (nivel) {
      query = query.eq('nivel', nivel);
    }

    const { data, error } = await query;

    // Se a tabela não existir, retornar configurações padrão
    if (error) {
      // Verificar se é erro de tabela não encontrada
      if (error.code === '42P01' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('não existe') ||
        error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.log('⚠️ Tabela permissoes_config não existe, retornando configurações padrão');
        return res.json({
          success: true,
          data: getDefaultConfig()
        });
      }

      console.error('Erro ao buscar configurações de permissões:', error);
      // Em caso de outro erro, também retornar padrão para não quebrar o sistema
      return res.json({
        success: true,
        data: getDefaultConfig()
      });
    }

    // Se não houver dados, retornar configurações padrão
    if (!data || data.length === 0) {
      return res.json({
        success: true,
        data: getDefaultConfig()
      });
    }

    // Processar dados: parsear JSON das páginas
    const processedData = data.map(item => {
      let paginas = null;
      let notificacoes = []; // Default para vazio

      // Processar Páginas
      if (item.paginas) {
        try {
          paginas = typeof item.paginas === 'string' ? JSON.parse(item.paginas) : item.paginas;
        } catch (parseError) {
          console.error('Erro ao parsear JSON de páginas:', parseError);
          paginas = null;
        }
      }

      // Processar Notificações (NOVO)
      if (item.notificacoes) {
        try {
          notificacoes = typeof item.notificacoes === 'string' ? JSON.parse(item.notificacoes) : item.notificacoes;
        } catch (parseError) {
          console.error('Erro ao parsear JSON de notificações:', parseError);
          notificacoes = [];
        }
      }

      return {
        ...item,
        paginas: paginas,
        notificacoes: notificacoes
      };
    });

    return res.json({
      success: true,
      data: processedData
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar configurações de permissões:', error);
    // Em caso de erro, retornar configurações padrão para não quebrar o sistema
    return res.json({
      success: true,
      data: getDefaultConfig()
    });
  }
}

// PUT - Atualizar configurações de permissões de um nível
async function atualizarPermissoesConfig(req, res) {
  try {
    const { nivel } = req.params;
    const { paginas, notificacoes } = req.body;

    if (!nivel) {
      return res.status(400).json({
        success: false,
        error: 'Nível de permissão é obrigatório'
      });
    }

    // Nível administrador é fixo e não pode ser editado via esta API (Regra existente)
    // MAS podemos permitir editar notificações se desejado?
    // O texto diz "NÃO remover o conceito de super usuário... regras hardcoded".
    // Vamos manter Admin intocável para evitar bloqueio acidental.
    if (nivel.toLowerCase() === 'administrador') {
      return res.status(400).json({
        success: false,
        error: 'Nível administrador não pode ser modificado'
      });
    }

    // Validar que paginas é um array ou null
    if (paginas !== undefined && paginas !== null && !Array.isArray(paginas)) {
      return res.status(400).json({
        success: false,
        error: 'Páginas deve ser um array ou null'
      });
    }

    // Validar notificações
    if (notificacoes !== undefined && !Array.isArray(notificacoes)) {
      return res.status(400).json({
        success: false,
        error: 'Notificações deve ser um array'
      });
    }

    const nivelNormalizado = nivel.toLowerCase().trim();

    // Verificar se já existe configuração para este nível
    const { data: existing, error: checkError } = await supabase
      
      .from('permissoes_config')
      .select('id')
      .eq('nivel', nivelNormalizado)
      .maybeSingle();

    // Se a tabela não existir, retornar erro informativo
    if (checkError) {
      if (checkError.code === '42P01' || checkError.message?.includes('does not exist') || checkError.message?.includes('não existe')) {
        return res.status(500).json({
          success: false,
          error: 'Tabela de configurações de permissões não existe. Execute o script SQL para criar a tabela.',
          details: 'A tabela permissoes_config precisa ser criada no banco de dados. Veja o arquivo backEnd/sql/create_permissoes_config.sql'
        });
      }

      console.error('Erro ao verificar configuração existente:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar configuração',
        details: checkError.message
      });
    }

    const dadosUpdate = {
      nivel: nivelNormalizado,
      updated_at: new Date().toISOString()
    };

    // Atualizar apenas o que foi enviado
    if (paginas !== undefined) dadosUpdate.paginas = JSON.stringify(paginas);
    if (notificacoes !== undefined) dadosUpdate.notificacoes = JSON.stringify(notificacoes);

    let result;
    if (existing) {
      // Atualizar existente
      const { data, error: updateError } = await supabase
        
        .from('permissoes_config')
        .update(dadosUpdate)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Erro ao atualizar configuração:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao atualizar configuração',
          details: updateError.message
        });
      }
      result = data;
    } else {
      // Criar novo
      const { data, error: insertError } = await supabase
        
        .from('permissoes_config')
        .insert({
          ...dadosUpdate,
          created_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Erro ao criar configuração:', insertError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao criar configuração',
          details: insertError.message
        });
      }
      result = data;
    }

    // Processar resposta: parsear JSON das páginas
    const processedResult = {
      ...result,
      paginas: result.paginas ? (typeof result.paginas === 'string' ? JSON.parse(result.paginas) : result.paginas) : [],
      notificacoes: result.notificacoes ? (typeof result.notificacoes === 'string' ? JSON.parse(result.notificacoes) : result.notificacoes) : []
    };

    console.log(`✅ Configuração de permissões atualizada para nível: ${nivelNormalizado}`);

    return res.json({
      success: true,
      message: 'Configuração de permissões atualizada com sucesso',
      data: processedResult
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar configuração de permissões:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// Função auxiliar para retornar configurações padrão
function getDefaultConfig() {
  return [
    {
      nivel: 'gestor',
      paginas: null // null = todas as páginas
    },
    {
      nivel: 'colaborador',
      paginas: [
        '/painel-colaborador',
        '/base-conhecimento/conteudos-clientes',
        '/base-conhecimento/cliente'
      ],
      notificacoes: ['PLUG_RAPIDO'] // Default: Colaborador recebe plug rápido
    }
  ];
}

module.exports = {
  getPermissoesConfig,
  atualizarPermissoesConfig
};

