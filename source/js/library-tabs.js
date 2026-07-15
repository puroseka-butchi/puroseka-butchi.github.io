'use strict';

(() => {
  const body = document.querySelector('.post-body');
  if (!body) return;
  const headings = [...body.querySelectorAll(':scope > .translation-library-project')];
  if (!headings.length) return;

  const tabs = document.createElement('div');
  tabs.className = 'translation-library-tabs';
  tabs.setAttribute('role', 'tablist');
  body.insertBefore(tabs, headings[0]);

  const panes = headings.map((heading, index) => {
    const pane = document.createElement('section');
    const paneId = `library-pane-${heading.id || index + 1}`;
    pane.className = 'translation-library-pane';
    pane.id = paneId;
    pane.setAttribute('role', 'tabpanel');
    pane.hidden = index !== 0;
    body.insertBefore(pane, heading);

    let node = heading;
    const nextHeading = headings[index + 1] || null;
    while (node && node !== nextHeading) {
      const next = node.nextSibling;
      pane.append(node);
      node = next;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `translation-library-tab${index === 0 ? ' is-active' : ''}`;
    button.textContent = heading.textContent.trim();
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', paneId);
    button.setAttribute('aria-selected', String(index === 0));
    tabs.append(button);
    return { button, pane };
  });

  const activate = selected => {
    for (const item of panes) {
      const active = item === selected;
      item.button.classList.toggle('is-active', active);
      item.button.setAttribute('aria-selected', String(active));
      item.pane.hidden = !active;
    }
  };

  panes.forEach(item => item.button.addEventListener('click', () => activate(item)));
})();
