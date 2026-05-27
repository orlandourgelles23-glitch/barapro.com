// ─── Constantes compartidas BARAPRO ──────────────────────────────────────────

export const PDL_CATEGORIES: Record<string, string> = {
  economico_productivo: "Económico-Productivo",
  sociocultural: "Sociocultural",
  ambiental: "Ambiental",
  institucional: "Institucional",
  id_innovacion: "I+D+i",
};

export const INVESTMENT_CATEGORIES: Record<string, string> = {
  activo_fijo: "Activo Fijo",
  construccion: "Construcción",
  capital_trabajo: "Capital de Trabajo",
  gastos_previos: "Gastos Previos",
  repuestos: "Repuestos",
  subcontrataciones: "Subcontrataciones",
};

export const INVESTMENT_CATEGORY_OPTIONS = [
  { value: "activo_fijo", label: "Activo Fijo" },
  { value: "construccion", label: "Construcción" },
  { value: "capital_trabajo", label: "Capital de Trabajo" },
  { value: "gastos_previos", label: "Gastos Previos" },
  { value: "repuestos", label: "Repuestos" },
  { value: "subcontrataciones", label: "Subcontrataciones" },
];

export const FINANCING_SOURCE_TYPES: Record<string, string> = {
  capital_propio: "Capital Propio",
  credito_bancario: "Crédito Bancario",
  aportes_socios: "Aportes de Socios",
  fondo_desarrollo: "Fondo de Desarrollo",
  otro: "Otro",
};

export const FINANCING_SOURCE_OPTIONS = [
  { value: "capital_propio", label: "Capital Propio" },
  { value: "credito_bancario", label: "Crédito Bancario" },
  { value: "aportes_socios", label: "Aportes de Socios" },
  { value: "fondo_desarrollo", label: "Fondo de Desarrollo" },
  { value: "otro", label: "Otro" },
];

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  nuevo: "Nuevo",
  ampliacion: "Ampliación",
  remodelacion: "Remodelación",
  reposicion: "Reposición",
};

export const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export const SENSITIVITY_STEPS = [-30, -20, -10, -5, 0, 5, 10, 20, 30];
