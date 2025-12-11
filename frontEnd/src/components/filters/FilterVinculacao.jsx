import React from 'react';
import '../../pages/CadastroVinculacoes/CadastroVinculacoes.css';

/**
 * Componente de filtro para vinculações
 * 
 * @param {Object} props
 * @param {string} props.filtroKey - Chave do filtro ('produto', 'atividade', 'tipoAtividade')
 * @param {boolean} props.checked - Se o filtro está marcado
 * @param {Function} props.onChange - Função chamada quando o filtro muda
 * @param {boolean} props.isFiltroPai - Se este é o filtro pai (primeiro selecionado)
 * @param {string} props.title - Título do filtro
 * @param {string} props.subtitle - Subtítulo do filtro
 * @param {string} props.icon - Classe do ícone FontAwesome
 * @param {string} props.filtroNome - Nome do filtro para exibir no tooltip
 * @param {Function} props.onMouseEnter - Função chamada quando o mouse entra no filtro
 * @param {Function} props.onMouseLeave - Função chamada quando o mouse sai do filtro
 */
const FilterVinculacao = ({
  filtroKey,
  checked,
  onChange,
  isFiltroPai,
  title,
  subtitle,
  icon = 'fas fa-list',
  filtroNome,
  onMouseEnter,
  onMouseLeave
}) => {
  return (
    <div className="filter-group">
      <div className={`filtro-pai-wrapper ${isFiltroPai ? 'has-tooltip' : ''}`}>
        <label 
          className={`filtro-card-option ${isFiltroPai ? 'filtro-pai' : ''}`}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(filtroKey, e.target.checked)}
          />
          <div className="filtro-card-content">
            <div className="filtro-card-icon">
              <i className={icon}></i>
            </div>
            <div className="filtro-card-text">
              <span className="filtro-card-title">{title}</span>
              <span className="filtro-card-subtitle">{subtitle}</span>
            </div>
            <div className="filtro-card-check">
              <i className="fas fa-check"></i>
            </div>
            <div className="filtro-card-click-indicator">
              <i className="fas fa-hand-pointer"></i>
            </div>
          </div>
        </label>
        {isFiltroPai && filtroNome && (
          <div className="filter-tooltip">
            Separar resultados por {filtroNome}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterVinculacao;

