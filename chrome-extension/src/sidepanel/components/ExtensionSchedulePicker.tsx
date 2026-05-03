import React, { useState, useEffect } from 'react';
import { MSG } from '../../shared/messages';
import type { CloudScheduleDraft } from '../../shared/types';
import { configScheduleFromDraft } from '../../shared/types';
import {
  ExtensionScheduleForm,
  EXTENSION_SCHEDULE_OPTIONS,
  getTimezoneAbbr,
  isValidCron,
} from './ExtensionScheduleForm';

interface Props {
  automationId: string;
  sendMessage: (type: string, payload?: any) => Promise<any>;
  value: CloudScheduleDraft;
  onDraftChange: (next: CloudScheduleDraft) => void | Promise<void>;
}

type PushState = 'idle' | 'saving' | 'saved' | 'error';

export function ExtensionSchedulePicker({
  automationId,
  sendMessage,
  value,
  onDraftChange,
}: Props) {
  const [pushState, setPushState] = useState<PushState>('idle');
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    setPushState('idle');
    setPushError(null);
  }, [automationId]);

  const apiSchedule = configScheduleFromDraft(value);
  const isCustomCron =
    !!value.cron &&
    !EXTENSION_SCHEDULE_OPTIONS.some((o) => typeof o.cron === 'string' && o.cron === value.cron);
  const cronInvalid = !!(value.enabled && value.cron && isCustomCron && !isValidCron(value.cron));

  const pushDisabled = pushState === 'saving' || cronInvalid;

  const handlePush = async () => {
    if (cronInvalid) {
      setPushState('error');
      setPushError('Enter a valid 5-field cron expression.');
      return;
    }
    setPushState('saving');
    setPushError(null);
    try {
      await sendMessage(MSG.SET_SCHEDULE, {
        automationId,
        schedule: apiSchedule,
      });
      setPushState('saved');
    } catch (err) {
      setPushState('error');
      setPushError(err instanceof Error ? err.message : 'Failed to save schedule');
    }
  };

  if (pushState === 'saved') {
    const label = value.cron
      ? EXTENSION_SCHEDULE_OPTIONS.find((o) => o.cron === value.cron)?.label || `Custom: ${value.cron}`
      : 'Off';
    return (
      <div style={styles.wrapper}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <div>
            <div style={styles.successTitle}>
              {value.enabled && value.cron ? 'Schedule saved on server' : 'Schedule disabled on server'}
            </div>
            <div style={styles.successSub}>
              {value.enabled && value.cron
                ? `${label} · ${getTimezoneAbbr(value.timezone)}`
                : 'No recurring runs until you turn a schedule on and save again.'}
            </div>
          </div>
        </div>
        <button type="button" style={styles.editLink} onClick={() => setPushState('idle')}>
          Edit schedule
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <ExtensionScheduleForm value={value} onChange={(d) => void onDraftChange(d)} />
      {pushError && <div style={styles.error}>{pushError}</div>}
      <div style={styles.actions}>
        <button
          type="button"
          disabled={pushDisabled}
          onClick={() => void handlePush()}
          style={{
            ...styles.saveBtn,
            opacity: pushDisabled ? 0.6 : 1,
            cursor: pushDisabled ? 'not-allowed' : 'pointer',
            background:
              !value.enabled || !value.cron
                ? '#374151'
                : 'linear-gradient(135deg, #ff00c3, #a21caf)',
          }}
        >
          {pushState === 'saving' ? 'Saving…' : 'Save schedule to server'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    marginTop: 8,
  },
  actions: {
    marginTop: 8,
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
    marginTop: 8,
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
  editLink: {
    marginTop: 10,
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #334155',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 12,
    cursor: 'pointer',
  },
};
