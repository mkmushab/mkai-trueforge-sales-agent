import { afterEach, describe, expect, test } from 'vitest';

import {
  APP_UPDATE_ELEVATION_DECLINED_ERROR,
  APP_UPDATE_FILE_INVALID_ERROR,
  APP_UPDATE_GRAY_UNAVAILABLE_ERROR,
  APP_UPDATE_URL_UNTRUSTED_ERROR,
} from '../../../shared/appUpdate/constants';
import { i18nService } from '../../services/i18n';
import { formatAppUpdateError } from './appUpdateErrorText';

describe('formatAppUpdateError', () => {
  afterEach(() => {
    i18nService.setLanguage('zh', { persist: false });
  });

  test('localizes stable Windows update errors in Chinese', () => {
    i18nService.setLanguage('zh', { persist: false });

    expect(formatAppUpdateError(APP_UPDATE_ELEVATION_DECLINED_ERROR)).toContain(
      ' ',
    );
    expect(formatAppUpdateError(APP_UPDATE_URL_UNTRUSTED_ERROR)).toContain(
      'HTTPS  ',
    );
    expect(formatAppUpdateError(APP_UPDATE_FILE_INVALID_ERROR)).toContain(
      ' ',
    );
  });

  test('localizes an unsafe update URL in English', () => {
    i18nService.setLanguage('en', { persist: false });

    expect(formatAppUpdateError(APP_UPDATE_URL_UNTRUSTED_ERROR)).toContain(
      'HTTPS safety requirements',
    );
  });

  test('preserves unknown operating-system messages', () => {
    expect(formatAppUpdateError('Access is denied.')).toBe('Access is denied.');
  });

  test('localizes gray eligibility errors in both languages', () => {
    i18nService.setLanguage('zh', { persist: false });
    expect(formatAppUpdateError(APP_UPDATE_GRAY_UNAVAILABLE_ERROR)).toContain(' ');
    i18nService.setLanguage('en', { persist: false });
    expect(formatAppUpdateError(APP_UPDATE_GRAY_UNAVAILABLE_ERROR)).toContain('Check for updates again');
  });
});
