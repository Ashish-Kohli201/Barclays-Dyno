const rootEl = document.getElementById('root');

function showError(err) {
  const message = err && (err.stack || err.message) ? (err.stack || err.message) : String(err);
  rootEl.innerHTML = `<pre style="margin:0;padding:16px;white-space:pre-wrap;font:13px/1.45 Consolas,Monaco,monospace;background:#1e1e1e;color:#ffb4b4;height:100%;box-sizing:border-box;">${message}</pre>`;
}

window.addEventListener('error', (event) => {
  showError(event.error || event.message || event);
});

window.addEventListener('unhandledrejection', (event) => {
  showError(event.reason || event);
});

(async () => {
  try {
    const [{ createElement }, { createRoot }, { default: App }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('./app.compiled.js')
    ]);

    createRoot(rootEl).render(createElement(App));
  } catch (err) {
    showError(err);
  }
})();