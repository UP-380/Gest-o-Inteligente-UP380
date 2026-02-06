const multer = require('multer');
const path = require('path');
const { uploadFileToStorage } = require('../utils/storage');

// Usar memória para enviar o arquivo ao Supabase Storage
const storage = multer.memoryStorage();

// Filtro de arquivos
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/ogg'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado. Apenas imagens e vídeos são permitidos.'), false);
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limite (principalmente para vídeos)
    },
    fileFilter
});

const BUCKET_CHAMADOS = 'chamados';

/**
 * Upload de Mídia (Imagem/Vídeo) para Supabase Storage
 */
exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(req.file.originalname) || '';
        const fileName = 'media-' + uniqueSuffix + ext;

        const uploadResult = await uploadFileToStorage(
            req.file.buffer,
            BUCKET_CHAMADOS,
            fileName,
            req.file.mimetype
        );

        return res.json({
            success: true,
            data: {
                url: uploadResult.publicUrl,
                filename: fileName,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        console.error('Erro no upload de mídia:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro ao processar upload.',
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
};

exports.multerMiddleware = upload;
