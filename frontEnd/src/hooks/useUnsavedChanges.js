import { useEffect, useRef } from 'react';

/**
 * Hook para avisar o usuário antes de sair com dados não salvos
 * @param {Boolean} hasUnsavedChanges - Se há mudanças não salvas
 * @param {String} message - Mensagem personalizada (opcional)
 */
export const useUnsavedChanges = (hasUnsavedChanges, message = 'Você tem alterações não salvas. Tem certeza que deseja sair?') => {
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

  // Atualizar ref quando hasUnsavedChanges mudar
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Interceptar saída da página (fechar aba, navegar para outro site, etc.)
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [message]);

  // Interceptar cliques em links e botões de navegação
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleClick = (e) => {
      const target = e.target.closest('a, button');
      if (target) {
        const href = target.getAttribute('href');
        const onClick = target.getAttribute('onclick');
        
        // Se for um link interno ou botão que navega
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          if (!window.confirm(message)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }
      }
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [hasUnsavedChanges, message]);
};

