'use strict';
// index.html이 외부 자원을 불러오거나 밖으로 연결하지 않는지 검사한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readHtml } = require('./load-core');

const html = readHtml();

test('외부 URL·외부 자원 참조가 없다', () => {
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /<(script|img|iframe|object|embed|audio|video|source)\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /@import|@font-face|url\s*\(/i);
});

test('네트워크·저장 API, HTML 문자열 삽입을 쓰지 않는다', () => {
  for (const word of [
    'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie',
    'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function',
  ]) assert.equal(html.includes(word), false, word);
});

test('CSP가 외부 연결을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m);
  assert.match(m[1], /default-src 'none'/);
  assert.doesNotMatch(m[1], /\*|https?:/);
});

test('게임 로직과 화면이 분리되어 있다', () => {
  const core = html.match(/<script id="gomoku-core">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(core, /\b(document|window)\b/);
  assert.match(html, /<script id="gomoku-ui">/);
});

test('저장소 맨 위에 빈 .nojekyll 파일이 있다', () => {
  const st = fs.statSync(path.join(__dirname, '..', '.nojekyll'));
  assert.equal(st.size, 0);
});
