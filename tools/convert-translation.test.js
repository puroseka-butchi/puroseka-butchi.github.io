'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildSpeakerMap,
  convert,
  ensureMissingCharacters,
  parseMediaDirective,
  parseTranslation,
  renderPost,
  resolveMediaSource,
  slugify
} = require('./convert-translation');

const registry = {
  kanade: { name: 'Yoisaki Kanade', short_name: 'Kanade', aliases: ['K'] },
  mizuki: { name: 'Akiyama Mizuki', short_name: 'Mizuki' },
  miku: { name: 'Hatsune Miku', short_name: 'Miku' },
  'miku-niigo': { name: 'Hatsune Miku (Nightcord)', short_name: 'Miku', aliases: ['Miku NIIGO'] }
};

test('slugify xử lý tiếng Việt và khoảng trắng', () => {
  assert.equal(slugify('Bản dịch mới – Phần 1'), 'ban-dich-moi-phan-1');
});

test('nhận diện chỉ dẫn ảnh và nhạc', () => {
  assert.deepEqual(parseMediaDirective('[IMAGE: cafe.webp | Cafe]'), {
    type: 'image', file: 'cafe.webp', label: 'Cafe'
  });
  assert.deepEqual(parseMediaDirective('[NHẠC: bgm.mp3 | Main theme]'), {
    type: 'audio', file: 'bgm.mp3', label: 'Main theme'
  });
});

test('chuyển lời thoại nhiều dòng, heading và thought', () => {
  const input = `# Part 1

Kanade: Dòng thứ nhất
Dòng thứ hai

Mizuki: (Độc thoại)

[IMAGE: cafe.webp | Cafe]`;
  const parsed = parseTranslation(input, buildSpeakerMap(registry));
  assert.equal(parsed.nodes[0].type, 'heading');
  assert.equal(parsed.nodes[0].level, 2);
  assert.equal(parsed.nodes[1].id, 'kanade');
  assert.equal(parsed.nodes[1].content, 'Dòng thứ nhất\nDòng thứ hai');
  assert.equal(parsed.nodes[2].variant, 'thought');
  assert.equal(parsed.nodes[3].type, 'media');
  assert.equal(parsed.nodes[3].mediaType, 'image');
  assert.equal(parsed.nodes[3].file, 'cafe.webp');
});

test('chuyển đổi end-to-end và import ảnh/nhạc', t => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hexo-translation-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const dataDir = path.join(projectRoot, 'source', '_data');
  const inputDir = path.join(projectRoot, 'input');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(inputDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'characters.yml'), 'kanade:\n  short_name: Kanade\n', 'utf8');
  fs.writeFileSync(path.join(inputDir, 'scene.png'), 'fake image', 'utf8');
  fs.writeFileSync(path.join(inputDir, 'bgm.mp3'), 'fake audio', 'utf8');
  fs.writeFileSync(path.join(inputDir, 'story.txt'), [
    '# Part 1',
    '[IMAGE: scene.png | Cafe]',
    'Kanade: Xin chào.',
    '[AUDIO: bgm.mp3 | Main theme]'
  ].join('\n'), 'utf8');

  const result = convert({
    input: path.join(inputDir, 'story.txt'),
    title: 'Bài thử',
    slug: 'bai-thu',
    translator: 'Tester',
    categories: ['Test'],
    force: false,
    dryRun: false
  }, projectRoot);

  assert.ok(fs.existsSync(result.outputPath));
  assert.ok(fs.existsSync(path.join(projectRoot, 'source', 'images', 'translations', 'bai-thu', 'scene.png')));
  assert.ok(fs.existsSync(path.join(projectRoot, 'source', 'audio', 'translations', 'bai-thu', 'bgm.mp3')));
  assert.match(result.content, /\{% scene "\/images\/translations\/bai-thu\/scene\.png" "Cafe" %\}/);
  assert.match(result.content, /\{% bgm "\/audio\/translations\/bai-thu\/bgm\.mp3" "Main theme" autoplay %\}/);
});

test('chuẩn hóa slug và tìm background trong thư mục bg cạnh TXT', t => {
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hexo-bg-'));
  t.after(() => fs.rmSync(inputDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(inputDir, 'bg'));
  fs.writeFileSync(path.join(inputDir, 'bg', 'scene.png'), 'fake image', 'utf8');
  const inputPath = path.join(inputDir, 'story.txt');
  fs.writeFileSync(inputPath, '', 'utf8');

  assert.equal(
    resolveMediaSource(inputPath, { mediaType: 'image', file: 'scene.png' }),
    path.join(inputDir, 'bg', 'scene.png')
  );
  assert.equal(slugify('Ichika-001002'), 'ichika-001002');
});

test('thêm note chọn ID Sekai cho thoại Virtual Singer', () => {
  const parsed = parseTranslation('Miku NIIGO: Xin chào.\n\nKanade: Không có note.', buildSpeakerMap(registry));
  assert.equal(parsed.nodes[0].id, 'miku');
  const result = renderPost({
    parsed,
    options: { title: 'VS note', slug: 'vs-note', categories: [], translator: 'Tester', dryRun: true },
    inputPath: path.join('res', 'vs-note.txt'),
    projectRoot: process.cwd()
  });

  assert.match(result.content, /VS note: OG giữ nguyên "miku"/);
  assert.match(result.content, /miku-ln, miku-mmj, miku-vbs, miku-wxs, miku-niigo/);
  assert.doesNotMatch(result.content, /OG giữ nguyên "kanade"/);
});

test('tự thêm placeholder cho nhân vật chưa có registry', t => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hexo-characters-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const dataDir = path.join(projectRoot, 'source', '_data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'characters.yml'), 'unknown:\n  avatar: /images/characters/unknown.svg\n', 'utf8');

  const parsed = parseTranslation('Cô bán hoa: Xin chào.', buildSpeakerMap({}));
  const warnings = [];
  const added = ensureMissingCharacters(projectRoot, parsed, {}, { logger: { warn: message => warnings.push(message) } });
  const registry = fs.readFileSync(path.join(dataDir, 'characters.yml'), 'utf8');

  assert.equal(added[0].id, 'co-ban-hoa');
  assert.match(registry, /co-ban-hoa:/);
  assert.match(registry, /avatar: \/images\/characters\/unknown\.svg/);
  assert.match(warnings[0], /co-ban-hoa/);
});
