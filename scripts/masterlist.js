'use strict';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function postCategories(post) {
  if (post.categories && typeof post.categories.toArray === 'function') {
    return post.categories.toArray().map(category => category.name);
  }
  if (Array.isArray(post.categories)) return post.categories.map(category => category.name || category);
  return [];
}

function postCharacters(post) {
  if (Array.isArray(post.characters)) return post.characters;
  if (typeof post.characters === 'string') return post.characters.split(',').map(item => item.trim()).filter(Boolean);
  return [];
}

function statusLabel(status) {
  const labels = {
    draft: 'Bản nháp',
    incomplete: 'Chưa hoàn thành',
    complete: 'Hoàn thành',
    unproofread: 'Chưa hoàn thành',
    proofread: 'Hoàn thành'
  };
  return labels[status] || status || 'Chưa xác định';
}

hexo.extend.tag.register('translation_masterlist', function masterlistTag() {
  const postsModel = hexo.locals.get('posts');
  const siteData = hexo.locals.get('data') || {};
  const overrides = siteData.masterlist?.posts || {};
  const posts = postsModel && typeof postsModel.toArray === 'function'
    ? postsModel.toArray()
    : [];
  const visiblePosts = posts
    .map(post => {
      const slug = String(post.slug || '');
      const override = overrides[slug] || {};
      return { post, slug, override };
    })
    .filter(item => item.post.published !== false && item.override.hidden !== true)
    .sort((left, right) => {
      const leftOrder = Number(left.override.order);
      const rightOrder = Number(right.override.order);
      const leftHasOrder = Number.isFinite(leftOrder);
      const rightHasOrder = Number.isFinite(rightOrder);
      if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
      if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;
      return new Date(right.post.date) - new Date(left.post.date);
    });

  if (!visiblePosts.length) return '<p>Chưa có bản dịch được xuất bản.</p>';

  const groups = new Map();
  for (const item of visiblePosts) {
    const { post, override } = item;
    const categories = postCategories(post);
    const group = String(override.group || categories[categories.length - 1] || 'Bản dịch khác');
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }

  const root = String(hexo.config.root || '/').replace(/\/$/, '');
  return [...groups.entries()].map(([group, groupPosts]) => {
    const rows = groupPosts.map(({ post, override }) => {
      const href = `${root}/${String(post.path || '').replace(/^\//, '')}`.replace(/\/+/g, '/');
      const characters = Array.isArray(override.characters)
        ? override.characters
        : typeof override.characters === 'string'
          ? override.characters.split(',').map(item => item.trim()).filter(Boolean)
          : postCharacters(post);
      const title = String(override.title || post.title);
      const status = String(override.status || post.translation_status || '');
      return `<tr>
        <td><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></td>
        <td>${escapeHtml(characters.join(', ') || '—')}</td>
        <td><span class="status-badge">${escapeHtml(statusLabel(status))}</span></td>
      </tr>`;
    }).join('');
    return `<section class="translation-masterlist">
      <h2>${escapeHtml(group)}</h2>
      <div class="table-container"><table>
        <thead><tr><th>Bản dịch</th><th>Nhân vật / Khách mời</th><th>Trạng thái</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
  }).join('');
});
