/**
 * Componente Avatar Reutilizável
 * 
 * Exibe o avatar de um usuário baseado no ID armazenado na coluna foto_perfil
 * 
 * @param {string} avatarId - ID do avatar (ex: 'color-blue', 'image-lobo')
 * @param {string} nomeUsuario - Nome do usuário (para exibir iniciais em avatares de cor)
 * @param {string} size - Tamanho do avatar: 'small' | 'normal' | 'large' | 'menu'
 * @param {string} className - Classes CSS adicionais
 */

import React, { useState, useEffect } from 'react';
import { isColorAvatar, isImageAvatar, isCustomAvatar, getAvatarColor, getAvatarImagePath, getInitialsFromName, DEFAULT_AVATAR } from '../../utils/avatars';
import { authAPI } from '../../services/api';
import './Avatar.css';

const Avatar = ({ 
  avatarId, 
  nomeUsuario = '', 
  size = 'normal',
  className = '',
  customImagePath = null // Caminho completo da imagem customizada (opcional)
}) => {
  // Usar avatar padrão se não fornecido
  const fotoPerfil = avatarId || DEFAULT_AVATAR;
  
  // Debug: log do avatarId recebido
  if (process.env.NODE_ENV === 'development') {
    console.log('🎨 Avatar - avatarId recebido:', avatarId, '| Usando:', fotoPerfil);
  }

  // Determinar tipo e configuração do avatar
  let avatarConfig = null;
  
  if (isColorAvatar(fotoPerfil)) {
    const colorConfig = getAvatarColor(fotoPerfil);
    avatarConfig = {
      type: 'color',
      gradient: colorConfig ? colorConfig.gradient : 'linear-gradient(135deg, #4a90e2, #357abd)',
      initials: getInitialsFromName(nomeUsuario)
    };
  } else if (isCustomAvatar(fotoPerfil)) {
    // Avatar customizado - será resolvido via state
    const userId = fotoPerfil.replace('custom-', '');
    avatarConfig = {
      type: 'custom',
      path: null, // Será buscado via API
      userId: userId
    };
  } else if (isImageAvatar(fotoPerfil)) {
    const imagePath = getAvatarImagePath(fotoPerfil);
    avatarConfig = {
      type: 'image',
      path: imagePath
    };
  } else {
    // Fallback para avatar padrão
    avatarConfig = {
      type: 'color',
      gradient: 'linear-gradient(135deg, #4a90e2, #357abd)',
      initials: getInitialsFromName(nomeUsuario)
    };
  }

  // State para armazenar o caminho da imagem customizada
  const [customImagePathState, setCustomImagePathState] = useState(customImagePath);
  const [loadingCustomImage, setLoadingCustomImage] = useState(false);

  // Usar o caminho fornecido como prop ou buscar via API
  useEffect(() => {
    if (customImagePath) {
      setCustomImagePathState(customImagePath);
    } else if (avatarConfig?.type === 'custom' && !customImagePathState && !loadingCustomImage) {
      setLoadingCustomImage(true);
      authAPI.getCustomAvatarPath()
        .then(result => {
          if (result.success && result.imagePath) {
            setCustomImagePathState(result.imagePath);
          }
        })
        .catch(error => {
          console.error('Erro ao buscar caminho do avatar customizado:', error);
        })
        .finally(() => {
          setLoadingCustomImage(false);
        });
    }
  }, [avatarConfig?.type, customImagePath, customImagePathState, loadingCustomImage]);

  // Classes CSS baseadas no tamanho
  const sizeClass = `avatar-${size}`;
  const baseClass = `user-avatar ${sizeClass} ${className}`.trim();

  if (avatarConfig.type === 'image' || avatarConfig.type === 'custom') {
    // Para avatar customizado, usar o caminho buscado via API ou fornecido como prop
    let imagePath = avatarConfig.type === 'custom' ? customImagePathState : avatarConfig.path;
    
    // Se ainda não temos o caminho e é customizado, mostrar loading ou fallback
    if (avatarConfig.type === 'custom' && !imagePath && loadingCustomImage) {
      // Mostrar iniciais enquanto carrega
      return (
        <div
          className={baseClass}
          style={{ background: 'linear-gradient(135deg, #4a90e2, #357abd)' }}
        >
          {getInitialsFromName(nomeUsuario)}
        </div>
      );
    }
    
    // Se não temos caminho para customizado, tentar construir
    if (avatarConfig.type === 'custom' && !imagePath) {
      // Tentar diferentes extensões como fallback
      const userId = avatarConfig.userId;
      const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      // Por enquanto, tentar jpg primeiro
      imagePath = `/assets/images/avatars/custom/custom-${userId}-${Date.now()}.jpg`;
    }
    
    return (
      <div className={`${baseClass} user-avatar-image`}>
        <img
          src={imagePath}
          alt={nomeUsuario || 'Avatar'}
          onError={(e) => {
            // Fallback para avatar com iniciais se a imagem não carregar
            const fallbackGradient = 'linear-gradient(135deg, #4a90e2, #357abd)';
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = getInitialsFromName(nomeUsuario);
            e.target.parentElement.style.background = fallbackGradient;
            e.target.parentElement.classList.remove('user-avatar-image');
          }}
        />
      </div>
    );
  } else {
    return (
      <div
        className={baseClass}
        style={{ background: avatarConfig.gradient }}
      >
        {avatarConfig.initials}
      </div>
    );
  }
};

export default Avatar;

