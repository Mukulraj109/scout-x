import React from 'react';
import { MSG } from '../../shared/messages';

interface Props {
  rows: Record<string, string>[];
  headers: string[];
}

export function ExportBar({ rows, headers }: Props) {
  const handleExportCSV = () => {
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','));
    }
    downloadFile(lines.join('\n'), 'maxun-export.csv', 'text/csv');
  };

  const handleExportJSON = () => {
    downloadFile(JSON.stringify(rows, null, 2), 'maxun-export.json', 'application/json');
  };

  return (
    <div style={styles.bar}>
      <button onClick={handleExportCSV} style={styles.btn}>
        Export CSV
      </button>
      <button onClick={handleExportJSON} style={styles.btn}>
        Export JSON
      </button>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  // In the data table tab we can use blob URLs directly
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    gap: 8,
  },
  btn: {
    padding: '8px 16px',
    background: '#1f1f1f',
    color: '#d1d5db',
    border: '1px solid #333',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
};
