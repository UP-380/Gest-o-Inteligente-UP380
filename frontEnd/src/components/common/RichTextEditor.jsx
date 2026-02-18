import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
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
const RichTextEditor = ({
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
}) => {
  const quillRef = useRef(null);
  const toolbarId = useMemo(() => id ? `toolbar-${id}` : `toolbar-${Math.random().toString(36).substr(2, 9)}`, [id]);
  const [showFloatingToolbarState, setShowFloatingToolbarState] = useState(false);
  const [floatingToolbarPosition, setFloatingToolbarPosition] = useState({ top: 0, left: 0 });
  const floatingToolbarRef = useRef(null);
  const wrapperId = useMemo(() => id || `rich-editor-${Math.random().toString(36).substr(2, 9)}`, [id]);
  const editorWrapperRef = useRef(null);

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

  // Formatos permitidos
  const formats = [
    'font', 'size',
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'script',
    'indent',
    'color', 'background',
    'align',
    'link', 'blockquote', 'code-block'
  ];

  const handleChange = (content) => {
    // React Quill retorna HTML vazio como '<p><br></p>' ou ''
    // Converter para string vazia para manter consistência
    const cleanedContent = content === '<p><br></p>' || content === '<p></p>' ? '' : content;
    onChange(cleanedContent);
  };

  // Efeito para garantir que o editor tenha tabindex correto
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const editorRoot = quill.root;
    if (editorRoot) {
      editorRoot.setAttribute('tabindex', '0');
    }
  }, []);

  // Efeito para controlar a toolbar flutuante
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const updateFloatingToolbar = () => {
      const range = quill.getSelection(true);

      if (range && range.length > 0) {
        try {
          // Obter a posição do texto selecionado
          const bounds = quill.getBounds(range);
          const editorBounds = quill.container.getBoundingClientRect();

          // Calcular posição da toolbar flutuante no início do texto selecionado
          // Posicionar logo abaixo do texto, com apenas 2px de espaçamento
          const top = editorBounds.top + bounds.top + bounds.height + 2;
          // Posicionar no início da seleção (esquerda)
          const left = editorBounds.left + bounds.left;

          setFloatingToolbarPosition({ top, left });
          if (showFloatingToolbar) {
            setShowFloatingToolbarState(true);
          }
        } catch (error) {
          // Se houver erro ao obter bounds, ocultar toolbar
          setShowFloatingToolbarState(false);
        }
      } else {
        setShowFloatingToolbarState(false);
      }
    };

    // Atualizar posição ao scrollar ou redimensionar
    const handleScroll = () => {
      if (!showFloatingToolbarState) return;

      requestAnimationFrame(() => {
        const quill = quillRef.current?.getEditor();
        if (!quill) return;

        // getSelection(true) rouba o foco. Para scroll, queremos apenas verificar se há seleção sem focar.
        const range = quill.getSelection();
        if (range && range.length > 0) {
          updateFloatingToolbar();
        }
      });
    };

    const handleResize = () => {
      requestAnimationFrame(updateFloatingToolbar);
    };

    // Event listeners para seleção de texto
    quill.on('selection-change', (range) => {
      if (range && range.length > 0) {
        updateFloatingToolbar();
      } else {
        setShowFloatingToolbarState(false);
      }
    });
    quill.on('text-change', updateFloatingToolbar);

    const editorContainer = quill.container.parentElement;
    if (editorContainer) {
      editorContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      quill.off('selection-change');
      quill.off('text-change', updateFloatingToolbar);
      if (editorContainer) {
        editorContainer.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [showFloatingToolbar, showFloatingToolbarState]); // Dependências ajustadas

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
          onFocus={onFocus}
          onBlur={onBlur}
          tabIndex={0}
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
};

export default RichTextEditor;

