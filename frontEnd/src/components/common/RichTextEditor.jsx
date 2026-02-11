import React, { useMemo, useRef, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './RichTextEditor.css';

// Registrar tamanhos de fonte personalizados
const Size = Quill.import('attributors/style/size');
const fontSizeOptions = ['8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '60px', '72px'];
Size.whitelist = fontSizeOptions;
Quill.register(Size, true);

// Registrar famílias de fonte personalizadas
const Font = Quill.import('formats/font');
const fontFamilyOptions = [
  'Arial',
  'Arial Black',
  'Comic Sans MS',
  'Courier New',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Palatino',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Poppins',
  'Inter',
  'Roboto'
];
Font.whitelist = fontFamilyOptions;
Quill.register(Font, true);

// Registrar blot de vídeo para que vídeos não sejam removidos pelo editor
const BlockEmbed = Quill.import('blots/block/embed');
class VideoBlot extends BlockEmbed {
  static create(url) {
    const node = super.create();
    node.setAttribute('src', url);
    node.setAttribute('controls', true);
    node.setAttribute('style', 'max-width:100%;');
    return node;
  }
  static value(node) {
    return node.getAttribute('src');
  }
}
VideoBlot.blotName = 'video';
VideoBlot.tagName = 'VIDEO';
Quill.register(VideoBlot);

/**
 * Componente de editor de texto rico reutilizável usando React Quill
 * 
 * @param {string} value - Valor HTML do editor (controlado)
 * @param {function} onChange - Callback chamado quando o conteúdo muda (recebe HTML string)
 * @param {string} placeholder - Texto placeholder do editor
 * @param {boolean} disabled - Se true, desabilita o editor
 * @param {boolean} error - Se true, aplica estilo de erro
 * @param {number} minHeight - Altura mínima do editor em pixels (padrão: 300)
 * @param {boolean} showFloatingToolbar - Se true, mostra toolbar flutuante ao selecionar texto (padrão: true)
 * @param {string} className - Classe CSS adicional para o wrapper
 * @param {string} id - ID único para o componente (opcional)
 * @param {function} onFocus - Callback chamado quando o editor recebe foco
 * @param {function} onBlur - Callback chamado quando o editor perde foco
 * @param {React.Ref} ref - Ref opcional; use ref.current.insertHtmlAtEnd(html) para inserir HTML no final do documento
 * 
 * @example
 * // Uso básico
 * <RichTextEditor
 *   value={content}
 *   onChange={setContent}
 *   placeholder="Digite aqui..."
 * />
 * 
 * @example
 * // Com customizações
 * <RichTextEditor
 *   value={content}
 *   onChange={setContent}
 *   minHeight={400}
 *   showFloatingToolbar={true}
 *   disabled={isSubmitting}
 *   error={hasError}
 *   onFocus={() => console.log('Editor focado')}
 * />
 */
const RichTextEditor = forwardRef(({
  value,
  onChange,
  placeholder = 'Digite o texto...',
  disabled = false,
  error = false,
  minHeight = 300,
  showFloatingToolbar = true,
  className = '',
  id,
  onFocus,
  onBlur
}, ref) => {
  const quillRef = useRef(null);
  const toolbarId = useMemo(() => id ? `toolbar-${id}` : `toolbar-${Math.random().toString(36).substr(2, 9)}`, [id]);
  const [showFloatingToolbarState, setShowFloatingToolbarState] = useState(false);
  const [floatingToolbarPosition, setFloatingToolbarPosition] = useState({ top: 0, left: 0 });
  const floatingToolbarRef = useRef(null);
  const wrapperId = useMemo(() => id || `rich-editor-${Math.random().toString(36).substr(2, 9)}`, [id]);
  const lastClickTargetRef = useRef(null);
  const allowFocusRef = useRef(false);
  const editorWrapperRef = useRef(null);

  useImperativeHandle(ref, () => ({
    insertHtmlAtEnd(html) {
      const quill = quillRef.current?.getEditor();
      if (!quill || typeof html !== 'string' || !html.trim()) return;
      try {
        const index = quill.getLength();
        quill.clipboard.dangerouslyPasteHTML(index, html);
      } catch (e) {
        console.warn('RichTextEditor.insertHtmlAtEnd:', e);
      }
    },
    insertImageAtEnd(url) {
      const quill = quillRef.current?.getEditor();
      if (!quill || !url) return;
      try {
        quill.insertEmbed(quill.getLength(), 'image', url);
        quill.insertText(quill.getLength(), '\n');
      } catch (e) {
        console.warn('RichTextEditor.insertImageAtEnd:', e);
      }
    },
    insertVideoAtEnd(url) {
      const quill = quillRef.current?.getEditor();
      if (!quill || !url) return;
      try {
        quill.insertEmbed(quill.getLength(), 'video', url);
        quill.insertText(quill.getLength(), '\n');
      } catch (e) {
        console.warn('RichTextEditor.insertVideoAtEnd:', e);
      }
    }
  }), []);

  // Função para aumentar o tamanho da fonte
  const increaseFontSize = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    let range = quill.getSelection(true);
    if (!range || range.length === 0) return;

    const format = quill.getFormat(range);
    let currentSize = 14; // Tamanho padrão

    if (format.size) {
      currentSize = parseInt(format.size);
    }

    // Encontrar índice atual no array de opções
    let currentIndex = fontSizeOptions.findIndex(size => parseInt(size) === currentSize);
    if (currentIndex === -1) {
      // Se não encontrou, procurar o tamanho mais próximo maior
      currentIndex = fontSizeOptions.findIndex(size => parseInt(size) > currentSize);
      if (currentIndex === -1) currentIndex = fontSizeOptions.length - 1;
      else if (currentIndex > 0) currentIndex = currentIndex - 1;
    }

    const nextIndex = currentIndex < fontSizeOptions.length - 1 ? currentIndex + 1 : currentIndex;
    const newSize = fontSizeOptions[nextIndex];
    quill.format('size', newSize, 'user');
  }, []);

  // Função para diminuir o tamanho da fonte
  const decreaseFontSize = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    let range = quill.getSelection(true);
    if (!range || range.length === 0) return;

    const format = quill.getFormat(range);
    let currentSize = 14; // Tamanho padrão

    if (format.size) {
      currentSize = parseInt(format.size);
    }

    // Encontrar índice atual no array de opções
    let currentIndex = fontSizeOptions.findIndex(size => parseInt(size) === currentSize);
    if (currentIndex === -1) {
      // Se não encontrou, procurar o tamanho mais próximo maior
      currentIndex = fontSizeOptions.findIndex(size => parseInt(size) > currentSize);
      if (currentIndex === -1) currentIndex = 0;
      else if (currentIndex > 0) currentIndex = currentIndex - 1;
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const newSize = fontSizeOptions[prevIndex];
    quill.format('size', newSize, 'user');
  }, []);

  // Configuração dos módulos do editor
  const modules = useMemo(() => ({
    toolbar: {
      container: `#${toolbarId}`,
      handlers: {
        'increaseFontSize': increaseFontSize,
        'decreaseFontSize': decreaseFontSize
      }
    },
    clipboard: {
      // Toggle to add extra line breaks when pasting HTML:
      matchVisual: false,
    }
  }), [toolbarId, increaseFontSize, decreaseFontSize]);

  // Formatos permitidos (inclui image e video para exibir mídia anexada)
  const formats = [
    'font', 'size',
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'script',
    'indent',
    'color', 'background',
    'align',
    'link', 'blockquote', 'code-block',
    'image', 'video'
  ];

  const handleChange = (content) => {
    // React Quill retorna HTML vazio como '<p><br></p>' ou ''
    // Converter para string vazia para manter consistência
    const cleanedContent = content === '<p><br></p>' || content === '<p></p>' ? '' : content;
    onChange(cleanedContent);
  };

  // Efeito para prevenir que o editor roube foco de outros elementos
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const wrapperElement = document.getElementById(wrapperId);
    if (!wrapperElement) return;
    const editorRoot = quill.root;
    const editorElement = editorRoot;

    // Desabilitar foco automático do Quill
    if (editorElement) {
      editorElement.setAttribute('tabindex', '-1');
    }

    const handleMouseDown = (e) => {
      const target = e.target;
      lastClickTargetRef.current = target;

      // Verificar se o clique foi dentro do wrapper do editor (incluindo toolbar)
      const clickedInsideEditor = wrapperElement.contains(target);

      // Permitir foco apenas se o clique foi diretamente no editor ou seus elementos filhos
      allowFocusRef.current = clickedInsideEditor;

      // Se o clique foi fora, garantir que o editor não ganhe foco
      if (!clickedInsideEditor && editorElement) {
        // Bloquear qualquer tentativa de foco no editor
        editorElement.blur();
        // Resetar a flag imediatamente para cliques fora
        setTimeout(() => {
          allowFocusRef.current = false;
        }, 0);
      } else {
        // Se clicou dentro, manter a flag ativa por um tempo maior
        setTimeout(() => {
          // Manter a flag ativa por 500ms para permitir que o foco seja processado
        }, 500);
      }
    };

    const handleFocusIn = (e) => {
      const target = e.target;
      const wrapperElement = document.getElementById(wrapperId);
      if (!wrapperElement) return;

      // Verificar se o foco está indo para dentro do editor
      const isFocusingEditor = wrapperElement.contains(target);

      // Se o foco está indo para o editor
      if (isFocusingEditor) {
        // Se não foi permitido o foco (clique foi fora), prevenir AGressivamente
        if (!allowFocusRef.current) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // Focar no elemento que foi realmente clicado
          const clickedElement = lastClickTargetRef.current;
          if (clickedElement &&
            clickedElement !== document.body &&
            clickedElement !== document.documentElement &&
            clickedElement.tagName !== 'BODY' &&
            clickedElement.tagName !== 'HTML' &&
            !wrapperElement.contains(clickedElement)) {

            // Tentar focar no elemento clicado
            if (typeof clickedElement.focus === 'function') {
              // Usar múltiplos métodos para garantir que o foco aconteça
              setTimeout(() => {
                try {
                  clickedElement.focus();
                } catch (err) {
                  // Se não conseguir focar, tentar clicar no elemento
                  try {
                    clickedElement.click();
                  } catch (err2) {
                    // Ignorar erros
                  }
                }
              }, 0);
            } else if (clickedElement.tagName === 'INPUT' || clickedElement.tagName === 'TEXTAREA' || clickedElement.tagName === 'SELECT') {
              // Para inputs, textareas e selects, tentar focar diretamente
              setTimeout(() => {
                try {
                  clickedElement.focus();
                } catch (err) {
                  // Ignorar erros
                }
              }, 0);
            }
          }

          // Bloquear o foco no editor imediatamente
          if (editorElement) {
            editorElement.blur();
            // Remover o foco programaticamente
            if (document.activeElement === editorElement) {
              editorElement.blur();
            }
          }
        }
      }
    };

    // Handler direto no elemento do editor para bloquear foco não autorizado
    const handleEditorFocus = (e) => {
      if (!allowFocusRef.current) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        editorElement.blur();

        // Tentar focar no elemento que foi clicado
        const clickedElement = lastClickTargetRef.current;
        if (clickedElement && typeof clickedElement.focus === 'function' &&
          !wrapperElement.contains(clickedElement)) {
          setTimeout(() => {
            try {
              clickedElement.focus();
            } catch (err) {
              // Ignorar erros
            }
          }, 0);
        }
      }
    };

    // Adicionar handler direto no elemento do editor
    if (editorElement) {
      editorElement.addEventListener('focus', handleEditorFocus, true);
      editorElement.addEventListener('focusin', handleEditorFocus, true);
    }

    // Interceptar mousedown ANTES do Quill processar (capture phase)
    document.addEventListener('mousedown', handleMouseDown, true);

    // Interceptar focusin na fase de captura (antes do Quill)
    document.addEventListener('focusin', handleFocusIn, true);

    // Interceptar também focus (para garantir)
    document.addEventListener('focus', handleFocusIn, true);

    // Interceptar também click para garantir
    const handleClick = (e) => {
      const target = e.target;
      const wrapperElement = document.getElementById(wrapperId);
      if (!wrapperElement) return;

      // Se o clique foi fora do editor, garantir que não ganhe foco
      if (!wrapperElement.contains(target) && editorElement && document.activeElement === editorElement) {
        editorElement.blur();
      }
    };

    document.addEventListener('click', handleClick, true);

    // Monitorar mudanças no activeElement para bloquear foco não autorizado
    let lastActiveElement = document.activeElement;
    const checkActiveElement = () => {
      const currentActive = document.activeElement;
      const wrapperElement = document.getElementById(wrapperId);

      // Se o editor ganhou foco sem permissão
      if (currentActive && wrapperElement && wrapperElement.contains(currentActive) && !allowFocusRef.current) {
        // Se o elemento ativo anterior não era o editor, bloquear
        if (lastActiveElement && !wrapperElement.contains(lastActiveElement)) {
          currentActive.blur();
          // Tentar restaurar o foco no elemento anterior
          if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
            setTimeout(() => {
              try {
                lastActiveElement.focus();
              } catch (err) {
                // Ignorar erros
              }
            }, 0);
          }
        }
      }

      lastActiveElement = currentActive;
    };

    // Verificar periodicamente o activeElement
    const activeElementInterval = setInterval(checkActiveElement, 50);

    return () => {
      clearInterval(activeElementInterval);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focus', handleFocusIn, true);
      document.removeEventListener('click', handleClick, true);
      if (editorElement) {
        editorElement.removeEventListener('focus', handleEditorFocus, true);
        editorElement.removeEventListener('focusin', handleEditorFocus, true);
      }
    };
  }, [wrapperId]);

  // Efeito para controlar a visibilidade da toolbar flutuante (baseado em seleção)
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const updateFloatingToolbar = () => {
      // Se o editor não estiver focado, escondemos a toolbar
      if (!quill.hasFocus()) {
        setShowFloatingToolbarState(false);
        return;
      }

      const range = quill.getSelection();

      if (range && range.length > 0) {
        try {
          const bounds = quill.getBounds(range);
          const editorBounds = quill.container.getBoundingClientRect();
          const top = editorBounds.top + bounds.top + bounds.height + 2;
          const left = editorBounds.left + bounds.left;

          setFloatingToolbarPosition({ top, left });
          if (showFloatingToolbar) {
            setShowFloatingToolbarState(true);
          }
        } catch (error) {
          setShowFloatingToolbarState(false);
        }
      } else {
        setShowFloatingToolbarState(false);
      }
    };

    quill.on('selection-change', updateFloatingToolbar);
    quill.on('text-change', updateFloatingToolbar);

    return () => {
      quill.off('selection-change', updateFloatingToolbar);
      quill.off('text-change', updateFloatingToolbar);
    };
  }, [showFloatingToolbar]);

  // Efeito para atualizar APENAS a posição da toolbar durante scroll ou resize
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill || !showFloatingToolbarState) return;

    const updatePosition = () => {
      const range = quill.getSelection();
      if (range && range.length > 0) {
        try {
          const bounds = quill.getBounds(range);
          const editorBounds = quill.container.getBoundingClientRect();
          const top = editorBounds.top + bounds.top + bounds.height + 2;
          const left = editorBounds.left + bounds.left;
          setFloatingToolbarPosition({ top, left });
        } catch (e) { }
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    const editorContainer = quill.container.parentElement;
    if (editorContainer) {
      editorContainer.addEventListener('scroll', updatePosition);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      if (editorContainer) {
        editorContainer.removeEventListener('scroll', updatePosition);
      }
    };
  }, [showFloatingToolbarState]);

  return (
    <div
      id={wrapperId}
      className={`rich-text-editor-wrapper ${error ? 'error' : ''} ${disabled ? 'disabled' : ''} ${className}`.trim()}
      style={{
        '--editor-min-height': `${minHeight}px`
      }}
    >
      {/* Toolbar fixa no topo */}
      <div id={toolbarId}>
        <select className="ql-font" defaultValue="">
          {fontFamilyOptions.map(font => (
            <option key={font} value={font}>{font}</option>
          ))}
        </select>
        <button className="ql-increaseFontSize" type="button" title="Aumentar fonte">
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>A+</span>
        </button>
        <button className="ql-decreaseFontSize" type="button" title="Diminuir fonte">
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>A-</span>
        </button>
        <select className="ql-header" defaultValue="">
          <option value="">Normal</option>
          <option value="1">Título 1</option>
          <option value="2">Título 2</option>
          <option value="3">Título 3</option>
        </select>
        <button className="ql-bold"></button>
        <button className="ql-italic"></button>
        <button className="ql-underline"></button>
        <button className="ql-strike"></button>
        <button className="ql-list" value="ordered"></button>
        <button className="ql-list" value="bullet"></button>
        <button className="ql-script" value="sub"></button>
        <button className="ql-script" value="super"></button>
        <button className="ql-indent" value="-1"></button>
        <button className="ql-indent" value="+1"></button>
        <select className="ql-color"></select>
        <select className="ql-background"></select>
        <select className="ql-align"></select>
        <button className="ql-link"></button>
        <button className="ql-blockquote"></button>
        <button className="ql-code-block"></button>
        <button className="ql-clean"></button>
      </div>

      <div
        ref={editorWrapperRef}
        onMouseDown={(e) => {
          // Marcar que o clique foi dentro do wrapper do editor
          allowFocusRef.current = true;
          // Garantir que o evento não propague para outros handlers
          e.stopPropagation();
        }}
        onClick={(e) => {
          // Permitir foco quando clicar diretamente no wrapper
          allowFocusRef.current = true;
        }}
        style={{ position: 'relative' }}
      >
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value || ''}
          onChange={handleChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          readOnly={disabled}
          onFocus={(e) => {
            // Só permitir foco se foi explicitamente permitido
            if (!allowFocusRef.current) {
              e.preventDefault();
              e.stopPropagation();
              const clickedElement = lastClickTargetRef.current;
              if (clickedElement && typeof clickedElement.focus === 'function' &&
                !document.getElementById(wrapperId)?.contains(clickedElement)) {
                setTimeout(() => {
                  try {
                    clickedElement.focus();
                  } catch (err) {
                    // Ignorar erros
                  }
                }, 0);
              }
              return;
            }
            if (onFocus) onFocus(e);
          }}
          onBlur={onBlur}
          tabIndex={-1}
        />
      </div>

      {/* Toolbar flutuante */}
      {showFloatingToolbar && showFloatingToolbarState && !disabled && (
        <div
          ref={floatingToolbarRef}
          className="rich-text-editor-floating-toolbar"
          style={{
            position: 'fixed',
            top: `${floatingToolbarPosition.top}px`,
            left: `${floatingToolbarPosition.left}px`,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="floating-btn floating-increase-font"
            type="button"
            title="Aumentar fonte"
            onClick={increaseFontSize}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>A+</span>
          </button>
          <button
            className="floating-btn floating-decrease-font"
            type="button"
            title="Diminuir fonte"
            onClick={decreaseFontSize}
          >
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>A-</span>
          </button>
          <div className="floating-color-picker">
            <input
              type="color"
              onChange={(e) => {
                const quill = quillRef.current?.getEditor();
                if (quill) {
                  const range = quill.getSelection(true);
                  if (range) {
                    quill.format('color', e.target.value, 'user');
                  }
                }
              }}
              title="Cor do texto"
            />
          </div>
          <button
            className="floating-btn floating-bold"
            type="button"
            title="Negrito"
            onClick={() => {
              const quill = quillRef.current?.getEditor();
              if (quill) {
                const range = quill.getSelection(true);
                if (range) {
                  const format = quill.getFormat(range);
                  quill.format('bold', !format.bold, 'user');
                }
              }
            }}
          >
            <strong>B</strong>
          </button>
          <button
            className="floating-btn floating-italic"
            type="button"
            title="Itálico"
            onClick={() => {
              const quill = quillRef.current?.getEditor();
              if (quill) {
                const range = quill.getSelection(true);
                if (range) {
                  const format = quill.getFormat(range);
                  quill.format('italic', !format.italic, 'user');
                }
              }
            }}
          >
            <em>I</em>
          </button>
          <button
            className="floating-btn floating-link"
            type="button"
            title="Link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const quill = quillRef.current?.getEditor();
              if (quill) {
                let range = quill.getSelection(true);
                if (!range || range.length === 0) return;

                // Manter a seleção ativa
                quill.setSelection(range, 'user');
                range = quill.getSelection(true);
                if (!range) return;

                const format = quill.getFormat(range);
                let url = format.link || '';

                url = prompt('Digite a URL do link:', url);
                if (url !== null) {
                  if (url.trim()) {
                    // Garantir que a URL tenha protocolo
                    if (!url.match(/^https?:\/\//i)) {
                      url = 'https://' + url;
                    }
                    quill.format('link', url, 'user');
                  } else {
                    // Se URL vazia, remover link
                    quill.format('link', false, 'user');
                  }
                }
              }
            }}
          >
            <i className="fas fa-link" style={{ fontSize: '12px' }}></i>
          </button>
        </div>
      )}
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

