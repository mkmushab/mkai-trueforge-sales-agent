import { ChangeSet } from '@codemirror/state';
import { expect, test } from 'vitest';

import { applyMarkdownSourceChanges, normalizeMarkdownLineEndings } from './markdownSourceEdits';

test('edits source without rewriting metadata, comments, tables, or mixed line endings', () => {
  const original = '\uFEFF---\r\ntitle:  \r\n---\r\n# Title\n\n| A | B |\r\n|---|---|\r\n\n<!-- keep -->\r\n';
  const normalized = normalizeMarkdownLineEndings(original);
  const from = normalized.indexOf('Title');
  const changes = ChangeSet.of({ from, to: from + 5, insert: ' \n ' }, normalized.length);
  expect(applyMarkdownSourceChanges(original, changes)).toBe(original.replace('Title', ' \r\n '));
});

test('handles multiple edits, deletion across lines, Unicode, and an empty file', () => {
  const original = ' \r\n🌈abc\r\nend';
  const normalized = normalizeMarkdownLineEndings(original);
  const changes = ChangeSet.of([{ from: 0, to: 3, insert: '' }, { from: 8, to: 12, insert: '\n ' }], normalized.length);
  expect(applyMarkdownSourceChanges(original, changes)).toBe('🌈abc\r\n ');
  expect(applyMarkdownSourceChanges('', ChangeSet.of({ from: 0, insert: '#  \n' }, 0))).toBe('#  \n');
  expect(applyMarkdownSourceChanges(original, ChangeSet.of({ from: 0, to: normalized.length }, normalized.length))).toBe('');
});
