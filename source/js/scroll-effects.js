'use strict';

(() => {
  const targets = [
    '.translation-library-event-card',
    '.translation-library-feature',
    '.translation-library-series',
    '.translation-library-grid-section',
    '.translation-library-card-deck-section',
    '.translation-library-side-list-section',
    '.translation-library-notice'
  ];

  const elements = [...document.querySelectorAll(targets.join(','))];
  if (!elements.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  document.documentElement.classList.add('scroll-effects-ready');
  elements.forEach((element) => element.classList.add('scroll-reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.08
  });

  elements.forEach((element) => observer.observe(element));
})();
