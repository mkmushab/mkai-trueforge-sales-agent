import { expect, test } from 'vitest';

import { buildSessionTitleFromInput, SESSION_TITLE_MAX_CHARS, stripGoalCommandPrefixForDisplay } from './sessionTitle';

test('builds title from the first characters of text input', () => {
  expect(buildSessionTitleFromInput(' ', ' ')).toBe(' ');
});

test('collapses whitespace before taking the title prefix', () => {
  expect(buildSessionTitleFromInput('\n   \n   ', ' ')).toBe('   ');
});

test('uses the localized default title for image-only input', () => {
  expect(buildSessionTitleFromInput('   ', ' ')).toBe(' ');
});

test('strips goal command prefixes from generated titles', () => {
  expect(buildSessionTitleFromInput('/goal start  ', ' ')).toBe(' ');
  expect(buildSessionTitleFromInput('/goal set Ship the landing page', 'New Chat')).toBe('Ship the landing page');
});

test('preserves non-start goal commands for display', () => {
  expect(stripGoalCommandPrefixForDisplay('/goal status')).toBe('/goal status');
});

test('caps generated titles to the maximum length', () => {
  const input = 'a'.repeat(SESSION_TITLE_MAX_CHARS + 10);
  expect(buildSessionTitleFromInput(input, 'New Chat')).toBe('a'.repeat(SESSION_TITLE_MAX_CHARS));
});
