import React, { useEffect, useState } from 'react';
import { DataGrid } from './components/DataGrid';
import { ExportBar } from './components/ExportBar';

interface ExtractedData {
  rows: Record<string, string>[];
  headers: string[];
  source: string;
  url: string;
  timestamp: string;
}

export function DataTableApp() {
  const [data, setData] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    chrome.storage.local.get('maxunExtractedData', (result) => {
      setData(result.maxunExtractedData || null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={styles.center}>Loading data...</div>;
  }

  if (!data || data.rows.length === 0) {
    return (
      <div style={styles.center}>
        <div style={styles.emptyTitle}>No data available</div>
        <div style={styles.emptyDesc}>
          Use Scout-X Scrapper on a page to extract data, then open this table again.
        </div>
      </div>
    );
  }

  const filteredRows = search
    ? data.rows.filter((row) =>
        Object.values(row).some((v) =>
          v.toLowerCase().includes(search.toLowerCase())
        )
      )
    : data.rows;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Data Table</h1>
          <div style={styles.subtitle}>
            {data.source} - {data.rows.length} rows from {data.url}
          </div>
        </div>
        <ExportBar rows={data.rows} headers={data.headers} />
      </div>

      {/* Search */}
      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="Search rows..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.resultCount}>
          {filteredRows.length} of {data.rows.length} rows
        </div>
      </div>

      {/* Table */}
      <DataGrid
        headers={data.headers}
        rows={filteredRows}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(165deg, #061a22 0%, #0c1118 100%)',
    color: '#e7ecf1',
    fontFamily: "'Geologica', system-ui, sans-serif",
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: '#94a3b8',
    textAlign: 'center',
    padding: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#f8fafc' },
  emptyDesc: { fontSize: 14, color: '#94a3b8', maxWidth: 360, lineHeight: 1.5 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(14, 116, 144, 0.35)',
    background: 'rgba(2, 51, 69, 0.5)',
  },
  title: { fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc' },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 24px',
    borderBottom: '1px solid rgba(30, 41, 59, 0.9)',
    background: 'rgba(15, 23, 42, 0.45)',
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    background: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid rgba(51, 65, 85, 0.9)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
  },
  resultCount: { fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' },
};
