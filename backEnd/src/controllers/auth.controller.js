// =============================================================
// === CONTROLLER DE AUTENTICAÇÃO ===
// =============================================================

const supabase = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar multer para upload de imagens
// Usar caminho absoluto baseado na raiz do projeto ou variável de ambiente
const getUploadPath = () => {
  // Tentar usar variável de ambiente primeiro (útil para Docker/produção)
  if (process.env.UPLOAD_AVATAR_PATH) {
    return process.env.UPLOAD_AVATAR_PATH;
  }
  
  // Em produção (Docker), usar caminho absoluto baseado no WORKDIR /app
  if (process.env.NODE_ENV === 'production') {
    // No Docker, o WORKDIR é /app, então o caminho deve ser absoluto
    return '/app/frontEnd/public/assets/images/avatars/custom';
  }
  
  // Fallback para caminho relativo (desenvolvimento local)
  return path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/custom');
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const uploadPath = getUploadPath();
      console.error('📂 Tentando usar caminho de upload:', uploadPath);
      
      // Criar pasta se não existir com permissões corretas (755 = rwxr-xr-x)
      if (!fs.existsSync(uploadPath)) {
        try {
          fs.mkdirSync(uploadPath, { recursive: true, mode: 0o755 });
          console.error('📁 Diretório de upload criado:', uploadPath);
        } catch (mkdirError) {
          console.error('❌ Erro ao criar diretório:', mkdirError);
          console.error('   Caminho:', uploadPath);
          console.error('   Erro:', mkdirError.message);
          console.error('   Code:', mkdirError.code);
          
          // Se for erro de permissão, dar mensagem mais clara
          if (mkdirError.code === 'EACCES' || mkdirError.code === 'EPERM') {
            return cb(new Error(`Sem permissão para criar diretório: ${uploadPath}. Verifique as permissões do volume Docker.`));
          }
          return cb(mkdirError);
        }
      }
      
      // Verificar se o diretório é acessível para escrita
      try {
        fs.accessSync(uploadPath, fs.constants.W_OK);
        console.error('✅ Diretório acessível para escrita:', uploadPath);
      } catch (accessError) {
        console.error('❌ Erro: Diretório sem permissão de escrita:', uploadPath);
        console.error('   Erro:', accessError.message);
        return cb(new Error(`Diretório sem permissão de escrita: ${uploadPath}. Verifique as permissões do volume Docker.`));
      }
      
      cb(null, uploadPath);
    } catch (error) {
      console.error('❌ Erro ao configurar diretório de upload:', error);
      console.error('   Stack:', error.stack);
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    try {
      // Nome do arquivo: custom-{userId}-{timestamp}.{extensão}
      const userId = req.session?.usuario?.id || 'unknown';
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      cb(null, `custom-${userId}-${timestamp}${ext}`);
    } catch (error) {
      console.error('❌ Erro ao gerar nome do arquivo:', error);
      cb(error);
    }
  }
});

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
  storage: storage,
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
    const { data: usuarios, error } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .select('id, email_usuario, senha_login, nome_usuario, foto_perfil')
      .eq('email_usuario', email.toLowerCase().trim())
      .limit(1);

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

    

    // Se for avatar customizado, buscar o caminho completo da imagem
    let fotoPerfilCompleto = usuario.foto_perfil;
    if (usuario.foto_perfil && usuario.foto_perfil.startsWith('custom-')) {
      const userId = usuario.foto_perfil.replace('custom-', '');
      const customDir = path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/custom');
      
      if (fs.existsSync(customDir)) {
        const files = fs.readdirSync(customDir);
        const userFiles = files.filter(file => file.startsWith(`custom-${userId}-`));
        
        if (userFiles.length > 0) {
          // Ordenar por timestamp (mais recente primeiro)
          userFiles.sort((a, b) => {
            const timestampA = parseInt(a.match(/-(\d+)\./)?.[1] || '0');
            const timestampB = parseInt(b.match(/-(\d+)\./)?.[1] || '0');
            return timestampB - timestampA;
          });
          
          const latestFile = userFiles[0];
          fotoPerfilCompleto = `/assets/images/avatars/custom/${latestFile}`;
        }
      }
    }

    // Criar sessão do usuário
    req.session.usuario = {
      id: usuario.id,
      email_usuario: usuario.email_usuario,
      nome_usuario: usuario.nome_usuario,
      foto_perfil: usuario.foto_perfil || null,
      foto_perfil_path: fotoPerfilCompleto !== usuario.foto_perfil ? fotoPerfilCompleto : null
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

      // Retornar dados do usuário (sem a senha)
      const { senha_login: _, ...usuarioSemSenha } = usuario;
      
      // Adicionar caminho completo se for customizado
      if (fotoPerfilCompleto !== usuario.foto_perfil) {
        usuarioSemSenha.foto_perfil_path = fotoPerfilCompleto;
      }

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
      // Buscar dados atualizados do usuário do banco (incluindo foto_perfil)
      const { data: usuarioAtualizado, error: userError } = await supabase
        .schema('up_gestaointeligente')
        .from('usuarios')
        .select('id, email_usuario, nome_usuario, foto_perfil')
        .eq('id', req.session.usuario.id)
        .maybeSingle();

      if (userError) {
        console.error('Erro ao buscar usuário no checkAuth:', userError);
        // Se der erro, retornar dados da sessão mesmo assim
        return res.json({
          authenticated: true,
          usuario: req.session.usuario
        });
      }

      if (usuarioAtualizado) {
        // Se for avatar customizado, buscar o caminho completo da imagem
        let fotoPerfilCompleto = usuarioAtualizado.foto_perfil;
        try {
          if (usuarioAtualizado.foto_perfil && usuarioAtualizado.foto_perfil.startsWith('custom-')) {
            const userId = usuarioAtualizado.foto_perfil.replace('custom-', '');
            const customDir = getUploadPath();
            
            try {
              if (fs.existsSync(customDir)) {
                try {
                  const files = fs.readdirSync(customDir);
                  const userFiles = files.filter(file => file.startsWith(`custom-${userId}-`));
                  
                  if (userFiles.length > 0) {
                    // Ordenar por timestamp (mais recente primeiro)
                    userFiles.sort((a, b) => {
                      const timestampA = parseInt(a.match(/-(\d+)\./)?.[1] || '0');
                      const timestampB = parseInt(b.match(/-(\d+)\./)?.[1] || '0');
                      return timestampB - timestampA;
                    });
                    
                    const latestFile = userFiles[0];
                    fotoPerfilCompleto = `/assets/images/avatars/custom/${latestFile}`;
                  }
                } catch (readError) {
                  // Erro ao ler diretório - usar foto_perfil original
                  console.error('Erro ao ler diretório de avatares customizados:', readError);
                  fotoPerfilCompleto = usuarioAtualizado.foto_perfil;
                }
              }
            } catch (existsError) {
              // Erro ao verificar existência do diretório - usar foto_perfil original
              console.error('Erro ao verificar diretório de avatares customizados:', existsError);
              fotoPerfilCompleto = usuarioAtualizado.foto_perfil;
            }
          }
        } catch (fileError) {
          // Se houver erro ao processar arquivo, usar foto_perfil original
          console.error('Erro ao processar foto de perfil:', fileError);
          fotoPerfilCompleto = usuarioAtualizado.foto_perfil;
        }
        
        // Atualizar sessão com dados do banco
        req.session.usuario = {
          id: usuarioAtualizado.id,
          email_usuario: usuarioAtualizado.email_usuario,
          nome_usuario: usuarioAtualizado.nome_usuario,
          foto_perfil: usuarioAtualizado.foto_perfil || null,
          foto_perfil_path: fotoPerfilCompleto !== usuarioAtualizado.foto_perfil ? fotoPerfilCompleto : null
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

    // Se for avatar customizado, buscar o caminho completo da imagem e limpar fotos antigas
    let fotoPerfilCompleto = usuarioAtualizado.foto_perfil;
    if (usuarioAtualizado.foto_perfil && usuarioAtualizado.foto_perfil.startsWith('custom-')) {
      const userIdFromAvatar = usuarioAtualizado.foto_perfil.replace('custom-', '');
      const customDir = getUploadPath();
      
      if (fs.existsSync(customDir)) {
        const files = fs.readdirSync(customDir);
        const userFiles = files.filter(file => file.startsWith(`custom-${userIdFromAvatar}-`));
        
        if (userFiles.length > 0) {
          // Ordenar por timestamp (mais recente primeiro)
          userFiles.sort((a, b) => {
            const timestampA = parseInt(a.match(/-(\d+)\./)?.[1] || '0');
            const timestampB = parseInt(b.match(/-(\d+)\./)?.[1] || '0');
            return timestampB - timestampA;
          });
          
          const latestFile = userFiles[0];
          fotoPerfilCompleto = `/assets/images/avatars/custom/${latestFile}`;
          
          // Deletar fotos antigas (manter apenas a mais recente)
          if (userFiles.length > 1) {
            for (let i = 1; i < userFiles.length; i++) {
              const oldFilePath = path.join(customDir, userFiles[i]);
              if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
                console.log(`🗑️ Foto antiga removida: ${userFiles[i]}`);
              }
            }
          }
        }
      }
      
      // Se estava usando outro avatar customizado antes, limpar fotos antigas
      if (usuarioExistente.foto_perfil && usuarioExistente.foto_perfil.startsWith('custom-') && 
          usuarioExistente.foto_perfil !== usuarioAtualizado.foto_perfil) {
        const oldUserId = usuarioExistente.foto_perfil.replace('custom-', '');
        if (oldUserId !== userIdFromAvatar.toString()) {
          const customDir = getUploadPath();
          if (fs.existsSync(customDir)) {
            const files = fs.readdirSync(customDir);
            files.forEach(file => {
              if (file.startsWith(`custom-${oldUserId}-`)) {
                const oldFilePath = path.join(customDir, file);
                if (fs.existsSync(oldFilePath)) {
                  fs.unlinkSync(oldFilePath);
                  console.log(`🗑️ Foto antiga removida (mudança de avatar): ${file}`);
                }
              }
            });
          }
        }
      }
    }

    // Atualizar sessão com os novos dados
    req.session.usuario = {
      id: usuarioAtualizado.id,
      email_usuario: usuarioAtualizado.email_usuario,
      nome_usuario: usuarioAtualizado.nome_usuario,
      foto_perfil: usuarioAtualizado.foto_perfil || null,
      foto_perfil_path: fotoPerfilCompleto !== usuarioAtualizado.foto_perfil ? fotoPerfilCompleto : null
    };

    // Adicionar caminho completo ao objeto de retorno
    const usuarioRetorno = { ...usuarioAtualizado };
    if (fotoPerfilCompleto !== usuarioAtualizado.foto_perfil) {
      usuarioRetorno.foto_perfil_path = fotoPerfilCompleto;
    }

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
  let uploadedFilePath = null;
  
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
    console.error(`📂 Caminho salvo: ${req.file.path}`);

    // Verificar se o arquivo foi realmente salvo
    uploadedFilePath = req.file.path;
    if (!fs.existsSync(uploadedFilePath)) {
      console.error('❌ Erro: Arquivo não foi salvo corretamente:', uploadedFilePath);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar arquivo no servidor'
      });
    }

    // Ajustar permissões do arquivo para que nginx possa ler (644 = rw-r--r--)
    try {
      fs.chmodSync(uploadedFilePath, 0o644);
      console.error('✅ Permissões do arquivo ajustadas para leitura pública');
    } catch (chmodError) {
      console.error('⚠️ Aviso: Não foi possível ajustar permissões do arquivo:', chmodError.message);
      // Não falhar o upload por causa disso, apenas avisar
    }

    // Caminho relativo da imagem (acessível pelo frontend)
    const imagePath = `/assets/images/avatars/custom/${req.file.filename}`;
    
    // ID único para a imagem customizada
    const customAvatarId = `custom-${userId}`;

    console.error('🔍 Buscando dados do usuário no banco...');
    
    // NÃO atualizar o banco de dados aqui - apenas salvar o arquivo
    // A atualização do banco será feita quando o usuário clicar em "Salvar Alterações"
    // Buscar dados do usuário apenas para retornar na resposta
    const { data: usuarioAtual, error: userError } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .select('id, email_usuario, nome_usuario, foto_perfil')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
      
      // Se der erro ao buscar usuário, deletar a imagem enviada
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
          console.error('🗑️ Arquivo deletado devido a erro no banco');
        } catch (unlinkError) {
          console.error('⚠️ Erro ao deletar arquivo:', unlinkError);
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar upload',
        details: userError.message
      });
    }

    console.error('✅ Upload concluído com sucesso');

    // Retornar dados com o ID do avatar customizado (mas sem atualizar o banco ainda)
    res.json({
      success: true,
      message: 'Foto carregada com sucesso. Clique em "Salvar Alterações" para confirmar.',
      usuario: {
        ...usuarioAtual,
        foto_perfil: customAvatarId // ID temporário para preview
      },
      imagePath: imagePath
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao fazer upload de avatar:', error);
    console.error('Stack trace:', error.stack);
    
    // Deletar arquivo se foi criado
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
        console.error('🗑️ Arquivo deletado devido a erro');
      } catch (unlinkError) {
        console.error('⚠️ Erro ao deletar arquivo:', unlinkError);
      }
    } else if (req.file && req.file.path) {
      // Fallback: tentar deletar usando req.file.path
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (unlinkError) {
        console.error('⚠️ Erro ao deletar arquivo (fallback):', unlinkError);
      }
    }
    
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
    const customDir = getUploadPath();
    
    if (!fs.existsSync(customDir)) {
      return res.json({
        success: false,
        imagePath: null
      });
    }

    const files = fs.readdirSync(customDir);
    const userFiles = files.filter(file => file.startsWith(`custom-${userId}-`));
    
    if (userFiles.length === 0) {
      return res.json({
        success: false,
        imagePath: null
      });
    }

    // Ordenar por timestamp (mais recente primeiro)
    userFiles.sort((a, b) => {
      const timestampA = parseInt(a.match(/-(\d+)\./)?.[1] || '0');
      const timestampB = parseInt(b.match(/-(\d+)\./)?.[1] || '0');
      return timestampB - timestampA;
    });

    const latestFile = userFiles[0];
    const imagePath = `/assets/images/avatars/custom/${latestFile}`;

    res.json({
      success: true,
      imagePath: imagePath
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

module.exports = {
  login,
  logout,
  checkAuth,
  updateProfile,
  uploadAvatar,
  getCustomAvatarPath,
  upload // Exportar multer para usar nas rotas
};

