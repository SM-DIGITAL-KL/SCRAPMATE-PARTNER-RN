#!/usr/bin/env node

/**
 * Script to obfuscate React Native bundle for production builds
 * Usage: node scripts/obfuscate-bundle.js <input-bundle> <output-bundle>
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: node scripts/obfuscate-bundle.js <input-bundle> <output-bundle>');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file not found: ${inputFile}`);
  process.exit(1);
}

console.log(`📦 Reading bundle from: ${inputFile}`);
const bundleCode = fs.readFileSync(inputFile, 'utf8');

console.log('🔒 Obfuscating JavaScript bundle...');
const obfuscationResult = JavaScriptObfuscator.obfuscate(bundleCode, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false, // Set to true for extra protection (may cause issues)
  debugProtectionInterval: 0,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
});

const obfuscatedCode = obfuscationResult.getObfuscatedCode();

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, obfuscatedCode, 'utf8');
console.log(`✅ Obfuscated bundle written to: ${outputFile}`);
console.log(`📊 Original size: ${(bundleCode.length / 1024).toFixed(2)} KB`);
console.log(`📊 Obfuscated size: ${(obfuscatedCode.length / 1024).toFixed(2)} KB`);

