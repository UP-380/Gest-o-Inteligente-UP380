import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import Avatar from './Avatar';
import './UserProfile.css';

const UserProfile = () => {
  const { logout, usuario } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarImagePath, setAvatarImagePath] = useState(null);
  const [isInHeader, setIsInHeader] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

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


  // Fechar menu ao clicar fora (especialmente importante quando está no header)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      // Usar setTimeout para garantir que o evento seja adicionado após o render
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

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
    <div 
      className={`user-profile-container ${isMenuOpen ? 'menu-open' : ''}`}
      ref={menuRef}
    >
      {/* Header do perfil - apenas avatar quando no header e fechado */}
      <div 
        className="user-profile-menu-header"
        onClick={(e) => {
          e.stopPropagation();
          setIsMenuOpen(!isMenuOpen);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div 
          className="user-avatar-clickable"
          style={{ cursor: 'pointer' }}
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
        <i 
          className={`fas fa-chevron-down user-profile-chevron ${isMenuOpen ? 'expanded' : ''}`}
        ></i>
      </div>
      
      {/* Menu expandido - mesma lógica para mobile e desktop, CSS controla visualização */}
      {isMenuOpen && (
        <>
          {/* Header do dropdown (apenas no desktop/header) */}
          <div className="user-profile-dropdown-header">
            <div className="user-profile-dropdown-avatar">
              <Avatar
                avatarId={userData.foto_perfil}
                nomeUsuario={getDisplayName()}
                size="menu"
              />
            </div>
            <div className="user-profile-dropdown-info">
              <div className="user-profile-dropdown-name">{getDisplayName()}</div>
              <div className="user-profile-dropdown-email">{userData.email_usuario || ''}</div>
            </div>
          </div>
          
          {/* Menu com botões */}
          <div className="user-profile-menu-expanded">
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
        </>
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

