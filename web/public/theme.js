// The theme before the first paint, as lib/theme.tsx will set it: no flash of the wrong one. A file of
// its own rather than a script in index.html, because the online setup's content security policy runs
// no script written into a page. Loaded without defer, so it runs before the page is drawn.
try {
  var choice = localStorage.getItem('vayora.theme');
  var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
} catch (error) {}
