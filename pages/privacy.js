import Head from 'next/head';

const privacyRows = [
    [
        '자체 저장',
        'Topstertube는 계정을 요구하지 않으며, 개인을 식별하기 위한 정보를 자체 데이터베이스에 수집하거나 저장하지 않습니다.',
    ],
    [
        '공유 URL',
        '사용자가 선택한 YouTube 영상 ID와 재생 시점은 공유 URL에 포함됩니다. 링크를 공유하면 해당 정보를 받은 사람이 볼 수 있습니다.',
    ],
    [
        '확장 프로그램',
        '확장 프로그램에서 추가한 곡 목록과 설정은 사용자의 브라우저 로컬 저장소에 저장됩니다.',
    ],
    [
        '외부 통신',
        '재생, 썸네일 표시, 영상 정보 조회 및 이미지 생성을 위해 YouTube, noembed, 이미지 생성 API 및 호스팅 제공자의 서버와 통신할 수 있습니다.',
    ],
];

export default function Privacy() {
    return (
        <>
            <Head>
                <title>Topstertube 개인정보 처리 안내</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="description" content="Topstertube의 데이터 처리 방식 안내" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main className="help-page">
                <section className="help-hero help-animate">
                    <p className="help-kicker">Privacy</p>
                    <h1>Topstertube 개인정보 처리 안내</h1>
                    <p>
                        Topstertube는 로그인이나 자체 계정 시스템 없이 작동합니다.
                        다만 공유와 재생 기능을 제공하기 위해 사용자가 선택한 YouTube 영상 정보와 외부 서비스 통신이 사용됩니다.
                    </p>
                    <div className="help-cta-row">
                        <a className="help-primary-link" href="/help">
                            사용법 보기
                        </a>
                        <a className="help-secondary-link" href="/">
                            Topstertube 열기
                        </a>
                    </div>
                </section>

                <section className="help-section help-animate">
                    <h2>처리 방식</h2>
                    <div className="help-output-list">
                        {privacyRows.map(([label, description]) => (
                            <div className="help-output-row" key={label}>
                                <strong>{label}</strong>
                                <span>{description}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="help-section help-note help-animate">
                    <h2>운영 참고</h2>
                    <p>
                        브라우저, YouTube, noembed, Vercel 등 외부 서비스는 요청 처리 과정에서 IP 주소, User-Agent, 요청 URL 같은 일반적인 네트워크 정보를 처리할 수 있습니다.
                    </p>
                </section>
            </main>
        </>
    );
}
