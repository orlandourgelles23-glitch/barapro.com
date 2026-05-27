'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { downloadFromApi } from '@/lib/download';

// ============================================================
// TableExportButton — Reusable button to export a single table
// to a professional DOCX document.
//
// Usage:
//   <TableExportButton
//     moduleName="Presupuesto de Inversión"
//     tableName="Cronograma Anual"
//     headers={['Concepto', 'Año 1', 'Año 2', 'Total']}
//     rows={[
//       { cells: ['Inversión Fija', '1000', '2000', '3000'], bold: false },
//       { cells: ['Total', '1000', '2000', '3000'], bold: true, highlight: true },
//     ]}
//     landscape={false}
//   />
// ============================================================

export interface TableExportRow {
  cells: string[];
  bold?: boolean;
  highlight?: boolean;
  isSectionHeader?: boolean;
}

interface TableExportButtonProps {
  moduleName: string;
  tableName: string;
  headers: string[];
  rows: TableExportRow[];
  landscape?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
}

export function TableExportButton({
  moduleName,
  tableName,
  headers,
  rows,
  landscape,
  className,
  variant = 'ghost',
  size = 'sm',
  label = 'Documento',
}: TableExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Normalize rows to ensure correct format: Array<{ cells: string[]; bold?: boolean; highlight?: boolean }>
      const safeRows = rows.map((row) => ({
        cells: Array.isArray(row.cells) ? row.cells.map((c) => String(c ?? '')) : [],
        ...(row.bold !== undefined && { bold: row.bold }),
        ...(row.highlight !== undefined && { highlight: row.highlight }),
        ...(row.isSectionHeader !== undefined && { isSectionHeader: row.isSectionHeader }),
      })).filter((row) => row.cells.length > 0);

      const body = {
        moduleName,
        tableName,
        projectName: getProjectName(),
        headers,
        rows: safeRows,
        landscape: landscape || headers.length > 6,
      };

      await downloadFromApi('/api/export-table-docx', `${moduleName}_${tableName}.docx`, body);
    } catch (err: any) {
      console.error('Error al exportar tabla:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleExport}
      disabled={loading}
      title={`Exportar "${tableName}" a Documento`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {label && <span className="ml-1 text-xs">{label}</span>}
    </Button>
  );
}

// Try to get project name from the store without importing it
// (to keep this component dependency-free)
function getProjectName(): string {
  try {
    if (typeof window !== 'undefined') {
      const storeStr = localStorage.getItem('barapro-storage');
      if (storeStr) {
        const parsed = JSON.parse(storeStr);
        return parsed?.state?.project?.projectName || 'Proyecto';
      }
    }
  } catch { /* ignore */ }
  return 'Proyecto';
}
