/**
 * Cria uma versão debounced de uma função que atrasa sua execução
 * até que um determinado tempo tenha passado desde a última invocação.
 * 
 * @param {Function} func A função a ser executada com debounce
 * @param {number} wait O número de milissegundos para atrasar
 * @returns {Function} A função debounced
 */
export const debounce = (func, wait) => {
    let timeout;

    const debounced = function (...args) {
        const context = this;

        const later = () => {
            timeout = null;
            func.apply(context, args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };

    debounced.cancel = () => {
        clearTimeout(timeout);
        timeout = null;
    };

    return debounced;
};

export default debounce;
