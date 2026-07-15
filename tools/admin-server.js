'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const Hexo = require('hexo');
const yaml = require('js-yaml');
const { marked } = require('marked');
const {
  buildSpeakerMap,
  ensureMissingCharacters,
  loadCharacterRegistry,
  parseTranslation,
  slugify,
  virtualSingerNote
} = require('./convert-translation');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ADMIN_DIR = path.join(PROJECT_ROOT, 'admin');
const POSTS_DIR = path.join(PROJECT_ROOT, 'source', '_posts');
const TRASH_DIR = path.join(PROJECT_ROOT, '.trash');
const TEMPLATES_FILE = path.join(ADMIN_DIR, 'post-types.yml');
const BLOG_CONFIG_FILE = path.join(PROJECT_ROOT, '_config.yml');
const MASTERLIST_DATA_FILE = path.join(PROJECT_ROOT, 'source', '_data', 'masterlist.yml');
const CHARACTERS_DATA_FILE = path.join(PROJECT_ROOT, 'source', '_data', 'characters.yml');
const ICON_SAMPLE_DIR = path.join(PROJECT_ROOT, 'res', 'icon');
const CHARACTER_ICON_DIR = path.join(PROJECT_ROOT, 'source', 'images', 'characters', 'project-sekai');
const BLOG_PAGE_FILES = {
  overview: path.join(PROJECT_ROOT, 'source', 'overview', 'index.md'),
  updates: path.join(PROJECT_ROOT, 'source', 'updates', 'index.md'),
  about: path.join(PROJECT_ROOT, 'source', 'about', 'index.md')
};
const HOST = '127.0.0.1';
const PORT = Number(process.env.ADMIN_PORT || 4173);
const MAX_BODY_SIZE = 12 * 1024 * 1024;
let buildRunning = false;

const TRANSLATION_STATUS_LABELS = {
  draft: 'Bản nháp',
  incomplete: 'Chưa hoàn thành',
  complete: 'Hoàn thành'
};
const LEGACY_TRANSLATION_STATUSES = { unproofread: 'incomplete', proofread: 'complete' };
const LEGACY_TRANSLATION_STATUS_LABELS = ['Chưa hiệu đính', 'Đã hiệu đính'];

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function sendText(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function safeResolveWithin(base, relativePath) {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, relativePath);
  if (resolved !== resolvedBase && !resolved.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error('Đường dẫn nằm ngoài phạm vi cho phép.');
  }
  return resolved;
}

function validateSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(String(slug || ''))) {
    throw new Error('Slug chỉ được chứa chữ không dấu, số và dấu gạch ngang.');
  }
  return slug;
}

function postPathForSlug(slug) {
  return safeResolveWithin(POSTS_DIR, `${validateSlug(slug)}.md`);
}

function normalizeYamlValue(value) {
  if (value instanceof Date) {
    const pad = number => String(number).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  if (Array.isArray(value)) return value.map(normalizeYamlValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeYamlValue(item)]));
  }
  return value;
}

function parsePostFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontMatter: {}, body: raw };
  return {
    frontMatter: normalizeYamlValue(yaml.load(match[1]) || {}),
    body: raw.slice(match[0].length)
  };
}

function serializePost(frontMatter, body) {
  const data = { ...frontMatter };
  if (data.published === true) delete data.published;
  const frontMatterText = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false
  });
  return `---\n${frontMatterText}---\n\n${String(body || '').trim()}\n`;
}

function listPosts() {
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  return fs.readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => {
      const slug = entry.name.slice(0, -3);
      const { frontMatter } = parsePostFile(path.join(POSTS_DIR, entry.name));
      return {
        slug,
        title: frontMatter.title || slug,
        date: frontMatter.date || '',
        updated: frontMatter.updated || '',
        visible: frontMatter.published !== false,
        postType: frontMatter.post_type || 'side-story',
        categories: frontMatter.categories || [],
        tags: frontMatter.tags || [],
        characters: frontMatter.characters || [],
        translationStatus: frontMatter.translation_status || '',
        homeOrder: frontMatter.home_order ?? ''
      };
    })
    .sort((left, right) => String(right.date).localeCompare(String(left.date)));
}

function backupPost(slug, filePath) {
  if (!fs.existsSync(filePath)) return;
  const backupDir = safeResolveWithin(TRASH_DIR, path.join('backups', slug));
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(filePath, path.join(backupDir, `${stamp}.md`));
}

function saveHomeOrder(payload) {
  const slugs = Array.isArray(payload?.slugs) ? payload.slugs.map(validateSlug) : [];
  if (!slugs.length) throw new Error('Danh sách bài cần sắp xếp đang trống.');
  const posts = listPosts();
  const known = new Map(posts.map(post => [post.slug, post]));
  const firstOrderedIndex = slugs.findIndex(slug => Number.isFinite(Number(known.get(slug)?.homeOrder)));
  const orderedSlugs = firstOrderedIndex >= 0 ? slugs.slice(firstOrderedIndex) : slugs;
  const updated = [];
  for (let index = 0; index < orderedSlugs.length; index += 1) {
    const slug = orderedSlugs[index];
    if (!known.has(slug)) continue;
    const filePath = postPathForSlug(slug);
    const post = parsePostFile(filePath);
    post.frontMatter.home_order = index + 1;
    post.frontMatter.updated = formatLocalDate();
    backupPost(slug, filePath);
    fs.writeFileSync(filePath, serializePost(post.frontMatter, post.body), 'utf8');
    updated.push({ slug, homeOrder: index + 1 });
  }
  return updated;
}

function backupBlogSettings() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = safeResolveWithin(TRASH_DIR, path.join('backups', 'blog-settings', stamp));
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(BLOG_CONFIG_FILE, path.join(backupDir, '_config.yml'));
  for (const [id, filePath] of Object.entries(BLOG_PAGE_FILES)) {
    fs.copyFileSync(filePath, path.join(backupDir, `${id}.md`));
  }
  if (fs.existsSync(MASTERLIST_DATA_FILE)) {
    fs.copyFileSync(MASTERLIST_DATA_FILE, path.join(backupDir, 'masterlist.yml'));
  }
  if (fs.existsSync(CHARACTERS_DATA_FILE)) {
    fs.copyFileSync(CHARACTERS_DATA_FILE, path.join(backupDir, 'characters.yml'));
  }
  return backupDir;
}

function replaceTopLevelYamlValue(source, key, value, block = false) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const index = lines.findIndex(line => new RegExp(`^${key}:`).test(line));
  if (index < 0) throw new Error(`Không tìm thấy cấu hình ${key} trong _config.yml.`);

  let deleteCount = 1;
  while (index + deleteCount < lines.length && /^\s+/.test(lines[index + deleteCount])) {
    deleteCount += 1;
  }

  const replacement = block
    ? [`${key}: |`, ...String(value || '').split('\n').map(line => `  ${line}`)]
    : [`${key}: ${JSON.stringify(String(value || ''))}`];
  lines.splice(index, deleteCount, ...replacement);
  return lines.join('\n');
}

function serializeManagedPage(filePath, title, body) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error(`Trang ${path.relative(PROJECT_ROOT, filePath)} không có front matter hợp lệ.`);
  const frontMatter = match[1].replace(
    /^title:.*$/m,
    `title: ${JSON.stringify(String(title || '').trim())}`
  );
  return `---\n${frontMatter}\n---\n\n${String(body || '').trim()}\n`;
}

function validateLibraryShortcodes(body, pageLabel = 'Trang') {
  const pairs = {
    library_event: 'endlibrary_event',
    library_interview: 'endlibrary_interview',
    library_grid_start: 'library_grid_end'
  };
  const closingToOpening = Object.fromEntries(Object.entries(pairs).map(([open, close]) => [close, open]));
  const stack = [];
  const source = String(body || '');
  const pattern = /\{%\s*([a-zA-Z_][\w-]*)\b[^%]*%\}/g;
  let match;
  while ((match = pattern.exec(source))) {
    const tag = match[1];
    if (!pairs[tag] && !closingToOpening[tag]) continue;
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    if (pairs[tag]) {
      stack.push({ tag, expected: pairs[tag], line });
      continue;
    }
    const last = stack.pop();
    if (!last) {
      throw new Error(`${pageLabel}: tag {% ${tag} %} ở dòng ${line} không có tag mở tương ứng.`);
    }
    if (last.expected !== tag) {
      throw new Error(`${pageLabel}: tag {% ${tag} %} ở dòng ${line} không khớp với {% ${last.tag} %} ở dòng ${last.line}. Cần đóng bằng {% ${last.expected} %}.`);
    }
  }
  const last = stack.pop();
  if (last) {
    throw new Error(`${pageLabel}: tag {% ${last.tag} %} ở dòng ${last.line} chưa được đóng bằng {% ${last.expected} %}.`);
  }
}

function summarizeBuildFailure(output) {
  const text = String(output || '').trim();
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const important = lines.find(line => /Nunjucks Error|YAMLException|TypeError|SyntaxError|FATAL|Error:/i.test(line));
  return important || lines[lines.length - 1] || 'Không rõ lỗi build.';
}

function readBlogSettings() {
  const configSource = fs.readFileSync(BLOG_CONFIG_FILE, 'utf8').replace(/^\uFEFF/, '');
  const config = yaml.load(configSource) || {};
  const pages = {};
  for (const [id, filePath] of Object.entries(BLOG_PAGE_FILES)) {
    const parsed = parsePostFile(filePath);
    pages[id] = {
      title: String(parsed.frontMatter.title || ''),
      body: parsed.body
    };
  }
  return {
    config: {
      title: String(config.title || ''),
      subtitle: String(config.subtitle || ''),
      description: String(config.description || ''),
      author: String(config.author || ''),
      url: String(config.url || '')
    },
    pages,
    masterlist: readMasterlistSettings(),
    characters: {
      body: fs.existsSync(CHARACTERS_DATA_FILE) ? fs.readFileSync(CHARACTERS_DATA_FILE, 'utf8') : ''
    }
  };
}

function readMasterlistOverrides() {
  if (!fs.existsSync(MASTERLIST_DATA_FILE)) return {};
  const data = yaml.load(fs.readFileSync(MASTERLIST_DATA_FILE, 'utf8')) || {};
  return data.posts && typeof data.posts === 'object' ? data.posts : {};
}

function readMasterlistSettings() {
  const overrides = readMasterlistOverrides();
  return listPosts().map(post => {
    const categories = Array.isArray(post.categories) ? post.categories : [];
    const defaultStatus = LEGACY_TRANSLATION_STATUSES[post.translationStatus] || post.translationStatus || 'draft';
    return {
      slug: post.slug,
      published: post.visible,
      defaults: {
        title: post.title,
        group: String(categories[categories.length - 1] || 'Bản dịch khác'),
        characters: Array.isArray(post.characters) ? post.characters.join(', ') : String(post.characters || ''),
        status: defaultStatus,
        order: '',
        hidden: false
      },
      override: overrides[post.slug] || {}
    };
  });
}

function saveMasterlistOverrides(payload) {
  const knownSlugs = new Set(listPosts().map(post => post.slug));
  const clean = {};
  for (const [slug, raw] of Object.entries(payload || {})) {
    if (!knownSlugs.has(slug) || !raw || typeof raw !== 'object') continue;
    const override = {};
    for (const field of ['title', 'group']) {
      const value = String(raw[field] || '').trim();
      if (value) override[field] = value;
    }
    if (Array.isArray(raw.characters)) {
      const characters = raw.characters.map(item => String(item).trim()).filter(Boolean);
      if (characters.length) override.characters = characters;
    }
    const status = LEGACY_TRANSLATION_STATUSES[raw.status] || String(raw.status || '');
    if (TRANSLATION_STATUS_LABELS[status]) override.status = status;
    if (raw.order !== '' && Number.isFinite(Number(raw.order))) override.order = Number(raw.order);
    if (raw.hidden === true) override.hidden = true;
    if (Object.keys(override).length) clean[slug] = override;
  }
  fs.mkdirSync(path.dirname(MASTERLIST_DATA_FILE), { recursive: true });
  fs.writeFileSync(MASTERLIST_DATA_FILE, yaml.dump({ posts: clean }, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: true
  }), 'utf8');
}

function saveBlogSettings(payload) {
  const config = payload?.config || {};
  const pages = payload?.pages || {};
  if (!String(config.title || '').trim()) throw new Error('Tên blog không được để trống.');
  const url = String(config.url || '').trim();
  if (url && !/^https?:\/\//i.test(url)) throw new Error('URL website phải bắt đầu bằng http:// hoặc https://.');
  const charactersBody = String(payload?.characters?.body || '').trim();
  if (payload && Object.hasOwn(payload, 'characters')) {
    const parsed = yaml.load(charactersBody) || {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Danh sách nhân vật phải là YAML dạng object.');
    }
  }

  for (const [id, page] of Object.entries(pages)) {
    if (!page) continue;
    const label = id === 'overview' ? 'Trang Bản dịch' : `Trang ${id}`;
    validateLibraryShortcodes(page.body, label);
  }

  const backupDir = backupBlogSettings();
  let configSource = fs.readFileSync(BLOG_CONFIG_FILE, 'utf8').replace(/^\uFEFF/, '');
  const currentConfig = yaml.load(configSource) || {};
  const configUpdates = {
    title: String(config.title).trim(),
    subtitle: String(config.subtitle || '').trim(),
    description: String(config.description || '').trim(),
    author: String(config.author || '').trim(),
    url
  };
  let configChanged = false;
  for (const [key, value] of Object.entries(configUpdates)) {
    if (String(currentConfig[key] || '').trim() === value) continue;
    configSource = replaceTopLevelYamlValue(configSource, key, value, key === 'description');
    configChanged = true;
  }
  if (configChanged) fs.writeFileSync(BLOG_CONFIG_FILE, configSource, 'utf8');

  for (const [id, filePath] of Object.entries(BLOG_PAGE_FILES)) {
    if (!pages[id]) continue;
    const existing = parsePostFile(filePath);
    const nextTitle = String(pages[id].title || existing.frontMatter.title || '').trim();
    const nextBody = String(pages[id].body || '').trim();
    if (String(existing.frontMatter.title || '') === nextTitle && String(existing.body || '').trim() === nextBody) continue;
    fs.writeFileSync(filePath, serializeManagedPage(filePath, nextTitle, nextBody), 'utf8');
  }
  if (payload && Object.hasOwn(payload, 'masterlist')) saveMasterlistOverrides(payload.masterlist || {});
  if (payload && Object.hasOwn(payload, 'characters')) {
    fs.writeFileSync(CHARACTERS_DATA_FILE, `${charactersBody}\n`, 'utf8');
  }
  return path.relative(PROJECT_ROOT, backupDir).replace(/\\/g, '/');
}

function sanitizeFrontMatter(payload, existing = {}) {
  const frontMatter = { ...existing, ...(payload || {}) };
  const arrayFields = ['categories', 'tags', 'characters'];
  for (const field of arrayFields) {
    if (!Array.isArray(frontMatter[field])) frontMatter[field] = [];
    frontMatter[field] = frontMatter[field].map(item => String(item).trim()).filter(Boolean);
  }
  frontMatter.title = String(frontMatter.title || '').trim();
  if (!frontMatter.title) throw new Error('Tiêu đề không được để trống.');
  frontMatter.description = String(frontMatter.description || '').trim();
  frontMatter.post_type = String(frontMatter.post_type || 'article').trim();
  frontMatter.translation_status = String(frontMatter.translation_status || 'draft').trim();
  frontMatter.translation_status = LEGACY_TRANSLATION_STATUSES[frontMatter.translation_status] || frontMatter.translation_status;
  if (!TRANSLATION_STATUS_LABELS[frontMatter.translation_status]) {
    frontMatter.translation_status = 'draft';
  }
  const managedStatusTags = new Set([...Object.values(TRANSLATION_STATUS_LABELS), ...LEGACY_TRANSLATION_STATUS_LABELS]);
  frontMatter.tags = frontMatter.tags.filter(tag => !managedStatusTags.has(tag));
  frontMatter.translator = String(frontMatter.translator || '').trim();
  if (frontMatter.home_order === '' || frontMatter.home_order === null || typeof frontMatter.home_order === 'undefined') {
    delete frontMatter.home_order;
  } else {
    const homeOrder = Number(frontMatter.home_order);
    if (Number.isFinite(homeOrder)) frontMatter.home_order = homeOrder;
    else delete frontMatter.home_order;
  }
  frontMatter.source_url = String(frontMatter.source_url || '').trim() || null;
  frontMatter.comments = frontMatter.comments === true;
  frontMatter.published = frontMatter.published !== false;
  const normalizeDate = value => String(value || '').trim().replace('T', ' ');
  frontMatter.date = normalizeDate(frontMatter.date) || formatLocalDate();
  frontMatter.updated = normalizeDate(frontMatter.updated) || formatLocalDate();
  return frontMatter;
}

function syncStatusInBody(body, status) {
  const label = TRANSLATION_STATUS_LABELS[status] || TRANSLATION_STATUS_LABELS.draft;
  return String(body || '').replace(
    /<strong>(?:Hiệu đính|Trạng thái):<\/strong>\s*(?:Bản nháp|Chưa hiệu đính|Đã hiệu đính|Chưa hoàn thành|Hoàn thành)/gi,
    `<strong>Trạng thái:</strong> ${label}`
  );
}

function formatLocalDate() {
  const date = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function loadTemplates() {
  return yaml.load(fs.readFileSync(TEMPLATES_FILE, 'utf8')) || {};
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function assetUrlForPreview(value) {
  const source = String(value || '');
  return source.startsWith('/') ? `/site-assets${source}` : source;
}

function renderCustomTags(markdownText) {
  const registry = loadCharacterRegistry(PROJECT_ROOT);
  let output = String(markdownText || '');
  output = output.replace(/\{%\s*interview_lead\s*%\}([\s\S]*?)\{%\s*endinterview_lead\s*%\}/gi, (_, content) => (
    `<div class="preview-interview-lead">${marked.parse(String(content).trim())}</div>`
  ));
  output = output.replace(/\{%\s*interview_question\s*%\}([\s\S]*?)\{%\s*endinterview_question\s*%\}/gi, (_, content) => {
    const question = String(content).trim().replace(/^(?:[—–-]+\s*)+/, '');
    return `<section class="preview-interview-question"><small>CÂU HỎI</small>${marked.parse(question)}</section>`;
  });
  output = output.replace(/\{%\s*interview_answer(?:\s+"([^"]+)")?\s*%\}([\s\S]*?)\{%\s*endinterview_answer\s*%\}/gi, (_, speaker, content) => (
    `<section class="preview-interview-answer"><strong>${escapeHtml(speaker || 'Trả lời')}</strong>${marked.parse(String(content).trim())}</section>`
  ));
  output = output.replace(/\{%\s*dialogue\s+([a-z0-9-]+)(?:\s+([a-z0-9_-]+))?\s*%\}([\s\S]*?)\{%\s*enddialogue\s*%\}/gi, (_, id, variant, content) => {
    const character = registry[id] || registry.unknown || {};
    const name = character.short_name || character.name || id;
    const avatar = character.avatar && !character.avatar_hidden
      ? `<img src="${escapeHtml(assetUrlForPreview(character.avatar))}" alt="${escapeHtml(name)}">`
      : '';
    const color = /^#[0-9a-f]{6}$/i.test(character.color || '') ? character.color : '#888888';
    const dialogueBody = marked.parse(String(content).trim().replace(/([^\n])\n(?=[^\n])/g, '$1  \n'));
    return `<section class="preview-dialogue ${variant === 'thought' ? 'is-thought' : ''}" style="--character:${color}">
      <div class="preview-dialogue__avatar">${avatar}</div>
      <div><strong>${escapeHtml(name)}</strong><div class="preview-dialogue__bubble">${dialogueBody}</div></div>
    </section>`;
  });
  output = output.replace(/\{%\s*scene\s+"([^"]+)"(?:\s+"([^"]*)")?\s*%\}/gi, (_, src, caption) => (
    `<figure><img class="preview-scene" src="${escapeHtml(assetUrlForPreview(src))}" alt="${escapeHtml(caption || 'Ảnh bối cảnh')}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`
  ));
  output = output.replace(/\{%\s*bgm\s+"([^"]+)"(?:\s+"([^"]*)")?(?:\s+autoplay)?\s*%\}/gi, (_, src, title) => (
    `<div class="preview-bgm">♫ ${escapeHtml(title || src)} <small>(nhạc nền)</small></div>`
  ));
  return output;
}

function previewDocument(frontMatter, body) {
  const rendered = marked.parse(renderCustomTags(body), { gfm: true, breaks: false });
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root{color-scheme:light dark;font-family:Inter,Segoe UI,sans-serif}body{margin:0;padding:28px;line-height:1.7;color:#333;background:#fff}h1{font-size:2rem;line-height:1.25}h2{margin-top:1.8em;border-bottom:1px solid #ddd}a{color:#6758d8}img{max-width:100%}.meta{color:#777;margin-bottom:30px}.translation-meta{background:#f1efff;border-left:4px solid #7c6fe8;border-radius:0 8px 8px 0;padding:16px 19px}.preview-dialogue{display:grid;grid-template-columns:72px 1fr;gap:12px;margin:20px 0}.preview-dialogue__avatar{padding-top:24px}.preview-dialogue__avatar img{width:66px;height:66px;border-radius:50%;border:3px solid var(--character);object-fit:cover}.preview-dialogue strong{color:var(--character);font-size:.85rem;text-transform:uppercase}.preview-dialogue__bubble{background:color-mix(in srgb,var(--character) 24%,white);border:1px solid color-mix(in srgb,var(--character) 58%,transparent);border-radius:10px;padding:12px 16px;margin-top:4px}.preview-dialogue__bubble p{margin:0}.preview-dialogue.is-thought .preview-dialogue__bubble{font-style:italic;border-style:dashed}.preview-scene{display:block;width:100%;border-radius:6px}figcaption{text-align:center;color:#777}.preview-bgm{background:#f1efff;border-radius:9px;padding:10px 14px;color:#554aa8}.translation-note{background:#fff9e8;border:1px solid #f4df9b;border-radius:8px;padding:14px 17px}.preview-interview-lead{border-bottom:1px solid #ddd;font-size:1.08rem;padding-bottom:18px}.preview-interview-question{background:#eeeafd;border-left:4px solid #7567df;border-radius:0 9px 9px 0;margin-top:24px;padding:12px 16px}.preview-interview-question small,.preview-interview-answer strong{color:#6758d8;font-size:.7rem}.preview-interview-question p,.preview-interview-answer p{margin:4px 0}.preview-interview-answer{border-left:2px solid #d8d3ee;margin:8px 0 20px 8px;padding:5px 16px}@media(prefers-color-scheme:dark){body{background:#202124;color:#e5e5e5}.translation-meta,.preview-bgm,.preview-interview-question{background:#29263d}.preview-dialogue__bubble{background:color-mix(in srgb,var(--character) 18%,#222)}h2{border-color:#444}}
  </style><style>
    body.is-interview{box-sizing:border-box;margin:0 auto;max-width:760px;line-height:1.85}.is-interview h2{border-bottom:2px solid #888;font-size:1.55rem;font-weight:400;margin-top:2.8em;padding-bottom:.3em}.is-interview .translation-meta{background:transparent;border:0;color:#777;font-size:.8rem;padding:0;text-align:right}.is-interview .preview-scene{border-radius:0}.is-interview figcaption{font-size:.75rem;margin:.55em 0 0;position:static;text-align:left}.is-interview .preview-interview-lead{border:0;font-size:1rem;line-height:1.95;margin:2em 0 2.6em;padding:0}.is-interview .preview-interview-question{background:transparent;border:0;border-radius:0;font-weight:700;margin:2.25em 0 0 2.5em;padding:0;position:static}.is-interview .preview-interview-question::before{content:none}.is-interview .preview-interview-question small,.is-interview .preview-interview-answer strong{clip:rect(0,0,0,0);height:1px;margin:-1px;overflow:hidden;position:absolute;width:1px}.is-interview .preview-interview-question p,.is-interview .preview-interview-answer p{margin:0}.is-interview .preview-interview-answer{border:0;line-height:1.95;margin:.7em 0 1.8em;padding:0}
  </style></head><body class="${frontMatter.post_type === 'interview' ? 'is-interview' : ''}"><h1>${escapeHtml(frontMatter.title || 'Bản xem trước')}</h1><div class="meta">${escapeHtml((frontMatter.categories || []).join(' › '))}</div>${rendered}</body></html>`;
}

function renderImportedHeading(node) {
  const content = String(node.content || '').trim();
  if (/^(?:part\s*\d+|ghi chú|ghi chu)$/iu.test(content)) {
    return `## ${content}`;
  }
  return `<p class="translation-scene-title">${escapeHtml(content)}</p>`;
}

function renderParsedTxt(parsed) {
  const sections = parsed.nodes.map(node => {
    if (node.type === 'heading') return renderImportedHeading(node);
    if (node.type === 'paragraph') return node.content;
    if (node.type === 'dialogue') {
      const todo = node.known ? '' : `<!-- TODO: khai báo nhân vật "${node.originalSpeaker}" với ID "${node.id}" -->\n`;
      return `${todo}${virtualSingerNote(node.id)}{% dialogue ${node.id}${node.variant ? ` ${node.variant}` : ''} %}\n${node.content}\n{% enddialogue %}`;
    }
    if (node.type === 'media') {
      return `<!-- TODO import ${node.mediaType}: ${node.file}${node.label ? ` | ${node.label}` : ''} -->`;
    }
    return '';
  });
  return sections.filter(Boolean).join('\n\n');
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error('Dữ liệu gửi lên vượt quá 5 MB.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('JSON không hợp lệ.'));
      }
    });
    request.on('error', reject);
  });
}

function listIconSamples() {
  if (!fs.existsSync(ICON_SAMPLE_DIR)) return [];
  return fs.readdirSync(ICON_SAMPLE_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name))
    .map(entry => ({
      name: entry.name,
      url: `/icon-samples/${encodeURIComponent(entry.name)}`
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

function sanitizeIconFileName(value) {
  const fileName = String(value || '').trim().replace(/\.(png|jpe?g|webp)$/i, '');
  const slug = slugify(fileName);
  if (!slug) throw new Error('Hay nhap ten file icon hop le.');
  return `${slug}.png`;
}

function saveGeneratedIcon(payload) {
  const fileName = sanitizeIconFileName(payload.fileName);
  const dataUrl = String(payload.dataUrl || '');
  const match = dataUrl.match(/^data:image\/png;base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error('Icon dau ra phai la PNG base64 hop le.');

  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
    throw new Error('File icon khong hop le hoac qua lon.');
  }

  fs.mkdirSync(CHARACTER_ICON_DIR, { recursive: true });
  const saved = [];
  const characterPath = safeResolveWithin(CHARACTER_ICON_DIR, fileName);
  fs.writeFileSync(characterPath, buffer);
  saved.push(path.relative(PROJECT_ROOT, characterPath).replace(/\\/g, '/'));

  if (payload.saveToRes === true) {
    fs.mkdirSync(ICON_SAMPLE_DIR, { recursive: true });
    const samplePath = safeResolveWithin(ICON_SAMPLE_DIR, fileName);
    fs.writeFileSync(samplePath, buffer);
    saved.push(path.relative(PROJECT_ROOT, samplePath).replace(/\\/g, '/'));
  }

  return { fileName, saved };
}

function assertLocalMutation(request) {
  const origin = request.headers.origin;
  if (origin && ![`http://${HOST}:${PORT}`, `http://localhost:${PORT}`].includes(origin)) {
    throw new Error('Nguồn yêu cầu không được phép.');
  }
  if (!String(request.headers['content-type'] || '').startsWith('application/json')) {
    throw new Error('API chỉnh sửa chỉ nhận application/json.');
  }
}

function moveToTrash(slug, postFile) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetRoot = safeResolveWithin(TRASH_DIR, path.join('deleted', `${stamp}-${slug}`));
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.renameSync(postFile, path.join(targetRoot, `${slug}.md`));
  const assetLocations = [
    ['post-assets', path.join(POSTS_DIR, slug)],
    ['images', path.join(PROJECT_ROOT, 'source', 'images', 'translations', slug)],
    ['audio', path.join(PROJECT_ROOT, 'source', 'audio', 'translations', slug)]
  ];
  for (const [name, source] of assetLocations) {
    const resolved = path.resolve(source);
    if (!resolved.startsWith(`${PROJECT_ROOT}${path.sep}`)) continue;
    if (fs.existsSync(resolved)) fs.renameSync(resolved, path.join(targetRoot, name));
  }
  return targetRoot;
}

async function runBuild() {
  if (buildRunning) throw new Error('Một bản build khác đang chạy.');
  buildRunning = true;
  const hexo = new Hexo(PROJECT_ROOT, { silent: true });
  try {
    await hexo.init();
    await hexo.call('clean', {});
    await hexo.call('generate', {});
    const routeCount = hexo.route.list().length;
    return { ok: true, code: 0, output: `Build thành công. Đã tạo ${routeCount} route trong public/.` };
  } catch (error) {
    return { ok: false, code: 1, output: error.stack || error.message };
  } finally {
    try { await hexo.exit(); } catch { /* Không che lỗi build chính. */ }
    buildRunning = false;
  }
}

function runCommand(command, args, options = {}) {
  return new Promise(resolve => {
    execFile(command, args, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
      ...options
    }, (error, stdout = '', stderr = '') => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        stdout,
        stderr,
        output: `${stdout}${stderr}`.trim()
      });
    });
  });
}

async function gitCommand(args, label) {
  const result = await runCommand('git', args);
  if (!result.ok) {
    throw new Error(`${label || `git ${args.join(' ')}`} thất bại:\n${result.output || `Exit code ${result.code}`}`);
  }
  return result;
}

function cleanCommitMessage(value) {
  return String(value || 'Update blog content')
    .replace(/\r?\n/g, ' ')
    .trim()
    .slice(0, 120) || 'Update blog content';
}

async function getPublishStatus() {
  const [status, branch, remote] = await Promise.all([
    runCommand('git', ['status', '--short']),
    runCommand('git', ['branch', '--show-current']),
    runCommand('git', ['remote', '-v'])
  ]);
  return {
    status: status.output,
    branch: branch.stdout.trim(),
    remote: remote.output,
    hasChanges: Boolean(status.output.trim())
  };
}

async function publishToGitHub(payload = {}) {
  const message = cleanCommitMessage(payload.message);
  const build = await runBuild();
  if (!build.ok) {
    return { ok: false, stage: 'build', output: build.output };
  }

  const before = await getPublishStatus();
  let commitOutput = 'Không có thay đổi mới để commit.';
  if (before.hasChanges) {
    await gitCommand(['add', '-A', '.'], 'Stage thay đổi');
    const diff = await runCommand('git', ['diff', '--cached', '--quiet']);
    if (diff.code !== 0) {
      const commit = await gitCommand(['commit', '-m', message], 'Commit thay đổi');
      commitOutput = commit.output;
    }
  }

  const push = await gitCommand(['push'], 'Push lên GitHub');
  const after = await getPublishStatus();
  return {
    ok: true,
    build: build.output,
    before,
    commit: commitOutput,
    push: push.output || 'Push hoàn tất.',
    after
  };
}

function contentTypeFor(filePath) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.svg': 'image/svg+xml'
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/config') {
    return sendJson(response, 200, { templates: loadTemplates(), characters: loadCharacterRegistry(PROJECT_ROOT) });
  }
  if (request.method === 'GET' && pathname === '/api/posts') {
    return sendJson(response, 200, { posts: listPosts() });
  }
  if (request.method === 'PATCH' && pathname === '/api/posts/home-order') {
    assertLocalMutation(request);
    const payload = await readJsonBody(request);
    return sendJson(response, 200, { ok: true, updated: saveHomeOrder(payload) });
  }
  if (request.method === 'GET' && pathname === '/api/blog-settings') {
    return sendJson(response, 200, readBlogSettings());
  }
  if (request.method === 'GET' && pathname === '/api/icon-samples') {
    return sendJson(response, 200, { icons: listIconSamples() });
  }
  if (request.method === 'GET' && pathname === '/api/publish/status') {
    return sendJson(response, 200, await getPublishStatus());
  }
  if (request.method === 'POST' && pathname === '/api/publish') {
    assertLocalMutation(request);
    const payload = await readJsonBody(request);
    try {
      const result = await publishToGitHub(payload);
      return sendJson(response, result.ok ? 200 : 500, result);
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }
  if (request.method === 'POST' && pathname === '/api/icons') {
    assertLocalMutation(request);
    const payload = await readJsonBody(request);
    return sendJson(response, 200, { ok: true, ...saveGeneratedIcon(payload) });
  }
  if (request.method === 'PUT' && pathname === '/api/blog-settings') {
    assertLocalMutation(request);
    const payload = await readJsonBody(request);
    const backupPath = saveBlogSettings(payload);
    const result = await runBuild();
    if (!result.ok) {
      return sendJson(response, 500, {
        error: `Đã lưu cấu hình nhưng build thất bại. Bản sao lưu: ${backupPath}`,
        output: result.output
      });
    }
    return sendJson(response, 200, { ok: true, backupPath, output: result.output });
  }
  const postMatch = pathname.match(/^\/api\/posts\/([a-z0-9-]+)$/i);
  if (request.method === 'GET' && postMatch) {
    const slug = validateSlug(postMatch[1]);
    const filePath = postPathForSlug(slug);
    if (!fs.existsSync(filePath)) return sendJson(response, 404, { error: 'Không tìm thấy bài.' });
    return sendJson(response, 200, { slug, ...parsePostFile(filePath) });
  }
  if (request.method === 'POST' && pathname === '/api/posts') {
    assertLocalMutation(request);
    const payload = await readJsonBody(request);
    const slug = validateSlug(payload.slug || slugify(payload.frontMatter?.title));
    const filePath = postPathForSlug(slug);
    if (fs.existsSync(filePath)) return sendJson(response, 409, { error: 'Slug đã tồn tại.' });
    const frontMatter = sanitizeFrontMatter(payload.frontMatter);
    fs.mkdirSync(POSTS_DIR, { recursive: true });
    const body = syncStatusInBody(payload.body, frontMatter.translation_status);
    fs.writeFileSync(filePath, serializePost(frontMatter, body), 'utf8');
    return sendJson(response, 201, { ok: true, slug });
  }
  if (request.method === 'PUT' && postMatch) {
    assertLocalMutation(request);
    const slug = validateSlug(postMatch[1]);
    const filePath = postPathForSlug(slug);
    if (!fs.existsSync(filePath)) return sendJson(response, 404, { error: 'Không tìm thấy bài.' });
    const payload = await readJsonBody(request);
    const existing = parsePostFile(filePath);
    const frontMatter = sanitizeFrontMatter(payload.frontMatter, existing.frontMatter);
    frontMatter.updated = formatLocalDate();
    backupPost(slug, filePath);
    const body = syncStatusInBody(payload.body, frontMatter.translation_status);
    fs.writeFileSync(filePath, serializePost(frontMatter, body), 'utf8');
    return sendJson(response, 200, { ok: true, slug });
  }
  const visibilityMatch = pathname.match(/^\/api\/posts\/([a-z0-9-]+)\/visibility$/i);
  if (request.method === 'PATCH' && visibilityMatch) {
    assertLocalMutation(request);
    const slug = validateSlug(visibilityMatch[1]);
    const filePath = postPathForSlug(slug);
    if (!fs.existsSync(filePath)) return sendJson(response, 404, { error: 'Không tìm thấy bài.' });
    const payload = await readJsonBody(request);
    const post = parsePostFile(filePath);
    backupPost(slug, filePath);
    post.frontMatter.published = payload.visible !== false;
    post.frontMatter.updated = formatLocalDate();
    fs.writeFileSync(filePath, serializePost(post.frontMatter, post.body), 'utf8');
    return sendJson(response, 200, { ok: true, visible: post.frontMatter.published !== false });
  }
  if (request.method === 'DELETE' && postMatch) {
    assertLocalMutation(request);
    const slug = validateSlug(postMatch[1]);
    const filePath = postPathForSlug(slug);
    if (!fs.existsSync(filePath)) return sendJson(response, 404, { error: 'Không tìm thấy bài.' });
    const trashPath = moveToTrash(slug, filePath);
    return sendJson(response, 200, { ok: true, trashPath: path.relative(PROJECT_ROOT, trashPath).replace(/\\/g, '/') });
  }
  if (request.method === 'POST' && pathname === '/api/preview') {
    assertLocalMutation(request);
    const payload = await readJsonBody(request);
    return sendJson(response, 200, { html: previewDocument(payload.frontMatter || {}, payload.body || '') });
  }
  if (request.method === 'POST' && pathname === '/api/convert-txt') {
    assertLocalMutation(request);
    const payload = await readJsonBody(request);
    const registry = loadCharacterRegistry(PROJECT_ROOT);
    const parsed = parseTranslation(String(payload.text || ''), buildSpeakerMap(registry));
    ensureMissingCharacters(PROJECT_ROOT, parsed, registry, { logger: console });
    return sendJson(response, 200, {
      body: renderParsedTxt(parsed),
      warnings: [...new Set(parsed.warnings)],
      speakers: [...parsed.speakers.values()]
    });
  }
  if (request.method === 'POST' && pathname === '/api/build') {
    assertLocalMutation(request);
    await readJsonBody(request);
    const result = await runBuild();
    return sendJson(response, result.ok ? 200 : 500, result);
  }
  return sendJson(response, 404, { error: 'API không tồn tại.' });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) return await handleApi(request, response, pathname);
    if (pathname.startsWith('/site-assets/')) {
      const filePath = safeResolveWithin(path.join(PROJECT_ROOT, 'source'), pathname.slice('/site-assets/'.length));
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return sendText(response, 404, 'Not found');
      response.writeHead(200, { 'Content-Type': contentTypeFor(filePath), 'Cache-Control': 'no-store' });
      return fs.createReadStream(filePath).pipe(response);
    }
    if (pathname.startsWith('/icon-samples/')) {
      const filePath = safeResolveWithin(ICON_SAMPLE_DIR, pathname.slice('/icon-samples/'.length));
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return sendText(response, 404, 'Not found');
      response.writeHead(200, { 'Content-Type': contentTypeFor(filePath), 'Cache-Control': 'no-store' });
      return fs.createReadStream(filePath).pipe(response);
    }
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const filePath = safeResolveWithin(ADMIN_DIR, relative);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return sendText(response, 404, 'Not found');
    response.writeHead(200, { 'Content-Type': contentTypeFor(filePath), 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    sendJson(response, error.message.includes('không được phép') ? 403 : 500, { error: error.message });
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Cổng ${PORT} đang được sử dụng. Hãy dừng Post Studio cũ hoặc đặt ADMIN_PORT khác.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Post Studio đang chạy tại http://${HOST}:${PORT}`);
  console.log('Nhấn Ctrl+C để dừng.');
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
