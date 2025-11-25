// =============================================================
// === CONTROLLER DE AUTENTICAÇÃO ===
// =============================================================

const supabase = require('../config/database');

async function login(req, res) {
  try {
    console.log('🔍 DEBUG LOGIN - req.body completo:', JSON.stringify(req.body, null, 2));
    
    const { email, senha } = req.body;
    
    console.log('🔍 DEBUG LOGIN - email extraído:', email);
    console.log('🔍 DEBUG LOGIN - senha extraída:', senha ? '[SENHA FORNECIDA]' : '[SENHA VAZIA]');
    
    if (!email || !senha) {
      console.log('❌ DEBUG LOGIN - Validação falhou: email=', email, 'senha=', senha ? '[FORNECIDA]' : '[VAZIA]');
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
      console.log('Usuário não encontrado:', email);
      return res.status(401).json({
        success: false,
        error: 'Login não cadastrado, entre em contato com o desenvolvedor'
      });
    }

    const usuario = usuarios[0];
    
    console.log('🔍 DEBUG LOGIN - Usuário encontrado:', JSON.stringify({ id: usuario.id, email: usuario.email_usuario, nome: usuario.nome_usuario }, null, 2));

    // Verificar senha (comparação simples - em produção usar hash)
    if (usuario.senha_login !== senha) {
      console.log('❌ DEBUG LOGIN - Senha incorreta para usuário:', email);
      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
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
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

function logout(req, res) {
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
}

function checkAuth(req, res) {
  if (req.session && req.session.usuario) {
    res.json({
      authenticated: true,
      usuario: req.session.usuario
    });
  } else {
    res.json({
      authenticated: false
    });
  }
}

module.exports = {
  login,
  logout,
  checkAuth
};

