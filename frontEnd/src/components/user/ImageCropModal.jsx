import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import './ImageCropModal.css';

/**
 * Modal para cortar imagem em formato circular
 */
const ImageCropModal = ({ 
  imageSrc, 
  onClose, 
  onCropComplete 
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropChange = useCallback((crop) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Tamanho do canvas (círculo)
    const size = Math.min(pixelCrop.width, pixelCrop.height);
    canvas.width = size;
    canvas.height = size;

    // Criar máscara circular
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
    ctx.clip();

    // Desenhar imagem cortada
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      size,
      size
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas está vazio');
          return;
        }
        const fileUrl = URL.createObjectURL(blob);
        resolve({ blob, fileUrl });
      }, 'image/jpeg', 0.95);
    });
  };

  const handleSave = async () => {
    try {
      if (!croppedAreaPixels) {
        return;
      }

      const { blob } = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      // Criar arquivo a partir do blob
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      
      onCropComplete(file);
      onClose();
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
    }
  };

  return (
    <div className="image-crop-modal-overlay" onClick={onClose}>
      <div className="image-crop-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="image-crop-modal-header">
          <h3>Cortar Foto</h3>
          <button className="image-crop-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="image-crop-modal-body">
          <div className="image-crop-container">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1} // Círculo (1:1)
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteCallback}
              cropShape="round" // Formato circular
              showGrid={false}
            />
          </div>
          
          <div className="image-crop-controls">
            <label className="image-crop-zoom-label">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="image-crop-zoom-slider"
              />
            </label>
          </div>
        </div>
        
        <div className="image-crop-modal-footer">
          <button className="image-crop-btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="image-crop-btn-save" onClick={handleSave}>
            <i className="fas fa-check"></i>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;




