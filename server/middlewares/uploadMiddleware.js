const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isServerless = Boolean(
  process.env.NETLIFY || 
  process.env.AWS_LAMBDA_FUNCTION_NAME || 
  process.env.LAMBDA_TASK_ROOT
);

// En Serverless (Netlify/AWS Lambda) solo el directorio temporal es de lectura/escritura
const uploadsDir = isServerless
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Uploads] Nota sobre directorio de subidas:', e.message);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `upload_${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes JPEG/JPG/PNG/WEBP.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // Máximo 15MB antes de compresión
  },
  fileFilter: fileFilter
});

module.exports = {
  upload,
  uploadsDir
};
