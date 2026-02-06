import React, { useEffect, useRef } from 'react';
import './FiltrosAdicionaisDropdown.css';

const FiltrosAdicionaisDropdown = ({
  isOpen,
  onClose,
  filtroPrincipal,
  ordemFiltros,
  filtrosAdicionaisAtivos,
  onToggleFiltro,
  periodoInicio,
  periodoFim,
  onBuscarOpcoes,
  loading
}) => {
  const dropdownRef = useRef(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      // Adicionar listener após um pequeno delay para não fechar imediatamente ao abrir
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtroPaiAtual = filtroPrincipal || ordemFiltros[0] || '';

  return (
    <div className="filtros-adicionais-dropdown" ref={dropdownRef}>
      <div className="filtros-adicionais-options">
        {/* Opção Cliente (se não for o filtro pai) */}
        {filtroPaiAtual !== 'cliente' && (
          <div className="filtro-adicional-option">
            <label>
              <input
                type="checkbox"
                checked={filtrosAdicionaisAtivos.cliente}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  await onToggleFiltro('cliente', checked);
                  if (checked && periodoInicio && periodoFim) {
                    const opcoes = await onBuscarOpcoes('cliente');
                    // O callback já atualiza o estado, então não precisamos fazer nada aqui
                  }
                }}
                disabled={loading}
              />
              <span>Cliente</span>
            </label>
          </div>
        )}

        {/* Opção Tarefa (se não for o filtro pai) */}
        {filtroPaiAtual !== 'atividade' && (
          <div className="filtro-adicional-option">
            <label>
              <input
                type="checkbox"
                checked={filtrosAdicionaisAtivos.tarefa}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  await onToggleFiltro('tarefa', checked);
                  if (checked && periodoInicio && periodoFim) {
                    const opcoes = await onBuscarOpcoes('tarefa');
                    // O callback já atualiza o estado, então não precisamos fazer nada aqui
                  }
                }}
                disabled={loading}
              />
              <span>Tarefa</span>
            </label>
          </div>
        )}

        {/* Opção Produto (se não for o filtro pai) */}
        {filtroPaiAtual !== 'produto' && (
          <div className="filtro-adicional-option">
            <label>
              <input
                type="checkbox"
                checked={filtrosAdicionaisAtivos.produto}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  await onToggleFiltro('produto', checked);
                  if (checked && periodoInicio && periodoFim) {
                    const opcoes = await onBuscarOpcoes('produto');
                    // O callback já atualiza o estado, então não precisamos fazer nada aqui
                  }
                }}
                disabled={loading}
              />
              <span>Produto</span>
            </label>
          </div>
        )}


      </div>
    </div>
  );
};

export default FiltrosAdicionaisDropdown;

