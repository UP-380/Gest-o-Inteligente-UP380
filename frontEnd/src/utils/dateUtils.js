/**
 * Utilitários para formatação de datas
 */

/**
 * Formata uma data para o padrão brasileiro
 * @param {string|Date} dateString - Data a ser formatada
 * @param {boolean} includeTime - Se deve incluir hora
 * @returns {string} Data formatada ou '-'
 */
export const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    
    if (includeTime) {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

