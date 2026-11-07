import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { ActivityIndicator } from './AssistantTurnBlock';

test('a silent model shows the first thinking phase and no step cue', () => {
  const html = renderToStaticMarkup(React.createElement(ActivityIndicator, {
    fingerprint: 'turn:0', startTimestamp: null,
  }));
  expect(html).toContain(' ');
  expect(html).not.toContain('data-cowork-activity-steps');
});

test('a running step names itself without a finished-step counter', () => {
  const html = renderToStaticMarkup(React.createElement(ActivityIndicator, {
    fingerprint: 'turn:3', startTimestamp: null, liveStatusText: ' ',
  }));
  expect(html).toContain(' ');
  expect(html).not.toContain(' ');
  expect(html).not.toContain('data-cowork-activity-steps');
  expect(html).not.toContain(' ');
});

test('a silent gap after the turn has shown something reads as working, not thinking', () => {
  const html = renderToStaticMarkup(React.createElement(ActivityIndicator, {
    fingerprint: 'turn:5', startTimestamp: null, hasContent: true,
  }));
  expect(html).toContain(' ');
  expect(html).not.toContain(' ');
});

test('a live step still names itself once the turn has content', () => {
  const html = renderToStaticMarkup(React.createElement(ActivityIndicator, {
    fingerprint: 'turn:6', startTimestamp: null, hasContent: true, liveStatusText: ' ',
  }));
  expect(html).toContain(' ');
  expect(html).not.toContain(' ');
});

test('an explicit status override wins over the phase rotation', () => {
  const html = renderToStaticMarkup(React.createElement(ActivityIndicator, {
    fingerprint: 'turn:1', startTimestamp: null, statusTextOverride: ' ',
  }));
  expect(html).toContain(' ');
  expect(html).not.toContain(' ');
});
