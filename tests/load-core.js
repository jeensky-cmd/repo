'use strict';
// index.html에서 <script id="survey-core"> 블록만 꺼내 DOM 없는 샌드박스에서 실행한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'index.html');

function readHtml() {
  return fs.readFileSync(htmlPath, 'utf8');
}

function loadCore() {
  const html = readHtml();
  const m = html.match(/<script id="survey-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 <script id="survey-core">가 없습니다.');
  const sandbox = {}; // window·document 없음: 계산 로직이 화면에 기대지 않는지도 함께 확인된다.
  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox, { filename: 'index.html#survey-core' });
  return sandbox.SurveyCore;
}

module.exports = { loadCore, readHtml, htmlPath };
