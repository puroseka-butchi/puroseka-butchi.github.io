'use strict';

(() => {
  const body = document.querySelector('.post-body');
  if (!body) return;
  const headings = [...body.querySelectorAll(':scope > .translation-library-project')];
  if (!headings.length) return;
  const tocWrap = document.querySelector('.post-toc-wrap');

  const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const ensureId = (element, fallback) => {
    if (!element.id) element.id = fallback;
    return element.id;
  };

  const tocItemsFor = pane => {
    const selectors = [
      '.translation-library-series > h2',
      '.translation-library-feature > h2',
      '.translation-library-grid-section > h3',
      '.translation-library-card-deck-section > h3',
      '.translation-library-side-list-section > h3',
      '.translation-library-notice__content > h3'
    ];
    return [...pane.querySelectorAll(selectors.join(','))];
  };

  const updateToc = item => {
    if (!tocWrap) return;
    const projectTitle = item.button.textContent.trim();
    const children = tocItemsFor(item.pane).map((heading, index) => {
      const target = heading.closest('section, article') || heading;
      const id = ensureId(target, `${item.pane.id}-section-${index + 1}`);
      return `<li class="nav-item nav-level-3"><a class="nav-link" href="#${encodeURIComponent(id)}"><span class="nav-text">${escapeHtml(heading.textContent.trim())}</span></a></li>`;
    }).join('');
    tocWrap.innerHTML = `<div class="post-toc animated"><ol class="nav"><li class="nav-item nav-level-2"><a class="nav-link" href="#${encodeURIComponent(item.pane.id)}"><span class="nav-text">${escapeHtml(projectTitle)}</span></a>${children ? `<ol class="nav-child">${children}</ol>` : ''}</li></ol></div>`;
    const sidebar = tocWrap.closest('.sidebar-inner');
    if (sidebar) {
      sidebar.classList.remove('sidebar-overview-active');
      sidebar.classList.add('sidebar-nav-active', 'sidebar-toc-active');
    }
  };

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
    updateToc(selected);
  };

  panes.forEach(item => item.button.addEventListener('click', () => activate(item)));

  let hashTarget = null;
  if (location.hash) {
    try {
      hashTarget = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    } catch {
      hashTarget = null;
    }
  }
  const initialPane = hashTarget
    ? panes.find(item => item.pane === hashTarget || item.pane.contains(hashTarget))
    : null;
  activate(initialPane || panes[0]);
})();
