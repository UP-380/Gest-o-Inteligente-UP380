// =============================================================
// === CONTROLLER DE CONFIGURAÇÕES DE PERMISSÕES ===
// =============================================================

const supabase = require('../config/database');

// GET - Buscar configurações de permissões por nível
async function getPermissoesConfig(req, res) {
  try {
    const { nivel } = req.query;

    let query = supabase
      .schema('up_gestaointeligente')
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
      if (item.paginas) {
        try {
          paginas = typeof item.paginas === 'string' ? JSON.parse(item.paginas) : item.paginas;
        } catch (parseError) {
          console.error('Erro ao parsear JSON de páginas:', parseError);
          paginas = null;
        }
      }
      
      return {
        ...item,
        paginas: paginas
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
    const { paginas } = req.body;

    if (!nivel) {
      return res.status(400).json({
        success: false,
        error: 'Nível de permissão é obrigatório'
      });
    }

    // Validar nível
    const niveisValidos = ['gestor', 'colaborador'];
    if (!niveisValidos.includes(nivel.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Nível inválido. Use: gestor ou colaborador'
      });
    }

    // Validar que paginas é um array ou null
    if (paginas !== null && !Array.isArray(paginas)) {
      return res.status(400).json({
        success: false,
        error: 'Páginas deve ser um array ou null'
      });
    }

    const nivelNormalizado = nivel.toLowerCase();

    // Verificar se já existe configuração para este nível
    const { data: existing, error: checkError } = await supabase
      .schema('up_gestaointeligente')
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
      paginas: JSON.stringify(paginas),
      updated_at: new Date().toISOString()
    };

    let result;
    if (existing) {
      // Atualizar existente
      const { data, error: updateError } = await supabase
        .schema('up_gestaointeligente')
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
        .schema('up_gestaointeligente')
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
      paginas: result.paginas ? (typeof result.paginas === 'string' ? JSON.parse(result.paginas) : result.paginas) : []
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
      ]
    }
  ];
}

module.exports = {
  getPermissoesConfig,
  atualizarPermissoesConfig
};

