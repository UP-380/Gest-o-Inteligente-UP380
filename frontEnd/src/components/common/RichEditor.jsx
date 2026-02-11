import React, { useState, useEffect, useRef } from 'react';
import { markdownToHtml, htmlToMarkdown } from '../../utils/richEditorMarkdown';
import { comunicacaoAPI } from '../../services/comunicacao.service';

/**
 * Editor rico (contentEditable) com suporte a texto, colar e arrastar imagens/vídeos.
 * Upload usa o mesmo endpoint do chat (POST /upload/chamado). Conteúdo é exposto em Markdown.
 */
const RichEditor = ({
  initialValue,
  onContentChange,
  placeholder,
  minHeight = '100px',
  autoFocus = false,
  uploadMediaFn = comunicacaoAPI.uploadMedia,
  showUploadTrigger = false,
}) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [editorEmpty, setEditorEmpty] = useState(true);

  useEffect(() => {
    if (editorRef.current) {
      if (!editorRef.current.innerHTML && initialValue) {
        editorRef.current.innerHTML = markdownToHtml(initialValue);
        setEditorEmpty(false);
      }
      if (initialValue === '' && editorRef.current.innerHTML !== '') {
        editorRef.current.innerHTML = '';
        setEditorEmpty(true);
      }
    }
  }, [initialValue]);

  const handleInput = () => {
    if (editorRef.current) {
      const markdown = htmlToMarkdown(editorRef.current.innerHTML);
      onContentChange(markdown);
      const hasContent = !!(
        (editorRef.current.innerText && editorRef.current.innerText.trim()) ||
        editorRef.current.querySelector?.('img, video')
      );
      setEditorEmpty(!hasContent);
    }
  };

  const insertAtCursor = (element) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    range.insertNode(element);
    range.collapse(false);
  };

  const handleUpload = async (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert('Arquivo > 50MB');
      return;
    }
    setUploading(true);
    const id = 'loader-' + Date.now();
    const placeholderImg = document.createElement('img');
    placeholderImg.id = id;
    placeholderImg.src = 'https://cdnjs.cloudflare.com/ajax/libs/galleriffic/2.0.1/css/loader.gif';
    placeholderImg.style.maxWidth = '30px';
    insertAtCursor(placeholderImg);

    try {
      const data = new FormData();
      data.append('file', file);
      const response = await uploadMediaFn(data);

      if (response.success) {
        const url = response.data.url;
        const isVideo = file.type.startsWith('video');
        const loader = document.getElementById(id);
        if (loader) {
          const wrapper = document.createElement('span');
          wrapper.contentEditable = 'false';
          wrapper.style.cssText = 'position: relative; display: inline-block; margin: 5px 0; vertical-align: bottom;';

          let media;
          if (isVideo) {
            media = document.createElement('video');
            media.src = url;
            media.controls = true;
          } else {
            media = document.createElement('img');
            media.src = url;
          }
          media.style.cssText = 'max-width: 100%; max-height: 300px; border-radius: 8px; display: block;';

          const btn = document.createElement('span');
          btn.innerHTML = '&times;';
          btn.className = 'media-remove-btn';
          btn.contentEditable = 'false';
          btn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 24px; height: 24px; text-align: center; line-height: 22px; cursor: pointer; font-weight: bold; font-size: 16px; z-index: 10; transition: background 0.2s;';
          btn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            wrapper.remove();
            handleInput();
          };
          btn.onmouseenter = () => (btn.style.background = 'red');
          btn.onmouseleave = () => (btn.style.background = 'rgba(0,0,0,0.6)');

          wrapper.appendChild(media);
          wrapper.appendChild(btn);
          loader.replaceWith(wrapper);
          const space = document.createTextNode(' \u00A0');
          wrapper.after(space);
          const sel = window.getSelection();
          const r = document.createRange();
          r.setStartAfter(wrapper);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          handleInput();
        }
      }
    } catch (error) {
      console.error('Upload fail', error);
      const loader = document.getElementById(id);
      if (loader) loader.remove();
      const msg =
        error?.message?.includes('502') || error?.message?.includes('Bad Gateway')
          ? 'Falha no upload (erro 502 - servidor). Tente novamente em instantes.'
          : 'Falha no upload. Verifique a conexão e tente novamente.';
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const ext = blob.type.split('/')[1] || 'png';
          const fileName = `pasted_image_${Date.now()}.${ext}`;
          const file = new File([blob], fileName, { type: blob.type || 'image/png' });
          handleUpload(file);
        }
        return;
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) handleUpload(files[0]);
  };

  const handleUploadTriggerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      handleUpload(files[i]);
    }
    e.target.value = '';
  };

  return (
    <div
      className="rich-editor-wrapper"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        backgroundColor: 'white',
        cursor: 'text',
        position: 'relative',
        width: '100%',
      }}
      onClick={() => editorRef.current?.focus()}
    >
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          minHeight,
          padding: '12px',
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '400px',
          overflowY: 'auto',
          color: 'black',
        }}
      />
      {showUploadTrigger && editorEmpty && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <button
              type="button"
              onClick={handleUploadTriggerClick}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                border: '2px dashed rgba(14, 59, 111, 0.4)',
                background: 'rgba(14, 59, 111, 0.06)',
                color: 'rgba(14, 59, 111, 0.5)',
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(14, 59, 111, 0.12)';
                e.currentTarget.style.color = 'rgba(14, 59, 111, 0.7)';
                e.currentTarget.style.borderColor = 'rgba(14, 59, 111, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(14, 59, 111, 0.06)';
                e.currentTarget.style.color = 'rgba(14, 59, 111, 0.5)';
                e.currentTarget.style.borderColor = 'rgba(14, 59, 111, 0.4)';
              }}
              title="Enviar imagens e vídeos"
              aria-label="Enviar imagens e vídeos"
            >
              <i className="fas fa-cloud-upload-alt" style={{ fontSize: '28px' }} />
            </button>
          </div>
        </>
      )}
      {placeholder && !editorRef.current?.innerText && !editorRef.current?.innerHTML && (
        <div style={{ position: 'absolute', top: '12px', left: '12px', color: '#94a3b8', pointerEvents: 'none' }}>
          {placeholder}
        </div>
      )}
      {uploading && (
        <div style={{ position: 'absolute', top: '5px', right: '5px' }}>
          <i className="fas fa-spinner fa-spin" style={{ color: '#0e3b6f' }} />
        </div>
      )}
    </div>
  );
};

export default RichEditor;
