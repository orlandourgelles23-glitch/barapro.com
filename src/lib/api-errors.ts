/**
 * BARAPRO v10.1 — API Error Sanitization
 * 
 * Centralized error handling for API routes.
 * Sanitizes error messages to avoid exposing internal details.
 * Provides consistent error response format.
 */

import { NextResponse } from 'next/server';

// ─── Error Response Types ────────────────────────────────────────────

interface ApiErrorOptions {
  status?: number;
  code?: string;
  message: string;
  details?: unknown;
  sanitized?: boolean;
}

// ─── Error Response Builder ──────────────────────────────────────────

export function apiError(options: ApiErrorOptions): NextResponse {
  const { status = 500, code, message, details, sanitized = false } = options;

  // Sanitize details if present and not already marked as sanitized
  let safeDetails = details;
  if (details && !sanitized) {
    safeDetails = sanitizeDetails(details);
  }

  const response: Record<string, unknown> = {
    error: message,
    ...(code && { code }),
    ...(safeDetails !== undefined && { details: safeDetails }),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status });
}

// ─── Predefined Error Helpers ────────────────────────────────────────

export function badRequest(message: string, details?: unknown) {
  return apiError({ status: 400, code: 'BAD_REQUEST', message, details, sanitized: true });
}

export function unauthorized(message = 'Autenticación requerida') {
  return apiError({ status: 401, code: 'UNAUTHORIZED', message });
}

export function forbidden(message = 'Sin permisos suficientes') {
  return apiError({ status: 403, code: 'FORBIDDEN', message });
}

export function notFound(message = 'Recurso no encontrado') {
  return apiError({ status: 404, code: 'NOT_FOUND', message });
}

export function validationError(errors: Array<{ field: string; message: string }>) {
  return apiError({
    status: 422,
    code: 'VALIDATION_ERROR',
    message: 'Datos de entrada no válidos',
    details: errors,
    sanitized: true,
  });
}

export function conflictError(message: string) {
  return apiError({ status: 409, code: 'CONFLICT', message });
}

export function tooManyRequests(message = 'Demasiadas peticiones. Intente nuevamente más tarde.') {
  return apiError({ status: 429, code: 'RATE_LIMITED', message });
}

export function internalError(err: unknown, context?: string) {
  // Log the real error for debugging (server-side only)
  if (context) {
    console.error(`[${context}] Internal error:`, err);
  } else {
    console.error('Internal error:', err);
  }

  // Never expose internal error details to client
  return apiError({
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor. Intente nuevamente.',
  });
}

// ─── Sanitization ────────────────────────────────────────────────────

function sanitizeDetails(details: unknown): unknown {
  if (details === null || details === undefined) return details;

  // Handle arrays
  if (Array.isArray(details)) {
    return details.map(sanitizeDetails);
  }

  // Handle objects
  if (typeof details === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      // Remove sensitive keys
      if (isSensitiveKey(key)) continue;
      sanitized[key] = sanitizeDetails(value);
    }
    return sanitized;
  }

  // Handle strings - remove potential SQL/NoSQL injection patterns
  if (typeof details === 'string') {
    return details.substring(0, 500); // Truncate long strings
  }

  return details;
}

function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /authorization/i,
    /cookie/i,
    /session/i,
    /private/i,
    /credential/i,
    /api[_-]?key/i,
  ];
  return sensitivePatterns.some(pattern => pattern.test(key));
}

// ─── Request Body Parser ─────────────────────────────────────────────

export async function safeParseBody<T = Record<string, unknown>>(
  request: Request,
  maxBodySize: number = 5 * 1024 * 1024 // 5MB default
): Promise<{ data: T | null; error: NextResponse | null }> {
  // Check Content-Type
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {
      data: null,
      error: badRequest('El Content-Type debe ser application/json'),
    };
  }

  // Check Content-Length
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxBodySize) {
    return {
      data: null,
      error: apiError({
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: `El cuerpo de la petición no debe exceder ${Math.round(maxBodySize / 1024 / 1024)}MB`,
      }),
    };
  }

  try {
    const body = await request.json() as T;
    return { data: body, error: null };
  } catch {
    return {
      data: null,
      error: badRequest('El cuerpo de la petición no es JSON válido'),
    };
  }
}

// ─── Success Response Helpers ────────────────────────────────────────

export function apiSuccess<T>(data: T, status?: number, meta?: Record<string, unknown>) {
  const response: Record<string, unknown> = {
    data,
    ...(meta && { meta }),
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response, { status });
}

export function apiCreated<T>(data: T) {
  return apiSuccess(data, 201);
}

export function apiDeleted(message = 'Eliminado correctamente') {
  return apiSuccess({ message }, 200);
}

export function apiNoContent() {
  return new NextResponse(null, { status: 204 });
}
