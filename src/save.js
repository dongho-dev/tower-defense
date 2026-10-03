// 저장 데이터의 읽기·정규화. 브라우저 저장소가 부분적으로 손상돼도 화면이 열려야 한다.
import { DIFFICULTY } from './core/data/difficulty.js';

export const SAVE_KEY = 'lastlight.v2';

const DEFAULT_SETTINGS = { quality: 'high', sound: true, shake: true };
const QUALITIES = new Set(['high', 'medium', 'low']);
const DIFFICULTIES = new Set(Object.keys(DIFFICULTY));
// 마지막으로 고른 놀이 방식 ('siege'는 예전 저장의 공성전 버튼 값)
const MODES = new Set(['campaign', 'endless', 'siege', 'fortress', 'survival', 'rtd']);

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeInt(value, fallback = 0) {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function normalizeRecord(value) {
    if (!isRecord(value)) return null;
    return { ...value, stars: nonNegativeInt(value.stars), best: nonNegativeInt(value.best) };
}

function normalizeRecords(value) {
    if (!isRecord(value)) return {};
    const records = {};
    for (const [mapId, mapRecord] of Object.entries(value)) {
        if (!isRecord(mapRecord)) continue;
        const normalized = {};
        for (const [key, record] of Object.entries(mapRecord)) {
            const next = normalizeRecord(record);
            if (next) normalized[key] = next;
        }
        records[mapId] = normalized;
    }
    return records;
}

export function defaultSave() {
    return {
        records: {},
        settings: { ...DEFAULT_SETTINGS },
        tutorialDone: false,
        lastDifficulty: 'normal',
        lastEndless: false,
        seen: []
    };
}

export function loadSave(storage) {
    const base = defaultSave();
    try {
        const source = storage === undefined ? globalThis.localStorage : storage;
        const raw = JSON.parse(source?.getItem(SAVE_KEY) || 'null');
        if (!isRecord(raw)) return base;

        const save = {
            ...base,
            ...raw,
            records: normalizeRecords(raw.records),
            seen: Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((id) => typeof id === 'string'))] : [],
            settings: {
                ...DEFAULT_SETTINGS,
                ...(isRecord(raw.settings) ? raw.settings : {})
            }
        };
        if (!QUALITIES.has(save.settings.quality)) save.settings.quality = DEFAULT_SETTINGS.quality;
        if (typeof save.settings.sound !== 'boolean') save.settings.sound = DEFAULT_SETTINGS.sound;
        if (typeof save.settings.shake !== 'boolean') save.settings.shake = DEFAULT_SETTINGS.shake;
        if (!DIFFICULTIES.has(save.lastDifficulty)) save.lastDifficulty = base.lastDifficulty;
        if (typeof save.lastEndless !== 'boolean') save.lastEndless = base.lastEndless;
        if (!MODES.has(save.lastMode)) delete save.lastMode;

        // 예전 저장(맵별 별 개수)은 보통 난이도 기록으로 옮긴다.
        if (isRecord(raw.stars)) {
            for (const [mapId, stars] of Object.entries(raw.stars)) {
                const legacyStars = nonNegativeInt(stars);
                const mapRecord = (save.records[mapId] ??= {});
                const normal = mapRecord.normal || { stars: 0, best: 0 };
                mapRecord.normal = {
                    ...normal,
                    best: nonNegativeInt(normal.best),
                    stars: Math.max(legacyStars, nonNegativeInt(normal.stars))
                };
            }
        }
        delete save.stars;
        return save;
    } catch {
        // 저장소 접근이 막힌 환경과 손상된 JSON 모두 새 저장으로 시작한다.
        return base;
    }
}
