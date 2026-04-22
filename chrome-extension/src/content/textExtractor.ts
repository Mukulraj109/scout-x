/**
 * Text Extractor - Extracts full page text as plain text or markdown.
 */

import type { TextFormat } from '../shared/types';

/**
 * Extract page text in the specified format.
 */
export function extractPageText(doc: Document, format: TextFormat): string {
  if (format === 'markdown') {
    return extractAsMarkdown(doc);
  }
  return extractAsPlainText(doc);
}

function extractAsPlainText(doc: Document): string {
  // Clone body and remove non-content elements
  const clone = doc.body.cloneNode(true) as HTMLElement;
  removeNonContent(clone);
  return (clone.innerText || clone.textContent || '').trim();
}

function extractAsMarkdown(doc: Document): string {
  const clone = doc.body.cloneNode(true) as HTMLElement;
  removeNonContent(clone);
  return domToMarkdown(clone).trim();
}

function removeNonContent(root: HTMLElement) {
  const selectors = [
    'script', 'style', 'noscript', 'iframe', 'svg',
    'nav', 'footer', 'header',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[aria-hidden="true"]',
  ];

  for (const sel of selectors) {
    root.querySelectorAll(sel).forEach((el) => el.remove());
  }
}

function domToMarkdown(element: HTMLElement): string {
  const parts: string[] = [];

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\s+/g, ' ');
      if (text.trim()) parts.push(text);
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const el = node as HTMLElement;
    const tag = el.tagName;

    // Headings
    if (/^H[1-6]$/.test(tag)) {
      const level = parseInt(tag[1]);
      const prefix = '#'.repeat(level);
      const text = el.textContent?.trim() || '';
      if (text) parts.push(`\n\n${prefix} ${text}\n\n`);
      continue;
    }

    // Paragraphs
    if (tag === 'P') {
      const inner = domToMarkdown(el);
      if (inner.trim()) parts.push(`\n\n${inner.trim()}\n\n`);
      continue;
    }

    // Line breaks
    if (tag === 'BR') {
      parts.push('\n');
      continue;
    }

    // Links
    if (tag === 'A') {
      const href = el.getAttribute('href');
      const text = el.textContent?.trim() || '';
      if (href && text) {
        try {
          const fullUrl = new URL(href, document.location.href).href;
          parts.push(`[${text}](${fullUrl})`);
        } catch {
          parts.push(`[${text}](${href})`);
        }
      } else if (text) {
        parts.push(text);
      }
      continue;
    }

    // Images
    if (tag === 'IMG') {
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      if (src) {
        try {
          const fullSrc = new URL(src, document.location.href).href;
          parts.push(`![${alt}](${fullSrc})`);
        } catch {
          parts.push(`![${alt}](${src})`);
        }
      }
      continue;
    }

    // Bold
    if (tag === 'STRONG' || tag === 'B') {
      const text = el.textContent?.trim() || '';
      if (text) parts.push(`**${text}**`);
      continue;
    }

    // Italic
    if (tag === 'EM' || tag === 'I') {
      const text = el.textContent?.trim() || '';
      if (text) parts.push(`*${text}*`);
      continue;
    }

    // Code
    if (tag === 'CODE') {
      const text = el.textContent || '';
      parts.push(`\`${text}\``);
      continue;
    }

    // Pre/code blocks
    if (tag === 'PRE') {
      const text = el.textContent || '';
      parts.push(`\n\n\`\`\`\n${text}\n\`\`\`\n\n`);
      continue;
    }

    // Unordered lists
    if (tag === 'UL') {
      const items = el.querySelectorAll(':scope > li');
      for (const li of Array.from(items)) {
        const text = li.textContent?.trim() || '';
        if (text) parts.push(`\n- ${text}`);
      }
      parts.push('\n');
      continue;
    }

    // Ordered lists
    if (tag === 'OL') {
      const items = el.querySelectorAll(':scope > li');
      items.forEach((li, i) => {
        const text = li.textContent?.trim() || '';
        if (text) parts.push(`\n${i + 1}. ${text}`);
      });
      parts.push('\n');
      continue;
    }

    // Horizontal rule
    if (tag === 'HR') {
      parts.push('\n\n---\n\n');
      continue;
    }

    // Blockquote
    if (tag === 'BLOCKQUOTE') {
      const text = el.textContent?.trim() || '';
      if (text) parts.push(`\n\n> ${text.replace(/\n/g, '\n> ')}\n\n`);
      continue;
    }

    // Tables
    if (tag === 'TABLE') {
      parts.push(tableToMarkdown(el as HTMLTableElement));
      continue;
    }

    // Divs, sections, articles - recurse
    if (['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 'SPAN'].includes(tag)) {
      parts.push(domToMarkdown(el));
      continue;
    }

    // Everything else - just get text
    const text = el.textContent?.trim() || '';
    if (text) parts.push(text);
  }

  return parts.join('');
}

function tableToMarkdown(table: HTMLTableElement): string {
  const rows: string[][] = [];
  const trs = table.querySelectorAll('tr');

  for (const tr of Array.from(trs)) {
    const cells = Array.from(tr.querySelectorAll('th, td'));
    rows.push(cells.map((c) => (c.textContent || '').trim().replace(/\|/g, '\\|')));
  }

  if (rows.length === 0) return '';

  const colCount = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((r) => {
    while (r.length < colCount) r.push('');
    return r;
  });

  const lines: string[] = [];
  lines.push('| ' + normalizedRows[0].join(' | ') + ' |');
  lines.push('| ' + normalizedRows[0].map(() => '---').join(' | ') + ' |');

  for (let i = 1; i < normalizedRows.length; i++) {
    lines.push('| ' + normalizedRows[i].join(' | ') + ' |');
  }

  return '\n\n' + lines.join('\n') + '\n\n';
}
