// Legacy tabpane persistence plus stable Code Group hash/sync/persistence.
(function () {
  'use strict';

  const legacyBase = 'td-tp-persist';
  const legacyCountKey = `${legacyBase}-count`;
  const internalOrigins = new WeakMap();
  let hashFrame = 0;

  const storage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        console.error(
          `OINK tabs: unable to read localStorage key '${key}':`,
          error,
        );
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.error(
          `OINK tabs: unable to write localStorage key '${key}':`,
          error,
        );
        return false;
      }
    },
  };

  const showTab = (button, origin) => {
    if (!button || button.disabled || button.classList.contains('active')) {
      return false;
    }
    if (!window.bootstrap?.Tab) return false;
    internalOrigins.set(button, origin);
    try {
      window.bootstrap.Tab.getOrCreateInstance(button).show();
      return true;
    } catch (error) {
      internalOrigins.delete(button);
      console.error('OINK tabs: unable to activate tab:', error);
      return false;
    }
  };

  const legacyTabs = () =>
    Array.from(document.querySelectorAll('[data-td-tp-persist]'));

  const activateLegacyKey = (key, origin) => {
    if (!key) return;
    legacyTabs()
      .filter((tab) => tab.getAttribute('data-td-tp-persist') === key)
      .forEach((tab) => showTab(tab, origin));
  };

  const persistLegacyKey = (key) => {
    if (!key) return;
    const count = Number.parseInt(storage.get(legacyCountKey) || '0', 10) || 0;
    const next = count + 1;
    if (storage.set(legacyCountKey, String(next))) {
      storage.set(`${legacyBase}:${key}`, String(next));
    }
  };

  const initializeLegacyTabs = () => {
    const keys = [
      ...new Set(legacyTabs().map((tab) => tab.dataset.tdTpPersist)),
    ];
    keys
      .map((key) => [
        key,
        Number.parseInt(storage.get(`${legacyBase}:${key}`) || '0', 10) || 0,
      ])
      .filter((entry) => entry[1] > 0)
      .sort((left, right) => left[1] - right[1])
      .forEach(([key]) => activateLegacyKey(key, 'legacy-initial'));
  };

  const groups = () =>
    Array.from(document.querySelectorAll('[data-td-code-group]'));

  const groupButtons = (group) =>
    Array.from(group.querySelectorAll('[data-td-code-group-tab]'));

  const groupButton = (group, value) =>
    groupButtons(group).find(
      (button) => button.dataset.tdCodeGroupValue === value,
    );

  const groupPanel = (button) => {
    const target = button?.getAttribute('data-bs-target') || '';
    return target.startsWith('#')
      ? document.getElementById(target.slice(1))
      : null;
  };

  const updateGroupActions = (group, value) => {
    group.querySelectorAll('[data-td-code-group-action]').forEach((action) => {
      action.hidden = action.dataset.tdCodeGroupAction !== value;
    });
  };

  const groupStorageKey = (group) => {
    const sync = group.dataset.sync;
    return sync
      ? `td-code-group:v1:sync:${sync}`
      : `td-code-group:v1:group:${group.dataset.groupId}`;
  };

  const groupPersists = (group) => group.dataset.persist !== 'false';

  const activateGroup = (group, value, origin) => {
    const button = groupButton(group, value);
    if (!button) return false;
    updateGroupActions(group, value);
    showTab(button, origin);
    return true;
  };

  const syncGroupPeers = (source, value, origin) => {
    const affected = new Set([source]);
    const sync = source.dataset.sync;
    if (!sync) return affected;
    groups().forEach((group) => {
      if (group === source || group.dataset.sync !== sync) return;
      // A hash has priority over storage for the entire sync domain. A peer
      // that lacks this value stays unchanged, but must not read a lower-
      // priority stored value and feed it back into the hash-selected group.
      affected.add(group);
      activateGroup(group, value, origin);
    });
    return affected;
  };

  const activateGroupAndPeers = (group, value, origin) => {
    if (!activateGroup(group, value, origin)) return new Set();
    return syncGroupPeers(group, value, origin);
  };

  const resolveHashPanel = () => {
    if (!window.location.hash) return null;
    let id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch (_) {
      return null;
    }
    const target = document.getElementById(id);
    if (!target) return null;
    return target.matches('[data-td-code-group-panel]')
      ? target
      : target.closest('[data-td-code-group-panel]');
  };

  const scrollGroupIntoView = (group) => {
    const rect = group.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (fullyVisible) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    group.scrollIntoView({
      block: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  const activateHash = ({ scroll = true } = {}) => {
    const panel = resolveHashPanel();
    if (!panel) return new Set();
    const group = panel.closest('[data-td-code-group]');
    const value = panel.dataset.tdCodeGroupValue;
    if (!group || !value) return new Set();
    const affected = activateGroupAndPeers(group, value, 'hash');
    if (scroll) {
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => scrollGroupIntoView(group)),
      );
    }
    return affected;
  };

  const initializeCodeGroups = () => {
    groups().forEach((group) => {
      const active = group.querySelector('[data-td-code-group-tab].active');
      if (active) updateGroupActions(group, active.dataset.tdCodeGroupValue);
    });

    const hashAffected = activateHash();
    groups().forEach((group) => {
      if (hashAffected.has(group) || !groupPersists(group)) return;
      const stored = storage.get(groupStorageKey(group));
      if (stored && groupButton(group, stored)) {
        activateGroupAndPeers(group, stored, 'stored');
      }
    });
  };

  const updateLocationHash = (button) => {
    const panel = groupPanel(button);
    if (!panel) return;
    const next = `${window.location.pathname}${window.location.search}#${panel.id}`;
    window.history.replaceState(window.history.state, '', next);
  };

  document.addEventListener('shown.bs.tab', (event) => {
    const button = event.target;
    const origin = internalOrigins.get(button);
    internalOrigins.delete(button);

    if (button.matches('[data-td-code-group-tab]')) {
      const group = button.closest('[data-td-code-group]');
      const value = button.dataset.tdCodeGroupValue;
      if (!group || !value) return;
      updateGroupActions(group, value);
      if (origin) return;

      updateLocationHash(button);
      if (groupPersists(group)) storage.set(groupStorageKey(group), value);
      syncGroupPeers(group, value, 'sync');
      return;
    }

    if (button.hasAttribute('data-td-tp-persist')) {
      if (origin) return;
      const key = button.getAttribute('data-td-tp-persist');
      persistLegacyKey(key);
      activateLegacyKey(key, 'legacy-sync');
    }
  });

  const scheduleHashActivation = () => {
    window.cancelAnimationFrame(hashFrame);
    hashFrame = window.requestAnimationFrame(() => activateHash());
  };
  window.addEventListener('hashchange', scheduleHashActivation);
  window.addEventListener('popstate', scheduleHashActivation);

  const start = () => {
    initializeLegacyTabs();
    initializeCodeGroups();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
