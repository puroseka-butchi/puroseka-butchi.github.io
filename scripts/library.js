'use strict';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripQuotes(value) {
  return String(value || '').trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2');
}

function parsePipeArguments(args) {
  return args.join(' ').split('|').map(stripQuotes);
}

function headingId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, match => match === 'Đ' ? 'D' : 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderInlineMarkdown(text) {
  return hexo.render.renderSync({
    text: String(text || '').trim(),
    engine: 'markdown'
  }).trim().replace(/^<p>|<\/p>$/g, '');
}

function renderMultilineTitle(value) {
  return escapeHtml(value)
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\\n/g, '<br>');
}

function plainTitle(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

hexo.extend.tag.register('library_project', function libraryProjectTag(args) {
  const title = stripQuotes(args.join(' ')) || 'Tên dự án';
  return `<h1 class="translation-library-project" id="${escapeHtml(headingId(title))}">${escapeHtml(title)}</h1>`;
});

hexo.extend.tag.register('library_series', function librarySeriesTag(args, content) {
  const [sectionTitle = 'Nhóm nội dung', image = '', seriesTitle = '', seriesUrl = ''] = parsePipeArguments(args);
  const imageHtml = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(seriesTitle || sectionTitle)}" loading="lazy" decoding="async">`
    : '';
  const linkedImage = seriesUrl && imageHtml
    ? `<a href="${escapeHtml(seriesUrl)}">${imageHtml}</a>`
    : imageHtml;
  const titleHtml = seriesUrl
    ? `<a href="${escapeHtml(seriesUrl)}">${escapeHtml(seriesTitle)}</a>`
    : escapeHtml(seriesTitle);
  const links = hexo.render.renderSync({
    text: String(content || '').trim(),
    engine: 'markdown'
  });

  return `<section class="translation-library-series">
    <h2 id="${escapeHtml(headingId(sectionTitle))}">${escapeHtml(sectionTitle)}</h2>
    <div class="translation-library-series__body">
      ${imageHtml ? `<figure class="translation-library-cover">${linkedImage}</figure>` : ''}
      <div class="translation-library-series__content">
        ${seriesTitle ? `<h3 class="translation-library-title">${titleHtml}</h3>` : ''}
        <div class="translation-library-links">${links}</div>
      </div>
    </div>
  </section>`;
}, { ends: true });

function renderLibraryFeature(args, content, className, showSectionTitle = true) {
  const [sectionTitle = 'Nhóm nội dung', image = '', title = '', url = ''] = parsePipeArguments(args);
  const imageHtml = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(plainTitle(title) || sectionTitle)}" loading="lazy" decoding="async">`
    : '';
  const titleHtml = url
    ? `<a href="${escapeHtml(url)}">${renderMultilineTitle(title)}</a>`
    : renderMultilineTitle(title);
  const linkItems = String(content || '').split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const splitIndex = Math.ceil(linkItems.length / 2);
  const columns = linkItems.length > 1
    ? [linkItems.slice(0, splitIndex), linkItems.slice(splitIndex)]
    : [linkItems];
  const links = `<div class="translation-library-feature__link-columns">${columns.map(column => (
    `<div class="translation-library-feature__link-column">${column.map(item => `<span>${renderInlineMarkdown(item)}</span>`).join('')}</div>`
  )).join('')}</div>`;

  return `<section class="translation-library-feature ${className}">
    ${showSectionTitle && sectionTitle ? `<h2 id="${escapeHtml(headingId(sectionTitle))}">${escapeHtml(sectionTitle)}</h2>` : ''}
    <div class="translation-library-feature__body">
      ${imageHtml ? `<figure class="translation-library-feature__cover">${url ? `<a href="${escapeHtml(url)}">${imageHtml}</a>` : imageHtml}</figure>` : ''}
      <div class="translation-library-feature__content">
        ${title ? `<h3 class="translation-library-feature__title">${titleHtml}</h3>` : ''}
        <div class="translation-library-feature__links">${links}</div>
      </div>
    </div>
  </section>`;
}

hexo.extend.tag.register('library_event', function libraryEventTag(args, content) {
  return renderLibraryFeature(args, content, 'translation-library-feature--event', false);
}, { ends: true });

hexo.extend.tag.register('library_interview', function libraryInterviewTag(args, content) {
  return renderLibraryFeature(args, content, 'translation-library-feature--interview');
}, { ends: true });

hexo.extend.tag.register('library_grid_start', function libraryGridStartTag(args) {
  const title = stripQuotes(args.join(' '));
  return `<section class="translation-library-grid-section">${title ? `<h3>${escapeHtml(title)}</h3>` : ''}<div class="translation-library-grid">`;
});

hexo.extend.tag.register('library_grid_end', function libraryGridEndTag() {
  return '</div></section>';
});

hexo.extend.tag.register('library_card', function libraryCardTag(args) {
  const [image = '', title = 'Tên bản dịch', url = '', state = ''] = parsePipeArguments(args);
  const isUnavailable = !url || state.toLowerCase() === 'wip';
  const stateClass = isUnavailable ? ' is-wip' : '';
  const imageHtml = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`
    : '';
  const content = `${imageHtml}<figcaption>${escapeHtml(title)}</figcaption>`;
  return `<figure class="translation-library-card${stateClass}">${url ? `<a href="${escapeHtml(url)}">${content}</a>` : content}</figure>`;
});

hexo.extend.tag.register('library_side_card', function librarySideCardTag(args) {
  const parts = parsePipeArguments(args);
  if (parts.length >= 5) {
    const [untrainedImage = '', trainedImage = '', title = 'Tên side story', untrainedUrl = '', trainedUrl = '', state = ''] = parts;
    const cardUnavailable = state.toLowerCase() === 'wip' || (!untrainedUrl && !trainedUrl);
    const panel = (image, label, url) => {
      const imageHtml = image
        ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(`${title} - ${label}`)}" loading="lazy" decoding="async">`
        : '';
      const panelClass = `translation-library-side-card__art${url ? '' : ' is-wip'}`;
      return url
        ? `<a class="${panelClass}" href="${escapeHtml(url)}" aria-label="${escapeHtml(`${title} - ${label}`)}">${imageHtml}<span>${escapeHtml(label)}</span></a>`
        : `<span class="${panelClass}" aria-label="${escapeHtml(`${title} - ${label}`)}">${imageHtml}<span>${escapeHtml(label)}</span></span>`;
    };
    const links = [
      untrainedUrl ? `<a href="${escapeHtml(untrainedUrl)}">Part1</a>` : '<span>Part1</span>',
      trainedUrl ? `<a href="${escapeHtml(trainedUrl)}">Part2</a>` : '<span>Part2</span>'
    ].join('');
    return `<figure class="translation-library-side-card translation-library-side-card--dual${cardUnavailable ? ' is-wip' : ''}">
      <div class="translation-library-side-card__arts">
        ${panel(untrainedImage, 'Untrained', untrainedUrl)}
        ${panel(trainedImage, 'Trained', trainedUrl)}
      </div>
      <figcaption>
        <strong>${escapeHtml(title)}</strong>
        <span class="translation-library-side-card__links">${links}</span>
      </figcaption>
    </figure>`;
  }

  const [image = '', title = 'Tên side story', url = '', state = ''] = parts;
  const isUnavailable = !url || state.toLowerCase() === 'wip';
  const imageHtml = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`
    : '';
  const content = `<div class="translation-library-side-card__single-art">${imageHtml}</div><figcaption><strong>${escapeHtml(title)}</strong></figcaption>`;
  return `<figure class="translation-library-side-card${isUnavailable ? ' is-wip' : ''}">${url ? `<a href="${escapeHtml(url)}">${content}</a>` : content}</figure>`;
});

hexo.extend.tag.register('library_card_deck_start', function libraryCardDeckStartTag(args) {
  const title = stripQuotes(args.join(' '));
  return `<section class="translation-library-card-deck-section">${title ? `<h3>${escapeHtml(title)}</h3>` : ''}<div class="translation-library-card-deck">`;
});

hexo.extend.tag.register('library_card_deck_end', function libraryCardDeckEndTag() {
  return '</div></section>';
});

hexo.extend.tag.register('library_deck_card', function libraryDeckCardTag(args) {
  const [image = '', title = 'Card', url = '', state = ''] = parsePipeArguments(args);
  const isLocked = !url || ['wip', 'locked', 'lock'].includes(state.toLowerCase());
  const imageHtml = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`
    : '<span class="translation-library-deck-card__placeholder"></span>';
  const body = `${imageHtml}<span class="translation-library-deck-card__title">${escapeHtml(title)}</span>`;
  return `<figure class="translation-library-deck-card${isLocked ? ' is-locked' : ''}">${url && !isLocked ? `<a href="${escapeHtml(url)}">${body}</a>` : body}</figure>`;
});

hexo.extend.tag.register('library_side_list_start', function librarySideListStartTag(args) {
  const title = stripQuotes(args.join(' '));
  return `<section class="translation-library-side-list-section">${title ? `<h3>${escapeHtml(title)}</h3>` : ''}<div class="translation-library-side-list">`;
});

hexo.extend.tag.register('library_side_list_end', function librarySideListEndTag() {
  return '</div></section>';
});

hexo.extend.tag.register('library_side_list_item', function librarySideListItemTag(args) {
  const [image = '', title = 'Side Story', part1Url = '', part2Url = '', state = ''] = parsePipeArguments(args);
  const isLocked = ['wip', 'locked', 'lock'].includes(state.toLowerCase()) || (!part1Url && !part2Url);
  const button = (label, url) => url
    ? `<a class="translation-library-side-list__button" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`
    : `<span class="translation-library-side-list__button is-locked">${escapeHtml(label)}</span>`;
  return `<article class="translation-library-side-list__item${isLocked ? ' is-locked' : ''}">
    <figure class="translation-library-side-list__thumb">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">` : ''}
    </figure>
    <div class="translation-library-side-list__content">
      <h4>${escapeHtml(title)}</h4>
      <div class="translation-library-side-list__buttons">
        ${button('Part 1', part1Url)}
        ${button('Part 2', part2Url)}
      </div>
    </div>
  </article>`;
});

hexo.extend.tag.register('library_notice', function libraryNoticeTag(args) {
  const [image = '', title = 'Thông báo', date = '', label = 'Đọc thêm', url = '', variant = 'notice'] = parsePipeArguments(args);
  const imageHtml = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`
    : '';
  const action = url
    ? `<a class="translation-library-notice__button translation-library-notice__button--${escapeHtml(variant)}" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`
    : `<span class="translation-library-notice__button translation-library-notice__button--${escapeHtml(variant)}">${escapeHtml(label)}</span>`;
  return `<article class="translation-library-notice">
    ${imageHtml ? `<figure class="translation-library-notice__image">${imageHtml}</figure>` : ''}
    <div class="translation-library-notice__content">
      <h3>${escapeHtml(title)}</h3>
      ${date ? `<time>${escapeHtml(date)}</time>` : ''}
    </div>
    ${action}
  </article>`;
});

hexo.extend.tag.register('library_episode', function libraryEpisodeTag(args, content) {
  const title = stripQuotes(args.join(' ')) || 'Episode';
  const body = hexo.render.renderSync({ text: String(content || '').trim(), engine: 'markdown' });
  return `<details class="translation-library-episode"><summary>${escapeHtml(title)}</summary>${body}</details>`;
}, { ends: true });
