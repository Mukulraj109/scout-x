import React from 'react';
import type { ToolType } from '../../shared/types';

interface Props {
  onSelect: (tool: ToolType) => void;
}

const tools = [
  {
    id: 'list' as ToolType,
    name: 'List Extractor',
    description: 'Extract data from lists, tables, and paginated content',
    color: '#facc15',
    icon: '≡',
  },
  {
    id: 'table' as ToolType,
    name: 'Table Extractor',
    description: 'Detect and extract HTML tables',
    color: '#22d3ee',
    icon: '⊞',
  },
  {
    id: 'text' as ToolType,
    name: 'Page Text Extractor',
    description: 'Extract full page text as plain text or markdown',
    color: '#a78bfa',
    icon: '¶',
  },
];

export function ToolSelector({ onSelect }: Props) {
  return (
    <div>
      <h2 style={styles.heading}>Choose a tool</h2>
      <p style={styles.intro}>Pick how you want to capture data from this page.</p>
      <div style={styles.grid}>
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onSelect(tool.id)}
            style={styles.card}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(34, 211, 238, 0.55)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(14, 116, 144, 0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(51, 65, 85, 0.85)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(15, 23, 42, 0.55)';
            }}
          >
            <span style={{ ...styles.icon, background: tool.color + '22', color: tool.color }}>
              {tool.icon}
            </span>
            <div>
              <div style={styles.cardTitle}>{tool.name}</div>
              <div style={styles.cardDesc}>{tool.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f8fafc',
    letterSpacing: '0.02em',
    marginBottom: 6,
  },
  intro: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.45,
    marginBottom: 14,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'rgba(15, 23, 42, 0.55)',
    border: '1px solid rgba(51, 65, 85, 0.85)',
    borderRadius: 14,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.18s ease',
    color: '#e7ecf1',
    width: '100%',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    flexShrink: 0,
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: 14,
    color: '#f9fafb',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 1.3,
  },
};
