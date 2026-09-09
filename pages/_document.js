import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
    return (
        <Html lang="ko">
            <Head>
                <link rel="stylesheet" href="/style.css" />
                <link rel="stylesheet" href="/enhancements.css" />
            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
