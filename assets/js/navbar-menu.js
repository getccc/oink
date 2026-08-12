/**
 * navbar-menu.js — one-level desktop disclosure and mobile accordion.
 *
 * Parent labels remain ordinary links. Only the adjacent button owns the
 * disclosure state, so navigation and expansion never compete for one click.
 */
(function () {
  'use strict';

  function setDisclosure(toggle, panel, owner, open) {
    panel.hidden = !open;
    owner.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    var label = open
      ? toggle.dataset.labelCollapse
      : toggle.dataset.labelExpand;
    if (label) toggle.setAttribute('aria-label', label);
  }

  function panelItems(panel) {
    return Array.prototype.filter.call(
      panel.querySelectorAll('a[href], button:not([disabled])'),
      function (item) {
        return !item.hasAttribute('hidden');
      },
    );
  }

  function initDesktopMenus() {
    document.querySelectorAll('[data-td-navbar-menu]').forEach(function (menu, index) {
      var toggle = menu.querySelector('[data-td-navbar-toggle]');
      var panel = menu.querySelector('[data-td-navbar-panel]');
      var surfaceName = 'navbar-menu-' + index;
      if (!toggle || !panel) return;

      function isOpen() {
        return !panel.hidden;
      }
      function close(restoreFocus) {
        if (!isOpen()) return;
        setDisclosure(toggle, panel, menu, false);
        if (restoreFocus === true) toggle.focus();
      }
      function open(focusFirst) {
        if (window.OinkSurfaceCoordinator)
          window.OinkSurfaceCoordinator.closeOthers(surfaceName);
        setDisclosure(toggle, panel, menu, true);
        if (focusFirst)
          window.requestAnimationFrame(function () {
            var items = panelItems(panel);
            if (items.length) items[0].focus();
          });
      }

      if (window.OinkSurfaceCoordinator)
        window.OinkSurfaceCoordinator.register(surfaceName, close);

      toggle.addEventListener('click', function () {
        if (isOpen()) close(false);
        else open(false);
      });
      toggle.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          open(true);
        } else if (event.key === 'Escape' && isOpen()) {
          event.preventDefault();
          close(true);
        }
      });
      panel.addEventListener('keydown', function (event) {
        var items = panelItems(panel);
        var current = items.indexOf(document.activeElement);
        var next = current;
        if (event.key === 'Escape') {
          event.preventDefault();
          close(true);
          return;
        } else if (event.key === 'ArrowDown') {
          next = current < 0 ? 0 : Math.min(current + 1, items.length - 1);
        } else if (event.key === 'ArrowUp') {
          next = current < 0 ? items.length - 1 : Math.max(current - 1, 0);
        } else if (event.key === 'Home') {
          next = 0;
        } else if (event.key === 'End') {
          next = items.length - 1;
        } else {
          return;
        }
        if (items.length) {
          event.preventDefault();
          items[next].focus();
        }
      });
      document.addEventListener(
        'pointerdown',
        function (event) {
          if (isOpen() && !menu.contains(event.target)) close(false);
        },
        true,
      );
      menu.addEventListener('focusout', function (event) {
        if (isOpen() && !menu.contains(event.relatedTarget)) close(false);
      });
    });
  }

  function initMobileAccordions() {
    var root = document.querySelector('[data-mobile-menu]');
    if (!root) return;
    var sections = Array.prototype.slice.call(
      root.querySelectorAll('[data-td-navbar-accordion]'),
    );
    var singleOpen = root.dataset.accordionSingleOpen === 'true';

    function setOpen(section, open) {
      var toggle = section.querySelector('[data-td-navbar-accordion-toggle]');
      var panel = section.querySelector('[data-td-navbar-accordion-panel]');
      if (!toggle || !panel) return;
      if (open && singleOpen)
        sections.forEach(function (other) {
          if (other !== section) setOpen(other, false);
        });
      setDisclosure(toggle, panel, section, open);
    }

    sections.forEach(function (section) {
      var toggle = section.querySelector('[data-td-navbar-accordion-toggle]');
      var panel = section.querySelector('[data-td-navbar-accordion-panel]');
      var parent = section.querySelector('.mobile-menu-parent-link');
      if (!toggle || !panel) return;
      toggle.addEventListener('click', function () {
        setOpen(section, panel.hidden);
      });
      if (parent && parent.classList.contains('active')) setOpen(section, true);
    });
  }

  initDesktopMenus();
  initMobileAccordions();
})();
