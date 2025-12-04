// =============================================================
// === CONTROLLER DE AUTENTICAÇÃO ===
// =============================================================

const supabase = require('../config/database');

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
      .select('id, email_usuario, senha_login, nome_usuario')
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

function checkAuth(req, res) {
  try {
    
    
    if (req.session && req.session.usuario) {
      
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
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        authenticated: false,
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }
}

module.exports = {
  login,
  logout,
  checkAuth
};

