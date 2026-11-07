import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { type AppUpdateRuntimeState, AppUpdateStatus } from '../../../shared/appUpdate/constants';
import AppUpdateBlockingPanel from './AppUpdateBlockingPanel';

const createState = (status: AppUpdateRuntimeState['status']): AppUpdateRuntimeState => ({
  status,
  source: null,
  info: {
    latestVersion: '2026.7.16',
    date: '2026-07-16',
    changeLog: {
      zh: { title: ' ', content: [' ', ' ', ' '] },
      en: { title: 'This release', content: ['First change', 'Second change', 'Third change'] },
    },
    url: 'https://updates.example.com/lobsterai-2026.7.16.dmg',
  },
  progress: null,
  readyFilePath: '/tmp/lobsterai-update.dmg',
  readyFileHash: 'hash',
  errorMessage: null,
});

const render = (state: AppUpdateRuntimeState): string => renderToStaticMarkup(
  React.createElement(AppUpdateBlockingPanel, { updateState: state }),
);

describe('AppUpdateBlockingPanel', () => {
  test('shows every release note without any actions while installing', () => {
    const html = render(createState(AppUpdateStatus.Installing));

    expect(html).toContain(' ');
    expect(html).toContain(' ');
    expect(html).toContain('v2026.7.16 · 2026-07-16');
    expect(html).toContain(' ');
    expect(html).toContain(' ');
    expect(html).toContain(' ');
    expect(html).toContain(' ');
    expect(html).toContain('logo.png');
    expect(html).toContain('animate-shimmer');
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('max-h-full');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).not.toContain(' ');
    expect(html).not.toContain('<button');
  });

  test('covers the moment between confirming and the installer taking over', () => {
    const html = render(createState(AppUpdateStatus.Ready));

    expect(html).toContain(' ');
    expect(html).toContain(' ');
    expect(html).toContain('animate-shimmer');
    expect(html).not.toContain(' ');
    expect(html).not.toContain('<button');
  });

  test('falls back to a status panel when update metadata is unavailable', () => {
    const state = createState(AppUpdateStatus.Installing);
    state.info = null;

    const html = render(state);

    expect(html).toContain(' ');
    expect(html).not.toContain('v2026.7.16');
    expect(html).not.toContain(' ');
  });

  test('labels the release notes generically when the changelog has no title', () => {
    const state = createState(AppUpdateStatus.Installing);
    state.info!.changeLog.zh.title = '  ';

    const html = render(state);

    expect(html).toContain(' ');
    expect(html).toContain(' ');
  });
});
