// =============================================================
// === CONTROLLER DE AUTENTICAÇÃO ===
// =============================================================

const supabase = require('../config/database');
const multer = require('multer');
const path = require('path');
const { uploadImageToStorage, deleteImageFromStorage, resolveAvatarUrl } = require('../utils/storage');

// Filtro para aceitar apenas imagens
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas (JPEG, JPG, PNG, GIF, WEBP)'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(), // Usar memória para enviar para Supabase Storage
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB máximo
  },
  fileFilter: fileFilter
});

async function login(req, res) {
  try {
    
    
    const { email, senha } = req.body;
    
    
    
    if (!email || !senha) {
      
      return res.status(400).json({
        success: false,
        error: 'Email e senha são obrigatórios'
      });
    }

    // Buscar usuário na tabela usuarios do schema up_gestaointeligente
    let usuarios = null;
    let error = null;
    
    try {
      const result = await supabase
        .schema('up_gestaointeligente')
        .from('usuarios')
        .select('id, email_usuario, senha_login, nome_usuario, foto_perfil, permissoes')
        .eq('email_usuario', email.toLowerCase().trim())
        .limit(1);
      
      usuarios = result.data;
      error = result.error;
    } catch (selectError) {
      // Se der erro ao fazer select (ex: coluna permissoes não existe), tentar sem
      console.error('Erro ao buscar usuário com permissoes, tentando sem:', selectError);
      try {
        const resultFallback = await supabase
          .schema('up_gestaointeligente')
          .from('usuarios')
          .select('id, email_usuario, senha_login, nome_usuario, foto_perfil')
          .eq('email_usuario', email.toLowerCase().trim())
          .limit(1);
        
        usuarios = resultFallback.data;
        error = resultFallback.error;
        
        // Se conseguiu buscar sem permissoes, adicionar null
        if (usuarios && usuarios.length > 0) {
          usuarios[0].permissoes = null;
        }
      } catch (fallbackError) {
        console.error('Erro ao buscar usuário no login (fallback):', fallbackError);
        error = fallbackError;
      }
    }

    if (error) {
      console.error('Erro ao buscar usuário:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }

    // Verificar se usuário existe
    if (!usuarios || usuarios.length === 0) {
      
      return res.status(401).json({
        success: false,
        error: 'Login não cadastrado, entre em contato com o desenvolvedor'
      });
    }

    const usuario = usuarios[0];
    
    

    // Verificar senha (comparação simples - em produção usar hash)
    if (usuario.senha_login !== senha) {
      
      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
      });
    }

    // Resolver foto_perfil: se for custom-{id}, buscar URL no Storage usando metadados
    let fotoPerfilUrl = usuario.foto_perfil;
    if (usuario.foto_perfil && usuario.foto_perfil.startsWith('custom-')) {
      const resolvedUrl = await resolveAvatarUrl(usuario.foto_perfil, 'user');
      if (resolvedUrl) {
        fotoPerfilUrl = resolvedUrl;
      }
    }

    // Criar sessão do usuário
    req.session.usuario = {
      id: usuario.id,
      email_usuario: usuario.email_usuario,
      nome_usuario: usuario.nome_usuario,
      foto_perfil: fotoPerfilUrl || null, // URL resolvida usando metadados
      permissoes: usuario.permissoes !== undefined ? usuario.permissoes : null
    };

    // Salvar sessão explicitamente para garantir que o cookie seja definido
    req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar sessão:', err);
        return res.status(500).json({
          success: false,
          error: 'Erro ao criar sessão'
        });
      }

      // Retornar dados do usuário (sem a senha) com foto_perfil resolvida
      const { senha_login: _, ...usuarioSemSenha } = usuario;

      // Garantir que permissoes esteja presente
      if (!usuarioSemSenha.permissoes) {
        usuarioSemSenha.permissoes = null;
      }

      usuarioSemSenha.foto_perfil = fotoPerfilUrl || usuario.foto_perfil;


      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        usuario: usuarioSemSenha
      });
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

function logout(req, res) {
  try {
    if (!req.session) {
      return res.json({ success: true });
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Erro ao destruir sessão:', err);
        return res.status(500).json({
          success: false,
          error: 'Erro ao fazer logout'
        });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

async function checkAuth(req, res) {
  try {
    // Verificar se a sessão existe
    if (!req.session) {
      return res.json({
        authenticated: false
      });
    }

      if (req.session.usuario) {
      // Buscar dados atualizados do usuário do banco (incluindo foto_perfil e permissoes)
      let usuarioAtualizado = null;
      let userError = null;
      
      try {
        const result = await supabase
          .schema('up_gestaointeligente')
          .from('usuarios')
          .select('id, email_usuario, nome_usuario, foto_perfil, permissoes')
          .eq('id', req.session.usuario.id)
          .maybeSingle();
        
        usuarioAtualizado = result.data;
        userError = result.error;
      } catch (selectError) {
        // Se der erro ao fazer select (ex: coluna não existe), tentar sem permissoes
        console.error('Erro ao buscar usuário com permissoes, tentando sem:', selectError);
        try {
          const resultFallback = await supabase
            .schema('up_gestaointeligente')
            .from('usuarios')
            .select('id, email_usuario, nome_usuario, foto_perfil')
            .eq('id', req.session.usuario.id)
            .maybeSingle();
          
          usuarioAtualizado = resultFallback.data;
          userError = resultFallback.error;
          
          // Se conseguiu buscar sem permissoes, adicionar null
          if (usuarioAtualizado) {
            usuarioAtualizado.permissoes = null;
          }
        } catch (fallbackError) {
          console.error('Erro ao buscar usuário no checkAuth (fallback):', fallbackError);
          userError = fallbackError;
        }
      }

      if (userError) {
        console.error('Erro ao buscar usuário no checkAuth:', userError);
        // Se der erro, retornar dados da sessão mesmo assim
        return res.json({
          authenticated: true,
          usuario: req.session.usuario
        });
      }

      if (usuarioAtualizado) {
        // Resolver foto_perfil: se for custom-{id}, buscar URL no Storage usando metadados
        let fotoPerfilUrl = usuarioAtualizado.foto_perfil;
        if (usuarioAtualizado.foto_perfil && usuarioAtualizado.foto_perfil.startsWith('custom-')) {
          const resolvedUrl = await resolveAvatarUrl(usuarioAtualizado.foto_perfil, 'user');
          if (resolvedUrl) {
            fotoPerfilUrl = resolvedUrl;
          }
        }

        // Atualizar sessão com dados do banco
        req.session.usuario = {
          id: usuarioAtualizado.id,
          email_usuario: usuarioAtualizado.email_usuario,
          nome_usuario: usuarioAtualizado.nome_usuario,
          foto_perfil: fotoPerfilUrl || null, // URL resolvida usando metadados
          permissoes: usuarioAtualizado.permissoes !== undefined ? usuarioAtualizado.permissoes : null
        };
      }

      return res.json({
        authenticated: true,
        usuario: req.session.usuario
      });
    } else {
      return res.json({
        authenticated: false
      });
    }
  } catch (error) {
    // Garantir que sempre retornamos JSON válido
    console.error('❌ Erro no checkAuth:', error);
    console.error('   Stack:', error.stack);
    console.error('   Message:', error.message);
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        authenticated: false,
        error: 'Erro interno do servidor',
        message: error.message || 'Erro desconhecido'
      });
    } else {
      console.error('⚠️ Resposta já foi enviada, não é possível retornar erro');
    }
  }
}

async function updateProfile(req, res) {
  try {
    // Verificar se o usuário está autenticado
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Faça login primeiro.'
      });
    }

    const userId = req.session.usuario.id;
    const { nome_usuario, foto_perfil, senha_atual, senha_nova } = req.body;

    // Preparar dados para atualização
    const dadosUpdate = {};

    // Atualizar nome de usuário se fornecido
    if (nome_usuario !== undefined && nome_usuario !== null) {
      const nomeTrimmed = nome_usuario.trim();
      if (!nomeTrimmed || nomeTrimmed.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Nome de usuário deve ter pelo menos 2 caracteres'
        });
      }
      dadosUpdate.nome_usuario = nomeTrimmed;
    }

    // Atualizar foto de perfil se fornecida
    if (foto_perfil !== undefined && foto_perfil !== null) {
      dadosUpdate.foto_perfil = foto_perfil.trim();
    }

    // Atualizar senha se fornecida
    if (senha_nova !== undefined && senha_nova !== null && senha_nova.trim() !== '') {
      console.log('🔐 Tentativa de alterar senha para usuário ID:', userId);
      
      // Validar que a senha atual foi fornecida
      if (!senha_atual || !senha_atual.trim()) {
        console.log('❌ Senha atual não fornecida');
        return res.status(400).json({
          success: false,
          error: 'Senha atual é obrigatória para alterar a senha'
        });
      }

      // Validar tamanho da nova senha
      if (senha_nova.trim().length < 6) {
        console.log('❌ Nova senha muito curta');
        return res.status(400).json({
          success: false,
          error: 'Nova senha deve ter pelo menos 6 caracteres'
        });
      }

      // Buscar usuário para verificar senha atual
      const { data: usuarioComSenha, error: senhaError } = await supabase
        .schema('up_gestaointeligente')
        .from('usuarios')
        .select('id, senha_login')
        .eq('id', userId)
        .maybeSingle();

      if (senhaError) {
        console.error('❌ Erro ao buscar usuário para validar senha:', senhaError);
        return res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }

      if (!usuarioComSenha) {
        console.log('❌ Usuário não encontrado');
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Verificar se a senha atual está correta
      const senhaAtualFornecida = senha_atual.trim();
      const senhaAtualBanco = usuarioComSenha.senha_login;
      
      console.log('🔍 Validando senha atual...');
      console.log('   Senha fornecida:', senhaAtualFornecida ? '***' : '(vazia)');
      console.log('   Senha no banco:', senhaAtualBanco ? '***' : '(vazia)');
      console.log('   Senhas coincidem:', senhaAtualBanco === senhaAtualFornecida);
      
      if (senhaAtualBanco !== senhaAtualFornecida) {
        console.log('❌ Senha atual incorreta!');
        return res.status(401).json({
          success: false,
          error: 'Senha atual incorreta'
        });
      }

      console.log('✅ Senha atual válida, permitindo alteração');
      // Se chegou aqui, a senha atual está correta, pode atualizar
      dadosUpdate.senha_login = senha_nova.trim();
    }

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    // Verificar se o usuário existe
    const { data: usuarioExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .select('id, email_usuario, nome_usuario, foto_perfil')
      .eq('id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Erro ao buscar usuário:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }

    if (!usuarioExistente) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Atualizar no banco de dados
    const dadosUpdateFinal = { ...dadosUpdate };

    const { data: usuarioAtualizado, error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .update(dadosUpdateFinal)
      .eq('id', userId)
      .select('id, email_usuario, nome_usuario, foto_perfil')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar perfil',
        details: updateError.message
      });
    }

    // Resolver foto_perfil: se for custom-{id}, buscar URL no Storage usando metadados
    let fotoPerfilUrl = usuarioAtualizado.foto_perfil;
    if (usuarioAtualizado.foto_perfil && usuarioAtualizado.foto_perfil.startsWith('custom-')) {
      const resolvedUrl = await resolveAvatarUrl(usuarioAtualizado.foto_perfil, 'user');
      if (resolvedUrl) {
        fotoPerfilUrl = resolvedUrl;
      }
    }

    // Atualizar sessão com os novos dados
    req.session.usuario = {
      id: usuarioAtualizado.id,
      email_usuario: usuarioAtualizado.email_usuario,
      nome_usuario: usuarioAtualizado.nome_usuario,
      foto_perfil: fotoPerfilUrl || null // URL resolvida usando metadados
    };

    // Retornar usuário atualizado com foto_perfil resolvida
    const usuarioRetorno = { ...usuarioAtualizado };
    usuarioRetorno.foto_perfil = fotoPerfilUrl || usuarioAtualizado.foto_perfil;

    console.log('✅ Perfil atualizado com sucesso para usuário:', usuarioAtualizado.email_usuario);

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      usuario: usuarioRetorno
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

async function uploadAvatar(req, res) {
  try {
    console.error('📤 Iniciando upload de avatar...');
    
    // Verificar se o usuário está autenticado
    if (!req.session || !req.session.usuario) {
      console.error('❌ Upload negado: usuário não autenticado');
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Faça login primeiro.'
      });
    }

    const userId = req.session.usuario.id;
    console.error(`👤 Upload para usuário ID: ${userId}`);

    if (!req.file) {
      console.error('❌ Upload negado: nenhum arquivo enviado');
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada'
      });
    }

    console.error(`📁 Arquivo recebido: ${req.file.originalname} (${req.file.size} bytes)`);

    // Buscar dados do usuário primeiro para validar
    const { data: usuarioAtual, error: userError } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .select('id, email_usuario, nome_usuario, foto_perfil')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar upload',
        details: userError.message
      });
    }

    // Preparar nome do arquivo para o Supabase Storage
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `user-${userId}-${timestamp}${ext}`;
    const bucketName = 'avatars';

    // Fazer upload para Supabase Storage com metadados
    const uploadResult = await uploadImageToStorage(
      req.file.buffer,
      bucketName,
      fileName,
      req.file.mimetype,
      { entityId: userId, entityType: 'user' } // Metadados para busca
    );

    // Salvar identificador customizado no banco (custom-{id}) ao invés da URL completa
    const customAvatarId = `custom-${userId}`;
    
    const { error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .update({ foto_perfil: customAvatarId })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Erro ao atualizar foto_perfil no banco:', updateError);
      // Tentar deletar o arquivo do storage se falhar
      await deleteImageFromStorage(bucketName, fileName);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar foto no banco de dados',
        details: updateError.message
      });
    }

    console.error('✅ Upload concluído com sucesso');

    // Retornar dados com o identificador customizado e a URL para preview
    res.json({
      success: true,
      message: 'Foto carregada e salva com sucesso.',
      usuario: {
        ...usuarioAtual,
        foto_perfil: customAvatarId // Identificador customizado
      },
      imagePath: uploadResult.publicUrl // URL pública para preview imediato
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao fazer upload de avatar:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

async function getCustomAvatarPath(req, res) {
  try {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Faça login primeiro.'
      });
    }

    const userId = req.session.usuario.id;
    const customId = `custom-${userId}`;

    // Buscar URL do avatar customizado no Supabase Storage usando metadados
    const avatarUrl = await resolveAvatarUrl(customId, 'user');

    if (!avatarUrl) {
      return res.json({
        success: false,
        imagePath: null
      });
    }

    res.json({
      success: true,
      imagePath: avatarUrl
    });
  } catch (error) {
    console.error('Erro ao buscar caminho do avatar customizado:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar preferência de modo de visualização do painel
async function getPreferenciaViewMode(req, res) {
  try {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado'
      });
    }

    const userId = req.session.usuario.id;

    const { data: usuario, error } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .select('view_modelo_painel')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar preferência de visualização:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar preferência'
      });
    }

    // Retornar o modo salvo ou 'quadro' como padrão
    const modo = usuario?.view_modelo_painel || 'quadro';

    return res.json({
      success: true,
      data: { modo }
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar preferência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

// PUT - Salvar preferência de modo de visualização do painel
async function updatePreferenciaViewMode(req, res) {
  try {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado'
      });
    }

    const userId = req.session.usuario.id;
    const { modo } = req.body;

    // Validar que o modo é válido
    if (modo !== 'quadro' && modo !== 'lista') {
      return res.status(400).json({
        success: false,
        error: 'Modo inválido. Deve ser "quadro" ou "lista"'
      });
    }

    // Atualizar ou inserir a preferência
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .update({ view_modelo_painel: modo })
      .eq('id', userId)
      .select('view_modelo_painel')
      .single();

    if (error) {
      console.error('Erro ao salvar preferência de visualização:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar preferência',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Preferência salva com sucesso',
      data: { modo: data.view_modelo_painel }
    });
  } catch (error) {
    console.error('Erro inesperado ao salvar preferência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

module.exports = {
  login,
  logout,
  checkAuth,
  updateProfile,
  uploadAvatar,
  getCustomAvatarPath,
  getPreferenciaViewMode,
  updatePreferenciaViewMode,
  upload // Exportar multer para usar nas rotas
};

