import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import UserMessageContent from './UserMessageContent';

test('renders numbered user input as plain text instead of a markdown list', () => {
  const content = ' :\n1.  \n2.  ';
  const html = renderToStaticMarkup(React.createElement(UserMessageContent, { content }));

  expect(html).not.toContain('<ol');
  expect(html).toContain(' :');
  expect(html).toContain('1.  ');
  expect(html).toContain('2.  ');
});
