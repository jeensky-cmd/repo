# 설문 집계기 계획서

## 목표

엑셀에서 머리글 줄까지 복사해 붙여넣으면 문항별 결과 표를 보여 주는 단일 페이지 `index.html`.

## 제약

- 파일은 `index.html` 하나. 외부 라이브러리·외부 글꼴·분석 도구 없음.
- 붙여넣은 데이터는 브라우저 밖으로 보내지 않고, 어디에도 저장하지 않는다.
  - `fetch`/`XMLHttpRequest`/`localStorage`/`sessionStorage`/`indexedDB`/쿠키를 쓰지 않는다.
  - Content-Security-Policy `default-src 'none'`으로 외부 요청을 막는다(인라인 스크립트·스타일만 허용).
  - 입력칸에 `spellcheck="false"`, `autocomplete="off"`를 달아 맞춤법 검사 서비스로 텍스트가 나가지 않게 한다.
  - `<form>`을 쓰지 않아 제출로 인한 전송이 없다.
  - 사용자 데이터는 `textContent`로만 화면에 넣는다(HTML로 해석하지 않음).
- 저장소 맨 위에 빈 `.nojekyll` 파일(GitHub Pages가 Jekyll 처리를 하지 않게).

## 집계 규칙

| 항목 | 규칙 |
|---|---|
| 입력 형식 | 엑셀 복사 결과(탭 구분, 줄바꿈 `\r\n`/`\n`/`\r`). 큰따옴표로 감싼 칸(칸 안의 줄바꿈·탭, `""` → `"`)도 해석 |
| 첫 줄 | 머리글. 첫 열(응답번호)은 집계하지 않고, 둘째 열부터가 문항 |
| 빈 줄 | 길이 0인 줄(끝의 줄바꿈 포함)은 자료 줄이 아니므로 건너뜀. 엑셀은 문항이 1개 이상이면 빈 행도 탭을 넣어 복사하므로 실제 응답 행과 겹치지 않음 |
| 칸 판정 | 앞뒤 공백을 지운 값이 `1`~`5` 중 하나 → 유효 / 비었거나 공백만 → 빈 응답 / 그 밖 → 제외 |
| 모자란 칸 | 칸 수가 머리글보다 적은 줄은 모자란 칸을 빈 응답으로 셈 |
| 남는 칸 | 머리글보다 많은 칸은 해당 문항이 없으므로 무시 |
| 평균 | 유효 응답 합 ÷ 유효 응답 수, 소수 셋째 자리에서 반올림(0.5 올림)해 둘째 자리까지 표시. 유효 0이면 `-` |

평균은 부동소수 오차(예: 2.675 → 2.67)를 피하려고 정수 연산으로 반올림한다:
`q = floor((합 × 200 + 수) ÷ (2 × 수))`, 표시 = `q ÷ 100`의 몫과 나머지 두 자리.

결과 표 열: **문항 / 유효 응답 / 평균 / 빈 응답 / 제외**.

## 구조

- `index.html`
  - `<script id="survey-core">`: 계산 로직만. DOM을 건드리지 않고 `SurveyCore` 객체(`parseTsv`, `classifyCell`, `formatAverage`, `tally`)를 내보낸다.
  - `<script id="survey-ui">`: 화면. 입력 → `SurveyCore.tally` → 표 그리기.
- `tests/core.test.js`: `index.html`에서 `survey-core` 스크립트만 꺼내 Node `vm`에서 실행해 시험(외부 의존성 없음, `node --test`).
- `tests/static.test.js`: `index.html`에 외부 URL·네트워크·저장소 API가 없는지, CSP가 있는지, `.nojekyll`이 빈 파일인지 검사.
- `.github/workflows/test.yml`: 푸시·PR 때 `node --test` 실행.

## 작업 순서(작업마다 커밋)

1. 계획서와 `.nojekyll` 추가
2. 계산 로직(`survey-core`)과 자동 시험
3. 화면(`survey-ui`)과 스타일
4. 정적 검사 시험, CI, README
5. 브라우저에서 직접 확인 후 PR
