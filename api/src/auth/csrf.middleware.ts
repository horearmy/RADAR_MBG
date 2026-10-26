import type { RequestHandler } from 'express';
import { verifyDoubleSubmitCsrf } from './auth.security.js';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createCsrfMiddleware(): RequestHandler {
  return (request, response, next) => {
    if (!mutatingMethods.has(request.method)) {
      next();
      return;
    }

    const origin = request.get('origin');
    const allowedOrigins = (process.env.WEB_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((value) => value.trim());
    const tokenValid = verifyDoubleSubmitCsrf(
      request.cookies?.radar_csrf,
      request.get('x-csrf-token'),
    );

    if (!origin || !allowedOrigins.includes(origin) || !tokenValid) {
      response.setHeader('Cache-Control', 'no-store');
      response.status(403).json({
        code: 'CSRF_INVALID',
        message: 'Permintaan tidak dapat diverifikasi.',
      });
      return;
    }

    next();
  };
}
