document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');
    const trackList = document.getElementById('track-list');
    const params = new URLSearchParams(window.location.search);

    // 1. Get Grid Size
    const w = parseInt(params.get('w')) || 3;
    const h = parseInt(params.get('h')) || 3;

    // 2. Set CSS Grid Styles
    gridContainer.style.gridTemplateColumns = `repeat(${w}, 1fr)`;

    // 3. Parse Links and Render
    const totalCells = w * h;
    
    for (let i = 1; i <= totalCells; i++) {
        const linkParam = params.get(`link${i}`);
        
        // Create Grid Item
        const gridItem = document.createElement('a');
        gridItem.className = 'grid-item';
        gridItem.target = '_blank'; // Open in new tab

        // Create List Item
        const listItem = document.createElement('li');
        const listLink = document.createElement('a');
        listLink.target = '_blank';
        listItem.appendChild(listLink);

        if (linkParam) {
            let videoId = linkParam;
            let startSeconds = 0;

            if (linkParam.includes('?t=')) {
                const parts = linkParam.split('?t=');
                videoId = parts[0];
                startSeconds = parseInt(parts[1]) || 0;
            }

            const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}${startSeconds ? '&t=' + startSeconds : ''}`;
            const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

            // Setup Grid Item
            gridItem.href = youtubeUrl;
            const img = document.createElement('img');
            img.src = thumbUrl;
            img.alt = `Track ${i}`;
            gridItem.appendChild(img);

            // Setup List Item
            listLink.href = youtubeUrl;
            listLink.textContent = `Track ${i}`; // Default text
            
            // Fetch Title asynchronously
            fetchTitle(videoId, listLink, i);

        } else {
            // Empty cell
            gridItem.style.backgroundColor = '#1e1e1e';
            gridItem.style.cursor = 'default';
            listLink.textContent = '-';
            listLink.removeAttribute('href');
        }

        gridContainer.appendChild(gridItem);
        trackList.appendChild(listItem);
    }
});

async function fetchTitle(videoId, element, index) {
    try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();
        if (data.title) {
            element.textContent = data.title;
            // Also update alt text for accessibility
            const gridImg = document.querySelectorAll('.grid-item img')[index - 1];
            if (gridImg) gridImg.alt = data.title;
        }
    } catch (error) {
        console.error('Failed to fetch title for', videoId, error);
    }
}