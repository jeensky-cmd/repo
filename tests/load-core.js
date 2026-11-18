'use strict';
// index.html에서 <script id="gomoku-core"> 블록만 꺼내 DOM 없는 샌드박스에서 실행한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'index.html');

function readHtml() {
  return fs.readFileSync(htmlPath, 'utf8');
}

function loadCore() {
  const m = readHtml().match(/<script id="gomoku-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 <script id="gomoku-core">가 없습니다.');
  const sandbox = {}; // window·document 없음
  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox, { filename: 'index.html#gomoku-core' });
  return sandbox.GomokuCore;
}

module.exports = { loadCore, readHtml };
