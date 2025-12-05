document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');
    const trackList = document.getElementById('track-list');
    
    // Fix common URL copy-paste errors (converting &amp; back to &)
    let queryString = window.location.search;
    if (queryString.includes('&amp;')) {
        queryString = queryString.replace(/&amp;/g, '&');
    }
    const params = new URLSearchParams(queryString);

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
        const gridItem = document.createElement('div'); // Changed to div
        gridItem.className = 'grid-item';
        
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

            // Setup Grid Item (Click to Play)
            const img = document.createElement('img');
            img.src = thumbUrl;
            img.alt = `Track ${i}`;
            gridItem.appendChild(img);

            gridItem.addEventListener('click', () => {
                const iframe = document.createElement('iframe');
                iframe.src = `https://www.youtube.com/embed/${videoId}?start=${startSeconds}&autoplay=1&playsinline=1`;
                iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
                iframe.allowFullscreen = true;
                gridItem.innerHTML = ''; // Remove image
                gridItem.appendChild(iframe);
            });

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
            let artist = data.author_name || '';
            // Remove " - Topic" suffix if present
            if (artist.endsWith(' - Topic')) {
                artist = artist.replace(' - Topic', '');
            }
            
            // Format: "Artist - Title" (Number is handled by CSS)
            // If artist is empty, just show title
            const text = artist ? `${artist} - ${data.title}` : data.title;
            
            element.textContent = text;
            
            // Also update alt text for accessibility
            const gridImg = document.querySelectorAll('.grid-item img')[index - 1];
            if (gridImg) gridImg.alt = text;
        }
    } catch (error) {
        console.error('Failed to fetch title for', videoId, error);
    }
}

// Sync List Height and Font Size with Grid
const gridContainer = document.getElementById('grid-container');
const listContainer = document.querySelector('.list-container');
const trackList = document.getElementById('track-list');

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
            // 1. Sync Height: List max-height = Grid height
            listContainer.style.maxHeight = `${height}px`;
            
            // 2. Dynamic Font Size: Scale based on grid height
            // Base size calculation: height / 25 (adjust divisor to tune size)
            // Min 12px, Max 18px to prevent too small/large text
            const fontSize = Math.max(12, Math.min(18, height / 25));
            trackList.style.fontSize = `${fontSize}px`;
        }
    }
});

if (gridContainer) {
    resizeObserver.observe(gridContainer);
}