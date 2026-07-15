'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const AUDIO_EXTENSIONS = new Set(['.aac', '.flac', '.m4a', '.mp3', '.oga', '.ogg', '.wav', '.webm']);
const VIRTUAL_SINGER_IDS = new Set(['miku', 'rin', 'len', 'luka', 'meiko', 'kaito']);
const VIRTUAL_SINGER_SEKAI_SUFFIXES = ['ln', 'mmj', 'vbs', 'wxs', 'niigo'];

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, match => (match === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ban-dich-moi';
}

function normalizeSpeaker(value) {
  return slugify(value).replace(/-/g, '');
}

function escapeTagText(value) {
  return String(value || '').replace(/"/g, '\\"').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLocalDate(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseCli(argv) {
  const options = {
    categories: ['Project Sekai', 'Bản dịch nháp'],
    translator: 'Tên của bạn',
    force: false,
    dryRun: false
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    const key = rawKey.toLowerCase();
    if (key === 'force') {
      options.force = true;
      continue;
    }
    if (key === 'dry-run') {
      options.dryRun = true;
      continue;
    }
    if (key === 'help') {
      options.help = true;
      continue;
    }
    const value = inlineValue !== undefined ? inlineValue : argv[++index];
    if (value === undefined) {
      throw new Error(`Thiếu giá trị cho --${rawKey}.`);
    }
    if (key === 'categories') {
      options.categories = value.split(',').map(item => item.trim()).filter(Boolean);
    } else if (key === 'tags') {
      options.tags = value.split(',').map(item => item.trim()).filter(Boolean);
    } else {
      options[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
  }

  options.input = positional[0];
  return options;
}

function loadCharacterRegistry(projectRoot) {
  const registryPath = path.join(projectRoot, 'source', '_data', 'characters.yml');
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Không tìm thấy registry nhân vật: ${registryPath}`);
  }
  return yaml.load(fs.readFileSync(registryPath, 'utf8')) || {};
}

function buildSpeakerMap(registry) {
  const speakerMap = new Map();
  for (const [id, character] of Object.entries(registry)) {
    const labels = [id, character.name, character.short_name, ...(character.aliases || [])];
    for (const label of labels.filter(Boolean)) {
      speakerMap.set(normalizeSpeaker(label), id);
    }
  }
  return speakerMap;
}

function canonicalDialogueId(id) {
  const value = String(id || '').trim().toLowerCase();
  const [base, suffix] = value.split('-');
  if (VIRTUAL_SINGER_IDS.has(base) && (!suffix || VIRTUAL_SINGER_SEKAI_SUFFIXES.includes(suffix))) return base;
  return value;
}

function parseMediaDirective(line) {
  const match = String(line).trim().match(/^\[(IMAGE|SCENE|ẢNH|AUDIO|MUSIC|NHẠC)\s*:\s*(.+)\]$/iu);
  if (!match) return null;
  const [file, ...captionParts] = match[2].split('|');
  const keyword = match[1].toUpperCase();
  return {
    type: ['AUDIO', 'MUSIC', 'NHẠC'].includes(keyword) ? 'audio' : 'image',
    file: file.trim(),
    label: captionParts.join('|').trim()
  };
}

function parseTranslation(text, speakerMap) {
  const nodes = [];
  const speakers = new Map();
  const warnings = [];
  let currentDialogue = null;
  let paragraph = [];

  const flushDialogue = () => {
    if (!currentDialogue) return;
    const content = currentDialogue.lines.join('\n').trim();
    if (content) {
      const normalized = normalizeSpeaker(currentDialogue.speaker);
      const knownId = speakerMap.get(normalized);
      const id = canonicalDialogueId(knownId || slugify(currentDialogue.speaker));
      const isThought = /^\([\s\S]*\)$/.test(content);
      speakers.set(id, currentDialogue.speaker);
      if (!knownId) {
        warnings.push(`Nhân vật chưa có trong characters.yml: ${currentDialogue.speaker} (ID tạm: ${id})`);
      }
      nodes.push({
        type: 'dialogue',
        id,
        originalSpeaker: currentDialogue.speaker,
        content,
        variant: isThought ? 'thought' : '',
        known: Boolean(knownId)
      });
    }
    currentDialogue = null;
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push({ type: 'paragraph', content: paragraph.join('\n').trim() });
    paragraph = [];
  };

  for (const rawLine of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    const media = parseMediaDirective(trimmed);
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    const speaker = trimmed.match(/^([^:\/]{1,60}):\s*(.*)$/u);

    if (media || heading || speaker) {
      flushDialogue();
      flushParagraph();
    }

    if (media) {
      nodes.push({ type: 'media', mediaType: media.type, file: media.file, label: media.label });
    } else if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      nodes.push({ type: 'heading', level, content: heading[2].trim() });
    } else if (speaker) {
      currentDialogue = { speaker: speaker[1].trim(), lines: [speaker[2].trim()] };
    } else if (!trimmed) {
      flushDialogue();
      flushParagraph();
    } else if (currentDialogue) {
      currentDialogue.lines.push(trimmed);
    } else {
      paragraph.push(trimmed);
    }
  }

  flushDialogue();
  flushParagraph();
  return { nodes, speakers, warnings };
}

function assertMediaExtension(filePath, type) {
  const extension = path.extname(filePath).toLowerCase();
  const allowed = type === 'audio' ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS;
  if (!allowed.has(extension)) {
    throw new Error(`Định dạng ${type === 'audio' ? 'âm thanh' : 'hình ảnh'} không được hỗ trợ: ${extension || '(không có đuôi file)'}`);
  }
}

function copyMediaFile({ sourceFile, type, slug, projectRoot, dryRun = false }) {
  const absoluteSource = path.resolve(sourceFile);
  if (!fs.existsSync(absoluteSource) || !fs.statSync(absoluteSource).isFile()) {
    throw new Error(`Không tìm thấy file media: ${absoluteSource}`);
  }
  assertMediaExtension(absoluteSource, type);
  const safeName = `${slugify(path.basename(absoluteSource, path.extname(absoluteSource)))}${path.extname(absoluteSource).toLowerCase()}`;
  const publicFolder = type === 'audio' ? 'audio' : 'images';
  const destinationDir = path.join(projectRoot, 'source', publicFolder, 'translations', slug);
  const destination = path.join(destinationDir, safeName);
  if (!dryRun) {
    fs.mkdirSync(destinationDir, { recursive: true });
    fs.copyFileSync(absoluteSource, destination);
  }
  return {
    destination,
    publicPath: `/${publicFolder}/translations/${slug}/${safeName}`.replace(/\\/g, '/')
  };
}

function resolveMediaSource(inputPath, node) {
  const inputDir = path.dirname(inputPath);
  const requested = String(node.file || '').trim();
  const candidates = path.isAbsolute(requested)
    ? [requested]
    : [
        ...(node.mediaType === 'image' && path.dirname(requested) === '.'
          ? [path.resolve(inputDir, 'bg', requested)]
          : []),
        path.resolve(inputDir, requested)
      ];
  const found = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (found) return found;
  throw new Error(`Không tìm thấy file media "${requested}". Đã thử: ${candidates.join(', ')}`);
}

function inferPostType(categories = []) {
  const normalized = (categories || []).map(item => slugify(item));
  if (normalized.includes('event-story')) return 'event-story';
  if (normalized.includes('phong-van') || normalized.includes('interview')) return 'interview';
  if (normalized.includes('side-story')) return 'side-story';
  return 'article';
}

function renderImportedHeading(node) {
  const content = String(node.content || '').trim();
  if (/^(?:part\s*\d+|ghi chú|ghi chu)$/iu.test(content)) {
    return `## ${content}`;
  }
  return `<p class="translation-scene-title">${escapeHtml(content)}</p>`;
}

function virtualSingerNote(id) {
  const [base] = String(id || '').split('-');
  if (!VIRTUAL_SINGER_IDS.has(base)) return '';
  const variants = [base, ...VIRTUAL_SINGER_SEKAI_SUFFIXES.map(suffix => `${base}-${suffix}`)].join(', ');
  return `<!-- VS note: OG giữ nguyên "${base}"; nếu là Sekai thì đổi ID thành một trong: ${variants}. -->\n`;
}

function yamlQuote(value) {
  return JSON.stringify(String(value || ''));
}

function missingCharacterNodes(parsed, registry = {}) {
  const result = new Map();
  for (const node of parsed.nodes || []) {
    if (node.type !== 'dialogue' || node.known || registry[node.id]) continue;
    result.set(node.id, node.originalSpeaker || node.id);
  }
  return [...result.entries()].map(([id, speaker]) => ({ id, speaker }));
}

function placeholderCharacterBlock(id, speaker) {
  return `${id}:\n  name: ${yamlQuote(speaker)}\n  short_name: ${yamlQuote(speaker)}\n  aliases: [${yamlQuote(speaker)}]\n  avatar: /images/characters/unknown.svg\n  color: "#999999"\n  text_color: "#444444"\n`;
}

function ensureMissingCharacters(projectRoot, parsed, registry, { dryRun = false, logger = console } = {}) {
  const missing = missingCharacterNodes(parsed, registry);
  if (!missing.length) return [];
  const registryPath = path.join(projectRoot, 'source', '_data', 'characters.yml');
  if (!dryRun) {
    const existing = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8').replace(/\s*$/, '\n') : '';
    const addition = missing.map(item => placeholderCharacterBlock(item.id, item.speaker)).join('\n');
    fs.writeFileSync(registryPath, `${existing}\n# Auto-added placeholder characters. Review avatar/color/aliases later.\n${addition}`, 'utf8');
  }
  for (const item of missing) {
    logger.warn(`[characters] Đã thêm placeholder "${item.id}" cho "${item.speaker}" bằng unknown.svg. Hãy kiểm tra lại trong source/_data/characters.yml.`);
  }
  return missing;
}

function renderPost({ parsed, options, inputPath, projectRoot }) {
  const title = options.title || path.basename(inputPath, path.extname(inputPath));
  const slug = slugify(options.slug || title);
  const renderedNodes = [];
  const copiedMedia = [];
  let firstAudio = true;

  for (const node of parsed.nodes) {
    if (node.type === 'heading') {
      renderedNodes.push(renderImportedHeading(node));
    } else if (node.type === 'paragraph') {
      renderedNodes.push(node.content);
    } else if (node.type === 'dialogue') {
      const todo = node.known ? '' : `<!-- TODO: khai báo nhân vật "${node.originalSpeaker}" với ID "${node.id}" trong source/_data/characters.yml -->\n`;
      const vsNote = virtualSingerNote(node.id);
      const variant = node.variant ? ` ${node.variant}` : '';
      renderedNodes.push(`${todo}${vsNote}{% dialogue ${node.id}${variant} %}\n${node.content}\n{% enddialogue %}`);
    } else if (node.type === 'media') {
      const sourceFile = resolveMediaSource(inputPath, node);
      const copied = copyMediaFile({ sourceFile, type: node.mediaType, slug, projectRoot, dryRun: options.dryRun });
      copiedMedia.push({ ...copied, type: node.mediaType, original: sourceFile });
      if (node.mediaType === 'image') {
        renderedNodes.push(`{% scene "${copied.publicPath}" "${escapeTagText(node.label)}" %}`);
      } else {
        renderedNodes.push(`{% bgm "${copied.publicPath}" "${escapeTagText(node.label || path.basename(node.file))}"${firstAudio ? ' autoplay' : ''} %}`);
        firstAudio = false;
      }
    }
  }

  const speakerNames = [...parsed.speakers.values()];
  const tags = [...new Set(options.tags || speakerNames)];
  const frontMatter = {
    title,
    date: options.date || formatLocalDate(),
    updated: options.date || formatLocalDate(),
    categories: options.categories,
    tags,
    description: options.description || `Bản dịch nháp được chuyển đổi từ ${path.basename(inputPath)}.`,
    ...(Number.isFinite(Number(options.homeOrder)) ? { home_order: Number(options.homeOrder) } : {}),
    post_type: options.postType || inferPostType(options.categories),
    translation_status: 'draft',
    source_language: options.sourceLanguage || 'ja',
    target_language: options.targetLanguage || 'vi',
    translator: options.translator,
    characters: speakerNames,
    proofreader: null,
    source_url: options.sourceUrl || null,
    source_file: path.relative(projectRoot, inputPath).replace(/\\/g, '/'),
    comments: false
  };
  const meta = `<div class="translation-meta">
  <strong>Tiêu đề:</strong> ${escapeHtml(title)}<br>
  <strong>Nhân vật:</strong> ${escapeHtml(speakerNames.join(', ') || 'Chưa xác định')}<br>
  <strong>Người dịch:</strong> ${escapeHtml(options.translator)}<br>
  <strong>Trạng thái:</strong> Bản nháp<br>
  <strong>File nguồn:</strong> <code>${path.basename(inputPath)}</code>
</div>`;
  const content = `---\n${yaml.dump(frontMatter, { lineWidth: -1, noRefs: true })}---\n\n${meta}\n\n<!-- more -->\n\n${renderedNodes.join('\n\n')}\n`;
  return { content, slug, title, copiedMedia };
}

function convert(options, projectRoot = path.resolve(__dirname, '..')) {
  if (!options.input) {
    throw new Error('Thiếu file TXT đầu vào. Dùng: npm run convert -- <file.txt> [tùy chọn]');
  }
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) throw new Error(`Không tìm thấy file TXT: ${inputPath}`);
  const registry = loadCharacterRegistry(projectRoot);
  const parsed = parseTranslation(fs.readFileSync(inputPath, 'utf8'), buildSpeakerMap(registry));
  ensureMissingCharacters(projectRoot, parsed, registry, { dryRun: options.dryRun, logger: console });
  const rendered = renderPost({ parsed, options, inputPath, projectRoot });
  const outputPath = options.output
    ? path.resolve(options.output)
    : path.join(projectRoot, 'source', '_posts', `${rendered.slug}.md`);

  if (!options.dryRun) {
    if (fs.existsSync(outputPath) && !options.force) {
      throw new Error(`File đầu ra đã tồn tại: ${outputPath}\nDùng --force nếu thật sự muốn ghi đè.`);
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rendered.content, 'utf8');
  }
  return { ...rendered, outputPath, warnings: [...new Set(parsed.warnings)] };
}

function printUsage() {
  console.log(`Chuyển TXT thành bài dịch Hexo

Cách dùng:
  npm run convert -- <file.txt> --title "Tên bài" [tùy chọn]

Tùy chọn:
  --slug <id>                 Đường dẫn/filename không dấu
  --output <file.md>          File đầu ra tùy chỉnh
  --categories "A,B"         Danh mục, phân tách bằng dấu phẩy
  --tags "A,B"               Tags bổ sung
  --post-type <loại>        side-story, event-story, interview hoặc article
  --translator "Tên"         Người dịch
  --source-url <url>          Liên kết nguồn
  --description "..."        Mô tả bài
  --force                     Cho phép ghi đè file đầu ra
  --dry-run                   Chỉ chuyển đổi thử, không ghi file/copy media

Chỉ dẫn trong TXT:
  Kanade: Nội dung lời thoại
  [IMAGE: cafe.webp | Cafe]   (mặc định tìm thêm trong thư mục bg/ cạnh TXT)
  [AUDIO: bgm.mp3 | Tên bản nhạc]`);
}

if (require.main === module) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
      printUsage();
    } else if (!options.input) {
      printUsage();
      process.exitCode = 1;
    } else {
      const result = convert(options);
      if (options.dryRun) {
        process.stdout.write(result.content);
      } else {
        console.log(`Đã tạo bài: ${result.outputPath}`);
        for (const media of result.copiedMedia) console.log(`Đã import media: ${media.destination}`);
      }
      for (const warning of result.warnings) console.warn(`CẢNH BÁO: ${warning}`);
    }
  } catch (error) {
    console.error(`LỖI: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildSpeakerMap,
  convert,
  copyMediaFile,
  escapeHtml,
  canonicalDialogueId,
  ensureMissingCharacters,
  loadCharacterRegistry,
  normalizeSpeaker,
  parseCli,
  parseMediaDirective,
  parseTranslation,
  resolveMediaSource,
  renderPost,
  virtualSingerNote,
  slugify
};
