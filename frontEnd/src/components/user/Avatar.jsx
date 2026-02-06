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
import { authAPI, clientesAPI } from '../../services/api';
import './Avatar.css';

const Avatar = ({ 
  avatarId, 
  nomeUsuario = '', 
  size = 'normal',
  className = '',
  entityType = 'user', // 'user' ou 'cliente'
  entityId = null // ID da entidade (necessário se entityType for 'cliente' e avatarId for custom-{id})
}) => {
  // Usar avatar padrão se não fornecido
  const fotoPerfil = avatarId || DEFAULT_AVATAR;

  // Determinar tipo e configuração do avatar
  let avatarConfig = null;
  
  // Verificar se foto_perfil é uma URL (avatar customizado já resolvido) ou custom-{id}
  const isUrlAvatar = fotoPerfil && (fotoPerfil.startsWith('http://') || fotoPerfil.startsWith('https://'));
  const isCustomAvatarId = fotoPerfil && fotoPerfil.startsWith('custom-');

  if (isUrlAvatar) {
    // Avatar customizado - foto_perfil já contém a URL completa (resolvida pelo backend)
    avatarConfig = {
      type: 'custom',
      path: fotoPerfil // URL completa já resolvida
    };
  } else if (isCustomAvatarId) {
    // Avatar customizado não resolvido (custom-{id}) - será resolvido via API
    avatarConfig = {
      type: 'custom',
      path: null, // Será buscado via API usando metadados
      customId: fotoPerfil
    };
  } else if (isColorAvatar(fotoPerfil)) {
    const colorConfig = getAvatarColor(fotoPerfil);
    avatarConfig = {
      type: 'color',
      gradient: colorConfig ? colorConfig.gradient : 'linear-gradient(135deg, #4a90e2, #357abd)',
      initials: getInitialsFromName(nomeUsuario)
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

  const [imageLoaded, setImageLoaded] = useState(false); // Flag para controlar quando a imagem carregou
  const [customImagePath, setCustomImagePath] = useState(avatarConfig.type === 'custom' ? avatarConfig.path : null);
  const [loadingCustomImage, setLoadingCustomImage] = useState(false);

  // Buscar avatar customizado via API se necessário (apenas se for custom-{id} e não tiver URL já resolvida)
  useEffect(() => {
    // Só buscar via API se:
    // 1. É tipo custom
    // 2. Tem customId (ou seja, é custom-{id}, não URL já resolvida)
    // 3. Não tem avatarConfig.path (URL já resolvida pelo backend)
    // 4. Não tem customImagePath já definido
    // 5. Não está carregando
    if (
      avatarConfig.type === 'custom' && 
      avatarConfig.customId && 
      !avatarConfig.path && // Não tem URL já resolvida pelo backend
      !customImagePath && 
      !loadingCustomImage
    ) {
      setLoadingCustomImage(true);
      
      // Determinar qual API usar e qual ID passar
      let fetchAvatar;
      if (entityType === 'cliente') {
        // Para cliente, usar entityId se fornecido, ou extrair do customId
        const clienteId = entityId || avatarConfig.customId.replace('custom-', '');
        fetchAvatar = clientesAPI.getClienteCustomAvatarPath(clienteId);
      } else {
        // Para usuário, usar API de auth (busca do usuário logado)
        fetchAvatar = authAPI.getCustomAvatarPath();
      }
      
      fetchAvatar
        .then(result => {
          if (result.success && result.imagePath) {
            setCustomImagePath(result.imagePath);
          }
        })
        .catch(() => {
          // Erro silencioso - avatar customizado não disponível
        })
        .finally(() => {
          setLoadingCustomImage(false);
        });
    }
  }, [avatarConfig.type, avatarConfig.customId, avatarConfig.path, customImagePath, loadingCustomImage, entityType, entityId]);

  // Classes CSS baseadas no tamanho
  const sizeClass = `avatar-${size}`;
  const baseClass = `user-avatar ${sizeClass} ${className}`.trim();

  if (avatarConfig.type === 'image' || avatarConfig.type === 'custom') {
    // Para avatar customizado, usar URL resolvida (já vem do backend ou foi buscada via API)
    // Priorizar customImagePath (URL buscada via API), depois avatarConfig.path (URL do backend), ou null
    const imagePath = avatarConfig.type === 'custom' 
      ? (customImagePath || avatarConfig.path) 
      : avatarConfig.path;
    
    // Se ainda está carregando (buscando via API) e não temos caminho ainda, mostrar fallback com iniciais
    if ((avatarConfig.type === 'custom' && loadingCustomImage && !imagePath) || (!imagePath && avatarConfig.type !== 'custom')) {
      return (
        <div
          className={baseClass}
          style={{ background: 'linear-gradient(135deg, #4a90e2, #357abd)' }}
        >
          {getInitialsFromName(nomeUsuario)}
        </div>
      );
    }
    
    // Se não temos caminho mesmo após não estar carregando, mostrar fallback
    if (!imagePath) {
      return (
        <div
          className={baseClass}
          style={{ background: 'linear-gradient(135deg, #4a90e2, #357abd)' }}
        >
          {getInitialsFromName(nomeUsuario)}
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

