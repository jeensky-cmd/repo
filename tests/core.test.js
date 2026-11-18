'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const core = loadCore();

// vm 샌드박스에서 만든 배열·객체는 프로토타입이 달라 deepStrictEqual이 실패하므로 JSON으로 옮긴다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const tally = (text) => plain(core.tally(text));
const byName = (res) => Object.fromEntries(res.questions.map((q) => [q.name, q]));
const row = (q) => ({ valid: q.valid, average: q.average, blank: q.blank, excluded: q.excluded });

test('classifyCell: 1~5만 유효, 빈칸·공백은 빈 응답, 나머지는 제외', () => {
  for (const v of ['1', '2', '3', '4', '5', ' 3', '4 ', '\t5\t', ' 2 ', '　1']) {
    assert.equal(core.classifyCell(v), 'valid', JSON.stringify(v));
  }
  for (const v of ['', ' ', '   ', '\t', '　', undefined, null]) {
    assert.equal(core.classifyCell(v), 'blank', JSON.stringify(v));
  }
  for (const v of ['0', '6', '-1', '1.0', '01', '3.5', '+3', '１', 'a', '3점', '1 2', 'N/A', '"3"']) {
    assert.equal(core.classifyCell(v), 'excluded', JSON.stringify(v));
  }
});

test('formatAverage: 소수 셋째 자리에서 반올림해 둘째 자리까지', () => {
  assert.equal(core.formatAverage(0, 0), '-');
  assert.equal(core.formatAverage(3, 1), '3.00');
  assert.equal(core.formatAverage(10, 3), '3.33'); // 3.333…
  assert.equal(core.formatAverage(11, 3), '3.67'); // 3.666…
  assert.equal(core.formatAverage(9, 2), '4.50');
  assert.equal(core.formatAverage(5, 1), '5.00');
  assert.equal(core.formatAverage(1, 1), '1.00');
  // 정확히 0.005에서 끝나는 경우는 올림. 부동소수로 계산하면 틀리기 쉬운 값들.
  assert.equal(core.formatAverage(107, 40), '2.68'); // 2.675
  assert.equal(core.formatAverage(41, 8), '5.13'); // 5.125
  assert.equal(core.formatAverage(201, 200), '1.01'); // 1.005
  assert.equal(core.formatAverage(229, 200), '1.15'); // 1.145
  assert.equal(core.formatAverage(2, 3), '0.67');
  assert.equal(core.formatAverage(1, 8), '0.13'); // 0.125
});

test('formatAverage: 모든 합·수 조합에서 BigInt 기준 계산과 일치', () => {
  for (let count = 1; count <= 400; count++) {
    for (let sum = count; sum <= count * 5; sum++) {
      const q = (BigInt(sum) * 200n + BigInt(count)) / (2n * BigInt(count));
      const expect = `${q / 100n}.${String(q % 100n).padStart(2, '0')}`;
      const got = core.formatAverage(sum, count);
      if (got !== expect) assert.fail(`sum=${sum} count=${count}: ${got} ≠ ${expect}`);
    }
  }
});

test('parseTsv: 탭·줄바꿈(CRLF/LF/CR) 구분', () => {
  assert.deepEqual(plain(core.parseTsv('a\tb\r\nc\td\r\n')), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(plain(core.parseTsv('a\tb\nc\td')), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(plain(core.parseTsv('a\tb\rc\td\r')), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(plain(core.parseTsv('a\t\t\n')), [['a', '', '']]);
  assert.deepEqual(plain(core.parseTsv('﻿a\tb')), [['a', 'b']]);
  assert.deepEqual(plain(core.parseTsv('')), []);
});

test('parseTsv: 엑셀식 큰따옴표 칸', () => {
  assert.deepEqual(plain(core.parseTsv('"첫\n줄"\t"탭\t포함"\t"따옴표 ""x"""\n1\t2\t3')), [
    ['첫\n줄', '탭\t포함', '따옴표 "x"'],
    ['1', '2', '3'],
  ]);
  // 닫히지 않았거나 닫힌 뒤 글자가 이어지면 따옴표를 글자 그대로 둔다.
  assert.deepEqual(plain(core.parseTsv('"3\t4\n5')), [['"3', '4'], ['5']]);
  assert.deepEqual(plain(core.parseTsv('"3"점\t4')), [['"3"점', '4']]);
  assert.deepEqual(plain(core.parseTsv('a"b"\t4')), [['a"b"', '4']]);
});

test('tally: 기본 집계와 표 열 값', () => {
  const text = [
    '응답번호\t만족도\t추천 의향\t재방문',
    '1\t5\t4\t3',
    '2\t4\t \t2',
    '3\t3\t모름\t',
    '4\t 5 \t6\t1',
  ].join('\r\n') + '\r\n';
  const res = tally(text);
  assert.equal(res.ok, true);
  assert.equal(res.responseCount, 4);
  assert.deepEqual(res.questions.map((q) => q.name), ['만족도', '추천 의향', '재방문']);
  const q = byName(res);
  assert.deepEqual(row(q['만족도']), { valid: 4, average: '4.25', blank: 0, excluded: 0 });
  assert.deepEqual(row(q['추천 의향']), { valid: 1, average: '4.00', blank: 1, excluded: 2 });
  assert.deepEqual(row(q['재방문']), { valid: 3, average: '2.00', blank: 1, excluded: 0 });
});

test('tally: 첫 열(응답번호)은 값이 무엇이든 집계하지 않는다', () => {
  const res = tally('번호\tQ1\n3\t1\n\t2\n문자\t3');
  assert.equal(res.questions.length, 1);
  assert.deepEqual(row(res.questions[0]), { valid: 3, average: '2.00', blank: 0, excluded: 0 });
});

test('tally: 칸이 모자란 줄은 모자란 칸을 빈 응답으로 센다', () => {
  const res = tally('번호\tQ1\tQ2\tQ3\n1\t5\n2\n3\t4\t4\t4');
  const q = byName(res);
  assert.deepEqual(row(q.Q1), { valid: 2, average: '4.50', blank: 1, excluded: 0 });
  assert.deepEqual(row(q.Q2), { valid: 1, average: '4.00', blank: 2, excluded: 0 });
  assert.deepEqual(row(q.Q3), { valid: 1, average: '4.00', blank: 2, excluded: 0 });
  assert.equal(res.shortRows, 2);
});

test('tally: 머리글보다 많은 칸은 무시한다', () => {
  const res = tally('번호\tQ1\n1\t2\t5\t5');
  assert.equal(res.questions.length, 1);
  assert.deepEqual(row(res.questions[0]), { valid: 1, average: '2.00', blank: 0, excluded: 0 });
  assert.equal(res.longRows, 1);
});

test('tally: 유효 응답이 없으면 평균은 "-"', () => {
  const res = tally('번호\tQ1\tQ2\n1\t\tx\n2\t \t0');
  const q = byName(res);
  assert.deepEqual(row(q.Q1), { valid: 0, average: '-', blank: 2, excluded: 0 });
  assert.deepEqual(row(q.Q2), { valid: 0, average: '-', blank: 0, excluded: 2 });
});

test('tally: 머리글만 있으면 모두 0, 평균 "-"', () => {
  const res = tally('번호\tQ1\tQ2\r\n');
  assert.equal(res.responseCount, 0);
  for (const q of res.questions) assert.deepEqual(row(q), { valid: 0, average: '-', blank: 0, excluded: 0 });
});

test('tally: 끝 줄바꿈·길이 0인 줄은 응답으로 세지 않는다', () => {
  const res = tally('\n번호\tQ1\n\n1\t3\n\n2\t\n\n\n');
  assert.equal(res.responseCount, 2);
  assert.deepEqual(row(res.questions[0]), { valid: 1, average: '3.00', blank: 1, excluded: 0 });
});

test('tally: 모든 칸이 빈 행(엑셀은 탭으로 복사)은 빈 응답으로 센다', () => {
  const res = tally('번호\tQ1\tQ2\n\t\t\n1\t2\t3');
  assert.equal(res.responseCount, 2);
  const q = byName(res);
  assert.deepEqual(row(q.Q1), { valid: 1, average: '2.00', blank: 1, excluded: 0 });
  assert.deepEqual(row(q.Q2), { valid: 1, average: '3.00', blank: 1, excluded: 0 });
});

test('tally: 칸 안 줄바꿈이 있는 따옴표 칸도 한 칸으로 본다', () => {
  const res = tally('번호\t"만족도\n(1~5)"\tQ2\n1\t4\t"의견\n있음"\n2\t5\t2');
  assert.equal(res.responseCount, 2);
  const q = byName(res);
  assert.deepEqual(row(q['만족도\n(1~5)']), { valid: 2, average: '4.50', blank: 0, excluded: 0 });
  assert.deepEqual(row(q.Q2), { valid: 1, average: '2.00', blank: 0, excluded: 1 });
});

test('tally: 이름 없는 머리글은 열 번호로 표시하고 앞뒤 공백을 지운다', () => {
  const res = tally('번호\t  Q1  \t\t \n1\t1\t2\t3');
  assert.deepEqual(res.questions.map((q) => q.name), ['Q1', '(이름 없음 · 3열)', '(이름 없음 · 4열)']);
});

test('tally: 같은 이름의 문항도 열마다 따로 집계', () => {
  const res = tally('번호\tQ\tQ\n1\t1\t5');
  assert.deepEqual(res.questions.map((q) => [q.name, q.average]), [['Q', '1.00'], ['Q', '5.00']]);
});

test('tally: 빈 입력·문항 열 없는 입력은 오류', () => {
  for (const t of ['', '\n\n', '\r\n']) {
    const res = tally(t);
    assert.equal(res.ok, false);
    assert.match(res.error, /내용이 없습니다/);
  }
  const res = tally('응답번호\n1\n2');
  assert.equal(res.ok, false);
  assert.match(res.error, /문항 열이 없습니다/);
});

test('tally: 유효 + 빈 응답 + 제외 = 응답 줄 수', () => {
  const lines = ['번호\tA\tB\tC\tD'];
  const pool = ['1', '2', '3', '4', '5', '', ' ', '0', '6', 'x', '2.5'];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 500; i++) {
    const width = 1 + Math.floor(rnd() * 6); // 칸이 모자란 줄·남는 줄 섞기
    const cells = [String(i + 1)];
    for (let c = 1; c < width; c++) cells.push(pool[Math.floor(rnd() * pool.length)]);
    lines.push(cells.join('\t'));
  }
  const res = tally(lines.join('\n'));
  assert.equal(res.responseCount, 500);
  for (const q of res.questions) assert.equal(q.valid + q.blank + q.excluded, 500, q.name);
});
