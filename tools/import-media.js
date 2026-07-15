'use strict';

const path = require('node:path');
const { copyMediaFile, slugify } = require('./convert-translation');

function parseArgs(argv) {
  const options = { type: 'image', autoplay: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    if (key === 'autoplay') {
      options.autoplay = true;
    } else {
      options[key] = argv[++index];
    }
  }
  options.file = positional[0];
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.file || !options.slug) {
    throw new Error('Cách dùng: npm run import:media -- <file> --slug <slug-bai> [--type image|audio] [--label "..."] [--autoplay]');
  }
  if (!['image', 'audio'].includes(options.type)) throw new Error('--type chỉ nhận image hoặc audio.');
  const projectRoot = path.resolve(__dirname, '..');
  const result = copyMediaFile({
    sourceFile: options.file,
    type: options.type,
    slug: slugify(options.slug),
    projectRoot
  });
  const label = String(options.label || path.basename(options.file)).replace(/"/g, '\\"');
  const tag = options.type === 'image'
    ? `{% scene "${result.publicPath}" "${label}" %}`
    : `{% bgm "${result.publicPath}" "${label}"${options.autoplay ? ' autoplay' : ''} %}`;
  console.log(`Đã import: ${result.destination}`);
  console.log('Chèn dòng sau vào bài dịch:');
  console.log(tag);
} catch (error) {
  console.error(`LỖI: ${error.message}`);
  process.exitCode = 1;
}

