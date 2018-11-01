const { echo } = require('shelljs');
const { readFileSync, writeFileSync, copyFileSync } = require('fs');
const _pick = require('lodash/pick');

const pkg = JSON.parse(readFileSync('package.json') as any);
const releasePkg = _pick(pkg, [
  'name',
  'version',
  'description',
  'keywords',
  'main',
  'typings',
  'sideEffects',
  'files',
  'author',
  'repository',
  'license',
  'engines',
  'optionalDependencies',
  'peerDependencies',
  'dependencies',
]);

releasePkg.main = 'index.js';
releasePkg.typings = 'index.d.ts';

echo('Copying extra files to dist folder.');
writeFileSync('dist/package.json', JSON.stringify(releasePkg, null, 2));
copyFileSync('README.md', 'dist/README.md');
copyFileSync('LICENSE', 'dist/LICENSE');
echo('Files copied.');

// TS needs to know that this is not beling loaded globally
// https://stackoverflow.com/a/41975448/197017
export {};
