import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import Avatar from './Avatar';
import TimerAtivo from './TimerAtivo';
import './UserProfile.css';

const UserProfile = () => {
  const { logout, usuario } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarImagePath, setAvatarImagePath] = useState(null);
  const menuRef = useRef(null);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Obter dados do usuário do localStorage ou do contexto
  const getUserData = () => {
    if (usuario) {
      return usuario;
    }
    
    try {
      const usuarioStorage = localStorage.getItem('usuario');
      if (usuarioStorage) {
        return JSON.parse(usuarioStorage);
      }
    } catch (error) {
      // Erro silencioso ao ler dados do localStorage
    }
    
    return null;
  };

  const userData = getUserData();

  if (!userData) {
    return null;
  }

  // Obter nome de exibição
  const getDisplayName = () => {
    return userData.nome_usuario || userData.email_usuario || 'Usuário';
  };

  // State para controlar se já tentamos buscar o avatar (evitar loops)
  const [hasTriedFetchAvatar, setHasTriedFetchAvatar] = useState(false);

  // Buscar caminho da imagem do avatar apenas se necessário (APENAS UMA VEZ)
  useEffect(() => {
    if (!userData) return;

    // Avatar é resolvido automaticamente pelo componente Avatar via Supabase Storage
    // Não precisamos mais buscar foto_perfil_path manualmente
  }, [userData?.foto_perfil]); // Usar apenas foto_perfil, não foto_perfil_path

  const handleAvatarClick = (e) => {
    e.stopPropagation(); // Evitar fechar o menu
    // Só abrir modal se for avatar de imagem (customizado ou padrão)
    const isImageAvatar = userData.foto_perfil && 
      (userData.foto_perfil.startsWith('image-') || userData.foto_perfil.startsWith('custom-'));
    
    if (isImageAvatar && avatarImagePath) {
      setShowAvatarModal(true);
    }
  };

  const handleConfiguracoes = () => {
    setIsMenuOpen(false);
    navigate('/configuracoes/perfil');
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  return (
    <div className="user-profile-container" ref={menuRef}>
      {/* Timer ativo ao lado do avatar */}
      <TimerAtivo />
      
      <button
        className="user-profile-button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Menu do usuário"
        aria-expanded={isMenuOpen}
      >
        <Avatar
          avatarId={userData.foto_perfil}
          nomeUsuario={getDisplayName()}
          size="normal"
        />
      </button>

      {isMenuOpen && (
        <div className="user-profile-menu">
          <div className="user-profile-menu-header">
            <div 
              className="user-avatar-clickable"
              onClick={handleAvatarClick}
              style={{ cursor: avatarImagePath ? 'pointer' : 'default' }}
            >
              <Avatar
                avatarId={userData.foto_perfil}
                nomeUsuario={getDisplayName()}
                size="menu"
              />
            </div>
            <div className="user-info">
              <div className="user-name">{getDisplayName()}</div>
              <div className="user-email">{userData.email_usuario || ''}</div>
            </div>
          </div>
          
          <div className="user-profile-menu-divider"></div>
          
          <button
            className="user-profile-menu-item"
            onClick={handleConfiguracoes}
          >
            <i className="fas fa-cog"></i>
            <span>Configurações</span>
          </button>
          
          <button
            className="user-profile-menu-item logout-button"
            onClick={handleLogout}
          >
            <i className="fas fa-sign-out-alt"></i>
            <span>Sair</span>
          </button>
        </div>
      )}

      {/* Modal para expandir avatar */}
      {showAvatarModal && (
        <div 
          className="avatar-expand-modal-overlay"
          onClick={() => setShowAvatarModal(false)}
        >
          <div 
            className="avatar-expand-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="avatar-expand-modal-close"
              onClick={() => setShowAvatarModal(false)}
              aria-label="Fechar"
            >
              <i className="fas fa-times"></i>
            </button>
            <img
              src={avatarImagePath}
              alt={getDisplayName()}
              className="avatar-expand-modal-image"
              onError={(e) => {
                // Prevenir tentativas repetidas
                if (!e.target.hasAttribute('data-error-handled')) {
                  e.target.setAttribute('data-error-handled', 'true');
                  e.target.style.display = 'none';
                }
              }}
              loading="lazy"
            />
            <div className="avatar-expand-modal-info">
              <div className="avatar-expand-modal-name">{getDisplayName()}</div>
              <div className="avatar-expand-modal-email">{userData.email_usuario || ''}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;

