import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { MAPS } from '../src/core/data/maps.js';
import {
    LOBBY_MODES,
    FIELD_MAPS,
    lobbyModeOf,
    lastLobbyMode,
    lobbyScale,
    diffDesc,
    recordOf
} from '../src/ui/screens.js';

test('로비 놀이 방식 다섯 가지: 전장이 하나인 방식은 공성전 전용 맵을 가리킨다', () => {
    assert.deepEqual(
        LOBBY_MODES.map((m) => m.id),
        ['campaign', 'endless', 'fortress', 'survival', 'rtd']
    );
    for (const m of LOBBY_MODES.filter((x) => x.map)) {
        assert.ok(MAPS[m.map]?.siegeOnly, m.id);
        assert.equal(m.run.siege, true);
    }
    assert.equal(FIELD_MAPS.length, 6);
    assert.ok(FIELD_MAPS.every((m) => !m.siegeOnly));
});

test('판에서 돌아갈 때 그 판의 놀이 방식을 찾는다', () => {
    assert.equal(lobbyModeOf(createGame('dusk')), 'campaign');
    assert.equal(lobbyModeOf(createGame('dusk', { endless: true })), 'endless');
    assert.equal(lobbyModeOf(createGame('fortress', { siege: true })), 'fortress');
    assert.equal(lobbyModeOf(createGame('randomtd', { siege: true })), 'rtd');
    assert.equal(lobbyModeOf(null), null);
});

test('예전 저장의 마지막 모드도 카드 초점으로 이어진다', () => {
    assert.equal(lastLobbyMode({ lastMode: 'siege' }), 'fortress');
    assert.equal(lastLobbyMode({ lastMode: 'rtd' }), 'rtd');
    assert.equal(lastLobbyMode({ lastEndless: true }), 'endless');
    assert.equal(lastLobbyMode({}), 'campaign');
});

test('로비 배율: 1080p에서 1.25배, 작은 창은 1배', () => {
    assert.equal(lobbyScale(1920, 1080), 1.25);
    assert.equal(lobbyScale(1280, 720), 1);
    assert.equal(lobbyScale(1024, 1080), 1);
});

test('난이도 설명은 놀이 방식에 맞춘다', () => {
    assert.equal(diffDesc('normal', 'campaign'), '기본 밸런스 · 생명 20');
    assert.equal(diffDesc('hero', 'campaign'), '생명 1 · 한 마리도 놓치면 끝');
    assert.match(diffDesc('hero', 'rtd'), /필드 한도 70마리/);
    assert.match(diffDesc('easy', 'survival'), /본진 체력 130%/);
});

test('기록 형식은 그대로: 공성전 기록은 siege- 키', () => {
    const save = {
        records: { fortress: { 'siege-normal': { stars: 2, best: 0 } }, dusk: { hero: { stars: 1, best: 0 } } }
    };
    assert.equal(recordOf(save, 'fortress', 'normal', 'siege').stars, 2);
    assert.equal(recordOf(save, 'dusk', 'hero').stars, 1);
    assert.equal(recordOf(save, 'dusk', 'normal').stars, 0);
});
