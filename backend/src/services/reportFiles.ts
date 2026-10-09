// Report files (plan v10 PRD-22): one table as CSV or as an Excel workbook.
//
// CSV starts with a byte-order mark so Excel reads Turkish letters right, and
// every cell that a spreadsheet would run as a formula — one starting with
// = + - @, a tab or a carriage return — is prefixed with an apostrophe
// (OWASP "CSV injection"): a visitor who calls themselves "=HYPERLINK(…)"
// must not become a link in the owner's spreadsheet.
//
// XLSX is written here rather than with a library: a workbook with one sheet
// of inline strings and numbers is five small XML files in a zip. Inline
// strings are never formulas, and characters XML cannot hold are dropped.

import zlib from 'zlib';

export type Cell = string | number | null | undefined;
export interface Table {
  /** The sheet's name in the workbook (≤ 31 characters, no []:*?/\). */
  name: string;
  headers: string[];
  rows: Cell[][];
}

// -------------------------------------------------------------------- CSV

const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value) : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(table: Table): Buffer {
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(','));
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

// ------------------------------------------------------------------- XLSX

// Characters XML 1.0 cannot carry at all.
// eslint-disable-next-line no-control-regex
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const xml = (value: string) =>
  value
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** A1-style column letters: 0 → A, 25 → Z, 26 → AA. */
function column(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function sheetXml(table: Table): string {
  const rows = [table.headers, ...table.rows].map((row, r) => {
    const cells = row
      .map((value, c) => {
        const ref = `${column(c)}${r + 1}`;
        if (value === null || value === undefined || value === '') return '';
        if (typeof value === 'number' && Number.isFinite(value)) {
          return `<c r="${ref}"><v>${value}</v></c>`;
        }
        // The header row is bold (style 1 in styles.xml).
        const style = r === 0 ? ' s="1"' : '';
        return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
      })
      .join('');
    return `<row r="${r + 1}">${cells}</row>`;
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<sheetData>${rows.join('')}</sheetData>` +
    '</worksheet>'
  );
}

function workbookFiles(table: Table): Array<[string, string]> {
  const sheetName = xml(table.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Report');
  return [
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>'
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>'
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'
    ],
    [
      'xl/styles.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>'
    ],
    ['xl/worksheets/sheet1.xml', sheetXml(table)]
  ];
}

/** A zip archive of the given files, deflated (PKZIP 2.0, no extensions). */
function zip(files: Array<[string, string]>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content, 'utf8');
    const packed = zlib.deflateRawSync(data);
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt32LE(0, 10); // time and date: 1980-01-01, as nothing depends on it
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, nameBytes, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // made by
    entry.writeUInt16LE(20, 6); // needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(0, 12);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += header.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export function toXlsx(table: Table): Buffer {
  return zip(workbookFiles(table));
}
