/**
 * BARAPRO v11 — generate-auth-secret.js
 *
 * Generates a unique AUTH_SECRET_HEX and writes it to .env
 * Replaces the broken `node -e` inline script in INSTALAR.bat
 * which fails on Node.js v24+ due to evalTypeScript mode.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(process.cwd(), '.env');
const hex = crypto.randomBytes(32).toString('hex');

let envContent = '';
if (fs.existsSync(ENV_FILE)) {
  envContent = fs.readFileSync(ENV_FILE, 'utf-8');
}

// Remove any existing AUTH_SECRET_HEX line
envContent = envContent
  .split('\n')
  .filter(line => !line.startsWith('AUTH_SECRET_HEX='))
  .join('\n')
  .trim();

// Add the new secret
envContent += '\nAUTH_SECRET_HEX=' + hex + '\n';

fs.writeFileSync(ENV_FILE, envContent, 'utf-8');
console.log('  Clave generada: ' + hex.substring(0, 8) + '...');
