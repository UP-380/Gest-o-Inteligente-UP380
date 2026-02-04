
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar armazenamento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Caminho relativo à raiz do projeto backend (onde roda o server)
        // Considerando que o server roda em backEnd/src/index.js ou backEnd/server.js
        // Vamos salvar em ../../public/uploads/chamados para ficar acessível
        // Se a estrutura é:
        // /backEnd
        //    /src
        // /uploads (na raiz junto com frontEnd e backEnd? ou dentro de backEnd?)

        // O index.js serve static de '../../' (raiz da aplicação).
        // Então salvar em c:\Aplicacao\Gest-o-Inteligente-UP380\uploads\chamados é ideal.

        const uploadDir = path.join(__dirname, '../../../uploads/chamados');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'media-' + uniqueSuffix + ext);
    }
});

// Filtro de arquivos
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/ogg'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado. Apenas imagens e vídeos são permitidos.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limite (principalmente para vídeos)
    },
    fileFilter: fileFilter
});

/**
 * Upload de Mídia (Imagem/Vídeo)
 */
exports.uploadMedia = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
        }

        // Retorna o caminho relativo acessível publicamente via static files
        // Como o static serve a raiz, o caminho é /uploads/chamados/nome-arquivo
        // Normaliza as barras para forward slash para URL
        const url = `/uploads/chamados/${req.file.filename}`;

        return res.json({
            success: true,
            data: {
                url: url,
                filename: req.file.filename,
                mimetype: req.file.mimetype
            }
        });

    } catch (error) {
        console.error('Erro no upload de mídia:', error);
        return res.status(500).json({ success: false, error: 'Erro ao processar upload.' });
    }
};

exports.multerMiddleware = upload;
