const { echo } = require('shelljs');
const { readFileSync, writeFileSync } = require('fs');
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
  'dependencies',
]);

echo('Copying package.json file to dist folder.');
writeFileSync('dist/package.json', JSON.stringify(releasePkg, null, 2));
echo('Package.json file copied.');

// TS needs to know that this is not beling loaded globally
// https://stackoverflow.com/a/41975448/197017
export {};
