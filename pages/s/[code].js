import Home from '../index';
import { readShortLink, validCode } from '../../lib/shortLinks';

export default function SharedTopster({ payload, unavailable }) {
    if (unavailable) return <main className="error-page"><h1>잠시 연결할 수 없어요</h1><p>저장소 연결을 확인하고 있습니다. 잠시 후 다시 열어주세요.</p><a href="">다시 시도</a> · <a href="/">홈으로</a></main>;
    return <Home initialPayload={payload} />;
}

export async function getServerSideProps({ params, res }) {
    if (!validCode(params.code)) return { notFound: true };
    try {
        const payload = await readShortLink(params.code);
        if (!payload) return { notFound: true };
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return { props: { payload } };
    } catch {
        res.statusCode = 503;
        res.setHeader('Cache-Control', 'no-store');
        return { props: { unavailable: true } };
    }
}
