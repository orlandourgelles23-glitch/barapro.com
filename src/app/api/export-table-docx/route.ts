import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, convertInchesToTwip, PageOrientation,
  TableLayoutType,
} from 'docx';
import { BARAPRO_LOGO_BASE64 } from '@/lib/barapro-logo';

// ============================================================
// SINGLE-TABLE DOCX EXPORT API
// Receives table data (headers + rows) and generates a
// professional DOCX with BARAPRO branding.
// No recalculation — just formats what the client sends.
// ============================================================

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Color palette
const C = {
  primary: '1565C0',
  darkPrimary: '0D47A1',
  accent: '1976D2',
  headerBg: '0D47A1',
  white: 'FFFFFF',
  dark: '1A237E',
  gray: '546E7A',
  border: '90CAF9',
  altRow: 'E8EAF6',
  totalBg: 'E3F2FD',
  subtotalBg: 'BBDEFB',
};

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: C.white },
  bottom: { style: BorderStyle.NONE, size: 0, color: C.white },
  left: { style: BorderStyle.NONE, size: 0, color: C.white },
  right: { style: BorderStyle.NONE, size: 0, color: C.white },
};

interface TableExportRequest {
  moduleName: string;
  tableName: string;
  projectName?: string;
  headers: string[];
  rows: {
    cells: string[];
    bold?: boolean;
    highlight?: boolean;
    isSectionHeader?: boolean;
  }[];
  landscape?: boolean;
}

function buildHeader(projectName: string): Header {
  return new Header({
    children: [new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [1800, 7000],
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: noBorders,
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  data: base64ToUint8Array(BARAPRO_LOGO_BASE64),
                  transformation: { width: 28, height: 28 },
                  type: 'jpg',
                } as any),
              ],
            })],
          }),
          new TableCell({
            width: { size: 7000, type: WidthType.DXA },
            borders: noBorders,
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: C.border, space: 4 } },
              children: [new TextRun({
                text: 'BARAPRO — Evaluacion Financiera de Proyectos',
                size: 15, font: 'Calibri', color: C.accent, italics: true,
              })],
            })],
          }),
        ],
      })],
    })],
  });
}

function buildFooter(projectName: string): Footer {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: C.border, space: 4 } },
      children: [
        new TextRun({ text: 'Pagina ', size: 15, font: 'Calibri', color: C.gray }),
        new TextRun({ children: [PageNumber.CURRENT], size: 15, font: 'Calibri', color: C.gray }),
        new TextRun({ text: ' — ', size: 15, font: 'Calibri', color: C.gray }),
        new TextRun({ text: projectName || 'Proyecto', size: 15, font: 'Calibri', color: C.gray }),
      ],
    })],
  });
}

function headerCell(text: string, widthDxa: number, alignment: any = AlignmentType.CENTER): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: C.headerBg, fill: C.headerBg },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: C.headerBg },
      bottom: { style: BorderStyle.SINGLE, size: 3, color: C.accent },
      left: { style: BorderStyle.SINGLE, size: 1, color: '1565C0' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '1565C0' },
    },
    verticalAlign: 'center',
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    children: [new Paragraph({
      alignment,
      spacing: { before: 30, after: 30, line: 240 },
      children: [new TextRun({ text, bold: true, color: C.white, size: 15, font: 'Calibri' })],
    })],
  });
}

function dataCell(
  text: string, widthDxa: number,
  opts?: { bold?: boolean; align?: any; bgColor?: string; color?: string; isSectionHeader?: boolean; fontSize?: number },
): TableCell {
  const o = opts || {};
  const lightBorder = { style: BorderStyle.SINGLE, size: 1, color: C.border };

  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: { top: lightBorder, bottom: lightBorder, left: lightBorder, right: lightBorder },
    verticalAlign: 'center',
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    shading: o.bgColor ? { type: ShadingType.SOLID, color: o.bgColor, fill: o.bgColor } : undefined,
    children: [new Paragraph({
      alignment: o.align || AlignmentType.LEFT,
      spacing: { before: 20, after: 20, line: 260 },
      children: [new TextRun({
        text: text || '', size: o.fontSize || 16, font: 'Calibri',
        bold: o.bold || o.isSectionHeader, color: o.color || C.dark,
      })],
    })],
  });
}

export async function POST(request: NextRequest) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });
  }

  try {
    const body: TableExportRequest = await request.json();
    const { moduleName, tableName, projectName, headers, rows, landscape } = body;

    if (!headers || !rows || headers.length === 0) {
      return NextResponse.json({ error: 'Datos de tabla vacios' }, { status: 400 });
    }

    // Normalize rows to ensure correct format: Array<{ cells: string[]; bold?: boolean; highlight?: boolean }>
    const safeRows = rows.map((row: any) => ({
      cells: Array.isArray(row.cells) ? row.cells.map((c: any) => String(c ?? '')) : [],
      ...(row.bold !== undefined && { bold: row.bold }),
      ...(row.highlight !== undefined && { highlight: row.highlight }),
      ...(row.isSectionHeader !== undefined && { isSectionHeader: row.isSectionHeader }),
    })).filter((row: any) => row.cells.length > 0);

    // Calculate column widths
    const pageW = landscape ? 16838 : 11906;
    const margins = {
      top: convertInchesToTwip(0.6), bottom: convertInchesToTwip(0.6),
      left: convertInchesToTwip(0.5), right: convertInchesToTwip(0.5),
    };
    const availableW = pageW - margins.left - margins.right;

    // First column gets more weight (concept names), rest equal
    const weights = headers.map((_, i) => i === 0 ? 2.5 : 1);
    const totalWeight = weights.reduce((s: number, w: number) => s + w, 0);
    const colWidths = weights.map((w: number) => Math.round((w / totalWeight) * availableW));

    // Build header row
    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map((h: string, i: number) =>
        headerCell(h, colWidths[i], i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER)
      ),
    });

    // Build data rows
    const dataRows = safeRows.map((row, rowIdx) => {
      const isSection = row.isSectionHeader;
      const isBold = row.bold || isSection;
      const isHighlight = row.highlight;
      const isAlt = rowIdx % 2 === 1 && !isSection && !isHighlight;
      const bg = isHighlight ? C.totalBg : isSection ? C.subtotalBg : isAlt ? C.altRow : undefined;
      const textColor = isHighlight ? C.darkPrimary : undefined;

      return new TableRow({
        cantSplit: true,
        children: row.cells.map((cell: string, ci: number) =>
          dataCell(cell, colWidths[ci], {
            bold: isBold,
            align: ci === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
            bgColor: bg,
            color: textColor,
            isSectionHeader: isSection,
            fontSize: isSection ? 16 : 15,
          })
        ),
      });
    });

    const docTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: colWidths,
      rows: [headerRow, ...dataRows],
    });

    // Title paragraphs
    const children: any[] = [];
    children.push(new Paragraph({
      spacing: { before: 100, after: 60 },
      children: [new TextRun({
        text: moduleName || 'Modulo', bold: true, size: 26, font: 'Calibri', color: C.darkPrimary,
      })],
    }));
    children.push(new Paragraph({
      spacing: { before: 40, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.primary, space: 6 } },
      children: [new TextRun({
        text: tableName || 'Tabla', bold: true, size: 22, font: 'Calibri', color: C.accent,
      })],
    }));
    children.push(docTable);

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: {
              width: landscape ? 16838 : 11906,
              height: landscape ? 11906 : 16838,
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: margins,
          },
        },
        headers: { default: buildHeader(projectName || 'Proyecto') },
        footers: { default: buildFooter(projectName || 'Proyecto') },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    const safeName = (moduleName || 'tabla').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '').replace(/\s+/g, '_');
    const safeTable = (tableName || 'tabla').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${safeName}_${safeTable}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generating table DOCX:', error);
    return NextResponse.json(
      { error: 'Error al generar el documento Word' },
      { status: 500 },
    );
  }
}
