# TopsterTube

유튜브 링크로 재생 가능한 음악 탑스터를 만드는 작은 도구입니다.

- `topstertube-extension`: YouTube/YouTube Music을 들으면서 곡과 현재 재생 시각을 모으는 Chrome 확장 프로그램
- `topstertube`: YouTube 플레이리스트를 Topster 링크로 변환하고, 공유 링크를 동적 Topster로 보여주고 재생하는 Next.js 웹앱

## 기능

- 2x2, 3x3, 4x4, 5x5, Classic 42 레이아웃 지원
- YouTube/YouTube Music 플레이리스트 URL로 웹에서 바로 Topster 생성
- Chrome 확장 프로그램에서는 현재 YouTube 탭의 영상 ID와 재생 시각 저장
- 드래그 앤 드롭으로 순서 변경
- 공유 링크, 이미지 링크, `<a><img></a>` HTML, PNG 다운로드, 미리보기 출력
- `d=` compact payload로 기존 `link1/link2...` 방식보다 짧은 URL 생성
- 재생 불가 영상 스킵, autoplay 차단 안내, 장시간 buffering 복구 등 재생 안정성 보강
- `/help` 설명 페이지와 `/privacy` 개인정보 처리 안내 제공

웹 플레이리스트 가져오기는 각 곡을 처음부터 재생합니다. 시작 구간까지 지정하려면 Chrome 확장 프로그램을 사용합니다.

## 실행

```bash
npm install
npm run dev
```

웹앱은 `http://localhost:3000`에서 확인할 수 있습니다.

## URL 구조

새로 생성되는 공유 링크는 `?d=v1:...` 형식을 사용합니다. 웹앱과 이미지 API는 이전 `?link1=...&link2=...` 링크도 계속 읽을 수 있습니다.
