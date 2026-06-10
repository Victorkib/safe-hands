import ExcelJS from 'exceljs';

/**
 * @param {Array<{ name: string; headers: string[]; rows: Record<string, unknown>[] }>} sheets
 */
export async function buildExcelBuffer(sheets) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Safe Hands Escrow';
  workbook.created = new Date();

  for (const sheet of sheets) {
    const safeName = String(sheet.name || 'Sheet').slice(0, 31);
    const ws = workbook.addWorksheet(safeName);

    ws.addRow(sheet.headers);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const row of sheet.rows) {
      ws.addRow(sheet.headers.map((h) => row[h] ?? ''));
    }

    sheet.headers.forEach((header, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.min(42, Math.max(12, String(header).length + 4));
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * @param {string[]} headers
 * @param {Record<string, unknown>[]} rows
 */
export async function buildSingleSheetExcel(headers, rows, sheetName = 'Report') {
  return buildExcelBuffer([{ name: sheetName, headers, rows }]);
}

export function xlsxResponse(buffer, filename) {
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
