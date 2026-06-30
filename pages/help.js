import Head from 'next/head';

const chromeStoreUrl = 'https://chromewebstore.google.com/detail/topstertube-%EC%9E%AC%EC%83%9D-%EA%B0%80%EB%8A%A5%ED%95%9C-%ED%83%91%EC%8A%A4%ED%84%B0/nnhcekoanhgdanobfegpjhdlankamgba';
const notionGuideUrl = 'https://m1nhyeok.notion.site/topstertube';

const steps = [
    {
        title: 'Chrome 확장 프로그램 설치',
        body: '탑스터 제작은 Chrome 확장 프로그램에서만 가능합니다. 먼저 Chrome Web Store에서 Topstertube를 설치합니다.',
    },
    {
        title: 'YouTube에서 곡 추가',
        body: 'YouTube 또는 YouTube Music에서 원하는 곡을 열고, 확장 프로그램의 현재 탭 추가 버튼을 누릅니다.',
    },
    {
        title: '순서와 레이아웃 정리',
        body: '2x2, 3x3, 4x4, 5x5, Classic 42 중 하나를 고르고 드래그로 곡 순서를 정리합니다.',
    },
    {
        title: '목적에 맞게 공유',
        body: '완성 후 링크, 이미지 링크, iframe, 이미지 저장 중 필요한 방식만 골라 사용합니다.',
    },
];

const shareOptions = [
    ['iframe 복사', 'iframe을 넣을 수 있는 커뮤니티, 블로그, 개인 페이지에 재생 가능한 탑스터를 넣을 때 사용합니다.'],
    ['링크 복사', '카카오톡, X, 인스타 스토리 등에서 재생 가능한 탑스터 페이지를 공유할 때 사용합니다.'],
    ['이미지 저장', '인스타 스토리나 게시글처럼 이미지 파일이 필요한 곳에 올릴 때 사용합니다.'],
    ['이미지 링크', '이미지 주소를 바로 붙여넣을 수 있는 게시판, 문서, 메신저에서 사용합니다.'],
];

export default function Help() {
    return (
        <>
            <Head>
                <title>Topstertube 도움말</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="description" content="Topstertube는 사용자의 어떠한 개인정보도 수집하지 않습니다." />
                <link rel="icon" href="/favicon.ico" />
                <link rel="stylesheet" href="/style.css" />
            </Head>
            <main className="help-page">
                <section className="help-hero help-animate">
                    <p className="help-kicker">Privacy Policy</p>
                    <h1>Topstertube는 사용자의 어떠한 개인정보도 수집하지 않습니다.</h1>
                    <p>
                        Topstertube는 별도의 계정, 로그인, 분석 도구, 개인 식별 정보를 사용하지 않습니다.
                        사용자가 만든 탑스터 정보는 공유 링크 안에 담기며, 서비스가 별도로 저장하지 않습니다.
                    </p>
                    <div className="help-cta-row">
                        <a className="help-primary-link" href={chromeStoreUrl} target="_blank" rel="noopener noreferrer">
                            Chrome 확장 프로그램 설치
                        </a>
                        <a className="help-secondary-link" href={notionGuideUrl} target="_blank" rel="noopener noreferrer">
                            자세한 사용법 보기
                        </a>
                    </div>
                </section>

                <section className="help-section help-animate">
                    <p className="help-kicker">Version 1.1</p>
                    <h2>v1.1 업데이트</h2>
                    <div className="help-update-box">
                        <p>공유 방식이 목적별 버튼으로 나뉘었습니다.</p>
                        <p>이제 iframe, 링크, 이미지 링크, 이미지 저장을 상황에 맞게 바로 선택할 수 있습니다.</p>
                    </div>
                </section>

                <section className="help-section help-animate">
                    <h2>만드는 방법</h2>
                    <div className="help-step-list">
                        {steps.map((step, index) => (
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
                            <strong>플레이리스트 감상</strong>
                            <span>Android, iOS, PC에서 링크를 열어 감상할 수 있습니다.</span>
                        </div>
                        <div>
                            <strong>플레이리스트 제작</strong>
                            <span>Chrome 확장 프로그램을 통해서만 만들 수 있습니다.</span>
                        </div>
                        <div>
                            <strong>지원 서비스</strong>
                            <span>YouTube와 YouTube Music만 지원합니다.</span>
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
                    <h2>더 자세한 사용법</h2>
                    <p>
                        확장 프로그램 설치 후 곡을 추가하고 공유하는 자세한 과정은 기존 Notion 가이드를 참고하세요.
                    </p>
                    <a className="help-secondary-link help-guide-link" href={notionGuideUrl} target="_blank" rel="noopener noreferrer">
                        Notion 가이드 열기
                    </a>
                </section>
            </main>
        </>
    );
}
