'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function control(id, root) {
  const listeners = new Map();
  const label = { textContent: 'Copy Markdown', dataset: {} };
  const classes = new Set();
  return {
    dataset: { oinkAction: id },
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
  const events = { preload: [], run: [], timers: [] };
  const actions = {
    copy_markdown: { id: 'copy_markdown', available: true, url: '/page.md' },
    print: { id: 'print', available: true },
  };
  const fakeWindow = {
    OinkActions: {
      get(id) { return actions[id] || null; },
      preloadMarkdown(url) { events.preload.push(url); return Promise.resolve(); },
      run(id, context) { events.run.push({ id, context }); return Promise.resolve(); },
    },
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { events.timers.push(callback); },
  };
  const fakeDocument = {
    querySelectorAll(selector) {
      assert.equal(selector, '[data-oink-action]');
      return [copy, print];
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

  console.log('PRD 4 page action DOM binding checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
