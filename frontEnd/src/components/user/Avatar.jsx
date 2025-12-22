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
  const [hasTriedFetch, setHasTriedFetch] = useState(false); // Flag para evitar requisições repetidas
  const [imageLoaded, setImageLoaded] = useState(false); // Flag para controlar quando a imagem carregou

  // Resetar estado quando avatarId ou customImagePath mudarem
  useEffect(() => {
    setCustomImagePathState(customImagePath);
    setHasTriedFetch(false);
    setLoadingCustomImage(false);
    setImageLoaded(false);
  }, [avatarId, customImagePath]);

  // Usar o caminho fornecido como prop ou buscar via API (APENAS UMA VEZ)
  useEffect(() => {
    // Se já temos o caminho fornecido como prop, usar ele (prioridade máxima)
    if (customImagePath) {
      setCustomImagePathState(customImagePath);
      setHasTriedFetch(true); // Marcar como tentado para não buscar via API
      return;
    }
    
    // Se é avatar customizado, ainda não temos caminho, e ainda não tentamos buscar
    // IMPORTANTE: Só buscar via API se NÃO tivermos customImagePath como prop
    if (avatarConfig?.type === 'custom' && !customImagePath && !customImagePathState && !loadingCustomImage && !hasTriedFetch) {
      setLoadingCustomImage(true);
      setHasTriedFetch(true); // Marcar que já tentamos, mesmo se falhar
      
      authAPI.getCustomAvatarPath()
        .then(result => {
          if (result.success && result.imagePath) {
            setCustomImagePathState(result.imagePath);
          }
        })
        .catch(() => {
          // Erro silencioso - avatar customizado não disponível
        })
        .finally(() => {
          setLoadingCustomImage(false);
        });
    }
  }, [avatarConfig?.type, customImagePath, avatarId, customImagePathState, loadingCustomImage, hasTriedFetch]);

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
    
    // Se não temos caminho para customizado, não tentar carregar (mostrar fallback com iniciais)
    if (avatarConfig.type === 'custom' && !imagePath) {
      // Não tentar construir caminho - o arquivo tem timestamp no nome
      // Se não temos o caminho correto, mostrar avatar com iniciais
      return (
        <div
          className={baseClass}
          style={{ background: 'linear-gradient(135deg, #4a90e2, #357abd)' }}
        >
          {avatarConfig.initials || getInitialsFromName(nomeUsuario)}
        </div>
      );
    }
    
    return (
      <div className={`${baseClass} user-avatar-image`}>
        {/* Placeholder enquanto carrega */}
        {!imageLoaded && (
          <div
            className="avatar-placeholder"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              fontSize: '0.7em',
              color: '#94a3b8'
            }}
          >
            {getInitialsFromName(nomeUsuario)}
          </div>
        )}
        <img
          src={imagePath}
          alt={nomeUsuario || 'Avatar'}
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            setImageLoaded(false);
            // Fallback para avatar com iniciais se a imagem não carregar
            // Prevenir tentativas repetidas de carregar a mesma imagem
            e.target.style.display = 'none';
            const parent = e.target.parentElement;
            if (parent && !parent.classList.contains('avatar-fallback-applied')) {
              const fallbackGradient = 'linear-gradient(135deg, #4a90e2, #357abd)';
              parent.innerHTML = getInitialsFromName(nomeUsuario);
              parent.style.background = fallbackGradient;
              parent.classList.remove('user-avatar-image');
              parent.classList.add('avatar-fallback-applied');
            }
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

