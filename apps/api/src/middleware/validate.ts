import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Zod validation middleware factory.
 * Validates req.body against the given schema.
 * On success, replaces req.body with the parsed (coerced) data.
 * On failure, responds 400 with flattened field errors.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: result.error.flatten(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
