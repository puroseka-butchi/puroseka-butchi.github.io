'use strict';

const state = {
  posts: [], templates: {}, currentSlug: null, isNew: false, dirty: false,
  filter: 'all', previewTimer: null, workspace: 'posts', blogLoaded: false, blogDirty: false,
  iconImage: null, iconObjectUrl: null, iconSamplesLoaded: false
};

const elements = Object.fromEntries([
  'post-list', 'post-search', 'new-button', 'empty-new-button', 'empty-state', 'editor',
  'refresh-posts',
  'post-form', 'editor-mode', 'editor-heading', 'save-status', 'build-button',
  'published', 'delete-button', 'title', 'slug', 'slug-help', 'post-type', 'date',
  'home-order', 'translation-status', 'description', 'categories', 'tags', 'characters', 'translator',
  'source-url', 'txt-import-panel', 'txt-file', 'import-txt-button', 'body', 'preview',
  'refresh-preview', 'toast-region', 'build-dialog', 'build-output',
  'find-text', 'replace-text', 'replace-case-sensitive', 'find-next-button', 'replace-all-button', 'replace-status',
  'mode-posts', 'mode-blog', 'mode-guide', 'mode-icons', 'posts-view', 'blog-view', 'guide-view', 'icons-view', 'blog-settings-form', 'blog-save-status',
  'blog-title', 'blog-subtitle', 'blog-description', 'blog-author', 'blog-url',
  'overview-title', 'overview-body', 'updates-title', 'updates-body', 'about-title', 'about-body',
  'characters-body',
  'icon-source-file', 'icon-source-preview', 'icon-canvas', 'icon-file-name', 'icon-size',
  'icon-shape', 'icon-bg-color', 'icon-border-color', 'icon-border-size', 'icon-zoom',
  'icon-offset-x', 'icon-offset-y', 'icon-save-res', 'icon-download', 'icon-save', 'icon-sample-list'
].map(id => [id, document.getElementById(id)]));

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.output || `HTTP ${response.status}`);
  return payload;
}

function toast(message, error = false) {
  const item = document.createElement('div');
  item.className = `toast${error ? ' is-error' : ''}`;
  item.textContent = message;
  elements['toast-region'].append(item);
  setTimeout(() => item.remove(), 4500);
}

function setDirty(value) {
  state.dirty = value;
  elements['save-status'].textContent = value ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ với file';
  elements['save-status'].classList.toggle('is-dirty', value);
}

function setBlogDirty(value) {
  state.blogDirty = value;
  elements['blog-save-status'].textContent = value ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ với file';
  elements['blog-save-status'].classList.toggle('is-dirty', value);
}

async function loadBlogSettings() {
  const result = await api('/api/blog-settings');
  const config = result.config || {};
  const pages = result.pages || {};
  elements['blog-title'].value = config.title || '';
  elements['blog-subtitle'].value = config.subtitle || '';
  elements['blog-description'].value = config.description || '';
  elements['blog-author'].value = config.author || '';
  elements['blog-url'].value = config.url || '';
  for (const id of ['overview', 'updates', 'about']) {
    elements[`${id}-title`].value = pages[id]?.title || '';
    elements[`${id}-body`].value = pages[id]?.body || '';
  }
  elements['characters-body'].value = result.characters?.body || '';
  state.blogLoaded = true;
  setBlogDirty(false);
}

async function switchWorkspace(workspace) {
  if (workspace === state.workspace) return;
  if (state.workspace === 'posts' && state.dirty && !window.confirm('Bài viết có thay đổi chưa lưu. Tạm chuyển khu vực?')) return;
  if (state.workspace === 'blog' && state.blogDirty && !window.confirm('Cấu hình blog có thay đổi chưa lưu. Tạm chuyển khu vực?')) return;

  state.workspace = workspace;
  const isBlog = workspace === 'blog';
  const isGuide = workspace === 'guide';
  const isIcons = workspace === 'icons';
  elements['posts-view'].hidden = isBlog || isGuide || isIcons;
  elements['blog-view'].hidden = !isBlog;
  elements['guide-view'].hidden = !isGuide;
  elements['icons-view'].hidden = !isIcons;
  elements['mode-posts'].classList.toggle('is-active', workspace === 'posts');
  elements['mode-blog'].classList.toggle('is-active', isBlog);
  elements['mode-guide'].classList.toggle('is-active', isGuide);
  elements['mode-icons'].classList.toggle('is-active', isIcons);
  elements['new-button'].hidden = isBlog || isGuide || isIcons;
  elements['save-status'].hidden = isBlog || isGuide || isIcons;
  elements['build-button'].hidden = isGuide || isIcons;

  if (isBlog && (!state.blogLoaded || !state.blogDirty)) {
    elements['blog-save-status'].textContent = 'Đang tải…';
    try {
      await loadBlogSettings();
    } catch (error) {
      elements['blog-save-status'].textContent = 'Không thể tải dữ liệu';
      toast(`Không thể tải cấu hình blog: ${error.message}`, true);
    }
  }
  if (isIcons && !state.iconSamplesLoaded) {
    await loadIconSamples();
    renderIconPreview();
  }
}

function blogSettingsPayload() {
  return {
    config: {
      title: elements['blog-title'].value.trim(),
      subtitle: elements['blog-subtitle'].value.trim(),
      description: elements['blog-description'].value.trim(),
      author: elements['blog-author'].value.trim(),
      url: elements['blog-url'].value.trim()
    },
    pages: Object.fromEntries(['overview', 'updates', 'about'].map(id => [id, {
      title: elements[`${id}-title`].value.trim(),
      body: elements[`${id}-body`].value
    }])),
    characters: {
      body: elements['characters-body'].value
    }
  };
}

async function saveBlogSettings(event) {
  event.preventDefault();
  if (!elements['blog-settings-form'].reportValidity()) return;
  elements['blog-save-status'].textContent = 'Đang lưu và build…';
  try {
    const result = await api('/api/blog-settings', {
      method: 'PUT',
      body: JSON.stringify(blogSettingsPayload())
    });
    setBlogDirty(false);
    toast(`Đã cập nhật blog. Bản sao lưu: ${result.backupPath}`);
  } catch (error) {
    elements['blog-save-status'].textContent = 'Lưu thất bại';
    toast(error.message, true);
  }
}

function csv(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

const translationStatusLabels = {
  draft: 'Bản nháp',
  incomplete: 'Chưa hoàn thành',
  complete: 'Hoàn thành'
};
const legacyTranslationStatuses = { unproofread: 'incomplete', proofread: 'complete' };

function syncTranslationStatusTag() {
  const managedTags = new Set([...Object.values(translationStatusLabels), 'Chưa hiệu đính', 'Đã hiệu đính']);
  const tags = csv(elements.tags.value).filter(tag => !managedTags.has(tag));
  elements.tags.value = tags.join(', ');
}

function toDatetimeLocal(value) {
  if (!value) return '';
  return String(value).replace(' ', 'T').slice(0, 16);
}

function localNow() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, match => match === 'Đ' ? 'D' : 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function renderPostList() {
  const query = elements['post-search'].value.trim().toLowerCase();
  const posts = state.posts.filter(post => {
    if (state.filter === 'visible' && !post.visible) return false;
    if (state.filter === 'hidden' && post.visible) return false;
    return !query || `${post.title} ${post.slug} ${(post.tags || []).join(' ')}`.toLowerCase().includes(query);
  });
  elements['post-list'].replaceChildren();
  if (!posts.length) {
    const empty = document.createElement('div');
    empty.className = 'post-list-empty';
    empty.textContent = 'Không có bài phù hợp.';
    elements['post-list'].append(empty);
    return;
  }
  for (const post of posts) {
    const homeOrder = post.homeOrder !== '' && typeof post.homeOrder !== 'undefined' ? ` · Home #${post.homeOrder}` : '';
    const card = document.createElement('article');
    card.className = `post-card${state.currentSlug === post.slug ? ' is-active' : ''}`;
    card.innerHTML = `<div class="post-card__top"><h3></h3><span class="visibility-badge ${post.visible ? 'is-visible' : 'is-hidden'}">${post.visible ? 'Đang hiện' : 'Đang ẩn'}</span></div><p></p><div class="post-card__actions"><button class="mini-button edit" type="button">Chỉnh sửa</button><button class="mini-button visibility" type="button">${post.visible ? 'Ẩn bài' : 'Hiện bài'}</button></div>`;
    card.querySelector('h3').textContent = post.title;
    card.querySelector('p').textContent = `${state.templates[post.postType]?.name || post.postType} · ${post.date || 'Chưa có ngày'}`;
    card.addEventListener('click', () => editPost(post.slug));
    card.querySelector('.edit').addEventListener('click', event => { event.stopPropagation(); editPost(post.slug); });
    card.querySelector('.visibility').addEventListener('click', async event => {
      event.stopPropagation();
      await toggleVisibility(post);
    });
    elements['post-list'].append(card);
  }
}

function filteredPosts() {
  const query = elements['post-search'].value.trim().toLowerCase();
  return state.posts.filter(post => {
    if (state.filter === 'visible' && !post.visible) return false;
    if (state.filter === 'hidden' && post.visible) return false;
    return !query || `${post.title} ${post.slug} ${(post.tags || []).join(' ')}`.toLowerCase().includes(query);
  });
}

function renderSortablePostList() {
  const posts = filteredPosts();
  elements['post-list'].replaceChildren();
  if (!posts.length) {
    const empty = document.createElement('div');
    empty.className = 'post-list-empty';
    empty.textContent = 'Không có bài phù hợp.';
    elements['post-list'].append(empty);
    return;
  }
  let renderedFreshHeading = false;
  let renderedManualHeading = false;
  for (const post of posts) {
    const hasHomeOrder = post.homeOrder !== '' && typeof post.homeOrder !== 'undefined';
    if (!hasHomeOrder && !renderedFreshHeading) {
      elements['post-list'].append(postGroupHeading('Bài mới theo ngày', 'Tự xếp theo ngày đăng mới nhất.'));
      renderedFreshHeading = true;
    }
    if (hasHomeOrder && !renderedManualHeading) {
      elements['post-list'].append(postGroupHeading('Bài đã sắp xếp thủ công', 'Kéo thả để đổi thứ tự trên trang chủ.'));
      renderedManualHeading = true;
    }
    const card = document.createElement('article');
    card.className = `post-card${state.currentSlug === post.slug ? ' is-active' : ''}`;
    card.draggable = true;
    card.dataset.slug = post.slug;
    card.innerHTML = `<div class="post-card__top"><button class="drag-handle" type="button" title="Kéo để đổi thứ tự trang chủ">☰</button><h3></h3><span class="visibility-badge ${post.visible ? 'is-visible' : 'is-hidden'}">${post.visible ? 'Đang hiện' : 'Đang ẩn'}</span></div><p></p><div class="post-card__actions"><button class="mini-button edit" type="button">Chỉnh sửa</button><button class="mini-button visibility" type="button">${post.visible ? 'Ẩn bài' : 'Hiện bài'}</button></div>`;
    card.querySelector('h3').textContent = post.title;
    const homeOrder = post.homeOrder !== '' && typeof post.homeOrder !== 'undefined' ? ` · Home #${post.homeOrder}` : '';
    card.querySelector('p').textContent = `${state.templates[post.postType]?.name || post.postType} · ${post.date || 'Chưa có ngày'}${homeOrder}`;
    attachPostDragHandlers(card);
    card.addEventListener('click', () => editPost(post.slug));
    card.querySelector('.edit').addEventListener('click', event => { event.stopPropagation(); editPost(post.slug); });
    card.querySelector('.visibility').addEventListener('click', async event => {
      event.stopPropagation();
      await toggleVisibility(post);
    });
    elements['post-list'].append(card);
  }
}

function postGroupHeading(title, description) {
  const heading = document.createElement('div');
  heading.className = 'post-group-heading';
  heading.innerHTML = '<strong></strong><span></span>';
  heading.querySelector('strong').textContent = title;
  heading.querySelector('span').textContent = description;
  return heading;
}

async function loadPosts() {
  const result = await api('/api/posts');
  state.posts = result.posts;
  renderSortablePostList();
}

function populateTemplateOptions() {
  elements['post-type'].replaceChildren();
  for (const [id, template] of Object.entries(state.templates)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = template.name;
    elements['post-type'].append(option);
  }
}

function dragAfterElement(container, y) {
  const cards = [...container.querySelectorAll('.post-card:not(.is-dragging)')];
  return cards.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

async function saveDraggedHomeOrder() {
  const slugs = [...elements['post-list'].querySelectorAll('.post-card')]
    .map(card => card.dataset.slug)
    .filter(Boolean);
  if (!slugs.length) return;
  try {
    await api('/api/posts/home-order', {
      method: 'PATCH',
      body: JSON.stringify({ slugs })
    });
    await loadPosts();
    toast('Đã cập nhật thứ tự trang chủ.');
  } catch (error) {
    toast(`Không thể lưu thứ tự: ${error.message}`, true);
  }
}

function attachPostDragHandlers(card) {
  card.addEventListener('dragstart', event => {
    event.stopPropagation();
    card.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.dataset.slug || '');
  });
  card.addEventListener('dragend', async event => {
    event.stopPropagation();
    card.classList.remove('is-dragging');
    await saveDraggedHomeOrder();
  });
}

function applyTemplate(id, resetBody = true) {
  const template = state.templates[id];
  if (!template) return;
  elements['post-type'].value = id;
  elements.categories.value = (template.categories || []).join(', ');
  elements.tags.value = (template.tags || []).join(', ');
  if (resetBody) elements.body.value = template.default_body || '';
  elements['txt-import-panel'].hidden = !template.supports_txt_import;
  schedulePreview();
}

function showEditor() {
  elements['empty-state'].hidden = true;
  elements.editor.hidden = false;
}

function confirmDiscard() {
  return !state.dirty || window.confirm('Bạn có thay đổi chưa lưu. Tiếp tục và bỏ các thay đổi đó?');
}

function startNew() {
  if (!confirmDiscard()) return;
  state.currentSlug = null;
  state.isNew = true;
  elements['post-form'].reset();
  delete elements.slug.dataset.edited;
  elements.published.checked = true;
  elements.date.value = localNow();
  elements.slug.disabled = false;
  elements['slug-help'].textContent = 'Slug được dùng làm URL và tên file.';
  elements['delete-button'].hidden = true;
  elements['editor-mode'].textContent = 'Tạo bài mới';
  elements['editor-heading'].textContent = 'Bài viết chưa lưu';
  applyTemplate(Object.keys(state.templates)[0], true);
  showEditor();
  setDirty(false);
  renderSortablePostList();
  elements.title.focus();
}

async function editPost(slug) {
  if (state.currentSlug === slug && !state.isNew) return;
  if (!confirmDiscard()) return;
  const post = await api(`/api/posts/${encodeURIComponent(slug)}`);
  const fm = post.frontMatter || {};
  state.currentSlug = slug;
  state.isNew = false;
  elements.title.value = fm.title || '';
  elements.slug.value = slug;
  elements.slug.disabled = true;
  elements['slug-help'].textContent = 'Slug được khóa để tránh làm hỏng liên kết cũ.';
  elements['post-type'].value = fm.post_type || 'side-story';
  elements.date.value = toDatetimeLocal(fm.date);
  elements['home-order'].value = fm.home_order ?? '';
  elements['translation-status'].value = legacyTranslationStatuses[fm.translation_status] || fm.translation_status || 'draft';
  elements.description.value = fm.description || '';
  elements.categories.value = (fm.categories || []).join(', ');
  elements.tags.value = (fm.tags || []).join(', ');
  elements.characters.value = (fm.characters || []).join(', ');
  elements.translator.value = fm.translator || '';
  elements['source-url'].value = fm.source_url || '';
  elements.published.checked = fm.published !== false;
  elements.body.value = post.body || '';
  elements['txt-import-panel'].hidden = !state.templates[elements['post-type'].value]?.supports_txt_import;
  elements['delete-button'].hidden = false;
  elements['editor-mode'].textContent = 'Chỉnh sửa bài';
  elements['editor-heading'].textContent = fm.title || slug;
  showEditor();
  setDirty(false);
  renderSortablePostList();
  await refreshPreview();
}

function formPayload() {
  return {
    slug: elements.slug.value.trim(),
    frontMatter: {
      title: elements.title.value.trim(),
      date: elements.date.value,
      home_order: elements['home-order'].value.trim(),
      categories: csv(elements.categories.value),
      tags: csv(elements.tags.value),
      characters: csv(elements.characters.value),
      description: elements.description.value.trim(),
      post_type: elements['post-type'].value,
      translation_status: elements['translation-status'].value,
      translator: elements.translator.value.trim(),
      source_url: elements['source-url'].value.trim(),
      published: elements.published.checked,
      source_language: 'ja', target_language: 'vi', comments: false
    },
    body: elements.body.value
  };
}

async function savePost(event) {
  event.preventDefault();
  if (!elements['post-form'].reportValidity()) return;
  const payload = formPayload();
  const method = state.isNew ? 'POST' : 'PUT';
  const url = state.isNew ? '/api/posts' : `/api/posts/${encodeURIComponent(state.currentSlug)}`;
  try {
    const result = await api(url, { method, body: JSON.stringify(payload) });
    state.currentSlug = result.slug;
    state.isNew = false;
    elements.slug.disabled = true;
    elements['delete-button'].hidden = false;
    elements['editor-mode'].textContent = 'Chỉnh sửa bài';
    elements['editor-heading'].textContent = payload.frontMatter.title;
    setDirty(false);
    await loadPosts();
    elements['save-status'].textContent = 'Đã lưu, đang build website…';
    try {
      await api('/api/build', { method: 'POST', body: '{}' });
      elements['save-status'].textContent = 'Đã lưu và cập nhật website';
      toast('Đã lưu và build website thành công.');
    } catch (buildError) {
      elements['save-status'].textContent = 'Đã lưu file, build thất bại';
      toast(`Bài đã được lưu nhưng build thất bại: ${buildError.message}`, true);
    }
  } catch (error) {
    toast(error.message, true);
  }
}

async function toggleVisibility(post) {
  try {
    await api(`/api/posts/${post.slug}/visibility`, {
      method: 'PATCH', body: JSON.stringify({ visible: !post.visible })
    });
    await loadPosts();
    if (state.currentSlug === post.slug) elements.published.checked = !post.visible;
    toast(post.visible ? 'Bài đã được ẩn.' : 'Bài đã được hiển thị.');
  } catch (error) { toast(error.message, true); }
}

async function deleteCurrentPost() {
  if (!state.currentSlug) return;
  const title = elements.title.value || state.currentSlug;
  if (!window.confirm(`Xóa bài “${title}”?\n\nBài và asset sẽ được chuyển vào .trash để có thể khôi phục.`)) return;
  try {
    const result = await api(`/api/posts/${state.currentSlug}`, {
      method: 'DELETE', body: JSON.stringify({ confirm: true })
    });
    toast(`Đã chuyển bài vào ${result.trashPath}`);
    state.currentSlug = null;
    state.isNew = false;
    setDirty(false);
    elements.editor.hidden = true;
    elements['empty-state'].hidden = false;
    await loadPosts();
  } catch (error) { toast(error.message, true); }
}

async function refreshPreview() {
  if (elements.editor.hidden) return;
  try {
    const payload = formPayload();
    const result = await api('/api/preview', {
      method: 'POST', body: JSON.stringify({ frontMatter: payload.frontMatter, body: payload.body })
    });
    elements.preview.srcdoc = result.html;
  } catch (error) { toast(`Preview: ${error.message}`, true); }
}

function schedulePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(refreshPreview, 450);
}

function findOptions() {
  return {
    needle: elements['find-text'].value,
    replacement: elements['replace-text'].value,
    caseSensitive: elements['replace-case-sensitive'].checked
  };
}

function findNextInBody() {
  const { needle, caseSensitive } = findOptions();
  if (!needle) {
    elements['replace-status'].textContent = 'Nhập nội dung cần tìm.';
    return;
  }
  const body = elements.body;
  const source = caseSensitive ? body.value : body.value.toLowerCase();
  const target = caseSensitive ? needle : needle.toLowerCase();
  let index = source.indexOf(target, body.selectionEnd || 0);
  if (index < 0) index = source.indexOf(target, 0);
  if (index < 0) {
    elements['replace-status'].textContent = 'Không tìm thấy.';
    return;
  }
  body.focus();
  body.setSelectionRange(index, index + needle.length);
  elements['replace-status'].textContent = `Đã chọn vị trí ${index + 1}.`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAllInBody() {
  const { needle, replacement, caseSensitive } = findOptions();
  if (!needle) {
    elements['replace-status'].textContent = 'Nhập nội dung cần tìm.';
    return;
  }
  const flags = caseSensitive ? 'g' : 'gi';
  const pattern = new RegExp(escapeRegExp(needle), flags);
  const before = elements.body.value;
  let count = 0;
  elements.body.value = before.replace(pattern, () => {
    count += 1;
    return replacement;
  });
  elements['replace-status'].textContent = count ? `Đã thay ${count} vị trí.` : 'Không có vị trí nào cần thay.';
  if (count) {
    setDirty(true);
    schedulePreview();
  }
}

async function importTxt() {
  const file = elements['txt-file'].files[0];
  if (!file) return toast('Hãy chọn một file TXT trước.', true);
  if (!state.templates[elements['post-type'].value]?.supports_txt_import) {
    return toast('Template này không hỗ trợ import TXT.', true);
  }
  try {
    const text = await file.text();
    const result = await api('/api/convert-txt', {
      method: 'POST', body: JSON.stringify({ text })
    });
    const current = elements.body.value.trim();
    let mode = 'append';
    if (current) mode = window.confirm('Nhấn OK để thay toàn bộ nội dung hiện tại.\nNhấn Cancel để chèn vào cuối bài.') ? 'replace' : 'append';
    elements.body.value = mode === 'replace' || !current ? result.body : `${current}\n\n${result.body}`;
    if (!elements.characters.value && result.speakers.length) elements.characters.value = result.speakers.join(', ');
    setDirty(true);
    schedulePreview();
    toast(result.warnings.length ? `Đã import với ${result.warnings.length} cảnh báo nhân vật.` : 'Đã chuyển đổi và chèn TXT.');
  } catch (error) { toast(error.message, true); }
}

function iconOutputSize() {
  return Number(elements['icon-size'].value || 128);
}

function roundedPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function iconClipPath(context, size, inset = 0) {
  const shape = elements['icon-shape'].value;
  const x = inset;
  const y = inset;
  const width = Math.max(0, size - inset * 2);
  const height = Math.max(0, size - inset * 2);
  if (shape === 'circle') {
    context.beginPath();
    context.arc(size / 2, size / 2, Math.max(0, Math.min(width, height) / 2), 0, Math.PI * 2);
    context.closePath();
  } else if (shape === 'rounded') {
    roundedPath(context, x, y, width, height, size * 0.18);
  } else {
    context.beginPath();
    context.rect(x, y, width, height);
  }
}

function drawIconToCanvas(canvas, size = iconOutputSize()) {
  const context = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);
  const borderSize = Number(elements['icon-border-size'].value || 0);
  const shapeInset = elements['icon-shape'].value === 'square' ? 0 : Math.max(1, borderSize / 2);

  context.save();
  iconClipPath(context, size, shapeInset);
  context.clip();
  context.fillStyle = elements['icon-bg-color'].value || '#f6f2ff';
  context.fillRect(0, 0, size, size);

  if (state.iconImage) {
    const zoom = Number(elements['icon-zoom'].value || 1);
    const coverScale = Math.max(size / state.iconImage.naturalWidth, size / state.iconImage.naturalHeight) * zoom;
    const drawWidth = state.iconImage.naturalWidth * coverScale;
    const drawHeight = state.iconImage.naturalHeight * coverScale;
    const maxX = Math.max(0, (drawWidth - size) / 2);
    const maxY = Math.max(0, (drawHeight - size) / 2);
    const offsetX = Number(elements['icon-offset-x'].value || 0) / 100 * maxX;
    const offsetY = Number(elements['icon-offset-y'].value || 0) / 100 * maxY;
    const x = (size - drawWidth) / 2 + offsetX;
    const y = (size - drawHeight) / 2 + offsetY;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(state.iconImage, x, y, drawWidth, drawHeight);
  } else {
    context.fillStyle = '#8e88a8';
    context.font = `${Math.round(size * 0.12)}px "Segoe UI", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Chọn ảnh', size / 2, size / 2);
  }
  context.restore();

  if (borderSize > 0) {
    context.save();
    context.lineWidth = borderSize;
    context.strokeStyle = elements['icon-border-color'].value || '#ffffff';
    iconClipPath(context, size, shapeInset);
    context.stroke();
    context.restore();
  }

  return canvas;
}

function renderIconPreview() {
  drawIconToCanvas(elements['icon-canvas'], 256);
}

function setIconImageFromUrl(url, fileName = '') {
  const image = new Image();
  image.onload = () => {
    state.iconImage = image;
    elements['icon-source-preview'].src = url;
    elements['icon-file-name'].value = fileName.replace(/\.(png|jpe?g|webp)$/i, '') || elements['icon-file-name'].value;
    renderIconPreview();
  };
  image.onerror = () => toast('Không thể đọc ảnh đầu vào.', true);
  image.src = url;
}

function loadIconFile(file) {
  if (!file) return;
  if (state.iconObjectUrl) URL.revokeObjectURL(state.iconObjectUrl);
  state.iconObjectUrl = URL.createObjectURL(file);
  setIconImageFromUrl(state.iconObjectUrl, file.name);
}

async function loadIconSamples() {
  try {
    const result = await api('/api/icon-samples');
    elements['icon-sample-list'].replaceChildren();
    for (const icon of result.icons || []) {
      const button = document.createElement('button');
      button.className = 'icon-sample';
      button.type = 'button';
      button.title = icon.name;
      button.innerHTML = '<img alt=""><span></span>';
      button.querySelector('img').src = icon.url;
      button.querySelector('img').alt = icon.name;
      button.querySelector('span').textContent = icon.name.replace(/\.(png|jpe?g|webp)$/i, '');
      button.addEventListener('click', () => setIconImageFromUrl(icon.url, icon.name));
      elements['icon-sample-list'].append(button);
    }
    if (!result.icons?.length) {
      const empty = document.createElement('p');
      empty.className = 'icon-empty';
      empty.textContent = 'Chưa có icon mẫu trong res/icon.';
      elements['icon-sample-list'].append(empty);
    }
    state.iconSamplesLoaded = true;
  } catch (error) {
    toast(`Không thể tải icon mẫu: ${error.message}`, true);
  }
}

function generatedIconDataUrl() {
  const canvas = document.createElement('canvas');
  drawIconToCanvas(canvas, iconOutputSize());
  return canvas.toDataURL('image/png');
}

function downloadIcon() {
  if (!state.iconImage) return toast('Hãy chọn ảnh trước khi xuất icon.', true);
  const link = document.createElement('a');
  const fileName = (elements['icon-file-name'].value.trim() || 'icon').replace(/\.(png|jpe?g|webp)$/i, '');
  link.download = `${slugify(fileName) || 'icon'}.png`;
  link.href = generatedIconDataUrl();
  link.click();
}

async function saveIcon() {
  if (!state.iconImage) return toast('Hãy chọn ảnh trước khi lưu icon.', true);
  try {
    const result = await api('/api/icons', {
      method: 'POST',
      body: JSON.stringify({
        fileName: elements['icon-file-name'].value.trim(),
        dataUrl: generatedIconDataUrl(),
        saveToRes: elements['icon-save-res'].checked
      })
    });
    toast(`Đã lưu icon: ${result.saved.join(', ')}`);
    if (elements['icon-save-res'].checked) {
      state.iconSamplesLoaded = false;
      await loadIconSamples();
    }
  } catch (error) {
    toast(error.message, true);
  }
}

async function buildWebsite() {
  elements['build-button'].disabled = true;
  elements['build-button'].textContent = 'Đang build…';
  try {
    const result = await api('/api/build', { method: 'POST', body: '{}' });
    elements['build-output'].textContent = result.output || 'Build thành công.';
    elements['build-dialog'].showModal();
    toast('Build website thành công.');
  } catch (error) {
    elements['build-output'].textContent = error.message;
    elements['build-dialog'].showModal();
    toast('Build thất bại. Xem log để biết chi tiết.', true);
  } finally {
    elements['build-button'].disabled = false;
    elements['build-button'].textContent = 'Build website';
  }
}

async function initialize() {
  try {
    const config = await api('/api/config');
    state.templates = config.templates;
    populateTemplateOptions();
    await loadPosts();
    setDirty(false);
  } catch (error) {
    toast(`Không thể khởi tạo Post Studio: ${error.message}`, true);
  }
}

elements['new-button'].addEventListener('click', startNew);
elements['mode-posts'].addEventListener('click', () => switchWorkspace('posts'));
elements['mode-blog'].addEventListener('click', () => switchWorkspace('blog'));
elements['mode-guide'].addEventListener('click', () => switchWorkspace('guide'));
elements['mode-icons'].addEventListener('click', () => switchWorkspace('icons'));
elements['blog-settings-form'].addEventListener('submit', saveBlogSettings);
elements['blog-settings-form'].addEventListener('input', () => setBlogDirty(true));
elements['empty-new-button'].addEventListener('click', startNew);
elements['post-search'].addEventListener('input', renderSortablePostList);
elements['post-list'].addEventListener('dragover', event => {
  event.preventDefault();
  const dragging = elements['post-list'].querySelector('.post-card.is-dragging');
  if (!dragging) return;
  const afterElement = dragAfterElement(elements['post-list'], event.clientY);
  if (afterElement) elements['post-list'].insertBefore(dragging, afterElement);
  else elements['post-list'].append(dragging);
});
elements['refresh-posts'].addEventListener('click', async () => {
  elements['refresh-posts'].disabled = true;
  try {
    await loadPosts();
    toast('Đã nạp lại các file trong source/_posts/.');
  } catch (error) {
    toast(`Không thể nạp danh sách: ${error.message}`, true);
  } finally {
    elements['refresh-posts'].disabled = false;
  }
});
document.querySelectorAll('.filter-tab').forEach(button => button.addEventListener('click', () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll('.filter-tab').forEach(item => item.classList.toggle('is-active', item === button));
  renderSortablePostList();
}));
elements['post-form'].addEventListener('submit', savePost);
elements['delete-button'].addEventListener('click', deleteCurrentPost);
elements['refresh-preview'].addEventListener('click', refreshPreview);
elements['find-next-button'].addEventListener('click', findNextInBody);
elements['replace-all-button'].addEventListener('click', replaceAllInBody);
elements['import-txt-button'].addEventListener('click', importTxt);
elements['build-button'].addEventListener('click', buildWebsite);
elements['txt-file'].addEventListener('change', () => {
  const label = elements['txt-file'].nextElementSibling;
  label.textContent = elements['txt-file'].files[0]?.name || 'Chọn file TXT';
});
elements['icon-source-file'].addEventListener('change', () => {
  loadIconFile(elements['icon-source-file'].files[0]);
});
for (const id of ['icon-size', 'icon-shape', 'icon-bg-color', 'icon-border-color', 'icon-border-size', 'icon-zoom', 'icon-offset-x', 'icon-offset-y']) {
  elements[id].addEventListener('input', renderIconPreview);
}
elements['icon-download'].addEventListener('click', downloadIcon);
elements['icon-save'].addEventListener('click', saveIcon);
elements.title.addEventListener('input', () => {
  if (state.isNew && !elements.slug.dataset.edited) elements.slug.value = slugify(elements.title.value);
});
elements.slug.addEventListener('input', () => { elements.slug.dataset.edited = 'true'; });
elements['post-type'].addEventListener('change', () => {
  if (state.isNew) {
    const reset = !elements.body.value.trim() || window.confirm('Áp dụng template mới và thay nội dung hiện tại?');
    applyTemplate(elements['post-type'].value, reset);
  } else {
    elements['txt-import-panel'].hidden = !state.templates[elements['post-type'].value]?.supports_txt_import;
  }
});
elements['translation-status'].addEventListener('change', () => {
  syncTranslationStatusTag();
});
elements['post-form'].addEventListener('input', event => {
  if (event.target.closest('.find-replace-panel')) return;
  if (event.target !== elements['post-type']) setDirty(true);
  schedulePreview();
});
window.addEventListener('beforeunload', event => {
  if (!state.dirty && !state.blogDirty) return;
  event.preventDefault();
  event.returnValue = '';
});

initialize();
