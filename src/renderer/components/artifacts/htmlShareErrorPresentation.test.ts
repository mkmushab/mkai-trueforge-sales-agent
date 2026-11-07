import {
  HtmlShareErrorCode,
  HtmlShareFailureKind,
} from '@shared/htmlShare/constants';
import { afterEach, describe, expect, test } from 'vitest';

import { i18nService, type LanguageType } from '@/services/i18n';

import { formatHtmlShareFailure } from './htmlShareErrorPresentation';

const originalLanguage = i18nService.getLanguage();

afterEach(() => {
  i18nService.setLanguage(originalLanguage, { persist: false });
});

function setLanguage(language: LanguageType): void {
  i18nService.setLanguage(language, { persist: false });
}

describe('formatHtmlShareFailure', () => {
  test('localizes an input-too-long failure instead of displaying its raw error', () => {
    setLanguage('zh');
    expect(formatHtmlShareFailure({
      failureKind: HtmlShareFailureKind.InputTooLong,
      error: 'content is too long.',
    })).toBe(' ');

    setLanguage('en');
    expect(formatHtmlShareFailure({
      failureKind: HtmlShareFailureKind.InputTooLong,
      error: 'content is too long.',
    })).toBe('The content exceeds the sharing size limit.');
  });

  test('formats a file size limit in the active language', () => {
    setLanguage('zh');
    expect(formatHtmlShareFailure({
      failureKind: HtmlShareFailureKind.FileTooLarge,
      details: { limitBytes: 10 * 1024 * 1024 },
      error: 'File is too large to share.',
    })).toBe('  10 MB ');

    setLanguage('en');
    expect(formatHtmlShareFailure({
      failureKind: HtmlShareFailureKind.FileTooLarge,
      details: { limitBytes: 10 * 1024 * 1024 },
      error: 'File is too large to share.',
    })).toBe('The file is too large. Maximum size: 10 MB.');
  });

  test('localizes the server too-large error code', () => {
    setLanguage('zh');
    expect(formatHtmlShareFailure({
      code: HtmlShareErrorCode.TooLarge,
      error: 'Share content is too large.',
    })).toBe(' ');

    setLanguage('en');
    expect(formatHtmlShareFailure({
      code: HtmlShareErrorCode.TooLarge,
      error: ' ',
    })).toBe('The share content exceeds the size limit.');
  });

  test('uses a localized generic message for unknown raw errors', () => {
    setLanguage('zh');
    expect(formatHtmlShareFailure({ error: 'socket hang up' })).toBe(' ');

    setLanguage('en');
    expect(formatHtmlShareFailure({ error: ' ' })).toBe(
      'Sharing failed. Please try again later.',
    );
  });
});
