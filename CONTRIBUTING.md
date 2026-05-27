# Guía de Contribución / Contributing Guide

¡Gracias por su interés en contribuir a BARAPRO! / Thank you for your interest in contributing to BARAPRO!

## 🌍 Idiomas / Languages

Este proyecto es bilingüe (Español/Inglés). Las contribuciones pueden realizarse en cualquiera de los dos idiomas.

This project is bilingual (Spanish/English). Contributions can be made in either language.

---

## 📋 Código de Conducta / Code of Conduct

- Sea respetuoso y constructivo
- Reporte comportamientos inapropiados
- Céntrese en lo que es mejor para la comunidad

---

## 🚀 Cómo Contribuir / How to Contribute

### Reportar Bugs / Report Bugs

1. Busque si el bug ya fue reportado en [Issues](../../issues)
2. Si no existe, cree un nuevo issue usando la plantilla **Bug Report**
3. Incluya:
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Capturas de pantalla (si aplica)
   - Versión de BARAPRO y entorno (OS, Node.js)

### Solicitar Funcionalidades / Request Features

1. Busque si la funcionalidad ya fue solicitada
2. Cree un nuevo issue usando la plantilla **Feature Request**
3. Describa claramente el caso de uso y el beneficio

### Enviar Código / Submit Code

1. **Fork** el repositorio
2. **Clone** su fork localmente:
   ```bash
   git clone https://github.com/your-username/barapro.git
   cd barapro
   ```
3. **Cree una rama** para su contribución:
   ```bash
   git checkout -b feature/nueva-funcionalidad
   # o / or
   git checkout -b fix/corregir-bug
   ```
4. **Instale dependencias:**
   ```bash
   npm install
   ```
5. **Configure el entorno:**
   ```bash
   cp .env.example .env
   npx prisma generate
   npx prisma db push
   npx tsx prisma/seed.ts
   ```
6. **Desarrolle** su contribución
7. **Verifique** que todo funciona:
   ```bash
   npm run lint
   npm run dev
   ```
8. **Commit** sus cambios con mensajes descriptivos:
   ```bash
   git commit -m "feat: agregar módulo de análisis XYZ"
   ```
9. **Push** a su fork:
   ```bash
   git push origin feature/nueva-funcionalidad
   ```
10. **Abra un Pull Request** contra la rama `main`

---

## 📐 Convenciones / Conventions

### Commits (Conventional Commits)

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

| Tipo | Descripción |
|------|-------------|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de bug |
| `docs:` | Cambios en documentación |
| `style:` | Formato (no afecta lógica) |
| `refactor:` | Refactorización |
| `perf:` | Mejora de rendimiento |
| `test:` | Agregar/modificar tests |
| `chore:` | Tareas de mantenimiento |

### Estructura de Archivos / File Structure

- **Componentes:** `src/components/barapro/` para lógica de negocio, `src/components/ui/` para primitivos
- **Librerías:** `src/lib/` para lógica compartida
- **API:** `src/app/api/` para rutas de API
- **Tipos:** Use TypeScript estricto, evite `any`

### Estilo de Código / Code Style

- **TypeScript** en todo el proyecto
- **ESLint** con la configuración del repositorio
- **Prettier** para formato consistente
- **Imports absolutos** con alias `@/`
- **Componentes funcionales** con hooks

### Nombramiento / Naming

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Componentes | PascalCase | `SalesModule.tsx` |
| Hooks | camelCase con prefijo use | `useLicense.ts` |
| Utilidades | camelCase | `format.ts` |
| APIs | kebab-case | `export-docx/` |
| Constantes | UPPER_SNAKE | `DEFAULT_TAX_RATE` |
| Tipos/Interfaces | PascalCase | `ProjectData` |

---

## 🧪 Testing

Antes de enviar un PR, asegúrese de:

```bash
# Verificar lint
npm run lint

# Verificar compilación
npm run build
```

---

## 📝 Pull Requests

### Checklist del PR

- [ ] El código compila sin errores (`npm run build`)
- [ ] El lint pasa sin errores (`npm run lint`)
- [ ] Los cambios están documentados si es necesario
- [ ] Se han agregado traducciones para nuevos textos (es/en)
- [ ] Los cambios no rompen funcionalidades existentes
- [ ] El PR tiene una descripción clara

### Título del PR

Use el formato: `tipo: descripción breve`

Ejemplos:
- `feat: agregar módulo de análisis de rentabilidad`
- `fix: corregir cálculo de TIR para flujos negativos`
- `docs: actualizar instrucciones de instalación`

---

## ❓ Preguntas / Questions

Si tiene preguntas, puede:
- Abrir un [Discussion](../../discussions)
- Mencionar a un mantenedor en su Issue/PR

¡Gracias por contribuir! / Thank you for contributing!
