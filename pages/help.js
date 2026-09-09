import Head from 'next/head';

const chromeStoreUrl = 'https://chromewebstore.google.com/detail/topstertube-%EC%9E%AC%EC%83%9D-%EA%B0%80%EB%8A%A5%ED%95%9C-%ED%83%91%EC%8A%A4%ED%84%B0/nnhcekoanhgdanobfegpjhdlankamgba';
const notionGuideUrl = 'https://m1nhyeok.notion.site/topstertube';

const playlistSteps = [
    {
        title: 'YouTube 플레이리스트 만들기',
        body: 'YouTube 또는 YouTube Music에서 탑스터에 넣고 싶은 곡을 플레이리스트에 모으고 순서를 정합니다.',
    },
    {
        title: '플레이리스트 링크 붙여넣기',
        body: 'Topstertube 첫 화면에 플레이리스트 링크를 붙여넣고 원하는 레이아웃을 고릅니다.',
    },
    {
        title: 'Topster 만들기',
        body: '플레이리스트 순서대로 필요한 곡 수만 가져와 재생 가능한 Topster 링크를 만듭니다.',
    },
];

const extensionSteps = [
    {
        title: 'Chrome 확장 프로그램 설치',
        body: '음악을 들으면서 현재 재생 위치까지 기록하고 싶다면 Chrome Web Store에서 Topstertube를 설치합니다.',
    },
    {
        title: '현재 탭 추가',
        body: 'YouTube 또는 YouTube Music에서 원하는 곡을 재생하고 현재 탭 추가를 누르면 영상과 현재 재생 시각이 함께 저장됩니다.',
    },
    {
        title: '순서와 레이아웃 정리',
        body: '2x2, 3x3, 4x4, 5x5, Classic 42 중 하나를 고르고 드래그로 곡 순서를 정리합니다.',
    },
    {
        title: '목적에 맞게 공유',
        body: '완성 후 링크, 이미지 링크, HTML, 이미지 저장 중 필요한 방식으로 공유합니다.',
    },
];

const shareOptions = [
    ['링크 복사', '카카오톡, X, 인스타 스토리 등에서 재생 가능한 탑스터 페이지를 공유할 때 사용합니다.'],
    ['이미지 저장', '인스타 스토리나 게시글처럼 이미지 파일이 필요한 곳에 올릴 때 사용합니다.'],
    ['이미지 링크', '이미지 주소를 바로 붙여넣을 수 있는 게시판, 문서, 메신저에서 사용합니다.'],
    ['HTML 복사', '이미지를 클릭하면 재생 페이지로 이동하는 <a><img></a> 형식의 HTML이 필요할 때 사용합니다.'],
    ['미리보기', '공유하기 전에 실제 재생 페이지가 어떻게 보이는지 새 탭에서 확인할 때 사용합니다.'],
];

export default function Help() {
    return (
        <>
            <Head>
                <title>Topstertube 도움말</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="description" content="Topstertube 사용법과 공유 방식 안내" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main className="help-page">
                <section className="help-hero help-animate">
                    <p className="help-kicker">Help</p>
                    <h1>음악 Topster를 만들고, 커버를 눌러 바로 들어보세요.</h1>
                    <p>
                        설치 없이 YouTube 플레이리스트 링크로 만들거나, Chrome 확장 프로그램으로 현재 재생 위치까지 담아 더 정밀하게 만들 수 있습니다.
                        공유받은 사람은 확장 프로그램 없이 웹에서 바로 감상합니다.
                    </p>
                    <div className="help-cta-row">
                        <a className="help-primary-link" href="/">플레이리스트로 만들기</a>
                        <a className="help-secondary-link" href={chromeStoreUrl} target="_blank" rel="noopener noreferrer">Chrome 확장 프로그램</a>
                        <a className="help-secondary-link" href={notionGuideUrl} target="_blank" rel="noopener noreferrer">자세한 사용법</a>
                    </div>
                </section>

                <section className="help-section help-animate">
                    <p className="help-kicker">Version 1.4</p>
                    <h2>웹 플레이리스트 가져오기</h2>
                    <div className="help-update-box">
                        <p>YouTube와 YouTube Music 플레이리스트 링크만으로 웹에서 Topster를 만들 수 있습니다.</p>
                        <p>웹에서 가져온 곡은 처음부터 재생됩니다. 시작 구간까지 지정하려면 Chrome 확장 프로그램을 사용하세요.</p>
                    </div>
                </section>

                <section className="help-section help-animate">
                    <h2>방법 1 · 플레이리스트로 빠르게 만들기</h2>
                    <div className="help-step-list">
                        {playlistSteps.map((step, index) => (
                            <article className="help-step" key={step.title}>
                                <span className="help-step-index">{String(index + 1).padStart(2, '0')}</span>
                                <h3>{step.title}</h3>
                                <p>{step.body}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="help-section help-animate">
                    <h2>방법 2 · 시작 구간까지 담기</h2>
                    <div className="help-step-list">
                        {extensionSteps.map((step, index) => (
                            <article className="help-step" key={step.title}>
                                <span className="help-step-index">{String(index + 1).padStart(2, '0')}</span>
                                <h3>{step.title}</h3>
                                <p>{step.body}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="help-section help-animate">
                    <h2>어디에서 사용할 수 있나요?</h2>
                    <div className="help-platform-grid">
                        <div>
                            <strong>감상</strong>
                            <span>Android, iOS, PC에서 공유 링크를 열어 Topster를 보고 음악을 재생할 수 있습니다.</span>
                        </div>
                        <div>
                            <strong>간편 제작</strong>
                            <span>웹에서 YouTube 또는 YouTube Music 플레이리스트 링크를 가져옵니다.</span>
                        </div>
                        <div>
                            <strong>정밀 제작</strong>
                            <span>Chrome 확장 프로그램을 사용하면 현재 듣고 있는 재생 위치까지 저장할 수 있습니다.</span>
                        </div>
                    </div>
                </section>

                <section className="help-section help-animate">
                    <h2>공유 버튼 선택하기</h2>
                    <div className="help-output-list">
                        {shareOptions.map(([label, description]) => (
                            <div className="help-output-row" key={label}>
                                <strong>{label}</strong>
                                <span>{description}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="help-section help-note help-animate">
                    <h2>지원 범위</h2>
                    <p>
                        Topstertube는 YouTube와 YouTube Music을 동적 Topster로 만드는 작은 도구입니다.
                        다른 스트리밍 서비스를 일반 음악 플레이어처럼 통합하는 대신 Topster 형태와 재생 경험을 유지하는 데 집중합니다.
                    </p>
                    <div className="help-cta-row">
                        <a className="help-secondary-link help-guide-link" href={notionGuideUrl} target="_blank" rel="noopener noreferrer">Notion 가이드 열기</a>
                        <a className="help-secondary-link help-guide-link" href="/privacy">개인정보 처리 안내</a>
                    </div>
                </section>
            </main>
        </>
    );
}
