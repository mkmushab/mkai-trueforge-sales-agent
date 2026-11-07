import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  analyzeIMReply,
  UNSCHEDULED_REMINDER_FAILURE_REPLY,
  FAILED_REMINDER_FAILURE_REPLY,
} = require('../dist-electron/main/im/imReplyGuard.js');

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

  assert.equal(analysis.guardApplied, true);
  assert.equal(analysis.successfulCronAdds, 0);
  assert.equal(analysis.text, UNSCHEDULED_REMINDER_FAILURE_REPLY);
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

  assert.equal(analysis.guardApplied, false);
  assert.equal(analysis.successfulCronAdds, 1);
  assert.equal(analysis.text, ' 2 ');
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

  assert.equal(analysis.guardApplied, true);
  assert.equal(analysis.attemptedCronAdds, 1);
  assert.equal(analysis.successfulCronAdds, 0);
  assert.equal(analysis.text, FAILED_REMINDER_FAILURE_REPLY);
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

  assert.equal(analysis.guardApplied, false);
  assert.equal(analysis.text, '  18   24  ');
});
