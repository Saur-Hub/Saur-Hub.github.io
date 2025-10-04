'use strict';

import { handleLogin, handleLogout, initializeAuth, loadWatchlistData, saveWatchlistData, accessToken, userData, REPO_OWNER, watchlist as remoteWatchlist } from './auth.js';

// Make functions available globally
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.renderWatchlist = renderWatchlist;
window.saveWatchlistData = saveWatchlistData;
window.loadWatchlistData = loadWatchlistData;
window.showAddModal = showAddModal;

// DOM Elements
const moviesGrid = document.getElementById('movies-grid');
const seriesGrid = document.getElementById('series-grid');
const modal = document.getElementById('add-modal');
const closeBtn = document.querySelector('.close');
const addForm = document.getElementById('add-form');
const movieSearch = document.getElementById('movie-search');
const seriesSearch = document.getElementById('series-search');
const searchInput = document.getElementById('search-title');
const suggestionsDropdown = document.getElementById('suggestions');
const selectedItem = document.getElementById('selected-item');

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Page initialized, checking for auth...');
    await initializeAuth();
    // After auth, try to load the canonical watchlist from the repo (if available)
    try {
        const remote = await loadWatchlistData();
        if (remote && (remote.movies || remote.series)) {
            watchlistData = {
                movies: remote.movies || [],
                series: remote.series || []
            };
        }
    } catch (e) {
        console.warn('Could not load remote watchlist:', e);
    }
    // Render using the synchronized watchlistData
    renderWatchlist('movies');
    renderWatchlist('series');
});

// State
let searchTimeout;
let watchlistData = {
    movies: JSON.parse(localStorage.getItem('movies') || '[]'),
    series: JSON.parse(localStorage.getItem('series') || '[]')
};

// Event Listeners
closeBtn.onclick = () => {
    modal.style.display = 'none';
    resetModal();
};

window.onclick = (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
        resetModal();
    }
};

// Enhanced mobile input handling
let originalScrollTop = 0;
let isKeyboardOpen = false;

// Handle virtual keyboard positioning and view adjustments
function handleVirtualKeyboard() {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    // Remove any existing listener first to prevent duplicates
    visualViewport.removeEventListener('resize', handleViewportResize);
    visualViewport.addEventListener('resize', handleViewportResize);

    // Handle iOS input focus
    const modalContent = document.querySelector('.modal-content');
    if (!modalContent) return;

    modalContent.addEventListener('touchstart', handleTouchStart);
}

// Handle viewport resizing when keyboard shows/hides
function handleViewportResize() {
    const modalContent = document.querySelector('.modal-content');
    if (!modalContent) return;

    if (window.visualViewport.height < window.innerHeight) {
        // Keyboard is likely open
        isKeyboardOpen = true;
        modalContent.classList.add('keyboard-open');
        // Store original scroll position if not already stored
        if (originalScrollTop === 0) {
            originalScrollTop = window.scrollY;
        }
    } else {
        // Keyboard is likely closed
        isKeyboardOpen = false;
        modalContent.classList.remove('keyboard-open');
        // Restore original scroll position
        if (originalScrollTop > 0) {
            window.scrollTo(0, originalScrollTop);
            originalScrollTop = 0;
        }
    }
}

// Handle iOS input focus positioning
function handleTouchStart(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const elementRect = e.target.getBoundingClientRect();
        const elementTop = elementRect.top;
        
        // Wait for virtual keyboard
        setTimeout(() => {
            if (elementTop > viewportHeight * 0.5) {
                e.target.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center'
                });
            }
        }, 300);
    }
}

// Close suggestions on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        suggestionsDropdown.style.display = 'none';
    }
});

movieSearch.addEventListener('input', () => filterItems('movies'));
seriesSearch.addEventListener('input', () => filterItems('series'));

// Search input event listener with debouncing
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    if (query.length < 3) {
        suggestionsDropdown.style.display = 'none';
        return;
    }
    
    // Set new timeout for API call
    searchTimeout = setTimeout(() => {
        searchMovies(query);
    }, 500);
});

// Functions
function showAddModal() {
    // Show the modal and reset form
    modal.style.display = 'block';
    addForm.reset();
    
    // Initialize virtual keyboard handling
    handleVirtualKeyboard();
}

async function searchMovies(query) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=d9d4d393`);
        const data = await response.json();
        
        if (data.Response === "True") {
            displaySuggestions(data.Search);
        } else {
            suggestionsDropdown.style.display = 'none';
        }
    } catch (error) {
        console.error('Error searching movies:', error);
    }
}

async function getMovieDetails(imdbID) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=d9d4d393`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}

function displaySuggestions(results) {
    suggestionsDropdown.innerHTML = '';
    
    // Add a close button for mobile
    const closeButton = document.createElement('div');
    closeButton.className = 'suggestions-close';
    closeButton.innerHTML = '<button type="button">Close Suggestions</button>';
    closeButton.onclick = () => {
        suggestionsDropdown.style.display = 'none';
        // On mobile, we want to blur the input to hide the keyboard
        if (window.innerWidth <= 768) {
            searchInput.blur();
        }
    };
    suggestionsDropdown.appendChild(closeButton);
    
    // Container for selection actions
    const actions = document.createElement('div');
    actions.className = 'suggestions-actions';
    actions.style.cssText = 'display:flex;justify-content:flex-end;padding:6px;gap:8px;';

    const addSelectedBtn = document.createElement('button');
    addSelectedBtn.type = 'button';
    addSelectedBtn.textContent = 'Add selected';
    addSelectedBtn.className = 'add-selected-btn';
    addSelectedBtn.style.cssText = 'padding:6px 10px;background:#2b6cb0;color:#fff;border-radius:4px;border:none;cursor:pointer;';

    const clearSelectedBtn = document.createElement('button');
    clearSelectedBtn.type = 'button';
    clearSelectedBtn.textContent = 'Clear';
    clearSelectedBtn.className = 'clear-selected-btn';
    clearSelectedBtn.style.cssText = 'padding:6px 10px;background:#e2e8f0;color:#111;border-radius:4px;border:none;cursor:pointer;';

    actions.appendChild(clearSelectedBtn);
    actions.appendChild(addSelectedBtn);
    suggestionsDropdown.appendChild(actions);

    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';

        const posterUrl = item.Poster !== 'N/A' ? item.Poster : 'assets/imgs/no-poster.png';

        // Checkbox for multi-select
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'suggest-select';
        checkbox.dataset.imdb = item.imdbID;

        const inner = document.createElement('div');
        inner.style.display = 'flex';
        inner.style.alignItems = 'center';
        inner.innerHTML = `
            <img src="${posterUrl}" alt="${item.Title}" class="suggestion-poster">
            <div class="suggestion-info">
                <div class="suggestion-title">${item.Title}</div>
                <div class="suggestion-year">${item.Year}</div>
            </div>
        `;

        // Click on the info selects single item (old behavior)
        inner.addEventListener('click', () => {
            selectMovie(item.imdbID);
            if (window.innerWidth <= 768) searchInput.blur();
        });

        div.appendChild(checkbox);
        div.appendChild(inner);

        suggestionsDropdown.appendChild(div);
    });

    // Clear selection handler
    clearSelectedBtn.addEventListener('click', () => {
        const boxes = suggestionsDropdown.querySelectorAll('.suggest-select');
        boxes.forEach(b => b.checked = false);
    });

    // Bulk add handler
    addSelectedBtn.addEventListener('click', async () => {
        const boxes = suggestionsDropdown.querySelectorAll('.suggest-select:checked');
            if (!boxes.length) {
                showToast('No items selected', 2000);
                return;
            }

        // Ensure the user is authenticated and is repo owner
        if (!accessToken || !userData || userData.login !== REPO_OWNER) {
            showToast('You must be logged in as the repository owner to add items', 3000);
            return;
        }

        const imdbIds = Array.from(boxes).map(b => b.dataset.imdb);

    // Fetch details for each selected item in parallel
    setButtonLoading(addSelectedBtn, true);
    const detailPromises = imdbIds.map(id => getMovieDetails(id));
    const details = await Promise.all(detailPromises);

        // Add items, dedupe by title+year
        let addedCount = 0;
        details.forEach(d => {
            if (!d) return;
            const listType = d.Type === 'movie' ? 'movies' : 'series';
            const candidate = {
                title: d.Title,
                year: d.Year,
                imdbRating: d.imdbRating,
                imdbId: d.imdbID,
                posterUrl: d.Poster,
                notes: '',
                type: d.Type,
                addedAt: new Date().toISOString()
            };

            // Dedupe: check existing items by title + year
            const exists = watchlistData[listType].some(it => {
                return it.title === candidate.title && it.year === candidate.year;
            });
            if (!exists) {
                candidate._new = true;
                watchlistData[listType].push(candidate);
                addedCount += 1;
            }
        });

        if (addedCount === 0) {
            showToast('No new items were added (duplicates skipped)', 2500);
            addSelectedBtn.disabled = false;
            setButtonLoading(addSelectedBtn, false);
            return;
        }

        // Sort lists by release year (newest first). Extract numeric year where possible
        ['movies', 'series'].forEach(type => {
            watchlistData[type].sort((a, b) => {
                const ay = parseInt((a.year || '').toString().slice(0,4)) || 0;
                const by = parseInt((b.year || '').toString().slice(0,4)) || 0;
                return by - ay; // newest first
            });
        });

        // Save once
        try {
            await scheduleSave(watchlistData);
            showToast(`Added ${addedCount} item(s)` , 2000);
            renderWatchlist('movies');
            renderWatchlist('series');
            suggestionsDropdown.style.display = 'none';
        } catch (err) {
            console.error('Bulk save failed:', err);
            showToast('Failed to save selected items. Please try again.', 3500);
        } finally {
            addSelectedBtn.disabled = false;
            setButtonLoading(addSelectedBtn, false);
        }
    });
    
    suggestionsDropdown.style.display = 'block';
    
    // On mobile, scroll to show suggestions
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            suggestionsDropdown.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

async function selectMovie(imdbID) {
    const details = await getMovieDetails(imdbID);
    if (!details) return;
    
    // Update hidden inputs
    document.getElementById('title').value = details.Title;
    document.getElementById('year').value = details.Year;
    document.getElementById('imdb-id').value = imdbID;
    document.getElementById('poster-url').value = details.Poster;
    
    // Update selected item display
    document.getElementById('selected-poster').src = details.Poster !== 'N/A' ? details.Poster : 'assets/imgs/no-poster.png';
    document.getElementById('selected-title').textContent = details.Title;
    document.getElementById('selected-year').textContent = `Year: ${details.Year}`;
    document.getElementById('selected-imdb').textContent = `IMDb Rating: ${details.imdbRating}`;
    
    // Show selected item and hide suggestions
    selectedItem.style.display = 'flex';
    suggestionsDropdown.style.display = 'none';
    searchInput.value = '';
}

function resetModal() {
    addForm.reset();
    selectedItem.style.display = 'none';
    suggestionsDropdown.style.display = 'none';
    searchInput.value = '';
    // Remove focus from any active input
    document.activeElement?.blur();
}

function createWatchlistItem(item) {
    const div = document.createElement('div');
    div.className = 'watchlist-item';
    // If item was recently added, add highlight class
    if (item._new) {
        div.classList.add('new-item');
    }
    const posterUrl = item.posterUrl !== 'N/A' ? item.posterUrl : 'assets/imgs/no-poster.png';
    
    div.innerHTML = `
        <div class="item-header">
            <img src="${posterUrl}" alt="${item.title}" class="item-poster">
            <div class="item-info">
                <h3>${item.title}</h3>
                <div class="year">${item.year}</div>
            </div>
        </div>
        <div class="ratings">
            <div class="rating">
                <span>IMDb</span>
                <div class="value">${item.imdbRating}</div>
            </div>
        </div>
        ${item.notes ? `<div class="notes">${item.notes}</div>` : ''}
    `;
    return div;
}

// Utility: parse the year from strings like "2019" or "2019–" or "2019-2021"
export function parseYear(yearStr) {
    if (!yearStr) return 0;
    const match = yearStr.toString().match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : 0;
}

// Utility: check duplicate by title + year in a list
export function isDuplicate(list, candidate) {
    if (!Array.isArray(list)) return false;
    return list.some(it => (it.title === candidate.title && it.year === candidate.year));
}

function filterItems(type) {
    const searchInput = type === 'movies' ? movieSearch : seriesSearch;
    const query = searchInput.value.toLowerCase();
    const items = watchlistData[type];
    
    const filtered = items.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.notes?.toLowerCase().includes(query)
    );
    
    renderWatchlist(type, filtered);
}

function renderWatchlist(type, items) {
    const grid = type === 'movies' ? moviesGrid : seriesGrid;
    grid.innerHTML = '';
    // Prefer items passed in, then remote watchlist from auth, then local watchlistData
    const source = items || (remoteWatchlist?.[type]) || watchlistData[type] || [];
    source.forEach(item => {
        grid.appendChild(createWatchlistItem(item));
    });

    // Remove _new flags after a short highlight duration
    setTimeout(() => {
        source.forEach(it => {
            if (it._new) delete it._new;
        });
        // Re-render to clear highlight class
        // Only re-render if the grid still matches (avoid flicker for other tabs)
        // We update DOM entries directly by re-rendering the type
        grid.querySelectorAll('.new-item').forEach(el => el.classList.remove('new-item'));
    }, 4000); // 4s highlight
}

// Form submission
addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check if user is authenticated and is repo owner
    if (!accessToken || !userData || userData.login !== REPO_OWNER) {
        showToast('You must be logged in as the repository owner to add items', 3000);
        return;
    }
    
    const title = document.getElementById('title').value;
    // We no longer accept a user rating; use IMDb rating only
    const myRating = null;
    const year = document.getElementById('year').value;
    const notes = document.getElementById('notes').value;
    const posterUrl = document.getElementById('poster-url').value;
    const imdbId = document.getElementById('imdb-id').value;
    
    if (!title || !year || !imdbId) {
        showToast('Please select a movie or TV show from the search results', 2500);
        return;
    }
    
    const details = await getMovieDetails(imdbId);
    
    const newItem = {
        title,
        year,
        // remove user's manual rating; rely on IMDb
        imdbRating: details.imdbRating,
        imdbId,
        posterUrl,
        notes,
        type: details.Type,
        addedAt: new Date().toISOString()
    };
    
    const listType = details.Type === 'movie' ? 'movies' : 'series';
    // Disable submit button during save
    const submitBtn = addForm.querySelector('button[type="submit"]');
    if (submitBtn) setButtonLoading(submitBtn, true);

    newItem._new = true;
    watchlistData[listType].push(newItem);
    // Sort by release year (newest first). Handle ranges like "2019–" by taking the first 4 digits.
    watchlistData[listType].sort((a, b) => {
        const ay = parseInt((a.year || '').toString().slice(0,4)) || 0;
        const by = parseInt((b.year || '').toString().slice(0,4)) || 0;
        return by - ay;
    });
    
    // Save to GitHub repository — use coalesced saver so multiple quick adds produce a single commit
    try {
        await scheduleSave(watchlistData);
        showToast('Saved', 1500);
    } catch (err) {
        console.error('Save failed:', err);
        showToast('Failed to save watchlist data. Please try again.', 3500);
    } finally {
        if (submitBtn) setButtonLoading(submitBtn, false);
    }
    renderWatchlist(listType);
    
    modal.style.display = 'none';
    resetModal();
});

// Initial render is performed after auth/data load in DOMContentLoaded

// --- Coalesced save: scheduleSave batches multiple quick saves into a single save call ---
let saveTimer = null;
let pendingSaveResolve = null;
function scheduleSave(data) {
    // Return a promise that resolves when the actual save completes
    return new Promise((resolve, reject) => {
        // Clear previous timer
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }

        // If there's an outstanding pending resolve, we chain it so callers get the same promise
        if (pendingSaveResolve) {
            // Attach to existing promise by resolving when that one resolves
            pendingSaveResolve.then(resolve).catch(reject);
            return;
        }

        // Create a promise for the pending save
        const pending = saveWatchlistData(data);
        pendingSaveResolve = pending;

        // Delay the actual commit slightly to coalesce multiple adds
        saveTimer = setTimeout(async () => {
            saveTimer = null;
            try {
                const resp = await pending;
                pendingSaveResolve = null;
                resolve(resp);
            } catch (err) {
                pendingSaveResolve = null;
                reject(err);
            }
        }, 300); // 300ms coalescing window
    });
}

// Tiny toast helper
// Button loading helper: toggles disabled state and spinner insertion
function setButtonLoading(button, loading) {
    if (!button) return;
    if (loading) {
        button.disabled = true;
        button.dataset.loading = 'true';
        if (!button.querySelector('.btn-spinner')) {
            const spinner = document.createElement('span');
            spinner.className = 'btn-spinner';
            // keep spinner accessible
            spinner.setAttribute('aria-hidden', 'true');
            button.appendChild(spinner);
        }
    } else {
        button.disabled = false;
        button.dataset.loading = 'false';
        const spinner = button.querySelector('.btn-spinner');
        if (spinner) spinner.remove();
    }
}

// Richer toast system (stacked, dismissable)
function showToast(message, duration = 2000, options = {}) {
    // Create toast container if missing
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = 'position:fixed;right:20px;bottom:20px;display:flex;flex-direction:column;gap:8px;z-index:10001;max-width:320px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = 'background:#222;color:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.2);font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:8px;';

    if (options.dismissable !== false) {
        const close = document.createElement('button');
        close.className = 'toast-close';
        close.innerHTML = '&#x2715;';
        close.style.cssText = 'background:transparent;border:none;color:rgba(255,255,255,0.8);cursor:pointer;font-size:12px;padding:4px;';
        close.addEventListener('click', () => {
            toast.remove();
        });
        toast.appendChild(close);
    }

    container.appendChild(toast);

    if (duration && duration > 0) {
        setTimeout(() => {
            toast.remove();
        }, duration);
    }

    return toast;
}