# BARAPRO v11

<p align="center">
  <img src="public/logo-barapro.png" alt="BARAPRO Logo" width="120" />
</p>

<p align="center">
  <strong>Sistema de Evaluación Financiera de Viabilidad para Proyectos de Desarrollo Local</strong>
</p>

<p align="center">
  Financial Viability Evaluation System for Local Development Projects — Compliant with <em>Resolución 1/2022 del MINCEX</em> (Cuba)
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-11.0.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License" />
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript" />
</p>

---

## 📋 Tabla de Contenidos / Table of Contents

- [Descripción / Description](#-descripción--description)
- [Características / Features](#-características--features)
- [Stack Tecnológico / Tech Stack](#-stack-tecnológico--tech-stack)
- [Requisitos / Requirements](#-requisitos--requirements)
- [Instalación / Installation](#-instalación--installation)
- [Configuración / Configuration](#-configuración--configuration)
- [Uso / Usage](#-uso--usage)
- [Estructura del Proyecto / Project Structure](#-estructura-del-proyecto--project-structure)
- [API Reference](#-api-reference)
- [Motor Financiero / Financial Engine](#-motor-financiero--financial-engine)
- [Licenciamiento / Licensing](#-licenciamiento--licensing)
- [Despliegue / Deployment](#-despliegue--deployment)
- [Contribuir / Contributing](#-contribuir--contributing)
- [Licencia / License](#-licencia--license)

---

## 📖 Descripción / Description

**BARAPRO** es un sistema profesional de evaluación de viabilidad financiera diseñado para proyectos de desarrollo local (PDL) en Cuba, cumpliendo con la **Resolución 1/2022 del MINCEX**. Realiza cálculos de VAN, TIR, TIRM, períodos de recuperación, relaciones beneficio-costo, puntos de equilibrio, análisis de sensibilidad y modelación de escenarios — todo con soporte de moneda dual (CUP/MLC/CL) conforme a la normativa financiera cubana.

**BARAPRO** is a professional financial viability evaluation system designed for local development projects (PDL) in Cuba, compliant with **Resolution 1/2022 of MINCEX**. It computes NPV, IRR, MIRR, payback periods, benefit-cost ratios, break-even points, sensitivity analyses, and scenario modeling — all with dual-currency support (CUP/MLC/CL) conforming to Cuban financial regulations.

**Usuarios objetivo / Target users:** Analistas financieros y evaluadores de proyectos de gobiernos municipales en Cuba.

---

## ✨ Características / Features

### Módulos Financieros / Financial Modules
- 📊 **Dashboard** — KPIs principales, gráficos de ingresos vs costos, flujo de caja acumulado
- 📝 **Datos del Proyecto** — Información general, monedas, tipos de cambio
- ⚙️ **Parámetros** — 27+ parámetros financieros, tasas por categoría de activo
- 💰 **Ventas** — Ítems de venta, cantidades mensuales, tipo de mercado
- 🏗️ **Presupuesto de Inversión** — Ítems de inversión por categorías con depreciación
- 💵 **Préstamos** — Amortización francesa y alemana, tasas variables, períodos de gracia
- 👥 **Salarios** — Nómina con contribuciones salariales
- 📉 **Costos** — Módulos configurables (B/C/D/F/I/J/K/L)
- 📑 **Estado de Resultados** — Estado financiero de 38 líneas
- 🔄 **Flujo de Caja** — Planeación e inversión según Resolución 1/2022
- 📋 **Balance General** — Proyección del balance
- 🏭 **Depreciación** — Depreciación y amortización
- 🔢 **Indicadores** — 11+ indicadores financieros con paneles duales
- 📐 **Sensibilidad** — Análisis de sensibilidad univariado
- 🎯 **Escenarios** — Comparación pesimista/base/optimista
- 💹 **Capital de Trabajo** — Metodología PDL
- 🌐 **Efecto Cambiario** — Balance en moneda extranjera
- 🏛️ **Distribución de Utilidades** — CAM/retenidas/proyecto
- 🧩 **Marco Lógico** — Jerarquía Fin/Propósito/Componente/Actividad

### Funcionalidades del Sistema / System Features
- 🔐 **Autenticación JWT** con rate limiting y auditoría
- 📜 **Licenciamiento RSA-2048** con 4 niveles (trial/basic/premium/enterprise)
- 🌍 **i18n** — Español (completo) e Inglés (parcial)
- 📤 **Exportación** — Word (.docx), Excel (.xlsx), PDF
- 💾 **Auto-guardado** y backup/importación
- 🤖 **Asistente IA** integrado
- 🌙 **Tema oscuro/claro**
- 📱 **Diseño responsivo**

---

## 🛠️ Stack Tecnológico / Tech Stack

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Framework** | Next.js (App Router) | ^16.1.1 |
| **UI Library** | React | ^19.0.0 |
| **Lenguaje** | TypeScript | ^5 |
| **Estilos** | Tailwind CSS | ^4 |
| **Componentes UI** | shadcn/ui (Radix) | 20+ primitivos |
| **Estado** | Zustand | ^5.0.13 |
| **Base de Datos** | SQLite (Prisma) | ^6.11.1 |
| **Gráficos** | Recharts | ^2.15.4 |
| **Animaciones** | Framer Motion | ^12.23.2 |
| **Autenticación** | JWT (jose, HS256) | ^6.2.3 |
| **Hashing** | bcryptjs | ^3.0.3 |
| **Exportación Word** | docx | ^9.6.1 |
| **Exportación Excel** | SheetJS (xlsx) | ^0.18.5 |
| **Exportación PDF** | jspdf + autotable | ^4.2.1 |
| **Formularios** | React Hook Form + Zod | ^7.60.0 / ^4.0.2 |
| **i18n** | Sistema personalizado | — |

---

## 📦 Requisitos / Requirements

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 (o bun >= 1.0.0)
- **Sistema Operativo:** Windows 10+ (recomendado para despliegue desktop), Linux, macOS

---

## 🚀 Instalación / Installation

### Método Rápido (Windows) / Quick Method (Windows)

Ejecute `INSTALAR.bat` como administrador. Este script:
1. Verifica Node.js
2. Instala dependencias
3. Genera el cliente Prisma
4. Inicializa la base de datos
5. Compila la aplicación en modo standalone

### Método Manual / Manual Method

```bash
# 1. Clonar el repositorio
git clone https://github.com/your-org/barapro.git
cd barapro

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env según sea necesario

# 4. Generar cliente Prisma
npx prisma generate

# 5. Inicializar la base de datos
npx prisma db push

# 6. Sembrar datos iniciales (admin user + trial license)
npx tsx prisma/seed.ts

# 7. Compilar para producción
npm run build

# 8. Iniciar servidor
npm start
```

### Desarrollo / Development

```bash
# Iniciar en modo desarrollo
npm run dev

# La aplicación estará disponible en http://localhost:3000
```

---

## ⚙️ Configuración / Configuration

### Variables de Entorno / Environment Variables

Copie `.env.example` a `.env` y configure:

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Ruta de la base de datos SQLite | `file:../db/custom.db` |
| `AUTH_SECRET_HEX` | Clave de firma JWT (hex, 64 chars) | Auto-generada en primer inicio |
| `PORT` | Puerto del servidor | `3000` |

> **Nota:** Si no se establece `AUTH_SECRET_HEX`, la aplicación genera una automáticamente y la almacena en `.auth-secret`.

### Credenciales por Defecto / Default Credentials

| Campo | Valor |
|-------|-------|
| **Usuario** | `admin` |
| **Contraseña** | `2026` |

> ⚠️ **Importante:** Cambie la contraseña por defecto inmediatamente después de la primera instalación.

---

## 📱 Uso / Usage

1. **Iniciar la aplicación** — Ejecute `INICIAR.bat` o `npm start`
2. **Iniciar sesión** — Use las credenciales por defecto
3. **Crear un proyecto** — Haga clic en "Nuevo Proyecto" en la barra lateral
4. **Configurar parámetros** — Complete datos del proyecto y parámetros financieros
5. **Ingresar datos** — Complete los módulos de ventas, costos, inversión, etc.
6. **Ver indicadores** — Consulte los resultados financieros en tiempo real
7. **Exportar** — Genere informes en Word, Excel o PDF

---

## 📁 Estructura del Proyecto / Project Structure

```
barapro/
├── .github/                    # GitHub Actions, templates
│   ├── workflows/              # CI/CD pipelines
│   └── ISSUE_TEMPLATE/         # Issue templates
├── docs/                       # Documentación adicional
├── prisma/
│   ├── schema.prisma           # Esquema de base de datos
│   └── seed.ts                 # Datos iniciales
├── public/
│   ├── logo-barapro.png        # Logo principal
│   ├── logo.svg                # Logo SVG
│   └── robots.txt              # SEO
├── scripts/
│   ├── generate-auth-secret.js # Generador de clave JWT
│   └── postbuild.js            # Post-build hook
├── src/
│   ├── app/
│   │   ├── api/                # API Routes (App Router)
│   │   │   ├── auth/           # Autenticación
│   │   │   ├── backup/         # Backup/Restore
│   │   │   ├── center-config/  # Configuración del centro
│   │   │   ├── export-docx/    # Exportación Word
│   │   │   ├── license/        # Gestión de licencias
│   │   │   ├── projects/       # CRUD de proyectos
│   │   │   └── users/          # Gestión de usuarios
│   │   ├── globals.css         # Estilos globales
│   │   ├── layout.tsx          # Layout raíz
│   │   └── page.tsx            # Página principal (SPA)
│   ├── components/
│   │   ├── barapro/            # Componentes de negocio
│   │   │   └── shared/         # Componentes compartidos
│   │   ├── ui/                 # shadcn/ui primitivos
│   │   └── providers.tsx       # Proveedores de contexto
│   ├── hooks/                  # Custom hooks
│   ├── lib/
│   │   ├── i18n/               # Internacionalización
│   │   ├── api-auth.ts         # Autenticación API
│   │   ├── api-errors.ts       # Manejo de errores
│   │   ├── api-validation.ts   # Validación de entrada
│   │   ├── auth-store.ts       # Estado de autenticación
│   │   ├── auth-token.ts       # Tokens JWT
│   │   ├── barapro-autosave.ts # Auto-guardado
│   │   ├── barapro-docx.ts     # Generación Word
│   │   ├── barapro-excel.ts    # Import/Export Excel
│   │   ├── barapro-financial.ts# Motor financiero
│   │   ├── barapro-logo.ts     # Componente logo
│   │   ├── barapro-project-manager.ts # Gestión de proyectos
│   │   ├── barapro-store.ts    # Store Zustand principal
│   │   ├── barapro-theme.ts    # Tema visual
│   │   ├── barapro-v10.ts      # Compatibilidad v10
│   │   ├── constants.ts        # Constantes y categorías
│   │   ├── db.ts               # Cliente Prisma
│   │   ├── download.ts         # Helper de descarga
│   │   ├── financial-calculations.ts # Cálculos auxiliares
│   │   ├── format.ts           # Formateo de números/fechas
│   │   ├── labels.ts           # Etiquetas i18n
│   │   ├── license-engine.ts   # Motor de licencias RSA
│   │   ├── password.ts         # Hashing de contraseñas
│   │   ├── rate-limit.ts       # Rate limiting
│   │   └── utils.ts            # Utilidades generales
│   ├── proxy.ts                # Proxy de desarrollo
│   ├── instrumentation.ts      # Instrumentación
│   └── instrumentation-node.ts # Instrumentación Node
├── .env.example                # Variables de entorno ejemplo
├── .gitignore                  # Archivos ignorados por Git
├── components.json             # Configuración shadcn/ui
├── CONTRIBUTING.md             # Guía de contribución
├── Dockerfile                  # Soporte Docker
├── docker-compose.yml          # Docker Compose
├── eslint.config.mjs           # Configuración ESLint
├── init-db.js                  # Inicializador de DB (standalone)
├── install.js                  # Instalador completo
├── INSTALAR.bat                # Instalador Windows
├── INICIAR.bat                 # Iniciador Windows
├── DETENER.bat                 # Detenedor Windows
├── ACTUALIZAR.bat              # Actualizador Windows
├── LICENSE                     # Licencia GPL-3.0
├── next.config.ts              # Configuración Next.js
├── package.json                # Dependencias y scripts
├── postcss.config.mjs          # Configuración PostCSS
├── README.md                   # Este archivo
├── start.js                    # Iniciador (standalone)
├── tailwind.config.ts          # Configuración Tailwind
└── tsconfig.json               # Configuración TypeScript
```

---

## 🔌 API Reference

### Autenticación / Authentication

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth` | Iniciar sesión |
| `GET` | `/api/auth/validate` | Validar token JWT |

### Proyectos / Projects

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/projects` | Listar proyectos |
| `POST` | `/api/projects` | Crear proyecto |
| `GET` | `/api/projects/[id]` | Obtener proyecto |
| `PUT` | `/api/projects/[id]` | Actualizar proyecto |
| `DELETE` | `/api/projects/[id]` | Eliminar proyecto |
| `POST` | `/api/projects/[id]/calculate` | Calcular indicadores |
| `GET` | `/api/projects/[id]/projections` | Proyecciones anuales |
| `GET` | `/api/projects/[id]/financing` | Fuentes de financiamiento |
| `GET` | `/api/projects/[id]/investment-items` | Ítems de inversión |

### Usuarios / Users

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/users` | Listar usuarios (admin) |
| `POST` | `/api/users` | Crear usuario (admin) |
| `GET` | `/api/users/[id]` | Obtener usuario |
| `PUT` | `/api/users/[id]` | Actualizar usuario |
| `DELETE` | `/api/users/[id]` | Eliminar usuario (admin) |
| `POST` | `/api/users/change-password` | Cambiar contraseña |

### Licencias / Licensing

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/license` | Validar/activar/revocar licencia |

### Backup & Exportación / Backup & Export

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/backup/export` | Exportar backup completo |
| `POST` | `/api/backup/import` | Importar backup |
| `POST` | `/api/backup/autosave` | Auto-guardado |
| `POST` | `/api/export-docx` | Generar informe Word |
| `POST` | `/api/export-table-docx` | Exportar tabla a Word |
| `GET` | `/api/download-zip` | Descargar backup ZIP |

### Sistema / System

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET/PUT` | `/api/center-config` | Configuración del centro |
| `GET/POST` | `/api/audit-log` | Registro de auditoría |

---

## 🧮 Motor Financiero / Financial Engine

BARAPRO implementa un motor financiero completo:

| Cálculo | Método | Descripción |
|---------|--------|-------------|
| **VAN / NPV** | Flujo descontado | Valor Actual Neto |
| **TIR / IRR** | Newton-Raphson + Bisección | Tasa Interna de Retorno |
| **TIRM / MIRR** | Tasa de reinversión | Tasa Interna Modificada |
| **Período de Recuperación** | Payback simple y descontado | Tiempo de recuperación |
| **Relación B/C** | Beneficio/Costo | Viabilidad del proyecto |
| **Punto de Equilibrio** | Break-even analysis | Umbral de rentabilidad |
| **Amortización** | Francesa y Alemana | Cuotas de préstamos |
| **Depreciación** | Línea recta | Depreciación de activos |
| **Análisis de Sensibilidad** | Univariado | Impacto de variables |
| **Escenarios** | Pesimista/Base/Optimista | Comparación de escenarios |
| **Capital de Trabajo** | Metodología PDL | Necesidades de capital |
| **Efecto Cambiario** | CUP/MLC/CL | Balance en moneda extranjera |

---

## 📜 Licenciamiento / Licensing

BARAPRO utiliza un sistema de licencias RSA-2048:

| Nivel | Duración | Usuarios | Funcionalidades |
|-------|----------|----------|-----------------|
| **Trial** | 30 días | 3 | Básicas |
| **Basic** | 365 días | 5 | Estándar |
| **Premium** | 365 días | 15 | Avanzadas |
| **Enterprise** | 730 días | Ilimitados | Completas |

- Verificación criptográfica RSA-2048 (clave pública embebida)
- Fingerprint de máquina para vinculación
- Detección de manipulación de reloj
- Períodos de gracia post-expiración

---

## 🐳 Despliegue / Deployment

### Docker

```bash
# Construir imagen
docker compose build

# Iniciar servicios
docker compose up -d

# La aplicación estará disponible en http://localhost:3000
```

### Windows (Standalone)

```bash
# Instalar
INSTALAR.bat

# Iniciar
INICIAR.bat

# Detener
DETENER.bat

# Actualizar
ACTUALIZAR.bat
```

### Producción Manual

```bash
npm run build
npm start
```

---

## 🤝 Contribuir / Contributing

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para las guías de contribución.

### Resumen rápido:

1. Fork el repositorio
2. Cree una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit sus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abra un Pull Request

---

## 📄 Licencia / License

Este proyecto está licenciado bajo la **GNU General Public License v3.0** — consulte el archivo [LICENSE](LICENSE) para más detalles.

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Créditos / Credits

- **CADEM** — Desarrollo y mantenimiento
- **DETOA v2.6** — Sistema de autenticación/licenciamiento adaptado
- Construido con [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/), y [Recharts](https://recharts.org/)

---

<p align="center">
  Hecho con ❤️ para el desarrollo local en Cuba
</p>
