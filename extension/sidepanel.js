let links = []; // Array of {id, t} or null

document.addEventListener('DOMContentLoaded', async () => {
    const linkList = document.getElementById('link-list');
    const grabTabBtn = document.getElementById('grab-tab-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const generateBtn = document.getElementById('generate-btn');
    const themeSelect = document.getElementById('theme-select');
    const coreUrlInput = document.getElementById('core-url');
    const statusMsg = document.getElementById('status-msg');

    // Load state
    const data = await chrome.storage.local.get(['topsterLinks', 'topsterTheme', 'topsterCoreUrl']);
    if (data.topsterTheme) themeSelect.value = data.topsterTheme;
    if (data.topsterCoreUrl) coreUrlInput.value = data.topsterCoreUrl;

    // Initialize links based on theme
    const requiredSize = getRequiredSize(themeSelect.value);
    links = new Array(requiredSize).fill(null);
    if (data.topsterLinks) {
        data.topsterLinks.forEach((l, i) => {
            if (i < links.length) links[i] = l;
        });
    }

    renderLinks();

    // Listeners
    grabTabBtn.addEventListener('click', grabCurrentTab);
    clearAllBtn.addEventListener('click', () => {
        if (confirm('모든 칸을 비우시겠습니까?')) {
            links = new Array(getRequiredSize(themeSelect.value)).fill(null);
            saveState();
            renderLinks();
        }
    });

    themeSelect.addEventListener('change', () => {
        const newSize = getRequiredSize(themeSelect.value);
        const newLinks = new Array(newSize).fill(null);
        links.forEach((l, i) => {
            if (i < newSize) newLinks[i] = l;
        });
        links = newLinks;
        saveState();
        renderLinks();
    });

    coreUrlInput.addEventListener('input', saveState);
    generateBtn.addEventListener('click', generateCode);

    function getRequiredSize(theme) {
        if (theme === 'classic') return 42;
        const [w, h] = theme.split('x').map(Number);
        return w * h;
    }

    async function grabCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (tab?.url && (tab.url.includes('youtube.com') || tab.url.includes('youtu.be'))) {
                const info = parseYoutubeInput(tab.url);
                if (info) {
                    const firstEmpty = links.findIndex(l => l === null);
                    if (firstEmpty !== -1) {
                        links[firstEmpty] = info;
                        saveState();
                        renderLinks();
                        showStatus('현재 탭 추가 완료!');
                    } else {
                        showStatus('남은 빈 칸이 없습니다.', true);
                    }
                }
            } else {
                showStatus('유튜브 페이지가 아닙니다.', true);
            }
        } catch (e) {
            console.error(e);
            showStatus('탭 정보를 가져오는데 실패했습니다.', true);
        }
    }

    function parseYoutubeInput(input) {
        if (!input) return null;
        let videoId = null;
        let startTime = 0;
        try {
            const url = new URL(input);
            if (url.hostname === 'youtu.be') videoId = url.pathname.slice(1);
            else if (url.hostname.includes('youtube.com')) {
                videoId = url.searchParams.get('v');
                if (!videoId && url.pathname.startsWith('/embed/')) videoId = url.pathname.split('/')[2];
            }
            const t = url.searchParams.get('t') || url.searchParams.get('start');
            if (t) startTime = parseInt(t) || 0;
        } catch (e) {
            if (input.length === 11) videoId = input;
        }
        return videoId ? { id: videoId, t: startTime } : null;
    }

    function renderLinks() {
        linkList.innerHTML = '';
        links.forEach((link, index) => {
            const slot = document.createElement('div');
            slot.className = `link-slot ${link ? 'filled' : ''}`;
            slot.draggable = link !== null;
            slot.dataset.index = index;

            if (link) {
                slot.innerHTML = `
                    <span class="slot-num">${index + 1}</span>
                    <img class="thumb-preview" src="https://i.ytimg.com/vi/${link.id}/hqdefault.jpg">
                    <div class="link-info">
                        <div class="video-id">${link.id}</div>
                        <div class="video-time">${link.t ? link.t + 's' : '0s'}</div>
                    </div>
                    <button class="delete-btn" data-index="${index}">×</button>
                `;
                slot.querySelector('.delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    links[index] = null;
                    saveState();
                    renderLinks();
                });
            } else {
                slot.innerHTML = `
                    <span class="slot-num">${index + 1}</span>
                    <div class="slot-placeholder">+ 클릭하여 링크 추가</div>
                `;
                slot.addEventListener('click', () => {
                    const input = prompt(`${index + 1}번 칸에 넣을 유튜브 링크나 ID를 입력하세요:`);
                    if (input) {
                        const info = parseYoutubeInput(input);
                        if (info) {
                            links[index] = info;
                            saveState();
                            renderLinks();
                        } else {
                            alert('올바른 유튜브 링크가 아닙니다.');
                        }
                    }
                });
            }

            // DnD Events for filled slots
            if (link) {
                slot.addEventListener('dragstart', handleDragStart);
                slot.addEventListener('dragover', handleDragOver);
                slot.addEventListener('drop', handleDrop);
                slot.addEventListener('dragend', handleDragEnd);
            } else {
                // Allow dropping onto empty slots too
                slot.addEventListener('dragover', handleDragOver);
                slot.addEventListener('drop', handleDrop);
            }

            linkList.appendChild(slot);
        });
    }

    let dragSourceIndex = null;

    function handleDragStart(e) {
        dragSourceIndex = this.dataset.index;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDrop(e) {
        e.preventDefault();
        const targetIndex = this.dataset.index;
        if (dragSourceIndex !== null && dragSourceIndex !== targetIndex) {
            const temp = links[targetIndex];
            links[targetIndex] = links[dragSourceIndex];
            links[dragSourceIndex] = temp;
            saveState();
            renderLinks();
        }
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        dragSourceIndex = null;
    }

    function saveState() {
        chrome.storage.local.set({
            topsterLinks: links,
            topsterTheme: themeSelect.value,
            topsterCoreUrl: coreUrlInput.value
        });
    }

    function showStatus(msg, isError = false) {
        statusMsg.textContent = msg;
        statusMsg.style.color = isError ? 'var(--danger-color)' : 'var(--accent-color)';
        setTimeout(() => statusMsg.textContent = '', 2000);
    }

    async function generateCode() {
        const theme = themeSelect.value;
        const baseUrl = coreUrlInput.value.trim();
        let origin = "";
        try {
            origin = new URL(baseUrl).origin;
        } catch (e) {
            showStatus('올바른 플레이어 주소를 입력해주세요.', true);
            return;
        }

        const params = new URLSearchParams();
        if (theme === 'classic') {
            params.append('theme', 'classic');
        } else {
            const [w, h] = theme.split('x').map(Number);
            params.append('w', w);
            params.append('h', h);
        }

        let addedCount = 0;
        links.forEach((link, i) => {
            if (link) {
                let val = link.id;
                if (link.t) val += `?t=${link.t}`;
                params.append(`link${i + 1}`, val);
                addedCount++;
            }
        });

        if (addedCount === 0) {
            showStatus('최소 한 개 이상의 링크를 추가해주세요.', true);
            return;
        }

        const playerUrl = `${baseUrl}?${params.toString()}`;
        const imgUrl = `${origin}/api/topster.png?${params.toString()}`;

        const code = `<a href="${playerUrl}" target="_blank">
  <img src="${imgUrl}" width="100%">
</a>`;

        try {
            await navigator.clipboard.writeText(code);
            showStatus('코드가 복사되었습니다! ✨');
        } catch (err) {
            showStatus('복사 실패', true);
        }
    }
});