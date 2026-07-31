'use strict';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePath(value) {
  const path = String(value || '').trim().replace(/^https?:\/\/[^/]+/i, '');
  if (!path) return '';
  return `/${path.replace(/^\/+|\/+$/g, '')}/`;
}

hexo.extend.tag.register('story_nav', function storyNavigationTag(args) {
  const id = String(args[0] || '').trim();
  const data = hexo.locals.get('data') || {};
  const navigation = data.story_navigation && data.story_navigation[id];

  if (!navigation) {
    hexo.log.warn(`[story_nav] Không tìm thấy cấu hình "${id}" trong source/_data/story_navigation.yml.`);
    return `<!-- story_nav: missing ${escapeHtml(id)} -->`;
  }

  const title = navigation.title || id;
  const titleUrl = navigation.url || '';
  const currentPath = normalizePath(this.path || this.permalink || '');
  const groups = Array.isArray(navigation.groups) ? navigation.groups : [];
  const rows = groups.map(group => {
    const links = Array.isArray(group.links) ? group.links : [];
    const items = links.map(link => {
      const label = escapeHtml(link.label || 'Liên kết');
      const url = String(link.url || '').trim();
      if (!url) return `<span class="story-series-nav__item is-unavailable">${label}</span>`;
      const isCurrent = currentPath && normalizePath(url) === currentPath;
      return `<span class="story-series-nav__item"><a href="${escapeHtml(url)}"${isCurrent ? ' class="is-current" aria-current="page"' : ''}>${label}</a></span>`;
    }).join('');
    return `<tr><th scope="row">${escapeHtml(group.label || 'Nhóm')}</th><td><div class="story-series-nav__links">${items}</div></td></tr>`;
  }).join('');
  const titleHtml = titleUrl
    ? `<a href="${escapeHtml(titleUrl)}">${escapeHtml(title)}</a>`
    : escapeHtml(title);

  return `<nav class="story-series-nav" aria-label="Điều hướng ${escapeHtml(title)}">
    <table>
      <caption>${titleHtml}</caption>
      <tbody>${rows}</tbody>
    </table>
  </nav>`;
});
