#!/usr/bin/env node
/**
 * #193: gameGlobals 자동 검증 스크립트
 *
 * 소스 파일에서 최상위 function, const, let 선언을 파싱하고
 * eslint.config.mjs의 gameGlobals 키와 비교하여
 * 누락(missing)과 과잉(extraneous)을 출력합니다.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 1. 소스 파일에서 최상위 선언 파싱
const SOURCE_FILES = [
    'constants.js',
    'towers.js',
    'utils.js',
    'map.js',
    'ui.js',
    'audio.js',
    'combat.js',
    'overlay.js',
    'game.js',
    'update.js',
    'renderer.js',
    'main.js'
];

const declPattern = /^(?:function\s+(\w+)|(?:const|let)\s+(\w+))/;

const sourceGlobals = new Set();

for (const file of SOURCE_FILES) {
    const filePath = join(ROOT, file);
    let content;
    try {
        content = readFileSync(filePath, 'utf-8');
    } catch {
        console.warn(`Warning: ${file} not found, skipping`);
        continue;
    }
    const lines = content.split('\n');
    for (const line of lines) {
        const match = line.match(declPattern);
        if (match) {
            const name = match[1] || match[2];
            sourceGlobals.add(name);
        }
    }
}

// 2. eslint.config.mjs에서 gameGlobals 키 추출
const eslintConfigPath = join(ROOT, 'eslint.config.mjs');
const eslintContent = readFileSync(eslintConfigPath, 'utf-8');

// gameGlobals 블록에서 키 추출: "키: '값'" 패턴
const globalKeyPattern = /^\s+(\w+):\s*'(?:readonly|writable)'/gm;
const configGlobals = new Set();
let keyMatch;
while ((keyMatch = globalKeyPattern.exec(eslintContent)) !== null) {
    configGlobals.add(keyMatch[1]);
}

// 3. 비교
const missing = []; // 소스에 있으나 config에 없음
const extraneous = []; // config에 있으나 소스에 없음

for (const name of sourceGlobals) {
    if (!configGlobals.has(name)) {
        missing.push(name);
    }
}

for (const name of configGlobals) {
    if (!sourceGlobals.has(name)) {
        extraneous.push(name);
    }
}

// 4. 결과 출력
let hasIssues = false;

if (missing.length > 0) {
    hasIssues = true;
    console.log(`\n❌ 소스에 있으나 gameGlobals에 누락된 선언 (${missing.length}개):`);
    for (const name of missing.sort()) {
        console.log(`  - ${name}`);
    }
}

if (extraneous.length > 0) {
    hasIssues = true;
    console.log(`\n⚠️  gameGlobals에 있으나 소스에서 찾을 수 없는 선언 (${extraneous.length}개):`);
    for (const name of extraneous.sort()) {
        console.log(`  - ${name}`);
    }
}

if (!hasIssues) {
    console.log('✅ gameGlobals와 소스 파일 선언이 일치합니다.');
}

console.log(`\n총 소스 선언: ${sourceGlobals.size}개, gameGlobals 키: ${configGlobals.size}개`);

process.exit(hasIssues ? 1 : 0);
