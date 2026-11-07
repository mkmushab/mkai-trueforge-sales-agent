import { test, expect } from 'vitest';
import { analyzeIMReply, UNSCHEDULED_REMINDER_FAILURE_REPLY, FAILED_REMINDER_FAILURE_REPLY } from './imReplyGuard';

test('guards IM reminder commitment when no cron.add succeeded', () => {
  const analysis = analyzeIMReply([
    {
      id: 'assistant-1',
      type: 'assistant',
      content: ' 2 ',
      timestamp: Date.now(),
      metadata: {},
    },
  ]);

  expect(analysis.guardApplied).toBe(true);
  expect(analysis.successfulCronAdds).toBe(0);
  expect(analysis.text).toBe(UNSCHEDULED_REMINDER_FAILURE_REPLY);
});

test('preserves reminder reply when cron.add completed successfully', () => {
  const analysis = analyzeIMReply([
    {
      id: 'tool-use-1',
      type: 'tool_use',
      content: 'Using tool: cron',
      timestamp: Date.now(),
      metadata: {
        toolName: 'cron',
        toolUseId: 'cron-call-1',
        toolInput: { action: 'add' },
      },
    },
    {
      id: 'tool-result-1',
      type: 'tool_result',
      content: '{"id":"job-1"}',
      timestamp: Date.now(),
      metadata: {
        toolUseId: 'cron-call-1',
        toolResult: '{"id":"job-1"}',
        isError: false,
      },
    },
    {
      id: 'assistant-1',
      type: 'assistant',
      content: ' 2 ',
      timestamp: Date.now(),
      metadata: {},
    },
  ]);

  expect(analysis.guardApplied).toBe(false);
  expect(analysis.successfulCronAdds).toBe(1);
  expect(analysis.text).toBe(' 2 ');
});

test('returns explicit failure when cron.add was attempted but failed', () => {
  const analysis = analyzeIMReply([
    {
      id: 'tool-use-1',
      type: 'tool_use',
      content: 'Using tool: cron',
      timestamp: Date.now(),
      metadata: {
        toolName: 'Cron',
        toolUseId: 'cron-call-1',
        toolInput: { action: 'add' },
      },
    },
    {
      id: 'tool-result-1',
      type: 'tool_result',
      content: 'invalid cron.add params',
      timestamp: Date.now(),
      metadata: {
        toolUseId: 'cron-call-1',
        toolResult: 'invalid cron.add params',
        error: 'invalid cron.add params',
        isError: true,
      },
    },
    {
      id: 'assistant-1',
      type: 'assistant',
      content: ' ',
      timestamp: Date.now(),
      metadata: {},
    },
  ]);

  expect(analysis.guardApplied).toBe(true);
  expect(analysis.attemptedCronAdds).toBe(1);
  expect(analysis.successfulCronAdds).toBe(0);
  expect(analysis.text).toBe(FAILED_REMINDER_FAILURE_REPLY);
});

test('does not guard normal non-reminder assistant replies', () => {
  const analysis = analyzeIMReply([
    {
      id: 'assistant-1',
      type: 'assistant',
      content: '  18   24  ',
      timestamp: Date.now(),
      metadata: {},
    },
  ]);

  expect(analysis.guardApplied).toBe(false);
  expect(analysis.text).toBe('  18   24  ');
});
