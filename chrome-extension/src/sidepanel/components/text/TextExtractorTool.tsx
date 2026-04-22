import React, { useState } from 'react';
import { MSG } from '../../../shared/messages';
import type { TextExtractionState, TextFormat } from '../../../shared/types';

interface Props {
  state: TextExtractionState;
  sendMessage: (type: string, payload?: any) => Promise<any>;
}

export function TextExtractorTool({ state, sendMessage }: Props) {
  const [format, setFormat] = useState<TextFormat>('plain');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExtract = async () => {
    try {
      setError(null);
      await sendMessage(MSG.EXTRACT_TEXT_CMD, { format });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const handleDownload = async () => {
    const ext = format === 'markdown' ? 'md' : 'txt';
    const mimeType = format === 'markdown' ? 'text/markdown' : 'text/plain';
    await sendMessage(MSG.EXPORT_CSV, {
      data: state.content,
      filename: `page-text.${ext}`,
    });
  };

  return (
    <div>
      <h2 style={styles.heading}>Page Text Extractor</h2>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.card}>
        <p style={styles.desc}>
          Extract all text content from the current page.
        </p>

        <div style={styles.formatToggle}>
          <button
            onClick={() => setFormat('plain')}
            style={format === 'plain' ? styles.formatActive : styles.formatBtn}
          >
            Plain Text
          </button>
          <button
            onClick={() => setFormat('markdown')}
            style={format === 'markdown' ? styles.formatActive : styles.formatBtn}
          >
            Markdown
          </button>
        </div>

        <button
          onClick={handleExtract}
          style={styles.primaryBtn}
          disabled={state.phase === 'extracting'}
        >
          {state.phase === 'extracting' ? 'Extracting...' : 'Extract Text'}
        </button>
      </div>

      {state.phase === 'complete' && state.content && (
        <div style={{ ...styles.card, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={styles.cardTitle}>
              Extracted ({(state.content.length / 1024).toFixed(1)} KB)
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleCopy} style={styles.smallBtn}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleDownload} style={styles.smallBtn}>
                Download
              </button>
            </div>
          </div>
          <pre style={styles.preview}>
            {state.content.slice(0, 2000)}
            {state.content.length > 2000 && '\n\n... (truncated)'}
          </pre>
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
  error: { padding: '8px 12px', background: '#7f1d1d', borderRadius: 8, fontSize: 12, marginBottom: 12 },
  primaryBtn: {
    padding: '10px 16px', background: '#ff00c3', color: '#fff', border: 'none',
    borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%',
  },
  smallBtn: {
    padding: '4px 10px', background: '#1f1f1f', color: '#d1d5db', border: '1px solid #333',
    borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer',
  },
  formatToggle: {
    display: 'flex', gap: 4, marginBottom: 12,
    background: '#0a0a0a', borderRadius: 8, padding: 3,
  },
  formatBtn: {
    flex: 1, padding: '6px 10px', background: 'transparent', border: 'none',
    borderRadius: 6, color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  formatActive: {
    flex: 1, padding: '6px 10px', background: '#1f1f1f', border: 'none',
    borderRadius: 6, color: '#f9fafb', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  preview: {
    maxHeight: 300, overflowY: 'auto' as const, padding: 10,
    background: '#0a0a0a', borderRadius: 8, fontSize: 11,
    fontFamily: 'monospace', color: '#d1d5db', whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const, lineHeight: 1.5, margin: 0,
  },
};
