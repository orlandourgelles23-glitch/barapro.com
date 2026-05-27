# Changelog

All notable changes to BARAPRO will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [11.0.0] - 2025-01-01

### Added
- Complete financial viability evaluation system for Cuban PDL projects
- Compliance with Resolución 1/2022 del MINCEX
- Dual-currency support (CUP/MLC/CL)
- 25+ financial modules including:
  - Dashboard with KPIs and charts
  - Sales, costs, and investment modules
  - Loan amortization (French and German methods)
  - Salary with social contributions
  - Financial statements (Income Statement, Balance Sheet, Cash Flow)
  - Financial indicators (NPV, IRR, MIRR, Payback, B/C Ratio)
  - Sensitivity analysis and scenario modeling
  - Working capital, currency effects, and utility distribution
  - Logical Framework (Marco Lógico)
- JWT-based authentication with rate limiting
- RSA-2048 licensing system with 4 tiers
- i18n support (Spanish/English)
- Export to Word (.docx), Excel (.xlsx), and PDF
- Auto-save and backup/restore
- AI assistant integration
- Dark/light theme support
- Responsive design
- Windows deployment scripts (.bat)
- Docker support

### Changed
- Migrated from DETOA v2.6 auth/license system
- Upgraded to Next.js 16 with App Router
- Upgraded to React 19
- Upgraded to Tailwind CSS 4

### Security
- JWT (HS256) authentication with persistent signing key
- RSA-2048 license verification
- bcrypt password hashing
- Rate limiting on login attempts
- Audit logging
- X-Frame-Options changed from ALLOWALL to DENY
- CSP frame-ancestors changed from * to 'none'
- React Strict Mode enabled
- TypeScript strict mode enabled (noImplicitAny: true)
- Removed ignoreBuildErrors from next.config.ts
- Added SECURITY.md vulnerability reporting policy

### Fixed
- Version inconsistency: sidebar showed "v10", footer showed "v10.1" — now both show "v11.0.0"
- Removed explicit `any` type casts in ModuleRenderer (page.tsx)
- ModuleErrorBoundary constructor now uses proper typed props

## [10.1.0] - 2024-12-01

### Added
- Enhanced financial calculations
- Additional export formats

## [10.0.0] - 2024-11-01

### Added
- Initial release based on DETOA v2.6 architecture
- Core financial evaluation modules
- Basic authentication and licensing
