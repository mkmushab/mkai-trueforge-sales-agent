import { expect,test } from 'vitest';

import {
  isReminderSystemTurn,
  looksLikeIMScheduledTaskCandidate,
  normalizeDetectedScheduledTaskRequest,
} from './imScheduledTaskHandler';

test('normalizes model-detected IM reminder requests into direct cron.add inputs', () => {
  const scheduleAtInput = '2026-03-15T16:30:00+08:00';
  const runAt = new Date(scheduleAtInput);
  const expectedClock = '16:30';
  const parsed = normalizeDetectedScheduledTaskRequest(
    {
      shouldCreateTask: true,
      scheduleAt: scheduleAtInput,
      reminderBody: ' ',
      taskName: ' ',
    },
    '2 ',
    new Date('2026-03-15T16:28:00+08:00'),
  );

  expect(parsed).toBeTruthy();
  expect(parsed!.kind).toBe('create');
  expect(parsed!.reminderBody).toBe(' ');
  expect(parsed!.taskName).toBe(' ');
  expect(parsed!.payloadText).toBe('⏰  ');
  expect(parsed!.delayLabel).toBe('2 ');
  expect(parsed!.runAt.toISOString()).toBe(runAt.toISOString());
  expect(new Date(parsed!.scheduleAt).toISOString()).toBe(runAt.toISOString());
  expect(parsed!.confirmationText).toMatch(new RegExp(`2 ${expectedClock} `, 'u'));
});

test('only uses heuristic as a cheap reminder candidate prefilter', () => {
  expect(looksLikeIMScheduledTaskCandidate(' ')).toBe(false);
  expect(looksLikeIMScheduledTaskCandidate('2 ')).toBe(true);
});

test('rejects detector payloads without a future timezone-aware timestamp', () => {
  expect(normalizeDetectedScheduledTaskRequest({
    shouldCreateTask: true,
    scheduleAt: '2026-03-15T16:30:00',
    reminderBody: ' ',
  }, ' ', new Date('2026-03-15T16:28:00+08:00'))).toBe(null);
});

test('identifies reminder system turns for async IM delivery', () => {
  expect(isReminderSystemTurn([
    { type: 'assistant', content: ' ' },
  ])).toBe(false);

  expect(isReminderSystemTurn([
    { type: 'system', content: '⏰  ' },
    { type: 'assistant', content: ' ' },
  ])).toBe(true);
});

test('keeps recognizing legacy reminder system messages during transition', () => {
  expect(isReminderSystemTurn([
    { type: 'system', content: 'System: [Sunday, March 15th, 2026 — 4:30 PM] ⏰  ' },
    { type: 'assistant', content: ' ' },
  ])).toBe(true);
});

test('recognizes plain reminder text turns during runtime hotfix rollout', () => {
  expect(isReminderSystemTurn([
    { type: 'user', content: '⏰  ' },
    { type: 'assistant', content: '⏰  ' },
  ])).toBe(true);
});
