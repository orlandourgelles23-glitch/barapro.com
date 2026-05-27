# Security Policy / Política de Seguridad

## Supported Versions / Versiones Soportadas

| Version | Supported          |
| ------- | ------------------ |
| 11.0.x  | ✅ |
| 10.x    | ❌ |
| < 10.0  | ❌ |

## Reporting a Vulnerability / Reportar una Vulnerabilidad

**Please do not report security vulnerabilities through public GitHub issues.**

**Por favor, no reporte vulnerabilidades de seguridad a través de Issues públicos de GitHub.**

Instead, please report them via email to the maintainer or use GitHub's private vulnerability reporting feature:

En su lugar, repórtelas por correo electrónico al mantenedor o use la función de reporte privado de GitHub:

1. Go to **Security** → **Report a vulnerability** in the GitHub repository
2. Ir a **Security** → **Report a vulnerability** en el repositorio de GitHub

### What to include / Qué incluir

- Type of vulnerability (XSS, SQL injection, CSRF, etc.)
- Full path of the affected file(s)
- Steps to reproduce
- Potential impact
- Any possible mitigations

### Response time / Tiempo de respuesta

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix**: Depends on severity (critical: 72h, high: 7d, medium: 30d)

## Known Security Considerations / Consideraciones de Seguridad Conocidas

### Default Credentials
The application ships with default admin credentials (`admin` / `2026`). **These must be changed immediately after installation.**

La aplicación incluye credenciales admin por defecto (`admin` / `2026`). **Deben cambiarse inmediatamente después de la instalación.**

### Content Security Policy
The CSP currently includes `'unsafe-inline'` and `'unsafe-eval'` directives. These are necessary for the current build but should be removed in a future update by implementing nonce-based CSP.

El CSP incluye directivas `'unsafe-inline'` y `'unsafe-eval'`. Son necesarias para el build actual pero deben eliminarse en una actualización futura implementando CSP basado en nonces.

### Machine Fingerprinting
License machine fingerprinting is performed client-side. While this deters casual sharing, it can be bypassed by sophisticated users.

La huella digital de máquina para licencias se realiza del lado del cliente. Si bien esto disuade el uso casual, puede ser eludida por usuarios sofisticados.

### Database Security
SQLite database file is stored locally. Ensure proper file system permissions to prevent unauthorized access.

El archivo de base de datos SQLite se almacena localmente. Asegure permisos adecuados del sistema de archivos para prevenir accesos no autorizados.
