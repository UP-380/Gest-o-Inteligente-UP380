/**
 * Helpers para o RichEditor: conversão Markdown <-> HTML (mídia como imagens/vídeos).
 */

export const markdownToHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="media-label">(imagem)</a>')
    .replace(/\[video\]\((.*?)\)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="media-label">(video)</a>');
};

export const htmlToMarkdown = (html) => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const removeBtns = temp.querySelectorAll('.media-remove-btn');
  removeBtns.forEach((btn) => btn.remove());

  const images = temp.querySelectorAll('img');
  images.forEach((img) => {
    const markdown = `![${img.alt || 'image'}](${img.src})`;
    img.replaceWith(document.createTextNode(markdown));
  });

  const videos = temp.querySelectorAll('video');
  videos.forEach((vid) => {
    const markdown = `[video](${vid.src})`;
    vid.replaceWith(document.createTextNode(markdown));
  });

  const mediaLinks = temp.querySelectorAll('a.media-label');
  mediaLinks.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const textContent = (a.textContent || '').trim();
    const markdown = textContent === '(video)' ? `[video](${href})` : `![imagem](${href})`;
    a.replaceWith(document.createTextNode(markdown));
  });

  let text = temp.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div\s*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]+>/g, '');

  const decoder = document.createElement('textarea');
  decoder.innerHTML = text;
  return decoder.value;
};
