/**
 * Shared schedule option definitions.
 * Used by both the web dashboard ScheduleModal/AutomationConfigPage
 * and (inlined) by the Chrome extension ExtensionSchedulePicker.
 */

export interface ScheduleOption {
  label: string;
  description: string;
  /** null means scheduling is disabled (Off) */
  cron: string | null;
  icon?: string;
}

export const SCHEDULE_OPTIONS: ScheduleOption[] = [
  {
    label: 'Off',
    description: 'No recurring schedule',
    cron: null,
    icon: '⚡',
  },
  {
    label: 'Every 15 minutes',
    description: 'Runs every 15 minutes',
    cron: '*/15 * * * *',
    icon: '🕐',
  },
  {
    label: 'Every 30 minutes',
    description: 'Runs every 30 minutes',
    cron: '*/30 * * * *',
    icon: '🕐',
  },
  {
    label: 'Every hour',
    description: 'Runs at the top of every hour',
    cron: '0 * * * *',
    icon: '🕐',
  },
  {
    label: 'Every 6 hours',
    description: 'Runs 4 times a day',
    cron: '0 */6 * * *',
    icon: '🕐',
  },
  {
    label: 'Every 12 hours',
    description: 'Runs twice a day',
    cron: '0 */12 * * *',
    icon: '🕐',
  },
  {
    label: 'Every day',
    description: 'Runs once daily at midnight UTC',
    cron: '0 0 * * *',
    icon: '📅',
  },
  {
    label: 'Every 2 days',
    description: 'Runs every other day at midnight',
    cron: '0 0 */2 * *',
    icon: '📅',
  },
  {
    label: 'Every 3 days',
    description: 'Runs every 3 days at midnight',
    cron: '0 0 */3 * *',
    icon: '📅',
  },
  {
    label: 'Every week',
    description: 'Runs every Monday at midnight UTC',
    cron: '0 0 * * 1',
    icon: '📆',
  },
  {
    label: 'Every month',
    description: 'Runs on the 1st of each month',
    cron: '0 0 1 * *',
    icon: '📆',
  },
];

/**
 * Get a schedule option by its cron expression.
 * Returns undefined if no match (e.g. custom cron).
 */
export function getScheduleOptionByCron(cron: string | null | undefined): ScheduleOption | undefined {
  return SCHEDULE_OPTIONS.find((opt) => opt.cron === (cron ?? null));
}

/**
 * Get a human-readable label for a cron expression.
 */
export function getScheduleLabel(cron: string | null | undefined): string {
  const opt = getScheduleOptionByCron(cron);
  if (opt) return opt.label;
  if (!cron) return 'Off';
  return cron; // fallback: show raw cron
}
