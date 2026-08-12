'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

function load(relative) {
  const target = path.join(__dirname, '..', '..', relative);
  delete require.cache[require.resolve(target)];
  require(target);
}

function testCoordinatorCompatibility() {
  global.window = {};
  load('assets/js/surface-coordinator.js');
  const coordinator = window.OinkSurfaceCoordinator;
  const calls = [];

  const unregisterDrawer = coordinator.register('drawer', (restore) => {
    calls.push(['drawer', restore]);
  });
  coordinator.register('root-menu', (restore) => {
    calls.push(['root-menu', restore]);
  });
  coordinator.register('palette', (restore) => {
    calls.push(['palette', restore]);
  });

  coordinator.closeOthers('root-menu', ['drawer']);
  assert.deepEqual(calls, [['palette', false]]);

  calls.length = 0;
  coordinator.closeOthers('palette');
  assert.deepEqual(calls, [
    ['drawer', false],
    ['root-menu', false],
  ]);

  calls.length = 0;
  unregisterDrawer();
  coordinator.closeAll(true);
  assert.deepEqual(calls, [
    ['root-menu', true],
    ['palette', true],
  ]);
}

function classList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
  };
}

function element(overrides = {}) {
  const attributes = new Map();
  const listeners = new Map();
  return Object.assign(
    {
      classList: classList(),
      dataset: {},
      offsetParent: {},
      textContent: '',
      hidden: false,
      addEventListener(type, callback) {
        const callbacks = listeners.get(type) || [];
        callbacks.push(callback);
        listeners.set(type, callbacks);
      },
      appendChild() {},
      contains(candidate) {
        return candidate === this;
      },
      dispatch(type, event = {}) {
        (listeners.get(type) || []).forEach((callback) => callback(event));
      },
      focus() {
        global.document.activeElement = this;
      },
      getAttribute(name) {
        return attributes.get(name) || null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      removeAttribute(name) {
        attributes.delete(name);
      },
      select() {},
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
    },
    overrides,
  );
}

function testPaletteFocusFromDrawer() {
  const documentListeners = new Map();
  const htmlAttributes = new Set(['data-td-shell-drawer']);
  const html = element({
    hasAttribute(name) {
      return htmlAttributes.has(name);
    },
    removeAttribute(name) {
      htmlAttributes.delete(name);
    },
    setAttribute(name) {
      htmlAttributes.add(name);
    },
  });
  const externalDrawerOpener = element();
  const internalPaletteOpener = element({
    closest(selector) {
      return selector === '#td-shell-sidebar' ? element() : null;
    },
  });
  const input = element();
  const list = element();
  const panel = element();
  const status = element();
  const root = element({
    dataset: {
      indexSrc: '/search.json',
      maxResults: '10',
      tLoading: 'Loading',
      tEmpty: 'Empty',
    },
    hidden: true,
    contains(candidate) {
      return candidate === input || candidate === panel || candidate === list;
    },
    querySelector(selector) {
      return {
        '.td-shell-search__input': input,
        '.td-shell-search__list': list,
        '.td-shell-search__panel': panel,
        '[data-td-shell-search-status]': status,
      }[selector];
    },
  });

  global.document = {
    activeElement: internalPaletteOpener,
    documentElement: html,
    addEventListener(type, callback) {
      const callbacks = documentListeners.get(type) || [];
      callbacks.push(callback);
      documentListeners.set(type, callbacks);
    },
    createElement() {
      return element();
    },
    getElementById(id) {
      return id === 'td-shell-search' ? root : null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-td-shell-search-open]')
        return [internalPaletteOpener];
      if (selector === '[data-td-shell-drawer-open]')
        return [externalDrawerOpener];
      return [];
    },
  };
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: { platform: 'MacIntel', userAgent: '' },
  });
  global.fetch = () => new Promise(() => {});
  global.window = {
    clearTimeout() {},
    requestAnimationFrame(callback) {
      callback();
    },
    setTimeout() {
      return 1;
    },
    OinkSurfaceCoordinator: {
      closeOthers(name) {
        assert.equal(name, 'palette');
        html.removeAttribute('data-td-shell-drawer');
      },
      register(name, close) {
        assert.equal(name, 'palette');
        this.paletteClose = close;
      },
    },
  };

  load('assets/js/command-palette.js');
  internalPaletteOpener.dispatch('click', {
    currentTarget: internalPaletteOpener,
  });
  assert.equal(document.activeElement, input);
  assert.equal(html.hasAttribute('data-td-shell-drawer'), false);

  const escape = (documentListeners.get('keydown') || []).find((callback) => {
    document.activeElement = input;
    callback({ key: 'Escape' });
    return document.activeElement === externalDrawerOpener;
  });
  assert.ok(escape, 'Escape must restore focus to the visible drawer opener');
}

testCoordinatorCompatibility();
testPaletteFocusFromDrawer();
console.log('PRD 4 surface behavior checks passed');
