'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const registryModule = require(
  path.join(__dirname, '..', '..', 'assets/js/action-registry.js'),
);

const builtinIds = [
  'copy_markdown',
  'view_markdown',
  'edit_page',
  'create_issue',
  'print',
  'switch_theme',
  'switch_language',
  'switch_version',
  'open_github',
];

function descriptor(id, values = {}) {
  return {
    id,
    title: id,
    description: id,
    icon: 'fa-solid fa-bolt',
    keywords: [id],
    kind: 'invoke',
    available: true,
    disabledReason: '',
    url: '',
    target: 'self',
    placements: { page: true, palette: true },
    options: [],
    ...values,
  };
}

function harness({ actions, commands = [], fetchImpl, clipboard = true } = {}) {
  const events = {
    assigned: [], opened: [], printed: 0, copied: [], fetched: [],
    execCommands: [], fallbackText: [],
  };
  const fakeWindow = {
    location: {
      href: 'https://example.org/preview/en/docs/page/',
      assign(url) {
        events.assigned.push(url);
      },
    },
    open(url, target, features) {
      events.opened.push({ url, target, features });
    },
    print() {
      events.printed += 1;
    },
    navigator: clipboard ? {
      clipboard: {
        writeText(text) {
          events.copied.push(text);
          return Promise.resolve();
        },
      },
    } : {},
  };
  let textarea = null;
  const fakeDocument = {
    getElementById() {
      return null;
    },
    createElement(name) {
      assert.equal(name, 'textarea');
      textarea = {
        value: '', style: {},
        setAttribute() {},
        select() { events.fallbackText.push(this.value); },
        remove() { textarea = null; },
      };
      return textarea;
    },
    body: {
      appendChild(node) { assert.equal(node, textarea); },
    },
    execCommand(command) {
      events.execCommands.push(command);
      return command === 'copy';
    },
  };
  const fetchApi =
    fetchImpl ||
    ((url) => {
      events.fetched.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve('# Page') });
    });
  const registry = registryModule.create({
    window: fakeWindow,
    document: fakeDocument,
    fetch: fetchApi,
    manifest: { version: 1, actions: actions || [], commands },
  });
  return { registry, events };
}

(async () => {
  const actions = builtinIds.map((id) => descriptor(id));
  actions[0] = descriptor('copy_markdown', {
    kind: 'copy',
    url: '/preview/en/docs/page/index.md',
  });
  actions[1] = descriptor('view_markdown', {
    kind: 'url',
    url: '/preview/en/docs/page/index.md',
    target: 'blank',
  });
  actions[2] = descriptor('edit_page', {
    kind: 'url',
    available: false,
    disabledReason: 'Repository unavailable',
  });
  actions[5] = descriptor('switch_theme', {
    kind: 'choice',
    options: [{ id: 'dark', title: 'Dark', value: 'dark', available: true }],
  });
  actions[6] = descriptor('switch_language', {
    kind: 'choice',
    options: [{ id: 'zh', title: '中文', url: '/zh/', available: true }],
  });
  actions[7] = descriptor('switch_version', {
    kind: 'choice',
    options: [{ id: 'v2', title: 'Version 2', url: 'https://v2.example.com/', available: true }],
  });
  const commands = [
    {
      id: 'status',
      kind: 'url',
      url: 'https://status.example.com/',
      target: 'blank',
    },
    { id: 'print_now', kind: 'builtin', action: 'print' },
    { id: 'theme_now', kind: 'builtin', action: 'switch_theme' },
    { id: 'language_now', kind: 'builtin', action: 'switch_language' },
    { id: 'version_now', kind: 'builtin', action: 'switch_version' },
    { id: 'unsafe', kind: 'url', url: 'javascript:alert(1)' },
    { id: 'unknown', kind: 'builtin', action: 'not_real' },
  ];
  const { registry, events } = harness({ actions, commands });

  assert.deepEqual(registry.list().map((action) => action.id), builtinIds);
  assert.deepEqual(
    registry.list({ placement: 'page' }).map((action) => action.id),
    builtinIds,
  );
  assert.equal(registry.get('unknown'), null);
  assert.deepEqual(registry.commands().map((command) => command.id), [
    'status',
    'print_now',
    'theme_now',
    'language_now',
    'version_now',
  ]);
  assert.equal(events.fetched.length, 0, 'registry creation caused a request');

  const pending = registry.preloadMarkdown('/preview/en/docs/page/index.md');
  await registry.run('copy_markdown', { source: 'page' });
  await pending;
  await registry.run('copy_markdown', { source: 'palette' });
  assert.equal(events.fetched.length, 1, 'markdown was fetched more than once');
  assert.deepEqual(events.copied, ['# Page', '# Page']);

  await registry.run('view_markdown');
  assert.deepEqual(events.opened[0], {
    url: 'https://example.org/preview/en/docs/page/index.md',
    target: '_blank',
    features: 'noopener,noreferrer',
  });
  await registry.run('print');
  await registry.runCommand('print_now');
  assert.equal(events.printed, 2);
  await registry.runCommand('status');
  assert.equal(events.opened[1].url, 'https://status.example.com/');
  for (const [command, action] of [
    ['theme_now', 'switch_theme'],
    ['language_now', 'switch_language'],
    ['version_now', 'switch_version'],
  ]) {
    const result = await registry.runCommand(command);
    assert.equal(result.requiresChoice, true, `${command} did not request a choice`);
    assert.equal(result.action.id, action);
    assert.ok(result.options.length > 0);
  }

  await assert.rejects(registry.run('edit_page'), (error) => {
    assert.equal(error.code, 'unavailable');
    assert.equal(error.message, 'Repository unavailable');
    return true;
  });
  await assert.rejects(registry.run('not_real'), { code: 'unsupported_action' });
  await assert.rejects(registry.runCommand('unsafe'), {
    code: 'unsupported_command',
  });

  let theme = '';
  registry.registerExecutor('switch_theme', ({ value }) => {
    theme = value.value;
  });
  await registry.run('switch_theme', { value: { value: 'dark' } });
  assert.equal(theme, 'dark');
  assert.throws(
    () => registry.registerExecutor('switch_theme', () => {}),
    { code: 'duplicate_executor' },
  );
  assert.throws(() => registry.registerExecutor('not_real', () => {}), {
    code: 'unsupported_executor',
  });

  assert.equal(
    registry.safeUrl('/preview/en/docs/'),
    'https://example.org/preview/en/docs/',
  );
  for (const unsafe of [
    'javascript:alert(1)',
    'data:text/html,boom',
    '//evil.example/x',
    '\\evil.example\\x',
    ' https://evil.example/',
  ]) {
    assert.equal(registry.safeUrl(unsafe), null, unsafe);
  }

  let attempts = 0;
  const retryHarness = harness({
    actions: [actions[0]],
    fetchImpl() {
      attempts += 1;
      if (attempts === 1) return Promise.resolve({ ok: false });
      return Promise.resolve({ ok: true, text: () => Promise.resolve('# Retry') });
    },
  });
  await assert.rejects(
    retryHarness.registry.preloadMarkdown('/preview/en/docs/page/index.md'),
  );
  await retryHarness.registry.run('copy_markdown');
  assert.equal(attempts, 2, 'failed markdown promise was not invalidated');

  const fallbackHarness = harness({ actions: [actions[0]], clipboard: false });
  await fallbackHarness.registry.run('copy_markdown');
  assert.deepEqual(fallbackHarness.events.execCommands, ['copy']);
  assert.deepEqual(fallbackHarness.events.fallbackText, ['# Page']);

  console.log('PRD 4 action registry behavior checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
