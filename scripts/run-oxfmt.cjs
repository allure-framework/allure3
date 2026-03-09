#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const mode = process.argv.includes('--check') ? '--check' : '--write';

const pathspecs = ['package.json', ':(glob)packages/*/package.json'];
for (const dir of ['src', 'test', 'features']) {
  for (const ext of ['json', 'js', 'ts', 'tsx']) {
    pathspecs.push(`:(glob)packages/*/${dir}/**/*.${ext}`);
  }
}

const gitResult = spawnSync('git', ['ls-files', '--', ...pathspecs], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});

if (gitResult.status !== 0) {
  process.exit(gitResult.status || 1);
}

const files = gitResult.stdout
  .split('\n')
  .map((value) => value.trim())
  .filter(Boolean)
  .filter((filePath) => !filePath.includes('/src/assets/data/test-results/'));

if (files.length === 0) {
  console.log('No files matched the configured OXFmt scope.');
  process.exit(0);
}

const formatResult = spawnSync('oxfmt', [mode, ...files], { stdio: 'inherit' });
process.exit(formatResult.status || 0);
