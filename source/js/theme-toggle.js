'use strict';

(() => {
  const storageKey = 'blog-theme';
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  const icon = button?.querySelector('.theme-toggle__icon');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  if (!button || !icon) return;

  const currentTheme = () => root.dataset.theme || (systemTheme.matches ? 'dark' : 'light');

  const updateButton = () => {
    const isDark = currentTheme() === 'dark';
    const nextThemeName = isDark ? 'sáng' : 'tối';
    icon.textContent = isDark ? '☀' : '☾';
    button.setAttribute('aria-label', `Chuyển sang giao diện ${nextThemeName}`);
    button.title = `Chuyển sang giao diện ${nextThemeName}`;
    button.setAttribute('aria-pressed', String(isDark));
  };

  button.addEventListener('click', () => {
    const nextTheme = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;

    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch (error) {
      // Theme vẫn đổi trong phiên hiện tại nếu localStorage không khả dụng.
    }

    updateButton();
  });

  systemTheme.addEventListener?.('change', () => {
    if (!root.dataset.theme) updateButton();
  });

  updateButton();
})();
