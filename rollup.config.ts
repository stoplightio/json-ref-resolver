import camelCase from 'lodash.camelcase';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import sourceMaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

const pkg = require('./package.json');

const libraryName = 'json-ref-resolver';

export default {
  input: `src/${libraryName}.ts`,

  output: [
    { file: pkg.main, name: camelCase(libraryName), format: 'umd', sourcemap: true },
    { file: pkg.module, format: 'es', sourcemap: true },
  ],

  // Indicate here external modules you don't want to include in your bundle (i.e.: 'lodash')
  external: [],

  watch: {
    include: 'src/**',
  },

  plugins: [
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),

    // Allow json resolution
    json(),

    // Compile TypeScript files
    typescript({ useTsconfigDeclarationDir: true, rollupCommonJSResolveHack: true }),

    // Bundle cjs modules
    commonjs(),

    // Resolve source maps to the original source
    sourceMaps(),

    terser(),
  ],
};
