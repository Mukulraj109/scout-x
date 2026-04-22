import React, { useState } from 'react';
import { MSG } from '../../shared/messages';

type PresetCron = string | null | 'custom';

const EXTENSION_SCHEDULE_OPTIONS: ReadonlyArray<{
  label: string;
  description: string;
  cron: PresetCron;
}> = [
  { label: 'Off', description: 'No recurring schedule', cron: null },
  { label: 'Every 15 min', description: 'Runs every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Every 30 min', description: 'Runs every 30 minutes', cron: '*/30 * * * *' },
  { label: 'Every hour', description: 'Runs at the top of every hour', cron: '0 * * * *' },
  { label: 'Every 6 hours', description: 'Runs 4 times a day', cron: '0 */6 * * *' },
  { label: 'Every 12 hours', description: 'Runs twice a day', cron: '0 */12 * * *' },
  { label: 'Every day', description: 'Runs once daily at midnight', cron: '0 0 * * *' },
  { label: 'Every 2 days', description: 'Runs every other day', cron: '0 0 */2 * *' },
  { label: 'Every 3 days', description: 'Runs every 3 days', cron: '0 0 */3 * *' },
  { label: 'Every week', description: 'Runs every Monday at midnight', cron: '0 0 * * 1' },
  { label: 'Every month', description: 'Runs on the 1st of each month', cron: '0 0 1 * *' },
  { label: 'Custom cron', description: 'Use a custom 5-field cron expression', cron: 'custom' },
];

/**
 * Lightweight client-side cron validator. Accepts standard 5-field
 * expressions with `*`, numbers, ranges (a-b), steps (*\/n, a-b/n), and
 * comma-separated lists. The backend does a stricter re-validation.
 */
function isValidCron(expr: string): boolean {
  const trimmed = expr.trim();
  if (!trimmed) return false;
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) return false;
  // Each field: digits, *, -, /, or comma; no spaces and non-empty
  const fieldRe = /^[\d*,/\-]+$/;
  return fields.every((f) => f.length > 0 && fieldRe.test(f));
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

interface Props {
  automationId: string;
  sendMessage: (type: string, payload?: any) => Promise<any>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function getTimezoneAbbr(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart?.value || tz;
  } catch {
    return tz;
  }
}

export function ExtensionSchedulePicker({ automationId, sendMessage }: Props) {
  // `selection` is the radio-button state: null (off), a preset cron string,
  // or the sentinel 'custom'. `customCron` holds the user-typed expression
  // when selection === 'custom'.
  const [selection, setSelection] = useState<PresetCron>(null);
  const [customCron, setCustomCron] = useState<string>('');
  const [timezone, setTimezone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveCron: string | null =
    selection === null ? null : selection === 'custom' ? customCron.trim() : selection;

  const customInvalid =
    selection === 'custom' && customCron.trim().length > 0 && !isValidCron(customCron);
  const saveDisabled =
    saveState === 'saving' ||
    (selection === 'custom' && (!customCron.trim() || customInvalid));

  const handleSave = async () => {
    if (selection === 'custom' && !isValidCron(customCron)) {
      setSaveState('error');
      setErrorMsg('Please enter a valid 5-field cron expression.');
      return;
    }
    setSaveState('saving');
    setErrorMsg(null);
    try {
      await sendMessage(MSG.SET_SCHEDULE, {
        automationId,
        schedule: {
          enabled: effectiveCron !== null,
          cron: effectiveCron,
          timezone,
        },
      });
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save schedule');
    }
  };

  if (saveState === 'saved') {
    const label =
      selection === 'custom'
        ? `Custom: ${customCron.trim()}`
        : EXTENSION_SCHEDULE_OPTIONS.find((o) => o.cron === selection)?.label;
    return (
      <div style={styles.wrapper}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <div>
            <div style={styles.successTitle}>
              {effectiveCron ? 'Schedule saved!' : 'Schedule disabled'}
            </div>
            <div style={styles.successSub}>
              {effectiveCron
                ? `Running: ${label} · ${getTimezoneAbbr(timezone)}`
                : 'No recurring runs configured. You can always schedule later from the dashboard.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>🗓</span>
        <div>
          <div style={styles.headerTitle}>Set Schedule (Optional)</div>
          <div style={styles.headerSub}>
            Auto-run this automation on your Scout-X server on a recurring schedule.
          </div>
        </div>
      </div>

      {errorMsg && <div style={styles.error}>{errorMsg}</div>}

      {/* Schedule card grid */}
      <div style={styles.grid}>
        {EXTENSION_SCHEDULE_OPTIONS.map((option) => {
          const isSelected = option.cron === selection;
          const isOff = option.cron === null;
          const isCustom = option.cron === 'custom';

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => setSelection(option.cron)}
              style={{
                ...styles.card,
                borderColor: isSelected
                  ? isOff ? '#f59e0b' : '#ff00c3'
                  : '#2a2a2a',
                background: isSelected
                  ? isOff
                    ? 'rgba(245,158,11,0.12)'
                    : 'rgba(255,0,195,0.12)'
                  : '#0f0f0f',
                boxShadow: isSelected
                  ? `0 0 0 2px ${isOff ? 'rgba(245,158,11,0.2)' : 'rgba(255,0,195,0.2)'}`
                  : 'none',
              }}
            >
              <div
                style={{
                  ...styles.cardIcon,
                  color: isSelected ? (isOff ? '#f59e0b' : '#ff00c3') : '#6b7280',
                }}
              >
                {isOff
                  ? '⚡'
                  : isCustom
                  ? '⌨'
                  : option.label.includes('month') || option.label.includes('week')
                  ? '📆'
                  : option.label.includes('day')
                  ? '📅'
                  : '🕐'}
              </div>
              <div
                style={{
                  ...styles.cardLabel,
                  color: isSelected ? (isOff ? '#f59e0b' : '#ff00c3') : '#e5e7eb',
                  fontWeight: isSelected ? 700 : 600,
                }}
              >
                {option.label}
              </div>
              <div style={styles.cardDesc}>{option.description}</div>
            </button>
          );
        })}
      </div>

      {/* Custom cron input */}
      {selection === 'custom' && (
        <div style={styles.customRow}>
          <span style={styles.timezoneLabel}>Cron</span>
          <input
            type="text"
            placeholder="e.g. */15 * * * *"
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            spellCheck={false}
            style={{
              ...styles.timezoneSelect,
              borderColor: customInvalid ? '#ef4444' : '#333',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />
        </div>
      )}
      {customInvalid && (
        <div style={styles.cronHint}>
          Invalid cron expression — need 5 fields like <code>*/15 * * * *</code>
        </div>
      )}

      {/* Timezone selector */}
      {selection !== null && (
        <div style={styles.timezoneRow}>
          <span style={styles.timezoneLabel}>Timezone</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={styles.timezoneSelect}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {getTimezoneAbbr(tz)} — {tz}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action buttons */}
      <div style={styles.actions}>
        <button
          type="button"
          disabled={saveDisabled}
          onClick={handleSave}
          style={{
            ...styles.saveBtn,
            opacity: saveDisabled ? 0.6 : 1,
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            background:
              selection === null
                ? '#374151'
                : 'linear-gradient(135deg, #ff00c3, #a21caf)',
          }}
        >
          {saveState === 'saving'
            ? 'Saving…'
            : selection === null
            ? 'Save schedule — Off'
            : selection === 'custom'
            ? `Save schedule: ${customCron.trim() || '…'} (${getTimezoneAbbr(timezone)})`
            : `Save schedule: ${EXTENSION_SCHEDULE_OPTIONS.find((o) => o.cron === selection)?.label} (${getTimezoneAbbr(timezone)})`}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    marginTop: 12,
    borderTop: '1px solid #1f1f1f',
    paddingTop: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 20,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#f9fafb',
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
    marginBottom: 10,
  },
  card: {
    padding: '10px 10px',
    borderRadius: 10,
    border: '2px solid',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  cardIcon: {
    fontSize: 13,
    marginBottom: 3,
  },
  cardLabel: {
    fontSize: 12,
    display: 'block',
    lineHeight: 1.2,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 10,
    color: '#6b7280',
    lineHeight: 1.3,
  },
  timezoneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  customRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cronHint: {
    fontSize: 10,
    color: '#fca5a5',
    marginBottom: 8,
    marginLeft: 2,
  },
  timezoneLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#9ca3af',
    whiteSpace: 'nowrap' as const,
  },
  timezoneSelect: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#e5e7eb',
    padding: '6px 8px',
    fontSize: 11,
    outline: 'none',
    cursor: 'pointer',
  },
  actions: {
    marginTop: 4,
  },
  saveBtn: {
    width: '100%',
    padding: '10px 16px',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 12,
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  error: {
    padding: '8px 12px',
    background: '#7f1d1d',
    borderRadius: 8,
    fontSize: 11,
    color: '#fca5a5',
    marginBottom: 10,
  },
  successCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 10,
  },
  successIcon: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#10b981',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 14,
    flexShrink: 0,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#10b981',
    marginBottom: 2,
  },
  successSub: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 1.4,
  },
};
