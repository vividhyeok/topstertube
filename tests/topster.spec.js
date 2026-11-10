const { test, expect } = require('@playwright/test');
const payload = 'v1:g3x3:dQw4w9WgXcQ~1q.jfKfPfyJRdk';

test.beforeEach(async ({ page }) => {
    await page.route('https://noembed.com/**', route => {
        const id = new URL(new URL(route.request().url()).searchParams.get('url')).searchParams.get('v');
        return route.fulfill({ json: { title: id, author_name: 'Test artist' } });
    });
});

test('edit, reorder, undo, restore draft and retain start time in player', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('YouTube 링크').fill('https://youtu.be/dQw4w9WgXcQ?t=1m2s\nhttps://music.youtube.com/watch?v=jfKfPfyJRdk');
    await page.getByRole('button', { name: '+ 음악 추가', exact: true }).click();
    await expect(page.getByLabel('1번 곡 시작 시간 (초)')).toHaveValue('62');
    await page.getByRole('button', { name: '2번 곡 위로', exact: true }).click();
    await expect(page.locator('.edit-tracks li').first()).toContainText('jfKfPfyJRdk');
    await page.getByRole('button', { name: '실행 취소', exact: true }).click();
    await page.reload();
    await expect(page.locator('.edit-tracks li')).toHaveCount(2);
    await expect(page.getByLabel('1번 곡 시작 시간 (초)')).toHaveValue('62');
    await page.getByRole('link', { name: '내 탑스터 재생하기' }).click();
    await expect(page.locator('#track-list li a')).toHaveCount(2);
    expect(new URL(page.url()).searchParams.get('d')).toBe(payload);
    await page.getByRole('link', { name: '편집', exact: true }).click();
    await expect(page.getByLabel('1번 곡 시작 시간 (초)')).toHaveValue('62');
    await expect(page.getByRole('heading', { name: '내 탑스터 만들기' })).toBeVisible();
});

test('share errors remain actionable and changing content invalidates short link', async ({ page }) => {
    await page.route('**/api/shorten', route => route.fulfill({ status: 200, json: { path: '/s/abcdefghijklmnop' } }));
    await page.goto('/?edit=1&d=' + encodeURIComponent(payload));
    await page.getByRole('button', { name: '단축 주소 만들기', exact: true }).click();
    await expect(page.getByLabel('NFC용 단축 주소')).toHaveValue(/\/s\/abcdefghijklmnop$/);
    await page.getByLabel('1번 곡 시작 시간 (초)').fill('12');
    await expect(page.getByLabel('원본 공유 주소')).toHaveValue(/d=/);
    await page.route('**/api/shorten', route => route.fulfill({ status: 503, json: { error: '저장소 연결 오류' } }));
    await page.getByRole('button', { name: '단축 주소 만들기', exact: true }).click();
    await expect(page.getByText('저장소 연결 오류', { exact: true })).toBeVisible();
    await expect(page.getByLabel('원본 공유 주소')).toBeVisible();
});

test('legacy links, classic layout, mobile overflow and keyboard cover navigation', async ({ page }) => {
    await page.goto('/?theme=classic&link1=dQw4w9WgXcQ%3Ft%3D62&link42=jfKfPfyJRdk');
    await expect(page.locator('.grid-item')).toHaveCount(42);
    await expect(page.locator('#track-list li a')).toHaveCount(2);
    await expect(page.getByRole('button', { name: '다음 곡', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('.grid-item[role=button]').first().focus();
    await expect(page.locator('.grid-item[role=button]').first()).toBeFocused();
});

test('invalid input and shrinking layout do not discard tracks', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('YouTube 링크').fill('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ');
    await page.getByRole('button', { name: '+ 음악 추가', exact: true }).click();
    await expect(page.locator('.edit-tracks li')).toHaveCount(0);
    await page.getByLabel('YouTube 링크').fill(Array(5).fill('dQw4w9WgXcQ').join('\n'));
    await page.getByRole('button', { name: '+ 음악 추가', exact: true }).click();
    await page.getByRole('button', { name: '2 × 2', exact: true }).click();
    await expect(page.getByRole('button', { name: '3 × 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.edit-tracks li')).toHaveCount(5);
});

test('API rejects invalid payload, foreign origin, oversized body, unsupported method and unknown code', async ({ request }) => {
    expect((await request.get('/api/shorten')).status()).toBe(405);
    for (const value of ['https://evil.example', 'v1:g3x3:', 'v1:g3x3:invalid', 'v1:g3x3:dQw4w9WgXcQ~zzzzzzzz']) {
        expect((await request.post('/api/shorten', { data: { payload: value } })).status()).toBe(400);
    }
    expect((await request.post('/api/shorten', { data: { payload }, headers: { origin: 'https://evil.example' } })).status()).toBe(403);
    expect((await request.post('/api/shorten', { data: { payload: 'x'.repeat(5000) } })).status()).toBe(413);
    expect((await request.get('/s/bad')).status()).toBe(404);
});

test('player controls reuse one iframe, pause, advance and restore position', async ({ page }) => {
    await page.addInitScript(() => {
        window.YT = { Player: function(host, options) {
            const frame = document.createElement('iframe'); frame.title = 'YouTube test player'; host.replaceWith(frame);
            let state = 1, time = options.playerVars.start || 0;
            const player = { playVideo() { state = 1; options.events.onStateChange({ data: 1 }); }, pauseVideo() { state = 2; options.events.onStateChange({ data: 2 }); }, stopVideo() { state = 0; }, getPlayerState() { return state; }, getCurrentTime() { return time; }, getDuration() { return 240; }, seekTo(t) { time = t; }, loadVideoById(v) { time = v.startSeconds; player.playVideo(); }, destroy() { frame.remove(); } };
            setTimeout(() => options.events.onReady({ target: player }), 10); return player;
        } };
    });
    await page.goto('/?d=' + encodeURIComponent(payload));
    await page.getByRole('button', { name: '재생', exact: true }).click();
    await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '일시정지', exact: true }).click();
    await expect(page.getByRole('button', { name: '재생', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '다음 곡', exact: true }).click();
    await expect(page.locator('.player-host iframe')).toHaveCount(1);
    await expect(page.locator('#track-list li').nth(1)).toContainText('▶');
    await expect.poll(async () => page.evaluate(() => JSON.parse(sessionStorage.getItem('topstertube:playback') || '{}').index)).toBe(1);
    await page.reload();
    await expect(page.getByRole('button', { name: '이어듣기', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '이어듣기', exact: true }).click();
    await expect(page.locator('#track-list li').nth(1)).toContainText('▶');
    const size = await page.locator('.player-overlay').boundingBox();
    expect(size.width).toBeGreaterThanOrEqual(200);
    expect(size.height).toBeGreaterThanOrEqual(200);
});

test('playlist import runs once and respects chosen capacity', async ({ page }) => {
    await page.addInitScript(() => {
        window.createdPlayers = 0;
        window.YT = { Player: function(host, options) {
            window.createdPlayers++;
            const player = { cuePlaylist() {}, getPlaylist() { return Array(8).fill('dQw4w9WgXcQ'); }, destroy() { host.remove(); } };
            setTimeout(() => options.events.onReady({ target: player }), 10); return player;
        } };
    });
    await page.goto('/');
    await page.getByRole('button', { name: '2 × 2', exact: true }).click();
    await page.getByLabel('YouTube 링크').fill('https://music.youtube.com/playlist?list=PL1234567890');
    await page.getByRole('button', { name: '+ 음악 추가', exact: true }).click();
    await expect(page.locator('.edit-tracks li')).toHaveCount(4);
    await expect(page.getByText(/8곡 중 4곡을 추가했습니다/)).toBeVisible();
    expect(await page.evaluate(() => window.createdPlayers)).toBe(1);
});
