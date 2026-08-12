'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function control(id, root, tagName = 'BUTTON') {
  const listeners = new Map();
  const label = { textContent: 'Copy Markdown', dataset: {} };
  const classes = new Set();
  const attributes = new Map();
  return {
    dataset: { oinkAction: id },
    tagName,
    listeners,
    label,
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
      contains(value) { return classes.has(value); },
    },
    querySelector(selector) {
      return selector === '[data-td-page-copy-label]' ? label : null;
    },
    closest(selector) {
      return selector === '[data-td-page-context]' ? root : null;
    },
    addEventListener(name, handler, options) {
      listeners.set(name, { handler, options });
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) || null; },
  };
}

(async () => {
  const status = { textContent: '' };
  const root = {
    dataset: { tCopied: 'Markdown copied', tCopyError: 'Copy failed' },
    querySelector(selector) {
      return selector === '[data-td-page-context-status]' ? status : null;
    },
  };
  const copy = control('copy_markdown', root);
  const print = control('print', root);
  const chatgpt = control('open_chatgpt', root, 'A');
  const claude = control('open_claude', root, 'A');
  const events = { preload: [], run: [], resolve: [], timers: [], current: 'initial' };
  const actions = {
    copy_markdown: { id: 'copy_markdown', available: true, url: '/page.md' },
    print: { id: 'print', available: true },
    open_chatgpt: { id: 'open_chatgpt', kind: 'url', available: true },
    open_claude: { id: 'open_claude', kind: 'url', available: true },
  };
  const fakeWindow = {
    OinkActions: {
      get(id) { return actions[id] || null; },
      preloadMarkdown(url) { events.preload.push(url); return Promise.resolve(); },
      run(id, context) { events.run.push({ id, context }); return Promise.resolve(); },
      resolveUrl(id) {
        events.resolve.push({ id, current: events.current });
        return `https://assistant.example/${id}?page=${events.current}`;
      },
    },
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { events.timers.push(callback); },
  };
  const fakeDocument = {
    querySelectorAll(selector) {
      assert.equal(selector, '[data-oink-action]');
      return [copy, print, chatgpt, claude];
    },
  };
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets/js/page-actions.js'),
    'utf8',
  );
  vm.runInNewContext(source, {
    window: fakeWindow,
    document: fakeDocument,
    Promise,
  });

  assert.equal(
    chatgpt.getAttribute('href'),
    'https://assistant.example/open_chatgpt?page=initial',
  );
  assert.equal(
    claude.getAttribute('href'),
    'https://assistant.example/open_claude?page=initial',
  );
  events.current = 'query-and-hash';
  chatgpt.listeners.get('click').handler();
  assert.equal(
    chatgpt.getAttribute('href'),
    'https://assistant.example/open_chatgpt?page=query-and-hash',
  );

  copy.listeners.get('pointerenter').handler();
  copy.listeners.get('focus').handler();
  assert.deepEqual(events.preload, ['/page.md', '/page.md']);
  assert.equal(copy.listeners.get('pointerenter').options.once, true);

  copy.listeners.get('click').handler();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(events.run[0].id, 'copy_markdown');
  assert.equal(events.run[0].context.source, 'page');
  assert.equal(copy.classList.contains('is-copied'), true);
  assert.equal(copy.label.textContent, 'Markdown copied');
  assert.equal(status.textContent, 'Markdown copied');
  events.timers[0]();
  assert.equal(copy.classList.contains('is-copied'), false);
  assert.equal(copy.label.textContent, 'Copy Markdown');

  print.listeners.get('click').handler();
  assert.equal(events.run[1].id, 'print');
  assert.equal(events.run[1].context.source, 'page');
  assert.deepEqual(events.resolve, [
    { id: 'open_chatgpt', current: 'initial' },
    { id: 'open_claude', current: 'initial' },
    { id: 'open_chatgpt', current: 'query-and-hash' },
  ]);

  console.log('PRD 4 page action DOM binding checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
