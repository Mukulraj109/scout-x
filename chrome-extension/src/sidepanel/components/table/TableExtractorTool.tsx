import React, { useState } from 'react';
import { MSG } from '../../../shared/messages';
import type { TableExtractionState } from '../../../shared/types';

interface Props {
  state: TableExtractionState;
  sendMessage: (type: string, payload?: any) => Promise<any>;
}

export function TableExtractorTool({ state, sendMessage }: Props) {
  const [error, setError] = useState<string | null>(null);

  const handleDetectTables = async () => {
    try {
      setError(null);
      await sendMessage(MSG.DETECT_TABLES_CMD);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
    }
  };

  const handleExtractTable = async (index: number, selector: string) => {
    try {
      setError(null);
      await sendMessage(MSG.EXTRACT_TABLE_CMD, { index, selector });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    }
  };

  const handleOpenDataTable = async () => {
    await sendMessage(MSG.OPEN_DATA_TABLE);
  };

  const handleExportCSV = async () => {
    if (state.rows.length === 0) return;
    const lines = [state.headers.join(',')];
    for (const row of state.rows) {
      lines.push(row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));
    }
    await sendMessage(MSG.EXPORT_CSV, { data: lines.join('\n'), filename: 'maxun-table.csv' });
  };

  return (
    <div>
      <h2 style={styles.heading}>Table Extractor</h2>
      {error && <div style={styles.error}>{error}</div>}

      {/* Detect */}
      {(state.phase === 'idle' || state.phase === 'detecting') && (
        <div style={styles.card}>
          <p style={styles.desc}>
            Automatically detect HTML tables on the current page.
          </p>
          <button
            onClick={handleDetectTables}
            style={styles.primaryBtn}
            disabled={state.phase === 'detecting'}
          >
            {state.phase === 'detecting' ? 'Detecting...' : 'Detect Tables'}
          </button>
        </div>
      )}

      {/* Table List */}
      {state.phase === 'selecting' && (
        <div>
          {state.detectedTables.length === 0 ? (
            <div style={styles.card}>
              <div style={styles.muted}>No tables found on this page.</div>
              <button onClick={handleDetectTables} style={{ ...styles.secondaryBtn, marginTop: 8 }}>
                Try Again
              </button>
            </div>
          ) : (
            state.detectedTables.map((table) => (
              <div key={table.index} style={{ ...styles.card, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={styles.cardTitle}>Table {table.index + 1}</div>
                    <div style={styles.muted}>
                      {table.rowCount} rows, {table.headers.length} columns
                    </div>
                  </div>
                  <button
                    onClick={() => handleExtractTable(table.index, table.selector)}
                    style={styles.smallBtn}
                  >
                    Extract
                  </button>
                </div>
                {table.headers.length > 0 && (
                  <div style={styles.headerList}>
                    {table.headers.slice(0, 5).map((h, i) => (
                      <span key={i} style={styles.headerPill}>{h}</span>
                    ))}
                    {table.headers.length > 5 && (
                      <span style={styles.muted}>+{table.headers.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Results */}
      {state.phase === 'complete' && (
        <div>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Extraction Complete</div>
            <div style={styles.pill}>{state.rows.length} rows extracted</div>
          </div>
          <div style={{ ...styles.btnGrid, marginTop: 8 }}>
            <button onClick={handleOpenDataTable} style={styles.primaryBtn}>View Data</button>
            <button onClick={handleExportCSV} style={styles.secondaryBtn}>Export CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#f9fafb' },
  card: { padding: 14, background: '#151515', border: '1px solid #2a2a2a', borderRadius: 12 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#f9fafb' },
  desc: { fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 12 },
  muted: { fontSize: 12, color: '#6b7280' },
  error: { padding: '8px 12px', background: '#7f1d1d', borderRadius: 8, fontSize: 12, marginBottom: 12 },
  primaryBtn: {
    padding: '10px 16px', background: '#ff00c3', color: '#fff', border: 'none',
    borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '8px 14px', background: '#1f1f1f', color: '#d1d5db', border: '1px solid #333',
    borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer',
  },
  smallBtn: {
    padding: '6px 12px', background: '#22d3ee22', color: '#22d3ee', border: '1px solid #22d3ee44',
    borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer',
  },
  pill: {
    display: 'inline-block', padding: '4px 10px', background: '#22d3ee22',
    color: '#22d3ee', borderRadius: 999, fontSize: 12, fontWeight: 700, marginTop: 6,
  },
  headerList: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginTop: 8 },
  headerPill: {
    padding: '2px 8px', background: '#1a1a1a', borderRadius: 4,
    fontSize: 11, color: '#9ca3af',
  },
  btnGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
};
