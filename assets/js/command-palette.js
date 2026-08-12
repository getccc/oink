/**
 * command-palette.js — local search dialog and keyboard interaction.
 *
 * This controller is bundled only when shell/search-enabled.html returns true.
 * Search metadata and commands extend this controller in later PRD 4 issues.
 */
(function () {
  'use strict';

  var html = document.documentElement;
  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"])';

  function focusable(container) {
    return Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE),
      function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      },
    );
  }

  function tabTrap(container, isActive) {
    return function (event) {
      if (event.key !== 'Tab' || !isActive()) return;
      var items = focusable(container);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
  }

  function initSearch() {
    var root = document.getElementById('td-shell-search');
    if (!root) return;
    var input = root.querySelector('.td-shell-search__input');
    var list = root.querySelector('.td-shell-search__list');
    var panel = root.querySelector('.td-shell-search__panel');
    var status = root.querySelector('[data-td-shell-search-status]');
    if (!input || !list || !panel || !status) return;

    var engine = null;
    var docs = null;
    var loading = false;
    var results = [];
    var selected = 0;
    var hideTimer = 0;
    var maxResults = parseInt(root.dataset.maxResults, 10);
    if (!Number.isFinite(maxResults) || maxResults < 1) maxResults = 10;
    var openers = document.querySelectorAll('[data-td-shell-search-open]');
    var lastOpener = null;

    function isOpen() {
      return root.classList.contains('is-open');
    }

    function open(event) {
      var opener =
        event && event.currentTarget
          ? event.currentTarget
          : document.activeElement;
      if (
        opener &&
        opener.closest &&
        opener.closest('#td-shell-sidebar') &&
        html.hasAttribute('data-td-shell-drawer')
      ) {
        var drawerOpeners = document.querySelectorAll(
          '[data-td-shell-drawer-open]',
        );
        opener =
          Array.prototype.find.call(drawerOpeners, function (candidate) {
            return candidate.offsetParent !== null;
          }) || drawerOpeners[0] || opener;
      }
      lastOpener = opener;
      if (window.OinkSurfaceCoordinator)
        window.OinkSurfaceCoordinator.closeOthers('palette');
      window.clearTimeout(hideTimer);
      root.hidden = false;
      html.setAttribute('data-td-shell-lock', '');
      openers.forEach(function (el) {
        el.setAttribute('aria-expanded', 'true');
      });
      input.setAttribute('aria-expanded', 'true');
      window.requestAnimationFrame(function () {
        root.classList.add('is-open');
      });
      input.focus();
      input.select();
      ensureIndex();
    }
    function close(restoreFocus) {
      var shouldRestore = restoreFocus !== false;
      root.classList.remove('is-open');
      html.removeAttribute('data-td-shell-lock');
      openers.forEach(function (el) {
        el.setAttribute('aria-expanded', 'false');
      });
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      if (shouldRestore && lastOpener && root.contains(document.activeElement))
        lastOpener.focus();
      hideTimer = window.setTimeout(function () {
        root.hidden = true;
      }, 240);
    }
    if (window.OinkSurfaceCoordinator)
      window.OinkSurfaceCoordinator.register('palette', close);

    function announce(text) {
      status.textContent = '';
      window.requestAnimationFrame(function () {
        status.textContent = text;
      });
    }

    function message(text) {
      list.textContent = '';
      input.removeAttribute('aria-activedescendant');
      var el = document.createElement('div');
      el.className = 'td-shell-search__empty';
      el.textContent = text;
      list.appendChild(el);
      announce(text);
    }

    function ensureIndex() {
      if (engine || loading) return;
      loading = true;
      list.setAttribute('aria-busy', 'true');
      if (!docs) message(root.dataset.tLoading || '…');
      fetch(root.dataset.indexSrc)
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          docs = data;
          engine = window.OinkSearchEngine.create(data, lunr, maxResults);
          loading = false;
          list.removeAttribute('aria-busy');
          render(input.value);
        })
        .catch(function () {
          loading = false;
          list.removeAttribute('aria-busy');
          message(root.dataset.tEmpty || 'No results');
        });
    }

    function highlight(text, q) {
      var fragment = document.createDocumentFragment();
      var at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
      if (at < 0) {
        fragment.appendChild(document.createTextNode(text));
        return fragment;
      }
      fragment.appendChild(document.createTextNode(text.slice(0, at)));
      var mark = document.createElement('mark');
      mark.textContent = text.slice(at, at + q.length);
      fragment.appendChild(mark);
      fragment.appendChild(document.createTextNode(text.slice(at + q.length)));
      return fragment;
    }

    function select(i) {
      var options = Array.prototype.slice.call(
        list.querySelectorAll('[role="option"]'),
      );
      if (!options.length) {
        input.removeAttribute('aria-activedescendant');
        return;
      }
      selected = Math.max(0, Math.min(i, options.length - 1));
      options.forEach(function (row, n) {
        row.setAttribute('aria-selected', n === selected ? 'true' : 'false');
      });
      var row = options[selected];
      input.setAttribute('aria-activedescendant', row.id);
      row.scrollIntoView({ block: 'nearest' });
    }

    function render(q) {
      q = (q || '').trim();
      if (!docs || !engine) return;
      list.textContent = '';
      results = [];
      selected = 0;
      input.removeAttribute('aria-activedescendant');
      if (!q) {
        status.textContent = '';
        return;
      }

      try {
        results = engine.query(q);
      } catch (e) {
        results = [];
      }
      if (!results.length) {
        message(root.dataset.tEmpty || 'No results');
        return;
      }
      var groups = window.OinkSearchEngine.group(results);
      results = [];
      groups.forEach(function (group) {
        var section = document.createElement('div');
        section.className = 'td-shell-search__group';
        section.setAttribute('role', 'presentation');

        var heading = document.createElement('div');
        heading.className = 'td-shell-search__group-label';
        heading.setAttribute('role', 'presentation');
        heading.textContent = group.label;
        section.appendChild(heading);

        group.results.forEach(function (r) {
          var i = results.length;
          results.push(r);
          var row = document.createElement('a');
          row.className = 'td-shell-search__item';
          row.id = 'td-shell-search-option-' + i;
          row.setAttribute('role', 'option');
          row.setAttribute('aria-selected', 'false');
          row.setAttribute('tabindex', '-1');
          row.href = r.doc.ref;

          var title = document.createElement('div');
          title.className = 'td-shell-search__item-title';
          title.appendChild(highlight(r.doc.title || r.doc.ref, q));
          row.appendChild(title);

          var ref = document.createElement('div');
          ref.className = 'td-shell-search__item-ref';
          ref.textContent = r.doc.ref;
          row.appendChild(ref);

          if (r.excerpt) {
            var excerpt = document.createElement('div');
            excerpt.className = 'td-shell-search__item-excerpt';
            excerpt.appendChild(highlight(r.excerpt, q));
            row.appendChild(excerpt);
          }

          row.addEventListener('pointermove', function () {
            if (selected !== i) select(i);
          });
          section.appendChild(row);
        });
        list.appendChild(section);
      });
      select(0);
      announce(
        (root.dataset.tResults || '{count} results').replace(
          '{count}',
          String(results.length),
        ),
      );
    }

    var debounce = 0;
    input.addEventListener('input', function () {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(function () {
        render(input.value);
      }, 80);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (results.length) select(Math.min(selected + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (results.length) select(Math.max(selected - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (results.length) select(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        if (results.length) select(results.length - 1);
      } else if (e.key === 'Enter') {
        var row = list.querySelectorAll('[role="option"]')[selected];
        if (row && row.href) window.location.href = row.href;
      }
    });

    document.addEventListener('keydown', tabTrap(panel, isOpen), true);

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen()) {
          close();
        } else {
          open();
        }
      } else if (e.key === 'Escape' && isOpen()) {
        close();
      }
    });
    openers.forEach(function (el) {
      el.addEventListener('click', open);
    });
    root
      .querySelectorAll('[data-td-shell-search-close]')
      .forEach(function (el) {
        el.addEventListener('click', close);
      });

    // Show Ctrl instead of the Command badge on non-Apple platforms.
    var apple = /Mac|iPhone|iPad|iPod/.test(
      navigator.platform || navigator.userAgent,
    );
    if (!apple) {
      document
        .querySelectorAll('[data-td-shell-meta-key]')
        .forEach(function (el) {
          el.textContent = 'Ctrl';
        });
    }
  }

  initSearch();
})();
