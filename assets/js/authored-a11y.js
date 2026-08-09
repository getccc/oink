/**
 * Accessibility repairs for authored content.
 *
 * Loaded on every page, not just the documentation shell: task lists and icon
 * markup also appear on list pages, the community layout, and the printable
 * view, none of which load docs-shell.js.
 */
(function () {
  'use strict';

  // Goldmark task-list controls are read-only status markers. Give them the
  // list item text as their accessible name without changing authored HTML.
  document
    .querySelectorAll('.td-content input[type="checkbox"][disabled]')
    .forEach(function (input) {
      if (
        input.hasAttribute('aria-label') ||
        input.hasAttribute('aria-labelledby')
      )
        return;
      var item = input.closest('li');
      var label = item ? item.textContent.replace(/\s+/g, ' ').trim() : '';
      if (label) input.setAttribute('aria-label', label);
      else input.setAttribute('aria-hidden', 'true');
    });

  // Empty Font Awesome elements are decorative; the adjacent text or parent
  // control already carries the name that assistive technology should use.
  document
    .querySelectorAll('i[class*="fa-"], span[class*="fa-"]')
    .forEach(function (icon) {
      if (
        icon.textContent.trim() ||
        icon.hasAttribute('aria-label') ||
        icon.hasAttribute('title')
      )
        return;
      icon.setAttribute('aria-hidden', 'true');
    });
})();
