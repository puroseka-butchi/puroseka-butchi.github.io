'use strict';

(() => {
  const body = document.querySelector('.post-body');
  if (!body) return;
  const headings = [...body.querySelectorAll(':scope > .translation-library-project')];
  if (!headings.length) return;
  const tocWrap = document.querySelector('.post-toc-wrap');
  const sidebar = tocWrap?.closest('.sidebar-inner');
  if (sidebar) {
    sidebar.classList.remove('sidebar-nav-active', 'sidebar-toc-active');
    sidebar.classList.add('sidebar-overview-active', 'translation-library-sidebar-overview');
  }

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
    if (pane.querySelector('.translation-library-event-card')) {
      pane.classList.add('translation-library-pane--event');
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

  for (const item of panes) {
    const groups = [...item.pane.querySelectorAll('.translation-library-side-list-section')];
    if (!groups.length) continue;
    const picker = document.createElement('div');
    picker.className = 'translation-library-character-picker';
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', 'Chọn nhân vật Side Story');
    item.pane.insertBefore(picker, groups[0]);

    const choices = [];
    const addChoice = (label, avatar, group) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'translation-library-character-picker__button';
      button.setAttribute('aria-label', label);
      button.title = label;
      if (avatar) {
        const image = document.createElement('img');
        image.src = avatar;
        image.alt = '';
        image.loading = 'lazy';
        button.append(image);
      } else {
        button.textContent = group ? label.slice(0, 2) : 'Tất cả';
      }
      picker.append(button);
      choices.push({ button, group });
      button.addEventListener('click', () => selectGroup(group));
    };

    const selectGroup = selected => {
      for (const group of groups) group.hidden = Boolean(selected && group !== selected);
      for (const choice of choices) {
        const active = choice.group === selected;
        choice.button.classList.toggle('is-active', active);
        choice.button.setAttribute('aria-pressed', String(active));
      }
    };

    addChoice('Tất cả', '', null);
    for (const group of groups) {
      addChoice(group.querySelector('h3')?.textContent.trim() || 'Nhân vật', group.dataset.characterAvatar, group);
    }
    item.selectSideSection = selectGroup;
    selectGroup(groups[0]);
  }

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
  const hashGroup = hashTarget?.closest('.translation-library-side-list-section');
  if (hashGroup) initialPane?.selectSideSection?.(hashGroup);
  activate(initialPane || panes[0]);
})();
