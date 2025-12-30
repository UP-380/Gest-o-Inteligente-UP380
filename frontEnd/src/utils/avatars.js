/**
 * Utilitário para gerenciar avatares de usuários
 * 
 * Cada avatar possui um ID único que é armazenado na coluna foto_perfil da tabela usuarios.
 * 
 * Tipos de avatar:
 * - 'color-{cor}': Avatar com iniciais e cor de fundo (6 opções)
 * - 'image-{nome}': Avatar com imagem personalizada (12 opções)
 * 
 * IDs disponíveis:
 * Cores: color-blue, color-green, color-purple, color-orange, color-pink, color-red
 * Imagens: image-feminina-moderna, image-masculino-tech, image-bolinha-rosa, 
 *          image-galinha-drone, image-gaviao-agressivo, image-lagartixa-cyborg,
 *          image-lobo, image-menina, image-tijolo, image-unicornio,
 *          image-cachorro-helicoptero, image-capivara-oculos
 */

// Cores disponíveis para avatares com iniciais (6 opções)
export const AVATAR_COLORS = [
  {
    id: 'color-blue',
    name: 'Azul',
    gradient: 'linear-gradient(135deg, #4a90e2, #357abd)',
    class: 'avatar-color-blue'
  },
  {
    id: 'color-green',
    name: 'Verde',
    gradient: 'linear-gradient(135deg, #52c41a, #389e0d)',
    class: 'avatar-color-green'
  },
  {
    id: 'color-purple',
    name: 'Roxo',
    gradient: 'linear-gradient(135deg, #722ed1, #531dab)',
    class: 'avatar-color-purple'
  },
  {
    id: 'color-orange',
    name: 'Laranja',
    gradient: 'linear-gradient(135deg, #fa8c16, #d46b08)',
    class: 'avatar-color-orange'
  },
  {
    id: 'color-pink',
    name: 'Rosa',
    gradient: 'linear-gradient(135deg, #eb2f96, #c41d7f)',
    class: 'avatar-color-pink'
  },
  {
    id: 'color-red',
    name: 'Vermelho',
    gradient: 'linear-gradient(135deg, #f5222d, #cf1322)',
    class: 'avatar-color-red'
  }
];

// Imagens de avatar disponíveis (12 opções)
export const AVATAR_IMAGES = [
  { id: 'image-feminina-moderna', name: 'Feminina', file: 'avatar-feminina-moderna.png' },
  { id: 'image-masculino-tech', name: 'Masculino', file: 'avatar-masculino-tech.png' },
  { id: 'image-bolinha-rosa', name: 'Bolinha', file: 'avatar-bolinha-rosa.png' },
  { id: 'image-galinha-drone', name: 'Galinha', file: 'avatar-galinha-drone.png' },
  { id: 'image-gaviao-agressivo', name: 'Gavião', file: 'avatar-gaviao-agressivo.png' },
  { id: 'image-lagartixa-cyborg', name: 'Lagartixa', file: 'avatar-lagartixa-cyborg.png' },
  { id: 'image-lobo', name: 'Lobo', file: 'avatar-lobo.png' },
  { id: 'image-menina', name: 'Menina', file: 'avatar-menina.png' },
  { id: 'image-tijolo', name: 'Tijolo', file: 'avatar-tijolo.png' },
  { id: 'image-unicornio', name: 'Unicórnio', file: 'avatar-unicornio.png' },
  { id: 'image-cachorro-helicoptero', name: 'Cachorro', file: 'avatar-cachorro-helicoptero.png' },
  { id: 'image-capivara-oculos', name: 'Capivara', file: 'avatar-capivara-oculos.png' }
];

// Avatar padrão (primeira cor - color-blue)
export const DEFAULT_AVATAR = 'color-blue';

// Lista de todos os IDs de avatares válidos
export const ALL_AVATAR_IDS = [
  ...AVATAR_COLORS.map(c => c.id),
  ...AVATAR_IMAGES.map(img => img.id)
];

/**
 * Verifica se um ID de avatar é válido
 */
export const isValidAvatarId = (avatarId) => {
  if (!avatarId) return false;
  return ALL_AVATAR_IDS.includes(avatarId);
};

/**
 * Obtém as iniciais de um nome
 */
export const getInitialsFromName = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Verifica se o avatar é uma cor (iniciais) ou imagem
 */
export const isColorAvatar = (avatarId) => {
  return avatarId && avatarId.startsWith('color-');
};

/**
 * Verifica se o avatar é uma imagem
 */
export const isImageAvatar = (avatarId) => {
  return avatarId && avatarId.startsWith('image-');
};

/**
 * Verifica se o avatar é uma imagem customizada (upload do usuário)
 */
export const isCustomAvatar = (avatarId) => {
  return avatarId && avatarId.startsWith('custom-');
};

/**
 * Obtém o caminho da imagem customizada
 * DEPRECADO: Avatares customizados agora são resolvidos automaticamente via Supabase Storage
 * O componente Avatar resolve via resolveAvatarUrl do Supabase Storage
 * Esta função retorna null - o Avatar resolve automaticamente
 */
export const getCustomAvatarPath = (avatarId, userId = null) => {
  if (!isCustomAvatar(avatarId)) return null;
  
  // Avatares customizados são resolvidos automaticamente pelo componente Avatar
  // via Supabase Storage (resolveAvatarUrl). Não retornar caminho do filesystem antigo.
  return null; // Avatar resolve via Supabase Storage
};

/**
 * Obtém a configuração de cor do avatar
 */
export const getAvatarColor = (avatarId) => {
  if (!isColorAvatar(avatarId)) return null;
  return AVATAR_COLORS.find(color => color.id === avatarId) || AVATAR_COLORS[0];
};

/**
 * Obtém a configuração de imagem do avatar
 */
export const getAvatarImage = (avatarId) => {
  if (!isImageAvatar(avatarId)) return null;
  return AVATAR_IMAGES.find(img => img.id === avatarId) || null;
};

/**
 * Obtém o caminho da imagem do avatar
 */
export const getAvatarImagePath = (avatarId, customImagePath = null) => {
  // Se for avatar customizado e tiver URL já resolvida (do Supabase Storage), usar ela
  if (isCustomAvatar(avatarId) && customImagePath) {
    return customImagePath; // URL do Supabase Storage já resolvida
  }
  
  // Se for avatar customizado sem URL, retornar null
  // O componente Avatar resolve automaticamente via Supabase Storage (resolveAvatarUrl)
  if (isCustomAvatar(avatarId)) {
    return null; // Avatar resolve via Supabase Storage automaticamente
  }
  
  // Avatar de imagem padrão
  const image = getAvatarImage(avatarId);
  if (!image) return null;
  return `/assets/images/avatars/${image.file}`;
};

/**
 * Obtém todas as opções de avatar (cores + imagens)
 */
export const getAllAvatarOptions = () => {
  return [
    {
      type: 'colors',
      label: 'Avatares com Iniciais',
      options: AVATAR_COLORS.map(color => ({
        id: color.id,
        name: color.name,
        type: 'color',
        gradient: color.gradient,
        class: color.class
      }))
    },
    {
      type: 'images',
      label: 'Avatares Personalizados',
      options: AVATAR_IMAGES.map(img => ({
        id: img.id,
        name: img.name,
        type: 'image',
        file: img.file,
        path: `/assets/images/avatars/${img.file}`
      }))
    }
  ];
};

/**
 * Obtém avatar por ID (funciona para qualquer tipo)
 * Retorna null se o ID não for válido
 */
export const getAvatarById = (avatarId) => {
  if (!avatarId) return null;
  
  // Verificar se é avatar de cor
  if (isColorAvatar(avatarId)) {
    return {
      id: avatarId,
      type: 'color',
      ...getAvatarColor(avatarId)
    };
  }
  
  // Verificar se é avatar de imagem
  if (isImageAvatar(avatarId)) {
    const image = getAvatarImage(avatarId);
    if (image) {
      return {
        id: avatarId,
        type: 'image',
        ...image,
        path: getAvatarImagePath(avatarId)
      };
    }
  }
  
  return null;
};

