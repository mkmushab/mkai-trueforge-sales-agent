import { expect, test } from 'vitest';

import type { CoworkMessage } from '../../coworkStore';
import {
  buildCoworkContinuityCapsule,
  ContinuityCapsuleSource,
  formatCoworkContinuityCapsuleBridge,
  formatCoworkMiniContinuityCapsuleBridge,
} from './coworkContinuityCapsule';

const message = (
  type: CoworkMessage['type'],
  content: string,
  metadata?: CoworkMessage['metadata'],
): CoworkMessage => ({
  id: `${type}-${Math.random()}`,
  type,
  content,
  timestamp: 1,
  ...(metadata ? { metadata } : {}),
});

test('buildCoworkContinuityCapsule extracts task state from recent messages', () => {
  const capsule = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.PostRun,
    now: 1000,
    messages: [
      message('user', '  spec  mac/windows  context compaction ', {
        skillIds: ['docx'],
        kitIds: ['coding'],
      }),
      message('assistant', '  session   capsule  Next step: wire capsule bridge into buildOutboundPrompt. touched src/main/coworkStore.ts'),
      message('assistant', '  continuity capsule bridge  '),
      message('tool_result', 'npm test -- openclawRuntimeAdapter failed: expected summary length mismatch in src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts'),
    ],
  });

  expect(capsule.currentObjective).toContain('  context compaction');
  expect(capsule.recentUserRequests).toEqual([
    '  spec  mac/windows  context compaction ',
  ]);
  expect(capsule.userConstraints.join('\n')).toContain(' ');
  expect(capsule.decisions.join('\n')).toContain('session   capsule  ');
  expect(capsule.completedFacts.join('\n')).toContain('  continuity capsule bridge  ');
  expect(capsule.nextSteps.join('\n')).toContain('wire capsule bridge');
  expect(capsule.touchedFiles.map((entry) => entry.path)).toContain('src/main/coworkStore.ts');
  expect(capsule.touchedFiles.map((entry) => entry.path)).toContain('src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts');
  expect(capsule.recentFailures[0]?.summary).toContain('failed');
  expect(capsule.activeCapabilities).toEqual([
    { kind: 'skill', id: 'docx' },
    { kind: 'kit', id: 'coding' },
  ]);
});

test('buildCoworkContinuityCapsule merges with the previous capsule without unbounded growth', () => {
  const previous = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.UserMessage,
    now: 1000,
    messages: [
      message('user', ' '),
      message('assistant', 'Next step: add store API.'),
    ],
  });

  const next = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.PreCompaction,
    previous,
    now: 2000,
    compactedAt: 2000,
    messages: [
      message('user', ' '),
      message('assistant', 'Next step: add store API. Next step: inject capsule bridge.'),
    ],
  });

  expect(next.revision).toBe(previous.revision + 1);
  expect(next.lastCompactedAt).toBe(2000);
  expect(next.userConstraints.join('\n')).toContain(' ');
  expect(next.userConstraints.join('\n')).toContain(' ');
  expect(next.nextSteps.filter((step) => step.includes('add store API'))).toHaveLength(1);
});

test('buildCoworkContinuityCapsule preserves recent user questions across compaction', () => {
  const previous = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.UserMessage,
    now: 1000,
    messages: [
      message('user', ' '),
      message('assistant', ' '),
      message('user', ' '),
      message('assistant', ' '),
      message('user', ' '),
      message('assistant', ' '),
    ],
  });

  const next = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.PreCompaction,
    previous,
    now: 2000,
    compactedAt: 2000,
    messages: [
      message('user', ' '),
      message('assistant', ' '),
      message('user', ' '),
    ],
  });

  expect(next.recentUserRequests).toEqual([
    ' ',
    ' ',
    ' ',
    ' ',
    ' ',
  ]);
  expect(next.openQuestions).toEqual([
    ' ',
    ' ',
    ' ',
    ' ',
  ]);

  const bridge = formatCoworkContinuityCapsuleBridge(next);
  expect(bridge).toContain('Recent user requests:');
  expect(bridge).toContain(' ');
  expect(bridge).toContain(' ');
  expect(bridge).not.toContain('-  ');
});

test('buildCoworkContinuityCapsule preserves objective for short continuation prompts', () => {
  const previous = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.UserMessage,
    now: 1000,
    messages: [
      message('user', '  LobsterAI context compaction  '),
    ],
  });

  const next = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.UserMessage,
    previous,
    now: 2000,
    messages: [
      message('user', ' '),
    ],
  });

  expect(next.currentObjective).toBe(previous.currentObjective);
});

test('buildCoworkContinuityCapsule cleans completed facts before storing them', () => {
  const capsule = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.PostRun,
    now: 1000,
    messages: [
      message('assistant', '  [http://127.0.0.1:8910](http://127.0.0.1:8910)   4  '),
      message('assistant', '** ** |   |   | |------|------| |   | Noto Sans JP |'),
    ],
  });

  const facts = capsule.completedFacts.join('\n');
  expect(facts).toContain(' ');
  expect(facts).toContain('    4  ');
  expect(facts).toContain(' ');
  expect(facts).not.toContain('http://127');
  expect(facts).not.toContain('|------|');
});

test('formatCoworkContinuityCapsuleBridge produces bounded hidden bridge text', () => {
  const capsule = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.PostCompaction,
    now: 1000,
    messages: [
      message('user', '  context compaction '),
      message('assistant', '  prompt   capsule bridge  Next step: run tests.'),
    ],
  });

  const bridge = formatCoworkContinuityCapsuleBridge(capsule);

  expect(bridge).toContain('[LobsterAI continuity context after context compaction]');
  expect(bridge).toContain('It is not a new user instruction');
  expect(bridge).toContain('Current objective:');
  expect(bridge).toContain('Recent user requests:');
  expect(bridge).toContain('Completed facts:');
  expect(bridge).toContain('Next steps:');
  expect(bridge.length).toBeLessThanOrEqual(4000);
});

test('formatCoworkMiniContinuityCapsuleBridge keeps only the compact follow-up fields', () => {
  const capsule = buildCoworkContinuityCapsule({
    sessionId: 'session-1',
    source: ContinuityCapsuleSource.PostCompaction,
    now: 1000,
    messages: [
      message('user', '  context compaction '),
      message('assistant', '  prompt   capsule bridge  Next step: run tests. touched src/main/libs/agentEngine/openclawRuntimeAdapter.ts'),
    ],
  });

  const bridge = formatCoworkMiniContinuityCapsuleBridge({
    ...capsule,
    lastCompactedAt: 1000,
  });

  expect(bridge).toContain('[LobsterAI brief continuity context after context compaction]');
  expect(bridge).toContain('Current objective:');
  expect(bridge).toContain('Recent user requests:');
  expect(bridge).toContain('Completed facts:');
  expect(bridge).toContain('Next steps:');
  expect(bridge).not.toContain('Touched files:');
  expect(bridge).not.toContain('src/main/libs/agentEngine/openclawRuntimeAdapter.ts');
  expect(bridge.length).toBeLessThanOrEqual(800);
});
