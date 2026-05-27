import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, requireAdmin } from '@/lib/api-auth';
import { validateLicenseKey, BUILT_IN_TRIAL_KEY, type ValidationResult } from '@/lib/license-engine';

/**
 * Ensure a date value is a valid Date within reasonable bounds (2020–2100).
 * Prevents Prisma from rejecting overflow dates like year 58323.
 */
function safeDate(d: Date | string | number | null | undefined): Date {
  if (!d) return new Date()
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return new Date()
  const MIN = new Date('2020-01-01').getTime()
  const MAX = new Date('2100-01-01').getTime()
  const t = date.getTime()
  if (t < MIN || t > MAX) return new Date()
  return date
}

export async function POST(request: NextRequest) {
  try {
    // All license actions require authentication
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'validate': {
        const { key } = body;
        if (!key) return NextResponse.json({ error: 'Clave de licencia requerida' }, { status: 400 });

        const result: ValidationResult = await validateLicenseKey(key);

        if (result.valid) {
          // Store/update in database
          const existing = await db.license.findFirst({ where: { key } });
          if (existing) {
            await db.license.update({
              where: { id: existing.id },
              data: { lastCheckedAt: new Date(), status: result.status },
            });
          } else {
            await db.license.create({
              data: {
                key,
                licensee: result.info?.licensee || '',
                email: result.info?.email || '',
                tier: result.info?.tier || 'trial',
                maxUsers: result.info?.maxUsers || 3,
                features: JSON.stringify(result.info?.features || []),
                issuedAt: safeDate(result.info?.issuedAt),
                expiresAt: safeDate(result.info?.expiresAt),
                status: result.status,
              },
            });
          }
        }

        return NextResponse.json(result);
      }

      case 'check': {
        // Look for any license (not just 'active' status), since built-in trial
        // may have been marked 'invalid' by previous RSA-only validation
        const activeLicense = await db.license.findFirst({
          orderBy: { createdAt: 'desc' },
        });

        if (!activeLicense) {
          return NextResponse.json({ valid: false, status: 'none', info: null });
        }

        // Re-validate the key (now supports built-in trial key)
        const result = await validateLicenseKey(activeLicense.key);

        // Update status
        await db.license.update({
          where: { id: activeLicense.id },
          data: { lastCheckedAt: new Date(), status: result.status },
        });

        return NextResponse.json({
          ...result,
          dbRecord: {
            id: activeLicense.id,
            activatedAt: activeLicense.activatedAt,
            machineId: activeLicense.machineId,
          },
        });
      }

      case 'activate': {
        const { key, machineId } = body;
        if (!key) return NextResponse.json({ error: 'Clave requerida' }, { status: 400 });

        const result = await validateLicenseKey(key);
        if (!result.valid) {
          return NextResponse.json(result);
        }

        // Deactivate any existing active license
        await db.license.updateMany({
          where: { status: 'active' },
          data: { status: 'superseded' },
        });

        // Create or update license record
        const existing = await db.license.findFirst({ where: { key } });
        if (existing) {
          await db.license.update({
            where: { id: existing.id },
            data: {
              status: 'active',
              activatedAt: new Date(),
              lastCheckedAt: new Date(),
              machineId: machineId || '',
            },
          });
        } else {
          await db.license.create({
            data: {
              key,
              licensee: result.info?.licensee || '',
              email: result.info?.email || '',
              tier: result.info?.tier || 'trial',
              maxUsers: result.info?.maxUsers || 3,
              features: JSON.stringify(result.info?.features || []),
              issuedAt: safeDate(result.info?.issuedAt),
              expiresAt: safeDate(result.info?.expiresAt),
              activatedAt: new Date(),
              lastCheckedAt: new Date(),
              machineId: machineId || '',
              status: 'active',
            },
          });
        }

        return NextResponse.json(result);
      }

      case 'revoke': {
        // Revoke requires admin role — use requireAdmin
        const admin = await requireAdmin(request);
        if (!admin) {
          return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de administrador para revocar licencias.' }, { status: 403 });
        }
        const { id } = body;
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

        await db.license.update({
          where: { id },
          data: { status: 'revoked' },
        });

        return NextResponse.json({ success: true });
      }

      case 'machine-id': {
        // Generate machine ID on server side (simplified)
        const crypto = await import('crypto');
        const machineId = 'SRV-' + crypto.randomBytes(16).toString('hex').substring(0, 24);
        return NextResponse.json({ machineId });
      }

      case 'status': {
        const activeLicense = await db.license.findFirst({
          orderBy: { createdAt: 'desc' },
        });

        if (!activeLicense) {
          return NextResponse.json({ valid: false, status: 'none', info: null });
        }

        // Special handling for built-in trial key — validate with the engine
        // which now recognizes it as a valid trial license
        if (activeLicense.key === BUILT_IN_TRIAL_KEY) {
          const result = await validateLicenseKey(BUILT_IN_TRIAL_KEY);
          // Update the DB status to match the engine's result
          if (result.status !== activeLicense.status) {
            await db.license.update({
              where: { id: activeLicense.id },
              data: { status: result.status, lastCheckedAt: new Date() },
            });
          }
          return NextResponse.json({
            valid: result.valid,
            status: result.status,
            info: result.info ? {
              licensee: result.info.licensee,
              email: result.info.email,
              tier: result.info.tier,
              maxUsers: result.info.maxUsers,
              features: result.info.features,
              issuedAt: result.info.issuedAt,
              expiresAt: result.info.expiresAt,
            } : null,
            dbRecord: {
              id: activeLicense.id,
              activatedAt: activeLicense.activatedAt,
              machineId: activeLicense.machineId,
              lastCheckedAt: activeLicense.lastCheckedAt,
            },
          });
        }

        return NextResponse.json({
          valid: activeLicense.status === 'active',
          status: activeLicense.status,
          info: {
            licensee: activeLicense.licensee,
            email: activeLicense.email,
            tier: activeLicense.tier,
            maxUsers: activeLicense.maxUsers,
            features: activeLicense.features ? JSON.parse(activeLicense.features) : [],
            issuedAt: activeLicense.issuedAt,
            expiresAt: activeLicense.expiresAt,
          },
          dbRecord: {
            id: activeLicense.id,
            activatedAt: activeLicense.activatedAt,
            machineId: activeLicense.machineId,
            lastCheckedAt: activeLicense.lastCheckedAt,
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('License error:', error);
    return NextResponse.json({ error: 'Error de licencia' }, { status: 500 });
  }
}
