'use strict';
// index.html이 외부 자원을 불러오지 않고, 데이터를 보내거나 저장하는 API를 쓰지 않는지 검사한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readHtml } = require('./load-core');

const html = readHtml();
const root = path.join(__dirname, '..');

test('외부 URL·외부 자원 참조가 없다', () => {
  assert.doesNotMatch(html, /https?:\/\//i, 'http(s) 주소');
  assert.doesNotMatch(html, /(^|[\s"'(=])\/\/[a-z0-9.-]+\.[a-z]{2,}/i, '프로토콜 생략 주소');
  assert.doesNotMatch(html, /<link\b/i, '<link>');
  assert.doesNotMatch(html, /<(script|img|iframe|object|embed|audio|video|source)\b[^>]*\bsrc\s*=/i, 'src 속성');
  assert.doesNotMatch(html, /@import|@font-face|url\s*\(/i, 'CSS 외부 자원');
});

test('네트워크 전송·브라우저 저장 API를 쓰지 않는다', () => {
  const banned = [
    'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'RTCPeerConnection',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'caches', 'serviceWorker',
    'postMessage', 'window.open', 'location.href', 'navigator.clipboard',
    'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function',
  ];
  for (const word of banned) assert.equal(html.includes(word), false, word);
  assert.doesNotMatch(html, /<form\b/i, '<form>');
});

test('CSP가 외부 연결을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'CSP meta 태그');
  const csp = m[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.doesNotMatch(csp, /connect-src|img-src|font-src|\*|https?:/);
});

test('입력칸은 맞춤법 검사·자동 완성을 끈다', () => {
  const m = html.match(/<textarea\b[^>]*>/);
  assert.ok(m);
  assert.match(m[0], /spellcheck="false"/);
  assert.match(m[0], /autocomplete="off"/);
});

test('계산 로직과 화면이 분리되어 있다', () => {
  const core = html.match(/<script id="survey-core">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(core, /\b(document|window)\b/, '계산 로직이 DOM을 참조함');
  assert.match(html, /<script id="survey-ui">/);
});

test('결과 표 머리글 순서', () => {
  assert.ok(html.includes("['문항', '유효 응답', '평균', '빈 응답', '제외']"));
});

test('저장소 맨 위에 빈 .nojekyll 파일이 있다', () => {
  const st = fs.statSync(path.join(root, '.nojekyll'));
  assert.ok(st.isFile());
  assert.equal(st.size, 0);
});
