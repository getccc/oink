// "Was this page helpful?" widget. Scoped per instance so a page may carry
// more than one, and inert when no analytics sink is present.
(function () {
  'use strict';

  document.querySelectorAll('[data-td-feedback]').forEach(function (root) {
    var yesButton = root.querySelector('.feedback--answer-yes');
    var noButton = root.querySelector('.feedback--answer-no');
    var yesResponse = root.querySelector('.feedback--response-yes');
    var noResponse = root.querySelector('.feedback--response-no');
    if (!yesButton || !noButton) return;

    var maxValue = parseInt(root.dataset.maxValue, 10);
    if (!Number.isFinite(maxValue)) maxValue = 100;

    function answer(response, value) {
      if (response) response.classList.add('feedback--response__visible');
      yesButton.disabled = true;
      noButton.disabled = true;
      if (typeof gtag !== 'function') return;
      gtag('event', 'page_helpful', {
        event_category: 'Helpful',
        event_label: window.location.pathname,
        value: value,
      });
    }

    yesButton.addEventListener('click', function () {
      answer(yesResponse, maxValue);
    });
    noButton.addEventListener('click', function () {
      answer(noResponse, 0);
    });
  });
})();
