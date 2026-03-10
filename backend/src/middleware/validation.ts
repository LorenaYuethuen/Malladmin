import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, AnyZodObject } from 'zod';
import { ValidationError } from '../utils/errors';

export function validateRequest(schema: AnyZodObject | {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If schema is a ZodObject with body/query/params structure
      if ('shape' in schema && (schema.shape.body || schema.shape.query || schema.shape.params)) {
        const validated = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        
        if (validated.body) req.body = validated.body;
        if (validated.query) req.query = validated.query;
        if (validated.params) req.params = validated.params;
      } 
      // Otherwise treat it as an object with body/query/params properties
      else {
        const schemaObj = schema as { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema };
        if (schemaObj.body) {
          req.body = await schemaObj.body.parseAsync(req.body);
        }
        if (schemaObj.query) {
          req.query = await schemaObj.query.parseAsync(req.query);
        }
        if (schemaObj.params) {
          req.params = await schemaObj.params.parseAsync(req.params);
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', { fields: details }));
      } else {
        next(error);
      }
    }
  };
}
