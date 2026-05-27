# BARAPRO v11 — Architecture Overview

## System Architecture

BARAPRO is a **Single-Page Application (SPA)** built on Next.js 16 with App Router, using a client-side state management approach with Zustand and server-side persistence via Prisma/SQLite.

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Client                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  React    │  │  Zustand     │  │  Auth Store   │ │
│  │  Components│◄─►│  Store       │  │  (JWT Token)  │ │
│  │  (25+    │  │  (barapro-   │  │               │ │
│  │  modules) │  │  store.ts)   │  │               │ │
│  └──────────┘  └──────┬───────┘  └───────┬───────┘ │
│                        │                  │         │
│              ┌─────────▼──────────────────▼──────┐  │
│              │        Auto-Save Hook              │  │
│              │   (barapro-autosave.ts)            │  │
│              └─────────┬─────────────────────────┘  │
└────────────────────────┼───────────────────────────┘
                         │ HTTP (authFetch + JWT)
┌────────────────────────▼───────────────────────────┐
│                 Next.js Server                       │
│  ┌──────────────────────────────────────────────┐   │
│  │              API Routes (App Router)          │   │
│  │  /api/auth    /api/projects    /api/backup   │   │
│  │  /api/license /api/users       /api/export   │   │
│  │  /api/center-config /api/audit-log           │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                               │
│  ┌──────────────────▼───────────────────────────┐   │
│  │         Prisma ORM (SQLite)                   │   │
│  │  Project │ CashFlow │ User │ License │ Config │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                               │
│  ┌──────────────────▼───────────────────────────┐   │
│  │         SQLite Database (file-based)          │   │
│  │              db/custom.db                     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### Project Data
1. **User Input** → Zustand Store (client-side)
2. **Auto-Save** → API `/api/backup/autosave` → SQLite
3. **Calculate** → API `/api/projects/[id]/calculate` → Financial Engine → Results
4. **Export** → API `/api/export-docx` → Word/PDF/Excel generation → Download

### Authentication
1. **Login** → API `/api/auth` → bcrypt verify → JWT (HS256) → Client stores token
2. **API Request** → `authFetch` adds JWT header → Server validates → Process
3. **Session Check** → On hydration, validate stored token against `/api/auth/validate`

### Licensing
1. **Activate** → API `/api/license` → RSA-2048 verification → Store in DB
2. **Check** → Client checks license status on app load
3. **Feature Gates** → License tier determines available features

## Key Design Decisions

### Why SPA with Hash Routing?
- Target users run the app locally on Windows desktops, often offline
- No SEO requirements — the app is a private financial tool
- Simpler deployment as a standalone executable

### Why Zustand over Server State?
- Financial models require real-time calculation as users type
- Avoids excessive API calls during data entry
- Auto-save provides persistence guarantees
- Export/import enables full data portability

### Why SQLite?
- Zero-configuration, file-based database
- Perfect for single-machine desktop deployment
- No external database server needed
- Easy backup (copy the .db file)

## Module Architecture

Each financial module follows this pattern:

```
┌─────────────────┐
│  Module Component│  (e.g., SalesModule.tsx)
│  - UI rendering  │
│  - User input    │
│  - Validation    │
└────────┬────────┘
         │ read/write
┌────────▼────────┐
│  Zustand Store  │  (barapro-store.ts)
│  - Module state  │
│  - CRUD actions  │
│  - Defaults      │
└────────┬────────┘
         │ compute
┌────────▼────────┐
│  Financial      │  (barapro-financial.ts)
│  Engine         │
│  - NPV, IRR     │
│  - Amortization  │
│  - Depreciation  │
└─────────────────┘
```

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | JWT (HS256) via `jose`, 30-minute expiry |
| **Password Storage** | bcrypt with auto-migration from plaintext |
| **API Protection** | `getAuthUser` / `requireAdmin` middleware |
| **Rate Limiting** | In-memory, locks account after failed attempts |
| **License Verification** | RSA-2048 digital signatures |
| **Machine Binding** | Browser fingerprint → SHA-256 hash |
| **Audit Trail** | Login/logout events logged with IP |
