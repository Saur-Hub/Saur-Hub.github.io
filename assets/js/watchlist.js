'use strict';

import { handleLogin, handleLogout, initializeAuth, loadWatchlistData, saveWatchlistData, accessToken, userData, REPO_OWNER, watchlist as remoteWatchlist } from './auth.js';
import { escapeHtml, isValidInput, parseYear, isDuplicate, determineListType, normalizeOmdbDetails, sortItemsByKey } from './watchlist-utils.js';

// Make functions available globally (only in browser environment)
if (typeof window !== 'undefined') {
    window.handleLogin = handleLogin;
    window.handleLogout = handleLogout;
    window.renderWatchlist = renderWatchlist;
    window.saveWatchlistData = saveWatchlistData;
    window.loadWatchlistData = loadWatchlistData;
    window.showAddModal = showAddModal;
}

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================
const CONFIG = {
    SEARCH_MIN_LENGTH: 3,
    SEARCH_DEBOUNCE_MS: 500,
    MOBILE_BREAKPOINT: 768,
    KEYBOARD_DETECTION_MS: 300,
    TOAST_DURATION_MS: 2000,
    ERROR_TOAST_DURATION_MS: 3500,
    HIGHLIGHT_DURATION_MS: 4000,
    SAVE_COALESCE_MS: 300,
    API_TIMEOUT_MS: 8000,
    NOTES_MAX_LENGTH: 1000,
    FILTER_STORAGE_KEY: 'watchlist_filters',
    SORT_STORAGE_KEY: 'watchlist_sort'
};

let activeSuggestionIndex = -1;
let currentSuggestionElements = [];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Safely initialize DOM elements with null checking
 * @returns {Object|null} Object containing references to DOM elements or null if any are missing
 */
function initializeElements() {
    const elements = {
        initialLoading: document.getElementById('initial-loading'),
        exportBtn: document.getElementById('export-watchlist'),
        moviesGrid: document.getElementById('movies-grid'),
        seriesGrid: document.getElementById('series-grid'),
        animeGrid: document.getElementById('anime-grid'),
        modal: document.getElementById('add-modal'),
        closeBtn: document.querySelector('.close'),
        addForm: document.getElementById('add-form'),
        movieSearch: document.getElementById('movie-search'),
        seriesSearch: document.getElementById('series-search'),
        animeSearch: document.getElementById('anime-search'),
        movieSort: document.getElementById('movie-sort'),
        seriesSort: document.getElementById('series-sort'),
        animeSort: document.getElementById('anime-sort'),
        searchInput: document.getElementById('search-title'),
        suggestionsDropdown: document.getElementById('suggestions'),
        selectedItem: document.getElementById('selected-item')
    };
    
    // Validate all required elements exist
    const missing = Object.entries(elements)
        .filter(([, el]) => !el)
        .map(([name]) => name);
    
    if (missing.length > 0) {
        console.error('Missing DOM elements:', missing);
        return null;
    }
    
    return elements;
}

// ============================================
// ELEMENT INITIALIZATION & LISTENERS
// ============================================

let domElements = null;
let isKeyboardHandlerAttached = false;

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        domElements = initializeElements();
        if (!domElements) {
            console.error('Failed to initialize watch list - required DOM elements missing');
            return;
        }
        setupEventListeners();
    });
}

/**
 * Setup all event listeners (called only once on DOMContentLoaded)
 */
function setupEventListeners() {
    if (!domElements) return;
    
    const { closeBtn, modal, movieSearch, seriesSearch, animeSearch, movieSort, seriesSort, animeSort, searchInput, suggestionsDropdown, addForm, exportBtn } = domElements;
    loadSearchFilters();
    loadSortPreferences();
    applySavedControls();
    setInitialLoading(true);
    
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

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideSuggestions();
        }
    });

    movieSearch.addEventListener('input', () => filterItems('movies'));
    seriesSearch.addEventListener('input', () => filterItems('series'));
    animeSearch.addEventListener('input', () => filterItems('anime'));

    movieSort.addEventListener('change', () => {
        sortState.movies = movieSort.value;
        saveSortPreferences();
        renderWatchlist('movies');
    });
    seriesSort.addEventListener('change', () => {
        sortState.series = seriesSort.value;
        saveSortPreferences();
        renderWatchlist('series');
    });
    animeSort.addEventListener('change', () => {
        sortState.anime = animeSort.value;
        saveSortPreferences();
        renderWatchlist('anime');
    });

    if (exportBtn) {
        exportBtn.addEventListener('click', exportWatchlistData);
    }

    // Search input event listener with debouncing
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (query.length < CONFIG.SEARCH_MIN_LENGTH) {
            hideSuggestions();
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchMovies(query);
        }, CONFIG.SEARCH_DEBOUNCE_MS);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (!currentSuggestionElements.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestionElements.length;
            currentSuggestionElements[activeSuggestionIndex].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex = activeSuggestionIndex <= 0
                ? currentSuggestionElements.length - 1
                : activeSuggestionIndex - 1;
            currentSuggestionElements[activeSuggestionIndex].focus();
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });

    // Form submission with proper error handling
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleFormSubmit();
        });
    }
    
    // Initial render after auth/data load
    initializeAuth().then(() => {
        loadWatchlistData().then((remote) => {
            if (remote && (remote.movies || remote.series || remote.anime)) {
                watchlistData = {
                    movies: Array.isArray(remote.movies) && remote.movies.length ? remote.movies : watchlistData.movies,
                    series: Array.isArray(remote.series) && remote.series.length ? remote.series : watchlistData.series,
                    anime: Array.isArray(remote.anime) && remote.anime.length ? remote.anime : watchlistData.anime
                };
                syncToLocalStorage();
            }
            if (filterState.movies) {
                filterItems('movies');
            } else {
                renderWatchlist('movies');
            }

            if (filterState.series) {
                filterItems('series');
            } else {
                renderWatchlist('series');
            }

            if (filterState.anime) {
                filterItems('anime');
            } else {
                renderWatchlist('anime');
            }
            setInitialLoading(false);
        }).catch(e => console.warn('Could not load remote watchlist:', e));
    }).finally(() => {
        setInitialLoading(false);
    });
}

/**
 * Show or hide the modal's primary submit button.
 * @param {boolean} isVisible - Whether the button should be visible.
 */
function setPrimaryAddButtonVisibility(isVisible) {
    if (!domElements?.addForm) return;
    const submitBtn = domElements.addForm.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    submitBtn.style.display = isVisible ? 'inline-flex' : 'none';
}

// Functions
/**
 * Open the add-to-watchlist modal and prepare input state.
 */
function showAddModal() {
    // Show the modal and reset form (only in browser environment)
    if (typeof document !== 'undefined' && domElements?.modal) {
        domElements.modal.style.display = 'block';
        domElements.addForm.reset();
        
        // Initialize virtual keyboard handling (only once)
        handleVirtualKeyboard();
    }
}

// ============================================
// STATE MANAGEMENT WITH LOCALSTORAGE SYNC
// ============================================

let searchTimeout;
let watchlistData = {
    movies: [],
    series: [],
    anime: []
};

let filterState = {
    movies: '',
    series: '',
    anime: ''
};

let sortState = {
    movies: 'year-desc',
    series: 'year-desc',
    anime: 'year-desc'
};

if (typeof localStorage !== 'undefined') {
    watchlistData = loadFromLocalStorage();
}

/**
 * Synchronize watchlistData to localStorage to prevent data loss
 * Called after any modification to watchlistData
 */
function syncToLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    
    try {
        localStorage.setItem('movies', JSON.stringify(watchlistData.movies));
        localStorage.setItem('series', JSON.stringify(watchlistData.series));
        localStorage.setItem('anime', JSON.stringify(watchlistData.anime));
    } catch (e) {
        console.error('Failed to sync to localStorage:', e);
        showToast('Warning: Could not save to browser storage', CONFIG.ERROR_TOAST_DURATION_MS);
    }
}

/**
 * Load watchlist from localStorage with error recovery
 */
function loadFromLocalStorage() {
    if (typeof localStorage === 'undefined') {
        return { movies: [], series: [], anime: [] };
    }

    try {
        const movies = localStorage.getItem('movies');
        const series = localStorage.getItem('series');
        const anime = localStorage.getItem('anime');

        return {
            movies: movies ? JSON.parse(movies) : [],
            series: series ? JSON.parse(series) : [],
            anime: anime ? JSON.parse(anime) : []
        };
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
        return { movies: [], series: [], anime: [] };
    }
}

// ============================================
// MOBILE KEYBOARD HANDLING
// ============================================

let originalScrollTop = 0;
let isKeyboardOpen = false;

/**
 * Handle virtual keyboard positioning and view adjustments
 * Uses flag to prevent duplicate listeners
 */
function handleVirtualKeyboard() {
    if (!domElements) return;
    
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    // Only attach once using the flag
    if (isKeyboardHandlerAttached) return;
    
    visualViewport.addEventListener('resize', handleViewportResize);
    isKeyboardHandlerAttached = true;

    const modalContent = document.querySelector('.modal-content');
    if (!modalContent) return;

    modalContent.addEventListener('touchstart', handleTouchStart);
}

/**
 * Handle viewport resizing when keyboard shows/hides
 */
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

/**
 * Handle iOS input focus positioning
 */
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
        }, CONFIG.KEYBOARD_DETECTION_MS);
    }
}

// ============================================
// API FUNCTIONS WITH ERROR HANDLING
// ============================================

// Development environment detection
const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const NETLIFY_URL = isDev ? 'http://localhost:8888' : 'https://saur-hub-static.netlify.app';

/**
 * Search movies with proper error handling and timeout
 * @param {string} query - Search query
 */
async function searchMovies(query) {
    if (!domElements) return;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);
        
        const response = await fetch(
            `${NETLIFY_URL}/.netlify/functions/omdb-api?s=${encodeURIComponent(query)}`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.error(`API error: ${response.status}`);
            showToast(`API error: ${response.status}`, CONFIG.ERROR_TOAST_DURATION_MS);
            return;
        }
        
        const data = await response.json();
        
        if (data.Response === "True" && data.Search?.length > 0) {
            const safeResults = data.Search.filter(item => item?.imdbID && item?.Title && item?.Year);
            if (!safeResults.length) {
                showToast('No valid results found', CONFIG.TOAST_DURATION_MS);
                hideSuggestions();
                return;
            }
            displaySuggestions(safeResults);
        } else if (data.Response === "False") {
            showToast(`No results found for "${escapeHtml(query)}"`, CONFIG.TOAST_DURATION_MS);
            hideSuggestions();
        } else {
            showToast('Unexpected response from API', CONFIG.ERROR_TOAST_DURATION_MS);
            console.error('Unexpected API response:', data);
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            showToast('Search request timed out. Please try again.', CONFIG.ERROR_TOAST_DURATION_MS);
        } else {
            console.error('Search error:', error);
            showToast('Failed to search. Please try again.', CONFIG.ERROR_TOAST_DURATION_MS);
        }
    }
}

/**
 * Get detailed movie information from OMDB
 * @param {string} imdbID - IMDB ID of movie/series
 * @returns {Promise<Object|null>} Movie details or null on error
 */
async function getMovieDetails(imdbID) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);
        
        const response = await fetch(
            `${NETLIFY_URL}/.netlify/functions/omdb-api?i=${imdbID}`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.error(`Failed to fetch details: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        if (data.Response === "False") {
            console.warn('Movie details not found:', data.Error);
            return null;
        }

        return normalizeOmdbDetails(data);
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}

// ============================================
// UI RENDERING & DISPLAY FUNCTIONS
// ============================================

/**
 * Display search suggestions with XSS protection
 * No innerHTML used for user data - SAFE from XSS
 */
function displaySuggestions(results) {
    if (!domElements) return;
    
    const { suggestionsDropdown, searchInput } = domElements;
    suggestionsDropdown.innerHTML = '';
    setPrimaryAddButtonVisibility(false);
    activeSuggestionIndex = -1;
    currentSuggestionElements = [];
    searchInput.setAttribute('aria-expanded', 'true');
    
    // Add a close button for mobile
    const closeButton = document.createElement('div');
    closeButton.className = 'suggestions-close';
    const closeButtonEl = document.createElement('button');
    closeButtonEl.type = 'button';
    closeButtonEl.textContent = 'Close Suggestions';
    closeButton.appendChild(closeButtonEl);
    closeButton.onclick = () => {
        hideSuggestions();
        // On mobile, we want to blur the input to hide the keyboard
        if (window.innerWidth <= 768) {
            searchInput.blur();
        }
    };
    suggestionsDropdown.appendChild(closeButton);
    
    // Container for selection actions
    const actions = document.createElement('div');
    actions.className = 'suggestions-actions';

    const addSelectedBtn = document.createElement('button');
    addSelectedBtn.type = 'button';
    addSelectedBtn.textContent = 'Quick Add Selected';
    addSelectedBtn.className = 'add-selected-btn';

    const clearSelectedBtn = document.createElement('button');
    clearSelectedBtn.type = 'button';
    clearSelectedBtn.textContent = 'Clear Selection';
    clearSelectedBtn.className = 'clear-selected-btn';

    actions.appendChild(clearSelectedBtn);
    actions.appendChild(addSelectedBtn);
    suggestionsDropdown.appendChild(actions);

    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.setAttribute('role', 'option');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';

        const posterUrl = item.Poster !== 'N/A' ? item.Poster : 'assets/imgs/no-poster.png';

        // Checkbox for multi-select
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'suggest-select';
        checkbox.dataset.imdb = item.imdbID;

        // ✅ SAFE: Use DOM methods instead of innerHTML to prevent XSS
        const inner = document.createElement('div');
        inner.tabIndex = 0;
        inner.style.display = 'flex';
        inner.style.alignItems = 'center';

        const poster = document.createElement('img');
        poster.src = posterUrl;
        poster.alt = item.Title;  // Alt text is safe as it's just text
        poster.className = 'suggestion-poster';

        const info = document.createElement('div');
        info.className = 'suggestion-info';

        const title = document.createElement('div');
        title.className = 'suggestion-title';
        title.textContent = item.Title;  // ✅ Safe: textContent prevents XSS

        const year = document.createElement('div');
        year.className = 'suggestion-year';
        year.textContent = item.Year;  // ✅ Safe: textContent prevents XSS

        info.appendChild(title);
        info.appendChild(year);
        inner.appendChild(poster);
        inner.appendChild(info);

        // Click on the info selects single item (old behavior)
        inner.addEventListener('click', () => {
            selectMovie(item.imdbID);
            if (window.innerWidth <= CONFIG.MOBILE_BREAKPOINT) searchInput.blur();
        });
        inner.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectMovie(item.imdbID);
            } else if (e.key === 'Escape') {
                hideSuggestions();
            }
        });

        div.appendChild(checkbox);
        div.appendChild(inner);

        suggestionsDropdown.appendChild(div);
        currentSuggestionElements.push(inner);
    });

    // Clear selection handler
    clearSelectedBtn.addEventListener('click', () => {
        const boxes = suggestionsDropdown.querySelectorAll('.suggest-select');
        boxes.forEach(b => b.checked = false);
    });

    // Bulk add handler with proper error handling and no race conditions
    addSelectedBtn.addEventListener('click', async () => {
        const boxes = suggestionsDropdown.querySelectorAll('.suggest-select:checked');
        
        // Validate early - no loading state started yet
        if (!boxes.length) {
            showToast('No items selected', CONFIG.TOAST_DURATION_MS);
            return;
        }

        // Ensure the user is authenticated and is repo owner
        if (!accessToken || !userData || userData.login !== REPO_OWNER) {
            showToast('You must be logged in as the repository owner to add items', CONFIG.ERROR_TOAST_DURATION_MS);
            return;
        }

        // ✅ Set loading state AFTER all validation
        setButtonLoading(addSelectedBtn, true);
        
        try {
            const imdbIds = Array.from(boxes).map(b => b.dataset.imdb);

            // Fetch details for each selected item in parallel
            const detailPromises = imdbIds.map(id => getMovieDetails(id));
            const details = await Promise.all(detailPromises);

            // Add items, dedupe by title+year
            let addedCount = 0;
            details.forEach(d => {
                if (!d) return;
                const listType = determineListType(d);
                if (!Array.isArray(watchlistData[listType])) {
                    watchlistData[listType] = [];
                }
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
                showToast('No new items were added (duplicates skipped)', CONFIG.TOAST_DURATION_MS);
                return;  // ✅ Button loading will be reset in finally block
            }

            // Sort lists by release year (newest first). Extract numeric year where possible
            ['movies', 'series', 'anime'].forEach(type => {
                watchlistData[type] = sortItems(watchlistData[type], type);
            });

            // ✅ Sync to localStorage immediately
            syncToLocalStorage();

            // Save once to GitHub
            await scheduleSave(watchlistData);
            showToast(`Added ${addedCount} item(s)`, CONFIG.TOAST_DURATION_MS);
            renderWatchlist('movies');
            renderWatchlist('series');
            renderWatchlist('anime');
            hideSuggestions();
            
        } catch (err) {
            console.error('Bulk add failed:', err);
            showToast('Failed to add selected items. Please try again.', CONFIG.ERROR_TOAST_DURATION_MS);
        } finally {
            // ✅ ALWAYS restore button state, regardless of success/failure
            setButtonLoading(addSelectedBtn, false);
        }
    });
    
    suggestionsDropdown.style.display = 'block';
    
    // On mobile, scroll to show suggestions
    if (window.innerWidth <= CONFIG.MOBILE_BREAKPOINT) {
        setTimeout(() => {
            suggestionsDropdown.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

/**
 * Select a movie and populate the form
 * @param {string} imdbID - IMDB ID of the selected movie
 */
async function selectMovie(imdbID) {
    if (!domElements) return;
    
    const details = await getMovieDetails(imdbID);
    if (!details) {
        showToast('Failed to load movie details. Please try again.', CONFIG.ERROR_TOAST_DURATION_MS);
        return;
    }
    
    // Update hidden inputs with validation
    const titleElem = document.getElementById('title');
    const yearElem = document.getElementById('year');
    const imdbIdElem = document.getElementById('imdb-id');
    const posterUrlElem = document.getElementById('poster-url');
    
    if (!titleElem || !yearElem || !imdbIdElem || !posterUrlElem) {
        console.error('Required form elements missing');
        showToast('Form element error - please refresh the page', CONFIG.ERROR_TOAST_DURATION_MS);
        return;
    }
    
    titleElem.value = details.Title;
    yearElem.value = details.Year;
    imdbIdElem.value = imdbID;
    posterUrlElem.value = details.Poster;
    
    // Update selected item display with safe text methods
    const posterImg = document.getElementById('selected-poster');
    const titleDisplay = document.getElementById('selected-title');
    const yearDisplay = document.getElementById('selected-year');
    const imdbDisplay = document.getElementById('selected-imdb');
    
    if (posterImg) {
        posterImg.src = details.Poster !== 'N/A' ? details.Poster : 'assets/imgs/no-poster.png';
        posterImg.alt = details.Title;
    }
    if (titleDisplay) titleDisplay.textContent = details.Title;
    if (yearDisplay) yearDisplay.textContent = `Year: ${details.Year}`;
    if (imdbDisplay) imdbDisplay.textContent = `IMDb Rating: ${details.imdbRating}`;
    
    // Show selected item and hide suggestions
    domElements.selectedItem.style.display = 'flex';
    hideSuggestions();
    domElements.searchInput.value = '';
}

/**
 * Reset the modal form to initial state
 */
function resetModal() {
    if (!domElements) return;
    
    if (domElements.addForm) domElements.addForm.reset();
    if (domElements.selectedItem) domElements.selectedItem.style.display = 'none';
    hideSuggestions();
    if (domElements.searchInput) domElements.searchInput.value = '';
    setPrimaryAddButtonVisibility(true);
    
    // Remove focus from any active input
    document.activeElement?.blur();
}

/**
 * Create a watchlist item element with proper sanitization
 * @param {Object} item - The watchlist item to display
 * @returns {HTMLElement} The created item element
 */
function createWatchlistItem(item, type) {
    const div = document.createElement('div');
    div.className = 'watchlist-item';
    // If item was recently added, add highlight class
    if (item._new) {
        div.classList.add('new-item');
        delete item._new;
    }
    const posterUrl = item.posterUrl !== 'N/A' ? item.posterUrl : 'assets/imgs/no-poster.png';
    
    // ✅ SAFE: Use DOM methods instead of innerHTML to prevent XSS
    const header = document.createElement('div');
    header.className = 'item-header';
    
    const posterImg = document.createElement('img');
    posterImg.src = posterUrl;
    posterImg.alt = item.title;
    posterImg.className = 'item-poster';
    
    const info = document.createElement('div');
    info.className = 'item-info';
    
    const title = document.createElement('h3');
    title.textContent = item.title;  // ✅ Safe: textContent
    
    const year = document.createElement('div');
    year.className = 'year';
    year.textContent = item.year;  // ✅ Safe: textContent
    
    info.appendChild(title);
    info.appendChild(year);
    header.appendChild(posterImg);
    header.appendChild(info);
    
    const ratings = document.createElement('div');
    ratings.className = 'ratings';
    
    const ratingDiv = document.createElement('div');
    ratingDiv.className = 'rating';
    
    const ratingLabel = document.createElement('span');
    ratingLabel.textContent = 'IMDb';  // ✅ Safe: textContent
    
    const ratingValue = document.createElement('div');
    ratingValue.className = 'value';
    ratingValue.textContent = item.imdbRating;  // ✅ Safe: textContent
    
    ratingDiv.appendChild(ratingLabel);
    ratingDiv.appendChild(ratingValue);
    ratings.appendChild(ratingDiv);
    
    // Add notes if they exist
    if (item.notes && item.notes.trim()) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'notes';
        notesDiv.textContent = item.notes;  // ✅ Safe: textContent
        div.appendChild(notesDiv);
    }
    
    div.appendChild(header);
    div.appendChild(ratings);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'item-action-btn';
    editBtn.textContent = 'Edit Notes';
    editBtn.addEventListener('click', async () => {
        const current = item.notes || '';
        const updated = prompt('Update notes:', current);
        if (updated === null) return;
        if (!isValidInput(updated, CONFIG.NOTES_MAX_LENGTH, true)) {
            showToast('Notes are invalid or too long', CONFIG.ERROR_TOAST_DURATION_MS);
            return;
        }

        const ok = updateItemNotes(type, item.imdbId, updated.trim());
        if (!ok) return;
        syncToLocalStorage();
        try {
            await scheduleSave(watchlistData);
            renderWatchlist(type);
            showToast('Notes updated', CONFIG.TOAST_DURATION_MS);
        } catch (e) {
            showToast('Failed to save notes update', CONFIG.ERROR_TOAST_DURATION_MS);
        }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'item-action-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
        const confirmed = confirm(`Delete "${item.title}" from watchlist?`);
        if (!confirmed) return;

        const removed = removeItem(type, item.imdbId);
        if (!removed) return;

        syncToLocalStorage();
        try {
            await scheduleSave(watchlistData);
            renderWatchlist(type);
            showToast('Item deleted', CONFIG.TOAST_DURATION_MS);
        } catch (e) {
            showToast('Failed to delete item', CONFIG.ERROR_TOAST_DURATION_MS);
        }
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    div.appendChild(actions);

    return div;
}

export { parseYear, isDuplicate };

// ============================================
// FILTERING & RENDERING
// ============================================

/**
 * Filter watchlist items by search query
 * @param {string} type - 'movies' or 'series'
 */
function filterItems(type) {
    if (!domElements) return;
    
    const searchInput = type === 'movies'
        ? domElements.movieSearch
        : type === 'series'
            ? domElements.seriesSearch
            : domElements.animeSearch;
    if (!searchInput) return;
    
    const query = searchInput.value.toLowerCase();
    filterState[type] = query;
    saveSearchFilters();
    const items = watchlistData[type] || [];
    
    const filtered = items.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.notes?.toLowerCase().includes(query)
    );
    
    renderWatchlist(type, filtered);
}

/**
 * Render watchlist items to the grid
 * @param {string} type - 'movies' or 'series'
 * @param {Array} items - Optional array of items to render (defaults to all items)
 */
function renderWatchlist(type, items) {
    if (!domElements) return;
    
    const grid = type === 'movies'
        ? domElements.moviesGrid
        : type === 'series'
            ? domElements.seriesGrid
            : domElements.animeGrid;
    if (!grid) {
        console.error(`Grid not found for type: ${type}`);
        return;
    }
    
    grid.innerHTML = '';
    // Prefer items passed in, then active local/state watchlistData, then remote watchlist as fallback
    const source = items || watchlistData[type] || (remoteWatchlist?.[type]) || [];
    const sorted = sortItems(source, type);
    sorted.forEach(item => {
        grid.appendChild(createWatchlistItem(item, type));
    });
}

// ============================================
// FORM SUBMISSION
// ============================================

/**
 * Check if item already exists in watchlist
 * @param {string} type - 'movies' or 'series'
 * @param {Object} candidate - Item to check
 * @returns {boolean} True if duplicate exists
 */
function hasDuplicate(type, candidate) {
    if (!Array.isArray(watchlistData[type])) return false;
    return watchlistData[type].some(it => 
        it.title.toLowerCase() === candidate.title.toLowerCase() && 
        it.year === candidate.year
    );
}

/**
 * Handle form submission for single item addition
 * Includes validation, duplicate checking, and proper error handling
 */
async function handleFormSubmit() {
    if (!domElements) return;
    
    // Check if user is authenticated and is repo owner
    if (!accessToken || !userData || userData.login !== REPO_OWNER) {
        showToast('You must be logged in as the repository owner to add items', CONFIG.ERROR_TOAST_DURATION_MS);
        return;
    }
    
    // Get form values
    const titleElem = document.getElementById('title');
    const yearElem = document.getElementById('year');
    const notesElem = document.getElementById('notes');
    const posterUrlElem = document.getElementById('poster-url');
    const imdbIdElem = document.getElementById('imdb-id');
    
    if (!titleElem || !yearElem || !posterUrlElem || !imdbIdElem) {
        console.error('Required form elements missing');
        return;
    }
    
    const title = titleElem.value.trim();
    const year = yearElem.value.trim();
    const notes = notesElem ? notesElem.value.trim() : '';
    const posterUrl = posterUrlElem.value;
    const imdbId = imdbIdElem.value;
    
    // Validate inputs
    if (!isValidInput(title, 300) || !isValidInput(year, 50) || !isValidInput(imdbId, 20)) {
        showToast('Please select a movie or TV show from the search results', CONFIG.TOAST_DURATION_MS);
        return;
    }
    
    // Fetch missing details if needed
    const details = await getMovieDetails(imdbId);
    if (!details) {
        showToast('Failed to load movie details. Please try again.', CONFIG.ERROR_TOAST_DURATION_MS);
        return;
    }
    
    const newItem = {
        title,
        year,
        imdbRating: details.imdbRating || 'N/A',
        imdbId,
        posterUrl: posterUrl || details.Poster,
        notes,
        type: details.Type || 'movie',
        addedAt: new Date().toISOString()
    };
    
    const listType = determineListType(details);
    if (!Array.isArray(watchlistData[listType])) {
        watchlistData[listType] = [];
    }
    
    // ✅ Check for duplicates BEFORE adding
    if (hasDuplicate(listType, newItem)) {
        showToast('This item is already in your watchlist', CONFIG.TOAST_DURATION_MS);
        return;
    }
    
    // Disable submit button during save
    const submitBtn = domElements.addForm.querySelector('button[type="submit"]');
    if (submitBtn) setButtonLoading(submitBtn, true);

    try {
        newItem._new = true;
        watchlistData[listType].push(newItem);
        
        // Sort using user preference
        watchlistData[listType] = sortItems(watchlistData[listType], listType);
        
        // ✅ Sync to localStorage immediately
        syncToLocalStorage();
        
        // Save to GitHub repository
        await scheduleSave(watchlistData);
        showToast('Item added successfully!', CONFIG.TOAST_DURATION_MS);
        renderWatchlist(listType);
        
        domElements.modal.style.display = 'none';
        resetModal();
        
    } catch (err) {
        console.error('Failed to add item:', err);
        showToast('Failed to save watchlist data. Please try again.', CONFIG.ERROR_TOAST_DURATION_MS);
    } finally {
        if (submitBtn) setButtonLoading(submitBtn, false);
    }
}

// ============================================
// SAVE MANAGEMENT
// ============================================

/**
 * Coalesced save: batches multiple quick saves into a single save call
 * Prevents too many commits to GitHub in rapid succession
 */
let saveTimer = null;
let pendingSaveResolve = null;

/**
 * Schedule a save operation with coalescing
 * @param {Object} data - The watchlist data to save
 * @returns {Promise} Promise that resolves when save completes
 */
function scheduleSave(data) {
    // Return a promise that resolves when the actual save completes
    return new Promise((resolve, reject) => {
        // Clear previous timer
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }

        // If there's an outstanding pending resolve, chain it
        if (pendingSaveResolve) {
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
        }, CONFIG.SAVE_COALESCE_MS);
    });
}

// Tiny toast helper
// Button loading helper: toggles disabled state and spinner insertion
/**
 * Toggle loading state on a button.
 * @param {HTMLButtonElement} button - Target button element.
 * @param {boolean} loading - Whether loading is active.
 */
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
/**
 * Show a toast message.
 * @param {string} message - Toast text.
 * @param {number} duration - Auto-dismiss duration in ms.
 * @param {{dismissable?: boolean}} options - Toast behavior options.
 * @returns {HTMLElement} Created toast element.
 */
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

/**
 * Toggle the initial loading indicator visibility.
 * @param {boolean} loading - Whether loading is active.
 */
function setInitialLoading(loading) {
    if (!domElements?.initialLoading) return;
    domElements.initialLoading.classList.toggle('hidden', !loading);
}

/**
 * Load persisted section filters from local storage.
 */
function loadSearchFilters() {
    if (typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem(CONFIG.FILTER_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        filterState = {
            movies: parsed.movies || '',
            series: parsed.series || '',
            anime: parsed.anime || ''
        };
    } catch (e) {
        console.warn('Failed to load filter state:', e);
    }
}

/**
 * Persist current section filters to local storage.
 */
function saveSearchFilters() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(CONFIG.FILTER_STORAGE_KEY, JSON.stringify(filterState));
    } catch (e) {
        console.warn('Failed to save filter state:', e);
    }
}

/**
 * Load persisted sort selections from local storage.
 */
function loadSortPreferences() {
    if (typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem(CONFIG.SORT_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        sortState = {
            movies: parsed.movies || 'year-desc',
            series: parsed.series || 'year-desc',
            anime: parsed.anime || 'year-desc'
        };
    } catch (e) {
        console.warn('Failed to load sort state:', e);
    }
}

/**
 * Persist current sort selections to local storage.
 */
function saveSortPreferences() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(CONFIG.SORT_STORAGE_KEY, JSON.stringify(sortState));
    } catch (e) {
        console.warn('Failed to save sort state:', e);
    }
}

/**
 * Sort items for a specific list type using the selected sort mode.
 * @param {Array<Object>} items - Items to sort.
 * @param {'movies'|'series'|'anime'} type - Target section type.
 * @returns {Array<Object>} Sorted list.
 */
function sortItems(items, type) {
    const sortKey = sortState[type] || 'year-desc';
    return sortItemsByKey(items, sortKey);
}

/**
 * Apply saved search and sort control values to UI elements.
 */
function applySavedControls() {
    if (!domElements) return;

    domElements.movieSearch.value = filterState.movies;
    domElements.seriesSearch.value = filterState.series;
    domElements.animeSearch.value = filterState.anime;

    if (domElements.movieSort) domElements.movieSort.value = sortState.movies;
    if (domElements.seriesSort) domElements.seriesSort.value = sortState.series;
    if (domElements.animeSort) domElements.animeSort.value = sortState.anime;
}

/**
 * Hide suggestions dropdown and reset navigation state.
 */
function hideSuggestions() {
    if (!domElements) return;
    domElements.suggestionsDropdown.style.display = 'none';
    domElements.searchInput.setAttribute('aria-expanded', 'false');
    currentSuggestionElements = [];
    activeSuggestionIndex = -1;
    setPrimaryAddButtonVisibility(true);
}

/**
 * Update notes for a specific watchlist item.
 * @param {'movies'|'series'|'anime'} type - List type.
 * @param {string} imdbId - IMDB identifier.
 * @param {string} notes - Updated notes value.
 * @returns {boolean} True when an item was updated.
 */
function updateItemNotes(type, imdbId, notes) {
    const list = watchlistData[type] || [];
    const target = list.find(item => item.imdbId === imdbId);
    if (!target) return false;
    target.notes = notes;
    return true;
}

/**
 * Remove an item by IMDB id from a specific list.
 * @param {'movies'|'series'|'anime'} type - List type.
 * @param {string} imdbId - IMDB identifier.
 * @returns {boolean} True when an item was removed.
 */
function removeItem(type, imdbId) {
    if (!Array.isArray(watchlistData[type])) return false;
    const originalLength = watchlistData[type].length;
    watchlistData[type] = watchlistData[type].filter(item => item.imdbId !== imdbId);
    return watchlistData[type].length !== originalLength;
}

/**
 * Export the current watchlist data as a downloadable JSON file.
 */
function exportWatchlistData() {
    const payload = JSON.stringify(watchlistData, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `watchlist-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Watchlist exported', CONFIG.TOAST_DURATION_MS);
}