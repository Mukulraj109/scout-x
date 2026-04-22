import { describe, it, expect } from 'vitest';
import { formatRecording, formatRunResponse } from './formatters';

describe('formatRecording', () => {
  it('builds input parameters from recording meta', () => {
    const out = formatRecording({
      recording_meta: {
        id: 'rid',
        name: 'Test',
        createdAt: '2020-01-01T00:00:00.000Z',
        url: 'https://example.com',
      },
      recording: { workflow: [] },
    });
    expect(out.id).toBe('rid');
    expect(out.inputParameters[0].defaultValue).toBe('https://example.com');
  });
});

describe('formatRunResponse', () => {
  it('handles minimal run row', () => {
    const out = formatRunResponse({
      id: 1,
      status: 'completed',
      name: 'n',
      robotMetaId: 'meta',
      startedAt: 'a',
      finishedAt: 'b',
      runId: 'run-1',
      serializableOutput: null,
      binaryOutput: null,
    });
    expect(out.runId).toBe('run-1');
    expect(out.data.markdown).toBe('');
  });
});
