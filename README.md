# TopsterTube

유튜브 링크로 재생 가능한 탑스터 이미지를 만드는 작은 도구입니다.

- `topstertube-extension`: YouTube/YouTube Music에서 곡을 모으는 Chrome 확장 프로그램
- `topstertube`: 공유 링크를 열어 탑스터를 보여주고 재생하는 Next.js 웹앱

## 기능

- 2x2, 3x3, 4x4, 5x5, Classic 42 레이아웃 지원
- 현재 YouTube 탭의 영상 ID와 재생 시각 저장
- 드래그 앤 드롭으로 순서 변경
- 공유 링크, 이미지 링크, iframe 코드, PNG 다운로드, 미리보기 출력
- `d=` compact payload로 기존 `link1/link2...` 방식보다 짧은 URL 생성
- `/help` 설명 페이지와 `/privacy` 개인정보 처리 안내 제공

## 실행

```bash
npm install
npm run dev
```

웹앱은 `http://localhost:3000`에서 확인할 수 있습니다.

## 확장 프로그램 설치

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램을 로드`를 누릅니다.
4. 이 저장소의 `topstertube-extension` 폴더를 선택합니다.

## URL 구조

새로 생성되는 공유 링크는 `?d=v1:...` 형식을 사용합니다. 웹앱과 이미지 API는 이전 `?link1=...&link2=...` 링크도 계속 읽을 수 있습니다.
