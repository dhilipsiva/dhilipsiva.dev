/* dhilipsiva.dev — progressive enhancement only.
   The site is fully functional without JS: nav is a CSS checkbox toggle,
   theme defaults to dark. This script just persists a light/dark preference. */
(function () {
  var KEY = 'dsiva-theme';
  function apply(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.theme-toggle');
    if (!btn) return;
    var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var next = cur === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, next); } catch (err) {}
    apply(next);
    btn.setAttribute('aria-pressed', String(next === 'light'));
  });
  // Close the mobile nav after following an in-page link / navigating.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.nav__link')) {
      var sw = document.getElementById('nav-switch');
      if (sw) sw.checked = false;
    }
  });
  // Reflect the current (possibly saved) theme on the toggle's aria-pressed at load,
  // so assistive tech doesn't report a stale "false" when the page opens in light mode.
  function syncToggle() {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', String(isLight));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncToggle);
  else syncToggle();
})();
