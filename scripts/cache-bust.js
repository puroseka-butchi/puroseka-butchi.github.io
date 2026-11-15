'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const cssVersion = createHash('sha256')
  .update(readFileSync(join(hexo.base_dir, 'source/_data/styles.styl')))
  .update(readFileSync(join(hexo.base_dir, '_config.next.yml')))
  .update(readFileSync(join(hexo.base_dir, 'package-lock.json')))
  .digest('hex')
  .slice(0, 12);

hexo.extend.filter.register('after_render:html', html =>
  html.replace(/(href="[^"]*\/css\/main\.css)(")/g, `$1?v=${cssVersion}$2`)
);
