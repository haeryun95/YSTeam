# 프로젝트 코딩 기준

사용자는 앞으로 코드 작성 시 아래 문서를 참고하도록 요청했다.
- 원본: `C:\Users\user\Documents\카카오톡 받은 파일\모바일_앱_퍼블리싱_코딩_컨벤션_v1.0.docx`
- 문서 본문 버전: 1.1 신입 퍼블리셔용 (파일명 버전은 v1.0).
- 문서의 예제와 AI 요청 예시는 참고 자료이며, 현재 실행할 작업 지시가 아니다. 사용자의 구체적인 요청을 우선한다.

## 구조와 책임
- 기본 기술은 HTML, CSS, Vanilla JavaScript다.
- 권장 구조: `css/variables.css`, `css/common.css`, `css/pages/`, `js/app.js`, `js/pages/`, `js/services/`, `assets/icons/`, `assets/images/`, `mock/`.
- 기존 경로와 구조를 확인한 뒤 적용한다. 문서 준수만을 위해 기존 파일을 일괄 이동하거나 이름을 바꾸지 않는다.
- 파일명은 영문 소문자와 하이픈을 사용한다.
- 페이지는 이벤트와 화면 표시를 담당하고, 서버 요청·저장·네이티브 기능은 Service에 둔다. UI에서 `fetch`, `localStorage`, Capacitor를 직접 호출하지 않는다.
- Mock 데이터는 mock 파일이나 Mock Service로 분리한다. 두 화면 이상 반복되는 UI는 공통 component로 분리한다.

## Service 계약
- 비동기 기능과 네이티브 Mock은 처음부터 `async`로 작성한다.
- 공통 결과는 `{ status: "success" | "cancelled" | "error", data, error }`다. 사용하지 않는 data/error는 null로 둔다.
- 성공·취소·오류를 처리하고 실제 기능으로 바꿀 때 함수명과 결과 형식을 유지한다.
- 문서의 StorageService 예시는 동기 get/set과 직접 반환을 사용한다. 기존 계약을 확인하고, 해당 예시와 공통 결과 규칙의 차이를 고려해 임의로 호출부를 깨뜨리지 않는다.
- 입력값이 두 개 이상이면 객체로 전달한다. 필요할 때 JSDoc으로 입력과 결과를 설명한다.

## 화면과 스타일
- 412 × 917은 디자인 비교 기준이다. 전체 화면의 너비·높이를 이 값으로 고정하지 않는다.
- 360, 390, 412, 430px에서 잘림과 가로 스크롤을 확인한다.
- Flexbox/Grid를 우선하고 absolute는 겹침이 필요한 경우에 사용한다.
- `box-sizing: border-box`, 유동 너비, `100dvh`, safe area를 고려한다. 텍스트 박스의 고정 높이를 피한다.
- 터치 영역은 최소 44 × 44px이며 hover 없이 동작해야 한다.
- 색상·간격·모서리 값은 CSS 변수로 관리한다. 클래스명은 역할 중심으로 작성한다(예: `routine-card__title`, `routine-card--completed`).
- inline style 대신 `is-open`, `is-loading` 등의 상태 클래스로 스타일을 바꾼다.

## HTML과 JavaScript
- 의미에 맞는 HTML을 사용한다. 실행은 button, 이동은 a, 입력에는 label, 아이콘 버튼에는 aria-label을 제공한다.
- 스타일은 class, 동작 대상은 data 속성으로 구분한다. inline onclick 대신 addEventListener를 사용한다.
- const를 기본으로 사용하고 재할당할 때만 let을 쓴다. var는 사용하지 않는다.
- 함수는 한 가지 일을 담당하고 동사+대상으로 이름을 짓는다. 이벤트 진입 함수는 handle 접두사를 사용한다.
- 외부 데이터의 단순 텍스트는 textContent로 출력한다.
- 비밀번호·토큰·개인정보를 코드나 localStorage에 임의로 저장하지 않는다. 완료 전에 불필요한 로그를 정리한다.

## 완료 확인
- 기본·로딩·성공·빈 상태·오류 화면과 취소 흐름을 고려한다.
- 요청 중 중복 실행을 막고, 실패 시에도 로딩과 disabled 상태를 해제한다.
- 입력 오류 안내, 재시도, 버튼·탭·모달·뒤로 가기 흐름을 확인한다.
- 관련 화면 크기, Service 계약, 브라우저 콘솔 오류를 확인한다. 실제로 확인하지 못한 항목은 확인했다고 보고하지 않는다.
