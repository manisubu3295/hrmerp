import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../middleware/error.middleware';

// Store uploads in apps/api/uploads/<sub-folder>
// Sub-folders: documents, receipts, photos
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'text/csv',
]);

const MAX_FILE_SIZE_MB = 10;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    cb(null, `${timestamp}-${random}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new AppError(400, `File type ${file.mimetype} is not allowed`));
  } else {
    cb(null, true);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

/**
 * Returns the public URL for a stored file.
 * In production, swap this to return the S3/CDN URL.
 */
export function fileUrl(filename: string): string {
  const baseUrl = process.env['API_BASE_URL'] ?? 'http://localhost:4000';
  return `${baseUrl}/uploads/${filename}`;
}
