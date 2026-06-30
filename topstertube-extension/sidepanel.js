const MAX_TOPSTER_SLOTS = 42;
let links = [];

document.addEventListener('DOMContentLoaded', async () => {
    const linkList = document.getElementById('link-list');
    const grabTabBtn = document.getElementById('grab-tab-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const copyPlayerBtn = document.getElementById('copy-player-btn');
    const copyImageBtn = document.getElementById('copy-image-btn');
    const copyHtmlBtn = document.getElementById('copy-html-btn');
    const downloadImageBtn = document.getElementById('download-image-btn');
    const previewBtn = document.getElementById('preview-btn');
    const themeSelect = document.getElementById('theme-select');
    const coreUrlInput = document.getElementById('core-url');
    const statusMsg = document.getElementById('status-msg');
    let statusTimer = null;
    let dragSourceIndex = null;

    let data = {};
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        data = await chrome.storage.local.get(['topsterLinks', 'topsterTheme', 'topsterCoreUrl']);
    }

    if (data.topsterTheme) themeSelect.value = data.topsterTheme;
    if (data.topsterCoreUrl) coreUrlInput.value = data.topsterCoreUrl;

    links = new Array(MAX_TOPSTER_SLOTS).fill(null);
    if (Array.isArray(data.topsterLinks)) {
        data.topsterLinks.forEach((link, index) => {
            if (index < MAX_TOPSTER_SLOTS) links[index] = link;
        });
    }

    renderLinks();

    grabTabBtn.addEventListener('click', grabCurrentTab);
    clearAllBtn.addEventListener('click', clearAll);
    themeSelect.addEventListener('change', resizeSlots);
    coreUrlInput.addEventListener('input', saveState);
    copyPlayerBtn.addEventListener('click', () => copyOutput('player'));
    copyImageBtn.addEventListener('click', () => copyOutput('image'));
    copyHtmlBtn.addEventListener('click', () => copyOutput('html'));
    downloadImageBtn.addEventListener('click', downloadImage);
    previewBtn.addEventListener('click', openPreview);

    function getRequiredSize(theme) {
        return window.TopsterPayload.getRequiredSize(theme);
    }

    function getVisibleLinks() {
        return links.slice(0, getRequiredSize(themeSelect.value));
    }

    function formatTime(seconds) {
        const total = Math.max(0, parseInt(seconds, 10) || 0);
        if (total === 0) return '처음부터';

        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = (value) => String(value).padStart(2, '0');

        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    function clearAll() {
        if (!confirm('모든 칸을 비우시겠습니까?')) return;

        links = new Array(MAX_TOPSTER_SLOTS).fill(null);
        saveState();
        renderLinks();
        showStatus('초기화 완료');
    }

    function resizeSlots() {
        const visibleCount = getRequiredSize(themeSelect.value);
        const hiddenCount = links.slice(visibleCount).filter(Boolean).length;

        saveState();
        renderLinks();

        if (hiddenCount > 0) {
            showStatus(`숨겨진 곡 ${hiddenCount}개 보존됨`);
        }
    }

    async function fetchMetadata(videoId) {
        try {
            const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            const json = await response.json();
            if (json.title) return json.title.replace(' - Topic', '');
        } catch (error) {
            // Metadata is a convenience only.
        }

        return videoId;
    }

    async function grabCurrentTab() {
        if (typeof chrome === 'undefined' || !chrome.tabs) {
            showStatus('확장 프로그램 환경이 아닙니다.', true);
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.url || !isYoutubeUrl(tab.url)) {
                showStatus('유튜브 페이지가 아닙니다.', true);
                return;
            }

            const info = parseYoutubeInput(tab.url);
            if (!info) {
                showStatus('영상 정보를 찾을 수 없습니다.', true);
                return;
            }

            const currentTime = await readCurrentVideoTime(tab.id);
            if (Number.isFinite(currentTime) && currentTime > 0) {
                info.t = currentTime;
            }

            const visibleCount = getRequiredSize(themeSelect.value);
            const firstEmpty = links.slice(0, visibleCount).findIndex((link) => link === null);
            if (firstEmpty === -1) {
                showStatus('빈 칸이 없습니다.', true);
                return;
            }

            const title = await fetchMetadata(info.id);
            links[firstEmpty] = { ...info, title };
            saveState();
            renderLinks();
            showStatus('현재 탭 추가 완료');
        } catch (error) {
            console.error(error);
            showStatus('탭 정보 가져오기 실패', true);
        }
    }

    async function readCurrentVideoTime(tabId) {
        if (!tabId || !chrome.scripting?.executeScript) return null;

        try {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const videos = Array.from(document.querySelectorAll('video'));
                    const video = videos.find((item) => !item.paused && item.duration) || videos[0];
                    return video ? Math.floor(video.currentTime || 0) : 0;
                },
            });

            return Math.max(0, parseInt(result?.result, 10) || 0);
        } catch (error) {
            return null;
        }
    }

    function isYoutubeUrl(input) {
        try {
            const url = new URL(input);
            return url.hostname === 'youtu.be' || url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com');
        } catch (error) {
            return false;
        }
    }

    function parseYoutubeInput(input) {
        if (!input) return null;

        const value = input.trim();
        let videoId = null;
        let startTime = 0;

        if (/^[A-Za-z0-9_-]{11}$/.test(value)) {
            return { id: value, t: 0 };
        }

        try {
            const url = new URL(value);

            if (url.hostname === 'youtu.be') {
                videoId = url.pathname.split('/').filter(Boolean)[0];
            } else if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
                videoId = url.searchParams.get('v');

                if (!videoId) {
                    const [, kind, id] = url.pathname.split('/');
                    if (['embed', 'shorts', 'live'].includes(kind)) videoId = id;
                }
            }

            startTime = parseTimeValue(url.searchParams.get('t') || url.searchParams.get('start'));
        } catch (error) {
            return null;
        }

        return /^[A-Za-z0-9_-]{11}$/.test(videoId || '') ? { id: videoId, t: startTime } : null;
    }

    function parseTimeValue(value) {
        if (!value) return 0;
        const text = String(value).trim().toLowerCase();

        if (/^\d+$/.test(text)) return parseInt(text, 10);
        if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(text)) {
            return text.split(':').reduce((total, part) => total * 60 + parseInt(part, 10), 0);
        }

        const match = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/.exec(text);
        if (!match) return 0;

        return (parseInt(match[1], 10) || 0) * 3600
            + (parseInt(match[2], 10) || 0) * 60
            + (parseInt(match[3], 10) || 0);
    }

    function renderLinks() {
        linkList.textContent = '';
        const visibleLinks = getVisibleLinks();

        visibleLinks.forEach((link, index) => {
            const slot = document.createElement('div');
            slot.className = `link-slot${link ? ' filled' : ''}`;
            slot.draggable = Boolean(link);
            slot.dataset.index = index;

            const slotNum = document.createElement('span');
            slotNum.className = 'slot-num';
            slotNum.textContent = String(index + 1);
            slot.appendChild(slotNum);

            if (link) renderFilledSlot(slot, link, index);
            else renderEmptySlot(slot, index);

            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('drop', handleDrop);
            if (link) {
                slot.addEventListener('dragstart', handleDragStart);
                slot.addEventListener('dragend', handleDragEnd);
            }

            linkList.appendChild(slot);
        });
    }

    function renderFilledSlot(slot, link, index) {
        const image = document.createElement('img');
        image.className = 'thumb-preview';
        image.alt = '';
        image.src = `https://i.ytimg.com/vi/${link.id}/mqdefault.jpg`;
        image.onerror = () => {
            image.onerror = null;
            image.src = `https://i.ytimg.com/vi/${link.id}/hqdefault.jpg`;
        };

        const info = document.createElement('div');
        info.className = 'link-info';

        const title = document.createElement('div');
        title.className = 'video-id';
        title.textContent = link.title || link.id;

        const time = document.createElement('div');
        time.className = 'video-time';
        time.textContent = formatTime(link.t);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.type = 'button';
        deleteButton.dataset.index = index;
        deleteButton.textContent = '×';
        deleteButton.title = '삭제';
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            links[index] = null;
            saveState();
            renderLinks();
        });

        info.append(title, time);
        slot.append(image, info, deleteButton);
    }

    function renderEmptySlot(slot, index) {
        const placeholder = document.createElement('div');
        placeholder.className = 'slot-placeholder';
        placeholder.textContent = '+ 클릭하여 추가';
        slot.appendChild(placeholder);

        slot.addEventListener('click', () => showSlotInput(slot, index));
    }

    function showSlotInput(slot, index) {
        if (slot.querySelector('.slot-inline-form')) return;

        const placeholder = slot.querySelector('.slot-placeholder');
        if (placeholder) placeholder.remove();

        const form = document.createElement('form');
        form.className = 'slot-inline-form';

        const input = document.createElement('input');
        input.className = 'slot-input';
        input.type = 'text';
        input.placeholder = 'YouTube 링크 붙여넣기';
        input.autocomplete = 'off';

        const addButton = document.createElement('button');
        addButton.className = 'slot-add-btn';
        addButton.type = 'submit';
        addButton.textContent = '추가';

        const cancelButton = document.createElement('button');
        cancelButton.className = 'slot-cancel-btn';
        cancelButton.type = 'button';
        cancelButton.textContent = '취소';

        form.append(input, addButton, cancelButton);
        form.addEventListener('click', (event) => event.stopPropagation());
        cancelButton.addEventListener('click', () => renderLinks());

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const info = parseYoutubeInput(input.value);
            if (!info) {
                showStatus('올바른 유튜브 링크가 아닙니다.', true);
                input.focus();
                return;
            }

            addButton.disabled = true;
            const title = await fetchMetadata(info.id);
            links[index] = { ...info, title };
            saveState();
            renderLinks();
            showStatus('곡 추가 완료');
        });

        slot.appendChild(form);
        input.focus();
    }

    function handleDragStart(event) {
        dragSourceIndex = parseInt(this.dataset.index, 10);
        this.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    function handleDrop(event) {
        event.preventDefault();
        if (!Number.isInteger(dragSourceIndex)) return;

        const targetIndex = parseInt(this.dataset.index, 10);
        if (dragSourceIndex === targetIndex) return;

        const visibleCount = getRequiredSize(themeSelect.value);
        const visibleLinks = links.slice(0, visibleCount);
        const hiddenLinks = links.slice(visibleCount);
        const [itemToMove] = visibleLinks.splice(dragSourceIndex, 1);
        visibleLinks.splice(targetIndex, 0, itemToMove);
        links = visibleLinks.concat(hiddenLinks).slice(0, MAX_TOPSTER_SLOTS);

        saveState();
        renderLinks();
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        dragSourceIndex = null;
    }

    function saveState() {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.set({
                topsterLinks: links,
                topsterTheme: themeSelect.value,
                topsterCoreUrl: coreUrlInput.value,
            });
        }
    }

    function buildOutputs() {
        const visibleLinks = getVisibleLinks();
        const addedCount = visibleLinks.filter(Boolean).length;
        if (addedCount === 0) {
            throw new Error('링크 없음');
        }

        const baseUrl = (coreUrlInput.value.trim() || 'https://topstertube.vercel.app/').replace(/\/+$/, '');
        const origin = new URL(baseUrl).origin;
        const params = new URLSearchParams({
            d: window.TopsterPayload.encode({ links: visibleLinks, themeValue: themeSelect.value }),
        });

        const playerUrl = `${baseUrl}?${params.toString()}`;
        const imageUrl = `${origin}/api/topster.png?${params.toString()}&ext=.png`;
        const html = `<iframe src="${playerUrl}" title="Topstertube" width="100%" height="720" style="border:0;" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;

        return { playerUrl, imageUrl, html };
    }

    function openPreview() {
        let outputs;
        try {
            outputs = buildOutputs();
        } catch (error) {
            showStatus('링크 없음', true);
            return;
        }

        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            chrome.tabs.create({ url: outputs.playerUrl });
        } else {
            window.open(outputs.playerUrl, '_blank', 'noopener,noreferrer');
        }

        showStatus('미리보기 열림');
    }

    async function copyOutput(type) {
        try {
            const outputs = buildOutputs();
            const value = type === 'player' ? outputs.playerUrl : type === 'image' ? outputs.imageUrl : outputs.html;
            await navigator.clipboard.writeText(value);

            const labels = {
                player: '링크 복사 완료',
                image: '이미지 링크 복사 완료',
                html: 'iframe 복사 완료',
            };
            showStatus(labels[type]);
        } catch (error) {
            showStatus(error.message === '링크 없음' ? '링크 없음' : '복사 실패', true);
        }
    }

    function downloadImage() {
        let outputs;
        try {
            outputs = buildOutputs();
        } catch (error) {
            showStatus('링크 없음', true);
            return;
        }

        const filename = `topstertube-${new Date().toISOString().slice(0, 10)}.png`;

        if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
            chrome.downloads.download({ url: outputs.imageUrl, filename, saveAs: true }, () => {
                if (chrome.runtime.lastError) {
                    showStatus('이미지 저장 실패', true);
                    return;
                }
                showStatus('이미지 저장 시작');
            });
            return;
        }

        const link = document.createElement('a');
        link.href = outputs.imageUrl;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
        showStatus('이미지 열기 완료');
    }

    function showStatus(message, isError = false) {
        clearTimeout(statusTimer);
        statusMsg.textContent = message;
        statusMsg.style.color = isError ? '#ff4444' : '#ffffff';
        statusTimer = setTimeout(() => {
            statusMsg.textContent = '';
        }, 2200);
    }
});
