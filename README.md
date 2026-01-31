# TopsterTube

유튜브 음악으로 만드는 나만의 재생 가능한 탑스터(Topster) 서비스입니다.

## 🏗 프로젝트 아키텍처 (Architecture)

TopsterTube는 **Chrome Extension (Generator)**과 **Web Application (Player)**이라는 두 개의 독립적인 프로그램이 상호작용하는 구조를 가지고 있습니다.

### 1. 설계 철학: 데이터 탈중앙화 (Decentralized Data)
이 프로젝트의 핵심은 **"웹 사이트는 그저 그릇(Container)에 불과하다"**는 것입니다.
- **Chrome Extension**: 사용자가 유튜브에서 직접 콘텐츠를 선택하고 구조화(큐레이션)하는 도구입니다. 데이터 생성의 주체입니다.
- **Web App**: 생성된 데이터를 시각적으로 표현하고 재생하는 도구입니다.

이 구조 덕분에 별도의 데이터베이스 유지관리 비용 없이, 사용자가 생성한 링크만으로 영구적인 플레이리스트 공유가 가능합니다.

### 2. 구성 요소 상세 (Components)

#### A. Chrome Extension (Generator)
사용자는 유튜브 웹사이트 내에서 이 확장프로그램을 사용하여 자신만의 탑스터를 구성합니다.

![TopsterTube Extension UI](/extension_ui.png)

- **기능**:
    - 현재 재생 중인 영상의 ID와 재생 시점(Time)을 캡처.
    - 드래그 앤 드롭으로 트랙 순서 변경.
    - 테마(Grid, Classic) 및 크기(2x2, 3x3 등) 설정.
    - **"코드 생성"**: 최종적으로 구성된 데이터를 TopsterTube 웹 앱 URL로 변환하여 생성.

#### B. Web Application (Player)
확장프로그램이 생성한 URL을 받아 화면에 렌더링하는 Next.js 애플리케이션입니다.

![TopsterTube Architecture](/architecture.png)

- **Client (Frontend)**: URL 파라미터를 파싱하여 그리드를 그리고, 유튜브 임베드 플레이어를 제어합니다.
- **Server (Image API)**: SNS 공유를 위해 `sharp`를 사용하여 현재 구성을 하나의 이미지 파일로 합성해줍니다.

### 3. 상호작용 흐름 (Interaction Workflow)

1. **Picking (Extension)**: 사용자가 유튜브 뮤직이나 유튜브에서 음악을 듣다가 확장프로그램을 열어 "현재 탭 추가"를 누릅니다.
2. **Curating (Extension)**: 확장프로그램 UI에서 순서를 바꾸거나 원하지 않는 트랙을 삭제하여 구성을 완료합니다.
3. **Generating (Extension -> Web)**: "코드 생성" 버튼을 누르면, 모든 데이터가 압축된 URL이 생성되어 TopsterTube 웹사이트로 이동합니다.
4. **Playing (Web)**: 웹사이트는 전달받은 파라미터대로 화면을 그리고 음악을 재생합니다.

## 🚀 시작하기

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인하실 수 있습니다.
