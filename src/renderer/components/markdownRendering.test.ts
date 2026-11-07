import { load } from 'cheerio';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import MarkdownContent from './MarkdownContent';

// Check the Markdown-to-code boundary without mounting CodeMirror in Node.
vi.mock('./CodeBlock', () => ({
  default: ({ inline, children }: { inline?: boolean; children: React.ReactNode }) =>
    React.createElement(inline ? 'code' : 'pre', { 'data-code-preview': true }, children),
}));

function render(content: string) {
  return load(renderToStaticMarkup(React.createElement(MarkdownContent, {
    content, enableLargePreview: false,
  })));
}

describe('Markdown rendering across messages and document previews', () => {
  test.each(['~', '\\~'])('preserves study-plan ranges written with %s', tilde => {
    const $ = render([
      ' ',
      '**1.   25%**',
      `  65${tilde}70min   85${tilde}90min `,
      '**2.  **',
      ' ',
    ].join('\n'));
    expect($('del')).toHaveLength(0);
    expect($('strong')).toHaveLength(2);
    expect($('strong').first().next().is('br')).toBe(true);
    expect($('p br')).toHaveLength(4);
    expect($('p').text()).toContain('65~70min   85~90min');
  });

  test('retains explicit double-tilde strikethrough and escaped punctuation', () => {
    const $ = render('~~ ~~  65~70min / 85~90min \\* \\* &lt; &gt; ');
    expect($('del').text()).toBe(' ');
    expect($('em')).toHaveLength(0);
    expect($('p').text()).toContain('* * < >');
  });

  test('preserves soft and explicit breaks inside lists and quotes without extra breaks', () => {
    const $ = render('- ** **\n   \n     \n   \\\n   \n\n>  \n>  ');
    expect($('ul li')).toHaveLength(1);
    expect($('li br')).toHaveLength(4);
    expect($('blockquote br')).toHaveLength(1);
  });

  test('honors GFM table alignment, escaped pipes, ranges, and safe HTML line breaks', () => {
    const $ = render('|   |   |   |\n| :--- | :---: | ---: |\n| a\\|b | 65~70 / 85~90 |  <br> <BR />  |');
    expect($('th').map((_, cell) => $(cell).attr('style')).get()).toEqual([
      'text-align:left', 'text-align:center', 'text-align:right',
    ]);
    expect($('td').first().text()).toBe('a|b');
    expect($('td br')).toHaveLength(2);
    expect($('del')).toHaveLength(0);
  });

  test('does not enable arbitrary HTML or HTML with event attributes', () => {
    const $ = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<br onclick="alert(1)">\n\n[bad](javascript:alert%281%29)');
    expect($('script, img, [onclick], [onerror]')).toHaveLength(0);
    expect($('a').attr('href')).toBe('');
  });

  test.each([
    ['fenced', '```tex\n$$a\nb$$\n\\(x\\)\n```', '$$a\nb$$\n\\(x\\)\n'],
    ['tilde fenced', '~~~text\n$$a\nb$$\n~~~', '$$a\nb$$\n'],
    ['indented', '    $$a\n    b$$\n    \\(x\\)', '$$a\nb$$\n\\(x\\)\n'],
    ['quoted fence', '> ```tex\n> $$a\n> b$$\n> \\(x\\)\n> ```', '$$a\nb$$\n\\(x\\)\n'],
    ['list fence', '-  \n\n  ```tex\n  $$a\n  b$$\n  \\(x\\)\n  ```', '$$a\nb$$\n\\(x\\)\n'],
  ])('preserves literal math in %s code', (_name, source, expected) => {
    const $ = render(source);
    expect($('[data-code-preview]').text()).toBe(expected);
    expect($('.katex')).toHaveLength(0);
  });

  test('does not rewrite file URLs inside code examples', () => {
    const literal = '[ ](file:///tmp/   .md)';
    const $ = render('`' + literal + '`\n\n```md\n' + literal + '\n```');
    expect($('code').text()).toBe(literal);
    expect($('pre').text()).toBe(literal + '\n');
  });

  test('uses syntax context for multiline inline code and single-line indented blocks', () => {
    const $ = render('  `one\ntwo`  \n\n    indented');
    expect($('p code').text()).toBe('one two');
    expect($('pre').text()).toBe('indented\n');
  });

  test('renders math, links, task lists, and trailing reference definitions together', () => {
    const $ = render('\\(x^2\\)   $y^2$\n\n\\[\na+b\n\\]\n\n- [x]  \n- [ ]  \n\n[ ][ref]\n\n[ref]: https://example.com " "');
    expect($('.katex')).toHaveLength(3);
    expect($('.katex-display')).toHaveLength(1);
    expect($('input[type="checkbox"]')).toHaveLength(2);
    expect($('input:checked')).toHaveLength(1);
    expect($('a').attr('href')).toBe('https://example.com');
  });
});
