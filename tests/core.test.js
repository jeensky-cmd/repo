'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const G = loadCore();
const { BLACK, WHITE, EMPTY, SIZE } = G;
const plain = (v) => JSON.parse(JSON.stringify(v));

// 좌표 목록을 차례대로 둔다(흑, 백, 흑, …). 하나라도 실패하면 시험 실패.
function playAll(game, moves) {
  for (const [x, y] of moves) {
    const r = G.play(game, x, y);
    assert.ok(r.ok, `(${x},${y}) 착수 실패: ${r.error}`);
  }
  return game;
}

// 흑 수와 백 수를 번갈아 끼워 둔다.
function interleave(blacks, whites) {
  const out = [];
  for (let i = 0; i < Math.max(blacks.length, whites.length); i++) {
    if (blacks[i]) out.push(blacks[i]);
    if (whites[i]) out.push(whites[i]);
  }
  return out;
}

test('새 게임: 10×10 빈 판, 흑 차례', () => {
  const g = G.createGame();
  assert.equal(SIZE, 10);
  assert.equal(g.board.length, 100);
  assert.ok(g.board.every((c) => c === EMPTY));
  assert.equal(g.turn, BLACK);
  assert.equal(G.isOver(g), false);
});

test('번갈아 두고, 둔 칸·판 밖에는 둘 수 없다', () => {
  const g = G.createGame();
  assert.ok(G.play(g, 0, 0).ok);
  assert.equal(g.turn, WHITE);
  assert.equal(g.board[0], BLACK);
  assert.deepEqual(plain(G.play(g, 0, 0)), { ok: false, error: '이미 돌이 있습니다.' });
  assert.equal(G.play(g, -1, 0).ok, false);
  assert.equal(G.play(g, 10, 0).ok, false);
  assert.equal(G.play(g, 0, 10).ok, false);
  assert.equal(g.turn, WHITE, '실패한 수는 차례를 바꾸지 않음');
  assert.ok(G.play(g, 9, 9).ok);
  assert.equal(g.board[99], WHITE);
});

for (const [name, dx, dy, sx, sy] of [
  ['가로', 1, 0, 2, 3],
  ['세로', 0, 1, 7, 1],
  ['대각선 ↘', 1, 1, 0, 0],
  ['대각선 ↗', 1, -1, 5, 9],
]) {
  test(`${name} 5개면 승리하고 승리 줄을 돌려준다`, () => {
    const blacks = [0, 1, 2, 3, 4].map((k) => [sx + dx * k, sy + dy * k]);
    // 백은 흑 줄과 겹치지 않는 맨 윗줄/아랫줄 구석에 둔다.
    const whites = [[9, 0], [9, 2], [8, 0], [8, 2]].filter(([x, y]) => !blacks.some(([a, b]) => a === x && b === y));
    const g = playAll(G.createGame(), interleave(blacks, whites.slice(0, 4)));
    assert.equal(g.winner, BLACK);
    const line = plain(g.winLine).map(([x, y]) => `${x},${y}`).sort();
    assert.deepEqual(line, blacks.map(([x, y]) => `${x},${y}`).sort());
    assert.equal(G.isOver(g), true);
    assert.equal(G.play(g, 5, 5).ok, false, '끝난 뒤에는 둘 수 없음');
  });
}

test('가운데를 채워 5개가 되어도 승리', () => {
  const g = playAll(G.createGame(), interleave([[0, 5], [1, 5], [3, 5], [4, 5], [2, 5]], [[0, 0], [1, 0], [2, 0], [3, 0]]));
  assert.equal(g.winner, BLACK);
});

test('6개 이상(장목)도 승리', () => {
  const g = playAll(G.createGame(), interleave(
    [[0, 4], [1, 4], [2, 4], [4, 4], [5, 4], [3, 4]],
    [[0, 0], [1, 0], [2, 0], [4, 9], [5, 9]],
  ));
  assert.equal(g.winner, BLACK);
  assert.equal(g.winLine.length, 6);
});

test('4개는 승리가 아니고, 다른 색이 끼면 이어지지 않는다', () => {
  const g = playAll(G.createGame(), interleave([[0, 0], [1, 0], [2, 0], [3, 0], [5, 0]], [[4, 0], [0, 9], [1, 9], [2, 9]]));
  assert.equal(g.winner, EMPTY);
  assert.equal(G.isOver(g), false);
});

test('백도 이길 수 있다', () => {
  const g = playAll(G.createGame(), interleave([[0, 0], [2, 0], [4, 0], [6, 0], [0, 9]], [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]));
  assert.equal(g.winner, WHITE);
});

test('판이 다 차고 승자가 없으면 무승부', () => {
  // 가로 BBWWBBWW…, 줄마다 한 칸씩 밀린 무늬: 어느 방향으로도 5개가 이어지지 않는다.
  const color = (x, y) => ((Math.floor(x / 2) + y) % 2 === 0 ? BLACK : WHITE);
  const blacks = [], whites = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) (color(x, y) === BLACK ? blacks : whites).push([x, y]);
  assert.equal(blacks.length, 50);
  const g = playAll(G.createGame(), interleave(blacks, whites));
  assert.equal(g.winner, EMPTY);
  assert.equal(g.draw, true);
  assert.equal(G.isOver(g), true);
  assert.equal(G.bestMove(g), null);
});

test('무르기: 판·차례·승패가 되돌아간다', () => {
  const g = G.createGame();
  assert.equal(G.undo(g), false, '둔 수가 없으면 false');
  playAll(g, interleave([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], [[0, 1], [1, 1], [2, 1], [3, 1]]));
  assert.equal(g.winner, BLACK);
  assert.ok(G.undo(g));
  assert.equal(g.winner, EMPTY);
  assert.equal(g.winLine, null);
  assert.equal(g.turn, BLACK);
  assert.equal(g.board[4], EMPTY);
  assert.equal(g.moves.length, 8);
  assert.ok(G.undo(g));
  assert.equal(g.turn, WHITE);
  assert.ok(G.play(g, 9, 9).ok);
});

test('무르기: 무승부도 풀린다', () => {
  const color = (x, y) => ((Math.floor(x / 2) + y) % 2 === 0 ? BLACK : WHITE);
  const blacks = [], whites = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) (color(x, y) === BLACK ? blacks : whites).push([x, y]);
  const g = playAll(G.createGame(), interleave(blacks, whites));
  G.undo(g);
  assert.equal(g.draw, false);
  assert.equal(G.isOver(g), false);
});

test('컴퓨터: 빈 판이면 가운데 근처에 둔다', () => {
  const m = plain(G.bestMove(G.createGame()));
  assert.ok(m.x >= 4 && m.x <= 5 && m.y >= 4 && m.y <= 5, JSON.stringify(m));
});

test('컴퓨터: 이길 수 있으면 이긴다(막기보다 우선)', () => {
  // 흑 4개(가로)와 백 4개(세로)가 모두 한 수면 5개. 흑 차례.
  const g = playAll(G.createGame(), interleave([[1, 0], [2, 0], [3, 0], [4, 0]], [[9, 3], [9, 4], [9, 5], [9, 6]]));
  assert.equal(g.turn, BLACK);
  const m = plain(G.bestMove(g));
  assert.ok((m.x === 0 || m.x === 5) && m.y === 0, JSON.stringify(m));
});

test('컴퓨터: 상대가 다음 수에 이기면 막는다', () => {
  // 흑 4개가 막히지 않은 한쪽 끝을 가짐. 백 차례.
  const g = playAll(G.createGame(), interleave([[0, 5], [1, 5], [2, 5], [3, 5]], [[9, 0], [9, 9], [0, 0]]));
  assert.equal(g.turn, WHITE);
  assert.deepEqual(plain(G.bestMove(g)), { x: 4, y: 5 });
});

test('컴퓨터: 상대의 열린 3을 막는다', () => {
  const g = playAll(G.createGame(), interleave([[3, 4], [4, 4], [5, 4]], [[0, 9], [9, 9]]));
  assert.equal(g.turn, WHITE);
  const m = plain(G.bestMove(g));
  assert.ok(m.y === 4 && (m.x === 2 || m.x === 6), JSON.stringify(m));
});

test('컴퓨터: 자기 열린 4를 만든다', () => {
  const g = playAll(G.createGame(), interleave([[3, 3], [4, 3], [5, 3]], [[9, 0], [9, 2], [7, 9]]));
  assert.equal(g.turn, BLACK);
  const m = plain(G.bestMove(g));
  assert.ok(m.y === 3 && (m.x === 2 || m.x === 6), JSON.stringify(m));
});

test('컴퓨터끼리 끝까지 두면 항상 빈칸에만 두고 게임이 끝난다', () => {
  const g = G.createGame();
  let n = 0;
  while (!G.isOver(g)) {
    const m = G.bestMove(g);
    assert.equal(g.board[m.y * SIZE + m.x], EMPTY);
    assert.ok(G.play(g, m.x, m.y).ok);
    assert.ok(++n <= 100);
  }
  assert.ok(g.winner !== EMPTY || g.draw);
});

test('컴퓨터는 같은 판에서 항상 같은 수를 고른다', () => {
  const a = playAll(G.createGame(), [[4, 4], [5, 5], [3, 5]]);
  const b = playAll(G.createGame(), [[4, 4], [5, 5], [3, 5]]);
  assert.deepEqual(plain(G.bestMove(a)), plain(G.bestMove(b)));
});
