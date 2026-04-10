import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import path from 'path';
import { upload, fileUrl } from '../lib/upload';
import { AppError } from '../middleware/error.middleware';

const router = Router();

/**
 * POST /upload
 * Single file upload. Returns { url, filename, mimetype, size }.
 * Auth: any authenticated user (JWT required by global middleware).
 */
router.post(
  '/',
  upload.single('file') as unknown as RequestHandler,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.file) {
        throw new AppError(400, 'No file provided');
      }
      res.status(201).json({
        success: true,
        data: {
          url: fileUrl(req.file.filename),
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
