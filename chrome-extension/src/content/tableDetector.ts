/**
 * Table Detector - Finds and extracts HTML tables from the page.
 */

import type { DetectedTable } from '../shared/types';

/**
 * Scan the page for meaningful HTML tables.
 * Returns tables with 2+ rows and 2+ columns.
 */
export function detectTables(doc: Document): DetectedTable[] {
  const tables = Array.from(doc.querySelectorAll('table'));
  const results: DetectedTable[] = [];

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];

    // Skip hidden tables
    if (!table.offsetWidth && !table.offsetHeight) continue;

    const headers = extractHeaders(table);
    const rows = extractRows(table);

    // Must have meaningful content
    if (rows.length < 2 || (headers.length === 0 && rows[0].length < 2)) continue;

    // Generate a selector for this table
    const selector = generateTableSelector(table, i);

    results.push({
      index: i,
      selector,
      headers: headers.length > 0 ? headers : rows[0].map((_, ci) => `Column ${ci + 1}`),
      rowCount: rows.length,
      previewRows: rows.slice(0, 3),
    });
  }

  return results;
}

/**
 * Extract all data from a specific table.
 */
export function extractTableData(
  doc: Document,
  selector: string
): { headers: string[]; rows: string[][] } {
  const table = doc.querySelector(selector) as HTMLTableElement;
  if (!table) return { headers: [], rows: [] };

  const headers = extractHeaders(table);
  const rows = extractRows(table);

  return {
    headers: headers.length > 0 ? headers : rows[0]?.map((_, i) => `Column ${i + 1}`) || [],
    rows,
  };
}

// ── Helpers ──

function extractHeaders(table: HTMLTableElement): string[] {
  // Try thead first
  const thead = table.querySelector('thead');
  if (thead) {
    const headerCells = thead.querySelectorAll('th, td');
    if (headerCells.length > 0) {
      return Array.from(headerCells).map((cell) => (cell.textContent || '').trim());
    }
  }

  // Try first row with th elements
  const firstRow = table.querySelector('tr');
  if (firstRow) {
    const thCells = firstRow.querySelectorAll('th');
    if (thCells.length > 0) {
      return Array.from(thCells).map((cell) => (cell.textContent || '').trim());
    }
  }

  return [];
}

function extractRows(table: HTMLTableElement): string[][] {
  const rows: string[][] = [];
  const tbody = table.querySelector('tbody') || table;
  const trs = tbody.querySelectorAll('tr');

  for (const tr of Array.from(trs)) {
    // Skip header rows
    if (tr.parentElement?.tagName === 'THEAD') continue;
    if (tr.querySelectorAll('th').length === tr.children.length && tr.children.length > 0) continue;

    const cells = tr.querySelectorAll('td, th');
    if (cells.length === 0) continue;

    const row = Array.from(cells).map((cell) => (cell.textContent || '').trim());
    rows.push(row);
  }

  return rows;
}

function generateTableSelector(table: HTMLTableElement, index: number): string {
  if (table.id) return `#${CSS.escape(table.id)}`;

  const stableClasses = Array.from(table.classList)
    .filter((c) => c.length < 40 && !/\d{3,}/.test(c))
    .slice(0, 2);

  if (stableClasses.length > 0) {
    const selector = `table.${stableClasses.map(c => CSS.escape(c)).join('.')}`;
    if (document.querySelectorAll(selector).length === 1) return selector;
  }

  // Fallback to nth-of-type
  return `table:nth-of-type(${index + 1})`;
}
