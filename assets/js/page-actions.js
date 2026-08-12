/** Bind the progressive-enhancement page rail to the shared action registry. */
(function () {
  'use strict';
  if (!window.OinkActions) return;

  function announce(root, text) {
    var status = root && root.querySelector('[data-td-page-context-status]');
    if (!status) return;
    status.textContent = '';
    window.requestAnimationFrame(function () { status.textContent = text; });
  }

  function showCopied(button, root) {
    var label = button.querySelector('[data-td-page-copy-label]');
    button.classList.add('is-copied');
    if (label && !label.dataset.original) label.dataset.original = label.textContent;
    if (label) label.textContent = root.dataset.tCopied || label.textContent;
    announce(root, root.dataset.tCopied || 'Copied');
    window.setTimeout(function () {
      button.classList.remove('is-copied');
      if (label && label.dataset.original) label.textContent = label.dataset.original;
    }, 1400);
  }

  document.querySelectorAll('[data-oink-action]').forEach(function (control) {
    var id = control.dataset.oinkAction;
    var action = window.OinkActions.get(id);
    if (!action || !action.available) return;
    var root = control.closest('[data-td-page-context]');

    if (id === 'copy_markdown') {
      ['pointerenter', 'focus'].forEach(function (eventName) {
        control.addEventListener(eventName, function () {
          window.OinkActions.preloadMarkdown(action.url).catch(function () {});
        }, { once: true });
      });
      control.addEventListener('click', function () {
        window.OinkActions.run(id, { source: 'page' })
          .then(function () { showCopied(control, root); })
          .catch(function () {
            announce(root, (root && root.dataset.tCopyError) || 'Copy failed');
          });
      });
    } else if (id === 'print') {
      control.addEventListener('click', function () {
        window.OinkActions.run(id, { source: 'page' });
      });
    }
  });
})();
