#!/usr/bin/env node
/**
 * gameGlobals 자동 검증 스크립트 (#193)
 *
 * 소스 파일에서 전역 선언(function, const, let)을 파싱하고
 * eslint.config.mjs의 gameGlobals 키와 비교하여
 * 누락/과잉 항목을 출력합니다.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 소스 파일 목록 (eslint.config.mjs의 gameGlobals 주석 기준)
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

// 전역 선언 패턴: 줄 맨 앞에서 function/const/let 선언
const DECL_RE = /^(?:function\s+(\w+)|(?:const|let)\s+(\w+))/;

/**
 * 소스 파일에서 전역 선언 이름을 수집
 */
function collectSourceGlobals() {
    const globals = new Map(); // name → file
    for (const file of SOURCE_FILES) {
        const filePath = join(ROOT, file);
        let content;
        try {
            content = readFileSync(filePath, 'utf-8');
        } catch {
            console.warn(`⚠ 파일 읽기 실패: ${file}`);
            continue;
        }
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(DECL_RE);
            if (match) {
                const name = match[1] || match[2];
                globals.set(name, file);
            }
        }
    }
    return globals;
}

/**
 * eslint.config.mjs에서 gameGlobals 키를 파싱
 */
function collectEslintGlobals() {
    const configPath = join(ROOT, 'eslint.config.mjs');
    const content = readFileSync(configPath, 'utf-8');

    // gameGlobals 객체 블록 추출
    const startMatch = content.match(/const\s+gameGlobals\s*=\s*\{/);
    if (!startMatch) {
        console.error('eslint.config.mjs에서 gameGlobals를 찾을 수 없습니다.');
        process.exit(1);
    }

    const startIdx = startMatch.index + startMatch[0].length;
    let depth = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < content.length && depth > 0; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') depth--;
        endIdx = i;
    }

    const block = content.slice(startIdx, endIdx);
    const globals = new Set();
    // 키 패턴: 단순 식별자 또는 따옴표로 감싸진 키 뒤에 ':'
    const keyRe = /^\s*(?:'([^']+)'|"([^"]+)"|(\w+))\s*:/gm;
    let m;
    while ((m = keyRe.exec(block)) !== null) {
        const key = m[1] || m[2] || m[3];
        globals.add(key);
    }
    return globals;
}

// ── main ──
const sourceGlobals = collectSourceGlobals();
const eslintGlobals = collectEslintGlobals();

const sourceNames = new Set(sourceGlobals.keys());

// 누락: 소스에 있지만 eslint에 없음
const missing = [];
for (const [name, file] of sourceGlobals) {
    if (!eslintGlobals.has(name)) {
        missing.push({ name, file });
    }
}

// 과잉: eslint에 있지만 소스에 없음
const excess = [];
for (const name of eslintGlobals) {
    if (!sourceNames.has(name)) {
        excess.push(name);
    }
}

let hasIssues = false;

if (missing.length > 0) {
    hasIssues = true;
    console.log('\n🔴 누락 (소스에 있지만 gameGlobals에 없음):');
    for (const { name, file } of missing) {
        console.log(`  - ${name}  (${file})`);
    }
}

if (excess.length > 0) {
    hasIssues = true;
    console.log('\n🟡 과잉 (gameGlobals에 있지만 소스에 없음):');
    for (const name of excess) {
        console.log(`  - ${name}`);
    }
}

if (!hasIssues) {
    console.log('✅ gameGlobals와 소스 전역 선언이 일치합니다.');
}

process.exit(hasIssues ? 1 : 0);
