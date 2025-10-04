// GitHub OAuth Configuration
const GITHUB_CLIENT_ID = 'Ov23livEBhhIbW4Vf2TS';
const GITHUB_REDIRECT_URI = 'https://saur-hub.github.io/watchlist.html';
const REPO_OWNER = 'Saur-Hub';
const REPO_NAME = 'Saur-Hub.github.io';
const DATA_FILE_PATH = 'assets/data/watchlist.json';

let accessToken = null;
let userData = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', initializeAuth);

async function initializeAuth() {
    console.log('Initializing authentication...');
    
    // Check for OAuth callback
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
        console.log('OAuth callback detected with code');
        await handleOAuthCallback(code);
        // Remove code from URL
        window.history.replaceState({}, document.title, '/watchlist.html');
    }

    // Check for existing token in session storage
    accessToken = sessionStorage.getItem('github_token');
    if (accessToken) {
        console.log('Found existing access token');
        try {
            await loadUserData();
        } catch (error) {
            console.error('Error loading user data:', error);
            // If token is invalid, clear it and show login button
            handleLogout();
        }
    } else {
        console.log('No existing access token found');
        document.getElementById('login-button').style.display = 'inline-flex';
    }
}

async function handleLogin() {
    console.log('Initiating GitHub login...');
    // Add state parameter for security
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('oauth_state', state);
    
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&scope=repo&state=${state}`;
    console.log('Redirecting to GitHub auth page...');
    window.location.href = authUrl;
}

async function handleOAuthCallback(code) {
    console.log('Processing OAuth callback...');
    
    // Verify state parameter
    const state = new URLSearchParams(window.location.search).get('state');
    const savedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state'); // Clear state after use
    
    if (state !== savedState) {
        console.error('State mismatch - possible CSRF attack');
        alert('Authentication failed: Invalid state parameter');
        return;
    }

    try {
        // Using implicit grant flow since this is a public GitHub Pages site
        // The code we receive is actually a personal access token with limited scope
        console.log('Validating GitHub token...');
        
        const testResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${code}`
            }
        });
        
        if (!testResponse.ok) {
            throw new Error(`GitHub API error: ${testResponse.status}`);
        }
        
        // If we get here, the token is valid
        accessToken = code;
        sessionStorage.setItem('github_token', accessToken);
        console.log('Authentication successful');
        
        await loadUserData();
    } catch (error) {
        console.error('Authentication error:', error);
        if (error.message.includes('401')) {
            alert('Authentication failed: Invalid or expired token. Please try logging in again.');
        } else {
            alert('Authentication failed: ' + error.message);
        }
        handleLogout();
    }
}

async function loadUserData() {
    console.log('Loading user data...');
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        userData = await response.json();
        console.log('User data loaded:', userData.login);
        
        // Update UI
        document.getElementById('login-button').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-avatar').src = userData.avatar_url;
        document.getElementById('username').textContent = userData.login;
        
        // Show add button only if user is repo owner
        if (userData.login === REPO_OWNER) {
            console.log('User is repo owner - enabling add functionality');
            document.getElementById('add-button-container').style.display = 'block';
        } else {
            console.log('User is not repo owner - add functionality disabled');
        }
        
        // Verify repository access
        const repoResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!repoResponse.ok) {
            throw new Error('No access to repository');
        }

        console.log('Repository access verified');
        
        // Load watchlist data
        await loadWatchlistData();
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Failed to load user data: ' + error.message);
        handleLogout();
    }
}

function handleLogout() {
    accessToken = null;
    userData = null;
    sessionStorage.removeItem('github_token');
    
    // Update UI
    document.getElementById('login-button').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('add-button-container').style.display = 'none';
    
    // Clear watchlist data
    watchlist.movies = [];
    watchlist.series = [];
    renderWatchlist('movies');
    renderWatchlist('series');
}

async function loadWatchlistData() {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.status === 404) {
            // Create new watchlist file if it doesn't exist
            return { movies: [], series: [] };
        }
        
        const data = await response.json();
        const content = atob(data.content);
        const parsedData = JSON.parse(content);
        
        // Update watchlist state
        watchlist = parsedData;
        renderWatchlist('movies');
        renderWatchlist('series');
        
        return parsedData;
    } catch (error) {
        console.error('Error loading watchlist data:', error);
        return { movies: [], series: [] };
    }
}

async function saveWatchlistData() {
    if (!accessToken || userData.login !== REPO_OWNER) return;

    try {
        // Get the current file (if it exists) to get the SHA
        let currentFile;
        try {
            const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            currentFile = await response.json();
        } catch (e) {
            // File doesn't exist yet
        }

        const content = btoa(JSON.stringify(watchlist, null, 2));
        const body = {
            message: 'Update watchlist data',
            content,
            branch: 'master'
        };

        if (currentFile?.sha) {
            body.sha = currentFile.sha;
        }

        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error('Failed to save watchlist data');
        }
    } catch (error) {
        console.error('Error saving watchlist data:', error);
        alert('Failed to save watchlist data. Please try again.');
    }
}