document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('grid-container');
    const params = new URLSearchParams(window.location.search);

    // 1. Get Grid Size
    const w = parseInt(params.get('w')) || 3;
    const h = parseInt(params.get('h')) || 3;

    // 2. Set CSS Grid Styles
    container.style.gridTemplateColumns = `repeat(${w}, 1fr)`;
    // Optional: Limit max width to keep it looking like a grid on very wide screens
    // container.style.maxWidth = `${w * 300}px`; 

    // 3. Parse Links and Render
    const totalCells = w * h;
    
    for (let i = 1; i <= totalCells; i++) {
        const linkParam = params.get(`link${i}`);
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';

        if (linkParam) {
            // Expected format: [ID]?t=[SEC] or just [ID]
            // Example: dQw4w9WgXcQ?t=15
            let videoId = linkParam;
            let startSeconds = 0;

            if (linkParam.includes('?t=')) {
                const parts = linkParam.split('?t=');
                videoId = parts[0];
                startSeconds = parseInt(parts[1]) || 0;
            }

            const iframe = document.createElement('iframe');
            // Construct YouTube Embed URL
            iframe.src = `https://www.youtube.com/embed/${videoId}?start=${startSeconds}&playsinline=1`;
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
            iframe.allowFullscreen = true;

            wrapper.appendChild(iframe);
        }
        // If no linkParam, it remains an empty styled div
        container.appendChild(wrapper);
    }
});