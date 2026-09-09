(() => {
    'use strict';

    const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
    const IMPORT_TIMEOUT_MS = 15000;
    const YT_API_TIMEOUT_MS = 12000;
    let ytApiPromise = null;

    function parsePlaylistId(input) {
        try {
            const url = new URL(String(input || '').trim());
            const hostname = url.hostname.toLowerCase();
            const isYoutube = hostname === 'youtube.com'
                || hostname.endsWith('.youtube.com')
                || hostname === 'youtu.be';
            if (!isYoutube) return null;

            const playlistId = url.searchParams.get('list');
            if (!playlistId || !/^[A-Za-z0-9_-]{10,}$/.test(playlistId)) return null;
            return playlistId;
        } catch (error) {
            return null;
        }
    }

    function getLayout(value) {
        if (value === 'classic') {
            return { token: 'c', total: 42 };
        }

        const match = /^(2|3|4|5)x\1$/.exec(value || '');
        const size = match ? parseInt(match[1], 10) : 3;
        return { token: `g${size}x${size}`, total: size * size };
    }

    function encodePayload(videoIds, layoutValue) {
        const layout = getLayout(layoutValue);
        const selected = videoIds.slice(0, layout.total);
        return {
            payload: `v1:${layout.token}:${selected.join('.')}`,
            selectedCount: selected.length,
            totalCount: videoIds.length,
            capacity: layout.total,
        };
    }

    function buildOutputs(payload) {
        const origin = window.location.origin;
        const encoded = encodeURIComponent(payload);
        const playerUrl = `${origin}/?d=${encoded}`;
        const imageUrl = `${origin}/api/topster.png?d=${encoded}&ext=.png`;
        const html = `<a href="${escapeHtmlAttribute(playerUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtmlAttribute(imageUrl)}" alt="Topstertube" style="max-width:100%;height:auto;" /></a>`;
        return { playerUrl, imageUrl, html };
    }

    function escapeHtmlAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function loadYouTubeApi() {
        if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
        if (ytApiPromise) return ytApiPromise;

        ytApiPromise = new Promise((resolve, reject) => {
            let settled = false;
            let pollTimer = null;
            let timeoutTimer = null;
            const previousReady = window.onYouTubeIframeAPIReady;

            const cleanup = () => {
                if (pollTimer) clearInterval(pollTimer);
                if (timeoutTimer) clearTimeout(timeoutTimer);
            };

            const succeed = () => {
                if (settled || !window.YT || !window.YT.Player) return;
                settled = true;
                cleanup();
                resolve(window.YT);
            };

            const fail = () => {
                if (settled) return;
                settled = true;
                cleanup();
                ytApiPromise = null;
                reject(new Error('YouTube 플레이어를 불러오지 못했습니다.'));
            };

            window.onYouTubeIframeAPIReady = () => {
                try {
                    if (typeof previousReady === 'function') previousReady();
                } finally {
                    succeed();
                }
            };

            let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
            if (!script) {
                script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.async = true;
                script.addEventListener('error', fail, { once: true });
                document.head.appendChild(script);
            }

            pollTimer = window.setInterval(succeed, 100);
            timeoutTimer = window.setTimeout(fail, YT_API_TIMEOUT_MS);
        });

        return ytApiPromise;
    }

    function createHelper(form) {
        removeHelper(form);
        const wrap = document.createElement('div');
        wrap.className = 'playlist-helper-wrap web-playlist-helper';
        wrap.setAttribute('aria-label', 'YouTube 플레이리스트 불러오기');

        const slot = document.createElement('div');
        slot.className = 'playlist-helper-player';
        wrap.appendChild(slot);
        form.appendChild(wrap);
        return { wrap, slot };
    }

    function removeHelper(form) {
        const existing = form.querySelector('.web-playlist-helper');
        if (existing) existing.remove();
    }

    function readPlaylist(YT, slot, playlistId) {
        return new Promise((resolve, reject) => {
            let player = null;
            let settled = false;
            let pollTimer = null;
            let timeoutTimer = null;

            const cleanup = () => {
                if (pollTimer) clearInterval(pollTimer);
                if (timeoutTimer) clearTimeout(timeoutTimer);
                if (player && typeof player.destroy === 'function') {
                    try { player.destroy(); } catch (error) { /* noop */ }
                }
            };

            const finish = (value, error) => {
                if (settled) return;
                settled = true;
                cleanup();
                if (error) reject(error);
                else resolve(value);
            };

            const host = document.createElement('div');
            slot.textContent = '';
            slot.appendChild(host);

            try {
                player = new YT.Player(host, {
                    width: '240',
                    height: '240',
                    playerVars: { playsinline: 1 },
                    events: {
                        onReady: (event) => {
                            try {
                                event.target.cuePlaylist({
                                    listType: 'playlist',
                                    list: playlistId,
                                    index: 0,
                                    startSeconds: 0,
                                });
                            } catch (error) {
                                finish(null, new Error('플레이리스트를 불러올 수 없습니다.'));
                            }
                        },
                        onError: () => {
                            finish(null, new Error('플레이리스트를 불러올 수 없습니다. 공개 또는 링크 공개 상태인지 확인해주세요.'));
                        },
                    },
                });
            } catch (error) {
                finish(null, new Error('YouTube 플레이어를 만들 수 없습니다.'));
                return;
            }

            const read = () => {
                if (!player || typeof player.getPlaylist !== 'function') return;
                try {
                    const ids = player.getPlaylist();
                    const validIds = Array.isArray(ids)
                        ? ids.map((id) => String(id || '')).filter((id) => VIDEO_ID_PATTERN.test(id))
                        : [];
                    if (validIds.length > 0) finish(validIds, null);
                } catch (error) {
                    // Playlist has not finished cueing yet.
                }
            };

            pollTimer = window.setInterval(read, 250);
            timeoutTimer = window.setTimeout(() => {
                finish(null, new Error('플레이리스트를 불러오지 못했습니다. 공개 또는 링크 공개 상태인지 확인해주세요.'));
            }, IMPORT_TIMEOUT_MS);
        });
    }

    function ensureStatus(form) {
        let status = form.querySelector('.web-import-status');
        if (!status) {
            status = document.createElement('p');
            status.className = 'playlist-import-status web-import-status';
            status.setAttribute('role', 'status');
            form.appendChild(status);
        }
        return status;
    }

    function setFormBusy(form, busy) {
        form.querySelectorAll('input, select, button').forEach((element) => {
            element.disabled = busy;
        });
        const submit = form.querySelector('.playlist-import-button');
        if (submit) submit.textContent = busy ? '불러오는 중...' : 'Topster 만들기';
    }

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const succeeded = document.execCommand('copy');
        textarea.remove();
        if (!succeeded) throw new Error('copy failed');
    }

    function flashButton(button, message) {
        const original = button.dataset.originalLabel || button.textContent;
        button.dataset.originalLabel = original;
        button.textContent = message;
        window.setTimeout(() => {
            if (button.isConnected) button.textContent = original;
        }, 1600);
    }

    async function downloadImage(imageUrl) {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('image download failed');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `topstertube-${new Date().toISOString().slice(0, 10)}.png`;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    }

    function removeResult() {
        const existing = document.querySelector('.web-topster-result');
        if (existing) existing.remove();
    }

    function renderResult(form, outputs, meta) {
        removeResult();

        const panel = document.createElement('section');
        panel.className = 'web-topster-result';

        const title = document.createElement('div');
        title.className = 'web-topster-result-heading';
        title.textContent = '탑스터 생성 완료';

        const summary = document.createElement('p');
        summary.className = 'web-topster-result-summary';
        if (meta.totalCount > meta.capacity) {
            summary.textContent = `${meta.totalCount}곡 중 앞의 ${meta.selectedCount}곡으로 만들었습니다.`;
        } else {
            summary.textContent = `${meta.selectedCount}곡으로 만들었습니다.`;
        }

        const label = document.createElement('label');
        label.className = 'web-topster-result-label';
        label.textContent = '재생 가능한 탑스터 링크';

        const linkInput = document.createElement('input');
        linkInput.className = 'web-topster-result-link';
        linkInput.type = 'text';
        linkInput.readOnly = true;
        linkInput.value = outputs.playerUrl;
        linkInput.addEventListener('click', () => linkInput.select());

        const actions = document.createElement('div');
        actions.className = 'web-topster-result-actions';

        const listen = document.createElement('a');
        listen.className = 'web-output-primary';
        listen.href = outputs.playerUrl;
        listen.target = '_blank';
        listen.rel = 'noopener noreferrer';
        listen.textContent = '탑스터 바로 듣기';

        const actionDefinitions = [
            ['링크 복사', async (button) => {
                await copyText(outputs.playerUrl);
                flashButton(button, '복사 완료');
            }],
            ['이미지 저장', async (button) => {
                try {
                    await downloadImage(outputs.imageUrl);
                    flashButton(button, '저장 시작');
                } catch (error) {
                    window.open(outputs.imageUrl, '_blank', 'noopener,noreferrer');
                    flashButton(button, '이미지 열림');
                }
            }],
            ['이미지 링크', async (button) => {
                await copyText(outputs.imageUrl);
                flashButton(button, '복사 완료');
            }],
            ['HTML 복사', async (button) => {
                await copyText(outputs.html);
                flashButton(button, '복사 완료');
            }],
        ];

        actions.appendChild(listen);
        actionDefinitions.forEach(([labelText, handler]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'web-output-secondary';
            button.textContent = labelText;
            button.addEventListener('click', async () => {
                button.disabled = true;
                try {
                    await handler(button);
                } catch (error) {
                    flashButton(button, '실패');
                } finally {
                    button.disabled = false;
                }
            });
            actions.appendChild(button);
        });

        const htmlNote = document.createElement('p');
        htmlNote.className = 'web-topster-result-note';
        htmlNote.textContent = 'HTML 복사는 탑스터 이미지를 표시하고, 이미지를 누르면 재생 페이지로 이동하는 <a><img></a> 형식입니다.';

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'web-output-reset';
        reset.textContent = '다시 만들기';
        reset.addEventListener('click', () => {
            panel.remove();
            setFormBusy(form, false);
            const urlInput = form.querySelector('#playlist-url');
            if (urlInput) urlInput.focus();
        });

        panel.append(title, summary, label, linkInput, actions, htmlNote, reset);
        form.insertAdjacentElement('afterend', panel);
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function handleSubmit(form) {
        const status = ensureStatus(form);
        const urlInput = form.querySelector('#playlist-url');
        const layoutSelect = form.querySelector('#playlist-layout');
        const playlistId = parsePlaylistId(urlInput ? urlInput.value : '');

        if (!playlistId) {
            status.textContent = '올바른 YouTube 플레이리스트 링크를 입력해주세요.';
            return;
        }

        removeResult();
        setFormBusy(form, true);
        status.textContent = '플레이리스트를 불러오는 중입니다.';
        const helper = createHelper(form);

        try {
            const YT = await loadYouTubeApi();
            const videoIds = await readPlaylist(YT, helper.slot, playlistId);
            if (!videoIds.length) throw new Error('플레이리스트에 가져올 수 있는 영상이 없습니다.');

            const encoded = encodePayload(videoIds, layoutSelect ? layoutSelect.value : '3x3');
            const outputs = buildOutputs(encoded.payload);
            status.textContent = '탑스터를 만들었습니다. 아래에서 공유 방식을 선택하세요.';
            removeHelper(form);
            renderResult(form, outputs, encoded);
        } catch (error) {
            removeHelper(form);
            setFormBusy(form, false);
            status.textContent = error && error.message
                ? error.message
                : '플레이리스트를 불러오지 못했습니다.';
        }
    }

    document.addEventListener('submit', (event) => {
        const form = event.target && event.target.closest
            ? event.target.closest('.playlist-import-form')
            : null;
        if (!form) return;

        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        handleSubmit(form);
    }, true);
})();
