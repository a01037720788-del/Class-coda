// CODA: GitHub Pages 배포 전에 Base44 런타임 의존성 재유입을 차단합니다.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const targets = ['src', 'package.json', 'vite.config.js'];
const blocked = [
  /@base44\/(?:sdk|vite-plugin)/i,
  /(?:from\s*['"]|import\s*\(['"])[^'"]*base44Client/i,
  /(?:import\.meta\.env\.|process\.env\.)VITE_BASE44_[A-Z_]+/,
  /https?:\/\/[^\s'"`]*base44\.app/i,
];
const failures = [];
async function inspect(path) {
  const fs = await import('node:fs/promises');
  const stat = await fs.stat(path);
  if (stat.isDirectory()) {
    for (const item of await readdir(path)) await inspect(join(path, item));
    return;
  }
  if (!/\.(?:jsx?|tsx?|json)$/.test(path)) return;
  const contents = await readFile(path, 'utf8');
  for (const pattern of blocked) if (pattern.test(contents)) failures.push(`${relative(root, path)}: ${pattern}`);
}
for (const target of targets) await inspect(join(root, target));
if (failures.length) {
  console.error('Base44 런타임 의존성 발견:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Base44 런타임 의존성 검사 통과 (src / package.json / vite.config.js)');
}
