import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  looksLikeIMScheduledTaskCandidate,
  normalizeDetectedScheduledTaskRequest,
  isReminderSystemTurn,
} = require('../dist-electron/main/im/imScheduledTaskHandler.js');

test('normalizes model-detected IM reminder requests into direct cron.add inputs', () => {
  const parsed = normalizeDetectedScheduledTaskRequest(
    {
      shouldCreateTask: true,
      scheduleAt: '2026-03-15T16:30:00+08:00',
      reminderBody: ' ',
      taskName: ' ',
    },
    '2 ',
    new Date('2026-03-15T16:28:00+08:00'),
  );

  assert.ok(parsed);
  assert.equal(parsed.kind, 'create');
  assert.equal(parsed.reminderBody, ' ');
  assert.equal(parsed.taskName, ' ');
  assert.equal(parsed.payloadText, '⏰  ');
  assert.equal(parsed.delayLabel, '2 ');
  // scheduleAt may be in any timezone representation; compare as absolute timestamps
  assert.equal(new Date(parsed.scheduleAt).getTime(), new Date('2026-03-15T16:30:00+08:00').getTime());
  assert.match(parsed.confirmationText, /2 .* /u);
});

test('only uses heuristic as a cheap reminder candidate prefilter', () => {
  assert.equal(looksLikeIMScheduledTaskCandidate(' '), false);
  assert.equal(looksLikeIMScheduledTaskCandidate('2 '), true);
});

test('rejects detector payloads without a future timezone-aware timestamp', () => {
  assert.equal(normalizeDetectedScheduledTaskRequest({
    shouldCreateTask: true,
    scheduleAt: '2026-03-15T16:30:00',
    reminderBody: ' ',
  }, ' ', new Date('2026-03-15T16:28:00+08:00')), null);
});

test('identifies reminder system turns for async IM delivery', () => {
  assert.equal(isReminderSystemTurn([
    { type: 'assistant', content: ' ' },
  ]), false);

  assert.equal(isReminderSystemTurn([
    { type: 'system', content: '⏰  ' },
    { type: 'assistant', content: ' ' },
  ]), true);
});

test('keeps recognizing legacy reminder system messages during transition', () => {
  assert.equal(isReminderSystemTurn([
    { type: 'system', content: 'System: [Sunday, March 15th, 2026 — 4:30 PM] ⏰  ' },
    { type: 'assistant', content: ' ' },
  ]), true);
});

test('recognizes plain reminder text turns during runtime hotfix rollout', () => {
  assert.equal(isReminderSystemTurn([
    { type: 'user', content: '⏰  ' },
    { type: 'assistant', content: '⏰  ' },
  ]), true);
});
