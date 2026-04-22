import React, { useState, useMemo } from 'react';

interface Props {
  headers: string[];
  rows: Record<string, string>[];
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

export function DataGrid({ headers, rows }: Props) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;

    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';

      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc'
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const isImageUrl = (value: string): boolean => {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(value) ||
           value.startsWith('data:image/');
  };

  const isUrl = (value: string): boolean => {
    return /^https?:\/\//i.test(value);
  };

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.thNum}>#</th>
            {headers.map((h) => (
              <th
                key={h}
                style={styles.th}
                onClick={() => handleSort(h)}
              >
                <div style={styles.thContent}>
                  {h}
                  {sortConfig?.key === h && (
                    <span style={styles.sortIcon}>
                      {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIndex) => (
            <tr key={rowIndex} style={rowIndex % 2 === 0 ? styles.evenRow : undefined}>
              <td style={styles.tdNum}>{rowIndex + 1}</td>
              {headers.map((h) => {
                const value = row[h] || '';
                return (
                  <td key={h} style={styles.td}>
                    {isImageUrl(value) ? (
                      <img src={value} alt="" style={styles.thumbnail} />
                    ) : isUrl(value) ? (
                      <a href={value} target="_blank" rel="noopener" style={styles.link}>
                        {value.length > 50 ? value.slice(0, 50) + '...' : value}
                      </a>
                    ) : (
                      <span title={value}>
                        {value.length > 100 ? value.slice(0, 100) + '...' : value}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {sortedRows.length === 0 && (
        <div style={styles.empty}>No matching rows</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    overflowX: 'auto',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    padding: '10px 14px',
    textAlign: 'left',
    background: '#151515',
    color: '#9ca3af',
    fontWeight: 600,
    borderBottom: '2px solid #2a2a2a',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    cursor: 'pointer',
    userSelect: 'none',
    zIndex: 1,
  },
  thNum: {
    padding: '10px 14px',
    textAlign: 'center',
    background: '#151515',
    color: '#4b5563',
    fontWeight: 600,
    borderBottom: '2px solid #2a2a2a',
    position: 'sticky',
    top: 0,
    width: 50,
    zIndex: 1,
  },
  thContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  sortIcon: {
    color: '#ff00c3',
    fontSize: 12,
  },
  td: {
    padding: '8px 14px',
    borderBottom: '1px solid #1a1a1a',
    color: '#d1d5db',
    maxWidth: 300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tdNum: {
    padding: '8px 14px',
    borderBottom: '1px solid #1a1a1a',
    color: '#4b5563',
    textAlign: 'center',
    fontSize: 12,
  },
  evenRow: {
    background: '#0f0f0f',
  },
  thumbnail: {
    width: 40,
    height: 40,
    objectFit: 'cover',
    borderRadius: 4,
    border: '1px solid #2a2a2a',
  },
  link: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontSize: 12,
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: '#4b5563',
    fontSize: 14,
  },
};
