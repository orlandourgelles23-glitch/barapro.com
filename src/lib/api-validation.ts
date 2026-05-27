/**
 * BARAPRO v10.1 — API Input Validation
 * 
 * Lightweight validation utilities for API routes.
 * Uses runtime type guards instead of Zod to minimize bundle size.
 * Validates request bodies, query params, and path params.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ─── Validators ──────────────────────────────────────────────────────

export function required(value: unknown, field: string): ValidationError | null {
  if (value === undefined || value === null || value === '') {
    return { field, message: `El campo "${field}" es obligatorio` };
  }
  return null;
}

export function isString(value: unknown, field: string): ValidationError | null {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    return { field, message: `El campo "${field}" debe ser texto` };
  }
  return null;
}

export function isNumber(value: unknown, field: string): ValidationError | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (isNaN(n)) {
    return { field, message: `El campo "${field}" debe ser numérico` };
  }
  return null;
}

export function isPositiveNumber(value: unknown, field: string): ValidationError | null {
  const numErr = isNumber(value, field);
  if (numErr) return numErr;
  if (value !== undefined && value !== null && Number(value) < 0) {
    return { field, message: `El campo "${field}" debe ser mayor o igual a 0` };
  }
  return null;
}

export function isPositiveStrict(value: unknown, field: string): ValidationError | null {
  const numErr = isNumber(value, field);
  if (numErr) return numErr;
  if (value !== undefined && value !== null && Number(value) <= 0) {
    return { field, message: `El campo "${field}" debe ser mayor a 0` };
  }
  return null;
}

export function isInRange(value: unknown, field: string, min: number, max: number): ValidationError | null {
  const numErr = isNumber(value, field);
  if (numErr) return numErr;
  if (value !== undefined && value !== null) {
    const n = Number(value);
    if (n < min || n > max) {
      return { field, message: `El campo "${field}" debe estar entre ${min} y ${max}` };
    }
  }
  return null;
}

export function isOneOf<T extends string>(value: unknown, field: string, allowed: T[]): ValidationError | null {
  if (value === undefined || value === null) return null;
  if (!allowed.includes(value as T)) {
    return { field, message: `El campo "${field}" debe ser uno de: ${allowed.join(', ')}` };
  }
  return null;
}

export function isArray(value: unknown, field: string): ValidationError | null {
  if (value !== undefined && value !== null && !Array.isArray(value)) {
    return { field, message: `El campo "${field}" debe ser un arreglo` };
  }
  return null;
}

export function isNonEmptyArray(value: unknown, field: string): ValidationError | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length === 0) {
    return { field, message: `El campo "${field}" debe ser un arreglo no vacío` };
  }
  return null;
}

export function maxLength(value: unknown, field: string, max: number): ValidationError | null {
  const strErr = isString(value, field);
  if (strErr) return strErr;
  if (value !== undefined && value !== null && String(value).length > max) {
    return { field, message: `El campo "${field}" no debe exceder ${max} caracteres` };
  }
  return null;
}

export function isInteger(value: unknown, field: string): ValidationError | null {
  const numErr = isNumber(value, field);
  if (numErr) return numErr;
  if (value !== undefined && value !== null && !Number.isInteger(Number(value))) {
    return { field, message: `El campo "${field}" debe ser un número entero` };
  }
  return null;
}

export function isPercentage(value: unknown, field: string): ValidationError | null {
  const numErr = isNumber(value, field);
  if (numErr) return numErr;
  if (value !== undefined && value !== null) {
    const n = Number(value);
    if (n < 0 || n > 100) {
      return { field, message: `El campo "${field}" debe ser un porcentaje entre 0 y 100` };
    }
  }
  return null;
}

export function isUUID(value: unknown, field: string): ValidationError | null {
  const strErr = isString(value, field);
  if (strErr) return strErr;
  if (value !== undefined && value !== null) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(String(value))) {
      return { field, message: `El campo "${field}" debe ser un UUID válido` };
    }
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function validate(
  checks: (ValidationError | null)[]
): ValidationResult {
  const errors = checks.filter((e): e is ValidationError => e !== null);
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateWith(req: unknown, fieldChecks: [string, (v: unknown, f: string) => ValidationError | null][]): ValidationResult {
  if (!req || typeof req !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'El cuerpo de la petición no es válido' }] };
  }
  const body = req as Record<string, unknown>;
  const errors: ValidationError[] = [];
  for (const [field, check] of fieldChecks) {
    const err = check(body[field], field);
    if (err) errors.push(err);
  }
  return { valid: errors.length === 0, errors };
}

// ─── Specific Schemas ────────────────────────────────────────────────

/** Validate POST /api/projects (create project) */
export function validateCreateProject(body: Record<string, unknown>): ValidationResult {
  return validateWith(body, [
    ['name', (v, f) => required(v, f)],
    ['name', (v, f) => maxLength(v, f, 200)],
    ['initialInvestment', (v, f) => required(v, f)],
    ['initialInvestment', (v, f) => isPositiveNumber(v, f)],
    ['discountRate', (v, f) => required(v, f)],
    ['discountRate', (v, f) => isNumber(v, f)],
    ['projectDuration', (v, f) => required(v, f)],
    ['projectDuration', (v, f) => isInteger(v, f)],
    ['projectDuration', (v, f) => isInRange(v, f, 1, 240)],
    ['currency', (v, f) => isOneOf(v, f, ['CUP', 'MLC', 'CL'])],
    ['projectType', (v, f) => isOneOf(v, f, ['nuevo', 'ampliacion', 'rehabilitacion'])],
    ['taxRateSales', (v, f) => isPercentage(v, f)],
    ['taxRateIncome', (v, f) => isPercentage(v, f)],
    ['socialSecurityContribution', (v, f) => isPercentage(v, f)],
    ['description', (v, f) => maxLength(v, f, 2000)],
    ['objectiveGeneral', (v, f) => maxLength(v, f, 2000)],
    ['objectiveSpecific', (v, f) => maxLength(v, f, 5000)],
    ['assumptions', (v, f) => maxLength(v, f, 5000)],
    ['cashFlows', (v, f) => isArray(v, f)],
    ['financingSources', (v, f) => isArray(v, f)],
    ['investmentItems', (v, f) => isArray(v, f)],
    ['annualProjections', (v, f) => isArray(v, f)],
  ]);
}

/** Validate PUT /api/projects/[id] (update project) */
export function validateUpdateProject(body: Record<string, unknown>): ValidationResult {
  return validateWith(body, [
    ['name', (v, f) => maxLength(v, f, 200)],
    ['initialInvestment', (v, f) => isPositiveNumber(v, f)],
    ['discountRate', (v, f) => isNumber(v, f)],
    ['projectDuration', (v, f) => isInteger(v, f)],
    ['projectDuration', (v, f) => isInRange(v, f, 1, 240)],
    ['currency', (v, f) => isOneOf(v, f, ['CUP', 'MLC', 'CL'])],
    ['projectType', (v, f) => isOneOf(v, f, ['nuevo', 'ampliacion', 'rehabilitacion'])],
    ['taxRateSales', (v, f) => isPercentage(v, f)],
    ['taxRateIncome', (v, f) => isPercentage(v, f)],
    ['socialSecurityContribution', (v, f) => isPercentage(v, f)],
    ['description', (v, f) => maxLength(v, f, 2000)],
    ['cashFlows', (v, f) => isArray(v, f)],
    ['financingSources', (v, f) => isArray(v, f)],
    ['investmentItems', (v, f) => isArray(v, f)],
    ['annualProjections', (v, f) => isArray(v, f)],
  ]);
}

/** Validate POST /api/projects/[id]/financing (create financing source) */
export function validateCreateFinancing(body: Record<string, unknown>): ValidationResult {
  return validateWith(body, [
    ['sourceName', (v, f) => required(v, f)],
    ['sourceName', (v, f) => maxLength(v, f, 200)],
    ['amount', (v, f) => required(v, f)],
    ['amount', (v, f) => isPositiveNumber(v, f)],
    ['interestRate', (v, f) => isNumber(v, f)],
    ['interestRate', (v, f) => isPercentage(v, f)],
    ['term', (v, f) => isInteger(v, f)],
    ['term', (v, f) => isInRange(v, f, 1, 480)],
    ['gracePeriod', (v, f) => isInteger(v, f)],
    ['gracePeriod', (v, f) => isInRange(v, f, 0, 120)],
  ]);
}

/** Validate POST /api/projects/[id]/investment-items (create investment item) */
export function validateCreateInvestmentItem(body: Record<string, unknown>): ValidationResult {
  return validateWith(body, [
    ['category', (v, f) => required(v, f)],
    ['category', (v, f) => maxLength(v, f, 100)],
    ['itemName', (v, f) => required(v, f)],
    ['itemName', (v, f) => maxLength(v, f, 200)],
    ['quantity', (v, f) => required(v, f)],
    ['quantity', (v, f) => isPositiveNumber(v, f)],
    ['unitPrice', (v, f) => required(v, f)],
    ['unitPrice', (v, f) => isPositiveNumber(v, f)],
    ['usefulLife', (v, f) => isInteger(v, f)],
    ['usefulLife', (v, f) => isInRange(v, f, 1, 100)],
    ['depreciationRate', (v, f) => isPercentage(v, f)],
    ['currency', (v, f) => isOneOf(v, f, ['CUP', 'MLC', 'CL'])],
  ]);
}

/** Validate POST /api/projects/[id]/projections (bulk upsert projections) */
export function validateProjections(body: Record<string, unknown>): ValidationResult {
  const projErr = isNonEmptyArray(body.projections, 'projections');
  if (projErr) return { valid: false, errors: [projErr] };

  const projections = body.projections as unknown[];
  const errors: ValidationError[] = [];

  projections.forEach((proj, idx) => {
    if (!proj || typeof proj !== 'object') {
      errors.push({ field: `projections[${idx}]`, message: 'Cada proyección debe ser un objeto' });
      return;
    }
    const p = proj as Record<string, unknown>;
    const checks = validateWith(p, [
      ['year', (v, f) => required(v, `projections[${idx}].${f}`)],
      ['year', (v, f) => isInteger(v, `projections[${idx}].${f}`)],
      ['revenue', (v, f) => isNumber(v, `projections[${idx}].${f}`)],
      ['variableCosts', (v, f) => isNumber(v, `projections[${idx}].${f}`)],
      ['fixedCosts', (v, f) => isNumber(v, `projections[${idx}].${f}`)],
      ['depreciation', (v, f) => isNumber(v, `projections[${idx}].${f}`)],
    ]);
    errors.push(...checks.errors);
  });

  return { valid: errors.length === 0, errors };
}

/** Validate cash flow items in project body */
export function validateCashFlowItems(cashFlows: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];
  cashFlows.forEach((cf, idx) => {
    if (!cf || typeof cf !== 'object') {
      errors.push({ field: `cashFlows[${idx}]`, message: 'Cada flujo de caja debe ser un objeto' });
      return;
    }
    const c = cf as Record<string, unknown>;
    const checks = validateWith(c, [
      ['period', (v, f) => required(v, `cashFlows[${idx}].${f}`)],
      ['period', (v, f) => isInteger(v, `cashFlows[${idx}].${f}`)],
      ['period', (v, f) => isInRange(v, `cashFlows[${idx}].${f}`, 0, 480)],
      ['amount', (v, f) => required(v, `cashFlows[${idx}].${f}`)],
      ['amount', (v, f) => isNumber(v, `cashFlows[${idx}].${f}`)],
    ]);
    errors.push(...checks.errors);
  });
  return errors;
}

/** Validate financing source items in project body */
export function validateFinancingItems(items: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];
  items.forEach((fs, idx) => {
    if (!fs || typeof fs !== 'object') {
      errors.push({ field: `financingSources[${idx}]`, message: 'Cada fuente debe ser un objeto' });
      return;
    }
    const f = fs as Record<string, unknown>;
    const checks = validateWith(f, [
      ['sourceName', (v, field) => required(v, `financingSources[${idx}].${field}`)],
      ['amount', (v, field) => required(v, `financingSources[${idx}].${field}`)],
      ['amount', (v, field) => isPositiveNumber(v, `financingSources[${idx}].${field}`)],
    ]);
    errors.push(...checks.errors);
  });
  return errors;
}

/** Validate investment items in project body */
export function validateInvestmentItems(items: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];
  items.forEach((ii, idx) => {
    if (!ii || typeof ii !== 'object') {
      errors.push({ field: `investmentItems[${idx}]`, message: 'Cada partida debe ser un objeto' });
      return;
    }
    const i = ii as Record<string, unknown>;
    const checks = validateWith(i, [
      ['category', (v, field) => required(v, `investmentItems[${idx}].${field}`)],
      ['itemName', (v, field) => required(v, `investmentItems[${idx}].${field}`)],
      ['quantity', (v, field) => required(v, `investmentItems[${idx}].${field}`)],
      ['quantity', (v, field) => isPositiveNumber(v, `investmentItems[${idx}].${field}`)],
      ['unitPrice', (v, field) => required(v, `investmentItems[${idx}].${field}`)],
      ['unitPrice', (v, field) => isPositiveNumber(v, `investmentItems[${idx}].${field}`)],
    ]);
    errors.push(...checks.errors);
  });
  return errors;
}
