'use strict';

// Keep CommonJS consumers on the same implementation as the ESM bundle.
// This small loader evaluates the ESM source synchronously after replacing its export.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = path.join(__dirname, 'gec-v2.js');
const source = fs.readFileSync(filename, 'utf8').replace(
  'export function generateSecMsGecV2',
  'function generateSecMsGecV2',
) + '\nmodule.exports = { generateSecMsGecV2 };';
const moduleShim = { exports: {} };
vm.runInNewContext(source, {
  module: moduleShim,
  exports: moduleShim.exports,
  TextEncoder: globalThis.TextEncoder,
  Uint8Array,
  Array,
  BigInt,
  Date,
  Error,
  Math,
  Number,
}, { filename });

module.exports = moduleShim.exports;
