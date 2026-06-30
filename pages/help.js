import Head from 'next/head';

const steps = [
    {
        title: '1. 확장 프로그램 열기',
        body: 'Chrome에서 TopsterTube 확장 프로그램을 고정해두고, YouTube 또는 YouTube Music에서 원하는 곡을 재생합니다.',
    },
    {
        title: '2. 곡 추가하기',
        body: '원하는 지점에서 확장 프로그램의 현재 탭 추가를 누릅니다. 가능한 경우 현재 재생 시각도 함께 저장됩니다.',
    },
    {
        title: '3. 순서와 레이아웃 정리',
        body: '2x2, 3x3, 4x4, 5x5, Classic 42 중 하나를 고르고, 목록을 드래그해서 순서를 바꿉니다.',
    },
    {
        title: '4. 목적에 맞게 내보내기',
        body: '링크 복사, 이미지 링크, iframe 코드, 이미지 저장 중 필요한 출력만 선택해서 사용합니다.',
    },
];

const outputs = [
    ['링크 복사', '재생 가능한 TopsterTube 페이지 주소를 공유합니다.'],
    ['이미지 링크', '블로그, 게시글, 메신저에 탑스터 PNG 주소만 붙여넣을 때 사용합니다.'],
    ['iframe 복사', '웹페이지 안에 플레이어까지 포함해 임베드할 때 사용합니다.'],
    ['이미지 저장', '탑스터 이미지를 PNG 파일로 내려받습니다.'],
];

export default function Help() {
    return (
        <>
            <Head>
                <title>Topstertube 도움말</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="description" content="Topstertube로 재생 가능한 탑스터를 만드는 방법" />
                <link rel="icon" href="/favicon.ico" />
                <link rel="stylesheet" href="/style.css" />
            </Head>
            <main className="help-page">
                <section className="help-hero">
                    <a className="help-back-link" href="/">Topstertube로 돌아가기</a>
                    <p className="help-kicker">Guide</p>
                    <h1>유튜브 음악으로 재생 가능한 탑스터 만들기</h1>
                    <p>
                        확장 프로그램에서 곡을 모으고, 생성된 링크를 열면 탑스터 화면에서 바로 재생할 수 있습니다.
                    </p>
                </section>

                <section className="help-section">
                    <h2>사용 순서</h2>
                    <div className="help-step-list">
                        {steps.map((step) => (
                            <article className="help-step" key={step.title}>
                                <h3>{step.title}</h3>
                                <p>{step.body}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="help-section">
                    <h2>출력 버튼</h2>
                    <div className="help-output-list">
                        {outputs.map(([label, description]) => (
                            <div className="help-output-row" key={label}>
                                <strong>{label}</strong>
                                <span>{description}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="help-section help-note">
                    <h2>짧은 링크 방식</h2>
                    <p>
                        새로 생성되는 공유 링크는 곡 목록을 `d=` 값 하나에 압축해서 담습니다.
                        이전처럼 `link1`, `link2`가 계속 늘어나는 방식보다 짧고, 기존 링크도 그대로 열 수 있습니다.
                    </p>
                </section>
            </main>
        </>
    );
}
