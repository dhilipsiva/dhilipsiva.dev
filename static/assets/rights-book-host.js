/* Share the website theme while leaving Dioxus in charge of book state. */
(function () {
  var siteKey = 'dsiva-theme';
  var bookKey = 'rights-book.preferences.v1';
  var root = document.documentElement;

  // Run before hydration. Preserve every saved reading/game preference.
  try {
    var saved = localStorage.getItem(bookKey);
    var preferences = saved ? JSON.parse(saved) : {};
    var theme = localStorage.getItem(siteKey);
    if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
      if (theme === 'light' || theme === 'dark') {
        preferences.theme = theme;
        localStorage.setItem(bookKey, JSON.stringify(preferences));
      }
      if (preferences.theme === 'light' || preferences.theme === 'dark') {
        root.dataset.theme = preferences.theme;
      }
    }
  } catch (error) { /* The book handles unavailable or invalid storage. */ }

  // Capture before site.js: use the book's own action so its in-memory state,
  // saved preferences and both theme controls agree after every render.
  document.addEventListener('click', function (event) {
    var toggle = event.target.closest && event.target.closest('.theme-toggle');
    if (!toggle) return;
    var app = document.getElementById('book-app');
    var bookToggle = app && app.querySelector('.theme-control');
    if (bookToggle && app.dataset.ready === 'true') {
      event.stopImmediatePropagation();
      bookToggle.click();
    } else if (bookToggle) {
      // site.js can still toggle a static reader while Wasm is loading or has
      // failed. Let a later hydration pick up that choice as well.
      try {
        var preferences = JSON.parse(localStorage.getItem(bookKey) || '{}');
        if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
          preferences.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
          localStorage.setItem(bookKey, JSON.stringify(preferences));
        }
      } catch (error) {}
    }
  }, true);

  function sync() {
    var theme = root.dataset.theme === 'light' ? 'light' : 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (button) {
      button.setAttribute('aria-pressed', String(theme === 'light'));
    });
    try { localStorage.setItem(siteKey, theme); } catch (error) {}
  }
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('DOMContentLoaded', sync);
})();
