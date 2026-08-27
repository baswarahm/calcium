/**
 * app.js
 * Entry point. Waits for the DOM, then hands control to UI.init(), which
 * wires up every panel. Kept intentionally tiny — all real logic lives in
 * the focused modules loaded before this file.
 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    UI.init();
  } catch (err) {
    console.error('Failed to initialize calculator', err);
    const body = document.body;
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#12151c;color:#ef6461;font-family:monospace;padding:24px;text-align:center;z-index:9999;';
    banner.textContent = 'Something went wrong starting the calculator. Please reload the page.';
    body.appendChild(banner);
  }
});
