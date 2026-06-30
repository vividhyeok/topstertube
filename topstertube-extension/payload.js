(function () {
    const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

    function getRequiredSize(themeValue) {
        if (themeValue === 'classic') return 42;
        const [w, h] = themeValue.split('x').map(Number);
        return Math.max(1, Math.min(10, w || 3)) * Math.max(1, Math.min(10, h || 3));
    }

    function getLayoutToken(themeValue) {
        if (themeValue === 'classic') return 'c';
        const [w, h] = themeValue.split('x').map(Number);
        return `g${Math.max(1, Math.min(10, w || 3))}x${Math.max(1, Math.min(10, h || 3))}`;
    }

    function encode({ links, themeValue }) {
        const total = getRequiredSize(themeValue);
        const tokens = links.slice(0, total).map((link) => {
            if (!link || !VIDEO_ID_PATTERN.test(link.id)) return '';

            const seconds = Math.max(0, parseInt(link.t, 10) || 0);
            return seconds ? `${link.id}~${seconds.toString(36)}` : link.id;
        });

        while (tokens.length && tokens[tokens.length - 1] === '') {
            tokens.pop();
        }

        return `v1:${getLayoutToken(themeValue)}:${tokens.join('.')}`;
    }

    window.TopsterPayload = {
        encode,
        getRequiredSize,
    };
}());
