import { useCallback } from 'react';

/**
 * Hook para exibir notificações toast no sistema
 * @returns {Function} Função showToast(type, message)
 */
export const useToast = () => {
  const showToast = useCallback((type, message) => {
    // Garantir que o container existe
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast--error' : type === 'warning' ? 'toast--warning' : 'toast--success'}`;
    
    const icon = document.createElement('i');
    icon.className = `toast-icon fas ${
      type === 'error' ? 'fa-times-circle' : 
      type === 'warning' ? 'fa-exclamation-triangle' : 
      'fa-check-circle'
    }`;
    
    const msg = document.createElement('div');
    msg.className = 'toast-text';
    msg.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(msg);
    container.appendChild(toast);

    // Animar entrada
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // Duração baseada no tipo
    const duration = type === 'error' ? 4000 : type === 'warning' ? 3500 : 2500;
    
    // Remover após a duração
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    }, duration);
  }, []);

  return showToast;
};









