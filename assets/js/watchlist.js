'use strict';

import { handleLogin, handleLogout, initializeAuth, loadWatchlistData, saveWatchlistData, accessToken, userData } from './auth.js';

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
    
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        
        const posterUrl = item.Poster !== 'N/A' ? item.Poster : 'assets/imgs/no-poster.png';
        
        div.innerHTML = `
            <img src="${posterUrl}" alt="${item.Title}" class="suggestion-poster">
            <div class="suggestion-info">
                <div class="suggestion-title">${item.Title}</div>
                <div class="suggestion-year">${item.Year}</div>
            </div>
        `;
        
        div.addEventListener('click', () => {
            selectMovie(item.imdbID);
            // On mobile, blur the input after selection
            if (window.innerWidth <= 768) {
                searchInput.blur();
            }
        });
        suggestionsDropdown.appendChild(div);
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
                <span>Your Rating</span>
                <div class="value">${item.myRating}</div>
            </div>
            <div class="rating">
                <span>IMDb</span>
                <div class="value">${item.imdbRating}</div>
            </div>
        </div>
        ${item.notes ? `<div class="notes">${item.notes}</div>` : ''}
    `;
    return div;
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

function renderWatchlist(type, items = watchlistData[type]) {
    const grid = type === 'movies' ? moviesGrid : seriesGrid;
    grid.innerHTML = '';
    items.forEach(item => {
        grid.appendChild(createWatchlistItem(item));
    });
}

// Form submission
addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check if user is authenticated and is repo owner
    if (!accessToken || !userData || userData.login !== REPO_OWNER) {
        alert('You must be logged in as the repository owner to add items');
        return;
    }
    
    const title = document.getElementById('title').value;
    const myRating = document.getElementById('my-rating').value;
    const year = document.getElementById('year').value;
    const notes = document.getElementById('notes').value;
    const posterUrl = document.getElementById('poster-url').value;
    const imdbId = document.getElementById('imdb-id').value;
    
    if (!title || !year || !imdbId) {
        alert('Please select a movie or TV show from the search results');
        return;
    }
    
    if (!title || !year) {
        alert('Please select a movie or TV show from the search results');
        return;
    }
    
    const details = await getMovieDetails(imdbId);
    
    const newItem = {
        title,
        year,
        myRating,
        imdbRating: details.imdbRating,
        imdbId,
        posterUrl,
        notes,
        type: details.Type,
        addedAt: new Date().toISOString()
    };
    
    const listType = details.Type === 'movie' ? 'movies' : 'series';
    watchlistData[listType].push(newItem);
    watchlistData[listType].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    
    // Save to GitHub repository
    await saveWatchlistData();
    renderWatchlist(listType);
    
    modal.style.display = 'none';
    resetModal();
});

// Initial render
renderWatchlist('movies');
renderWatchlist('series');