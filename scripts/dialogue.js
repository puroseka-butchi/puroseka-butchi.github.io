'use strict';

const warnedCharacterIds = new Set();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeHex(value, fallback) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
}

function hexToRgba(hex, alpha) {
  const value = normalizeHex(hex, '#888888').slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function stripQuotes(value) {
  return String(value || '').replace(/^(["'])(.*)\1$/, '$2');
}

hexo.extend.tag.register('dialogue', function dialogueTag(args, content) {
  const requestedId = String(args.shift() || 'unknown').trim().toLowerCase();
  const variant = String(args.shift() || '').trim().toLowerCase();
  const registry = hexo.locals.get('data').characters || {};
  const fallback = registry.unknown || {};
  const found = registry[requestedId];
  const character = found || fallback;

  if (!found && !warnedCharacterIds.has(requestedId)) {
    warnedCharacterIds.add(requestedId);
    hexo.log.warn(`Dialogue: character ID "${requestedId}" is not defined; using "unknown".`);
  }

  const name = character.short_name || character.name || requestedId || '???';
  const avatar = character.avatar || '';
  const avatarHidden = character.avatar_hidden === true || !avatar;
  const color = normalizeHex(character.color, '#888888');
  const textColor = normalizeHex(character.text_color, '#3F3F3F');
  const preparedContent = String(content || '')
    .trim()
    .replace(/([^\n])\n(?=[^\n])/g, '$1  \n');
  const body = hexo.render.renderSync({ text: preparedContent, engine: 'markdown' });
  const classes = [
    'translation-dialogue',
    avatarHidden ? 'translation-dialogue--no-avatar' : '',
    variant ? `translation-dialogue--${variant.replace(/[^a-z0-9_-]/g, '')}` : ''
  ].filter(Boolean).join(' ');
  const style = [
    `--character-color:${color}`,
    `--character-bg:${hexToRgba(color, 0.24)}`,
    `--character-bg-dark:${hexToRgba(color, 0.18)}`,
    `--character-border:${hexToRgba(color, 0.58)}`,
    `--character-text:${textColor}`
  ].join(';');
  const avatarHtml = avatarHidden
    ? ''
    : `<img class="translation-dialogue__avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async">`;

  return `<section class="${classes}" data-character="${escapeHtml(requestedId)}" style="${style}">
  <div class="translation-dialogue__portrait">${avatarHtml}</div>
  <div class="translation-dialogue__content">
    <div class="translation-dialogue__name">${escapeHtml(name)}</div>
    <div class="translation-dialogue__bubble">${body}</div>
  </div>
</section>`;
}, { ends: true });

hexo.extend.tag.register('scene', function sceneTag(args) {
  const src = stripQuotes(args.shift());
  const caption = stripQuotes(args.join(' '));

  if (!src) {
    hexo.log.warn('Scene: image path is missing.');
    return '';
  }

  const captionHtml = caption
    ? `<figcaption>${escapeHtml(caption)}</figcaption>`
    : '';
  return `<figure class="translation-scene">
  <img src="${escapeHtml(src)}" alt="${escapeHtml(caption || 'Ảnh bối cảnh')}" loading="lazy" decoding="async">
  ${captionHtml}
</figure>`;
});

hexo.extend.tag.register('bgm', function bgmTag(args) {
  const src = stripQuotes(args.shift());
  const autoplayIndex = args.findIndex(argument => String(argument).toLowerCase() === 'autoplay');
  const autoplay = autoplayIndex >= 0;
  if (autoplay) args.splice(autoplayIndex, 1);
  const title = stripQuotes(args.join(' ')) || 'Nhạc nền';

  if (!src) {
    hexo.log.warn('BGM: audio path is missing.');
    return '';
  }

  return `<span class="translation-bgm-source" data-src="${escapeHtml(src)}" data-title="${escapeHtml(title)}" data-autoplay="${autoplay}" hidden></span>`;
});

