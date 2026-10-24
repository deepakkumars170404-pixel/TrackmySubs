import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { config, getSupabaseAdminClient, createUserClient } from './config.js';
import './types.js';

// Centralized App Error class
export class AppError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Zod Validation Middlewares
export function validateBody(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        res.status(400).json({ success: false, error: 'Validation failed', details });
        return;
      }
      next(error);
    }
  };
}

export function validateQuery(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      Object.assign(req.query, parsed);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        res.status(400).json({ success: false, error: 'Invalid query parameters', details });
        return;
      }
      next(error);
    }
  };
}

// Supabase Auth Middlewares
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token) {
    try {
      const adminClient = getSupabaseAdminClient();
      const { data: { user }, error } = await adminClient.auth.getUser(token);

      if (error || !user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or expired authentication token'
        });
        return;
      }

      req.user = { id: user.id, email: user.email || '', token };
      req.supabaseClient = createUserClient(token);
      next();
      return;
    } catch (err) {
      console.error('[Auth Middleware] Verification error:', err);
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Could not verify authentication credentials'
      });
      return;
    }
  }

  // Development / Demo Fallback Mode
  if (config.nodeEnv !== 'production') {
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'deepak@example.com',
      token: 'demo-dev-token'
    };
    req.supabaseClient = getSupabaseAdminClient();
    next();
    return;
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: Authorization header with Bearer token is required'
  });
}

export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token) {
    try {
      const adminClient = getSupabaseAdminClient();
      const { data: { user } } = await adminClient.auth.getUser(token);
      if (user) {
        req.user = { id: user.id, email: user.email || '', token };
        req.supabaseClient = createUserClient(token);
      }
    } catch {
      // Ignored for optional auth
    }
  }

  if (!req.supabaseClient) {
    req.supabaseClient = getSupabaseAdminClient();
  }

  next();
}

// Error Handler Middleware
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const message = err.message || 'An unexpected internal server error occurred';

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    details: 'details' in err ? err.details : undefined
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.nodeEnv === 'development' && {
      stack: err.stack,
      details: 'details' in err ? err.details : undefined
    })
  });
}

