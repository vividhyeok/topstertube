const YT_API_TIMEOUT_MS = 12000;
let ytApiPromise = null;
export function loadYouTubeApi() {
    if (typeof window === 'undefined') return Promise.reject(new Error('YouTube API is only available in the browser'));
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (ytApiPromise) return ytApiPromise;

    ytApiPromise = new Promise((resolve, reject) => {
        let settled = false;
        let pollTimer = null;
        let timeoutTimer = null;
        const previousReady = window.onYouTubeIframeAPIReady;
        let script = null;

        const cleanup = () => {
            if (pollTimer) clearInterval(pollTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
        };

        const succeed = () => {
            if (settled || !window.YT?.Player) return;
            settled = true;
            cleanup();
            resolve(window.YT);
        };

        const fail = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (!window.YT?.Player && script?.parentNode) script.parentNode.removeChild(script);
            reject(error instanceof Error ? error : new Error('YouTube API load failed'));
        };

        window.onYouTubeIframeAPIReady = () => {
            try {
                if (typeof previousReady === 'function') previousReady();
            } finally {
                succeed();
            }
        };

        script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
        if (!script) {
            script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            document.head.appendChild(script);
        }
        script.addEventListener('error', () => fail(new Error('YouTube API network error')), { once: true });

        pollTimer = setInterval(succeed, 100);
        timeoutTimer = setTimeout(() => fail(new Error('YouTube API load timeout')), YT_API_TIMEOUT_MS);
    }).catch((error) => {
        ytApiPromise = null;
        throw error;
    });

    return ytApiPromise;
}


const METADATA_TIMEOUT_MS = 5000;
function cleanTopicSuffix(value) {
    return String(value || '').replace(' - Topic', '');
}

export async function fetchTrackMetadata(videoId, externalSignal) {
    if (externalSignal?.aborted) return { title: videoId, author: '' };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
    const abortFromParent = () => controller.abort();
    if (externalSignal) externalSignal.addEventListener('abort', abortFromParent, { once: true });

    try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
        const data = await response.json();

        return {
            title: data?.title ? cleanTopicSuffix(data.title) : videoId,
            author: data?.author_name ? cleanTopicSuffix(data.author_name) : '',
        };
    } catch (error) {
        return { title: videoId, author: '' };
    } finally {
        clearTimeout(timeout);
        if (externalSignal) externalSignal.removeEventListener('abort', abortFromParent);
    }
}

