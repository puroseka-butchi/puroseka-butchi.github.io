'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const hexoCli = path.join(root, 'node_modules', 'hexo-cli', 'bin', 'hexo');
const forwardedArgs = process.argv.slice(2);
const watchedPaths = [
  path.join(root, 'source', '_data'),
  path.join(root, '_config.yml'),
  path.join(root, '_config.next.yml')
];

let serverProcess = null;
let restartTimer = null;
let restarting = false;
let closing = false;
const watchers = [];

function cleanCache() {
  const result = spawnSync(process.execPath, [hexoCli, 'clean'], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.status !== 0) throw new Error('Không thể xóa cache Hexo.');
}

function startServer() {
  cleanCache();
  serverProcess = spawn(process.execPath, [hexoCli, 'server', ...forwardedArgs], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true
  });
  serverProcess.on('exit', code => {
    serverProcess = null;
    if (!closing && !restarting) process.exit(code || 0);
  });
}

function scheduleRestart(changedPath) {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (closing) return;
    console.log(`\n[Live] ${changedPath} đã thay đổi. Đang nạp lại dữ liệu...`);
    if (!serverProcess) return startServer();
    const previous = serverProcess;
    restarting = true;
    previous.once('exit', () => {
      restarting = false;
      startServer();
    });
    previous.kill();
  }, 600);
}

function watchFileOrDirectory(target) {
  if (!fs.existsSync(target)) return;
  const watcher = fs.watch(target, { persistent: true }, (eventType, filename) => {
    const changed = filename ? path.join(target, String(filename)) : target;
    scheduleRestart(path.relative(root, changed));
  });
  watchers.push(watcher);
}

function shutdown() {
  if (closing) return;
  closing = true;
  clearTimeout(restartTimer);
  for (const watcher of watchers) watcher.close();
  if (!serverProcess) return process.exit(0);
  serverProcess.once('exit', () => process.exit(0));
  serverProcess.kill();
  setTimeout(() => process.exit(0), 1500).unref();
}

if (!fs.existsSync(hexoCli)) {
  console.error('Không tìm thấy Hexo CLI. Hãy chạy npm install trước.');
  process.exit(1);
}

try {
  startServer();
  for (const target of watchedPaths) watchFileOrDirectory(target);
  console.log('[Live] Bài viết tự cập nhật; dữ liệu và cấu hình tự nạp lại.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
