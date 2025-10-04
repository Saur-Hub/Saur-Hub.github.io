// GitHub OAuth Configuration
const GITHUB_CLIENT_ID = 'Ov23livEBhhIbW4Vf2TS';
const GITHUB_REDIRECT_URI = 'https://saur-hub.github.io/watchlist.html';
const GITHUB_API_URL = 'https://api.github.com';
const REPO_OWNER = 'Saur-Hub';
const REPO_NAME = 'Saur-Hub.github.io';
const DATA_FILE_PATH = 'assets/data/watchlist.json';

// Note: The client secret should never be exposed in client-side code
// We'll use an OAuth proxy service for token exchange

// OAuth scopes required for the application
const REQUIRED_SCOPES = 'repo,user';

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
        // Add error handling for URL state
        try {
            await handleOAuthCallback(code);
            // Remove code from URL - use relative path to work on GitHub Pages
            const path = window.location.pathname;
            window.history.replaceState({}, document.title, path);
        } catch (error) {
            console.error('Failed to handle OAuth callback:', error);
            // Clear any existing tokens to ensure clean state
            handleLogout();
        }
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
    try {
        // Clear any existing session data
        sessionStorage.removeItem('github_token');
        
        // Generate a secure random state
        const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        // Store state and timestamp
        const stateData = {
            value: state,
            timestamp: Date.now()
        };
        sessionStorage.setItem('oauth_state', JSON.stringify(stateData));
        
        // Construct authorization URL with minimum required scopes
        const params = new URLSearchParams({
            client_id: GITHUB_CLIENT_ID,
            redirect_uri: GITHUB_REDIRECT_URI,
            scope: 'repo,user', // Explicit scope definition
            state: state
        });
        
        const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
        console.log('Redirecting to GitHub auth page...');
        
        // Redirect to GitHub
        window.location.href = authUrl;
    } catch (error) {
        console.error('Failed to initiate login:', error);
        alert('Failed to start login process. Please try again.');
    }
}

async function handleOAuthCallback(code) {
    console.log('Processing OAuth callback...');
    
    try {
        // Verify state parameter
        const state = new URLSearchParams(window.location.search).get('state');
        const savedStateData = JSON.parse(sessionStorage.getItem('oauth_state') || '{}');
        sessionStorage.removeItem('oauth_state'); // Clear state after use
        
        // Verify state and check if it's not expired (10 minute window)
        if (!state || !savedStateData.value || state !== savedStateData.value || 
            Date.now() - savedStateData.timestamp > 600000) {
            throw new Error('Invalid or expired state parameter');
        }

        // For GitHub Pages, we'll use the authorization code as a token
        // This is a workaround since we can't securely exchange the code for a token on the client side
        console.log('Setting up GitHub API access...');
        
        // Set the authorization code as our access token
        accessToken = code;
        
        // Test the token with a simple API call
        const testResponse = await fetch(`${GITHUB_API_URL}/user`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${accessToken}` // Use 'token' prefix for GitHub API
            }
        });
        
        if (!testResponse.ok) {
            throw new Error(`Failed to validate GitHub access: ${testResponse.status}`);
        }
        
        // Check if we have the required permissions
        const userData = await userResponse.json();
        if (userData.login !== REPO_OWNER) {
            throw new Error('You must be the repository owner to access this application');
        }
        
        // Store the token and redirect to clean URL
        sessionStorage.setItem('github_token', accessToken);
        console.log('Authentication successful');
        
        // Load user data and initialize the application
        await loadUserData();
        
        // Remove code and state from URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    } catch (error) {
        console.error('Authentication error:', error);
        const errorMessage = error.message || 'Unknown error occurred';
        
        // Provide user-friendly error message
        if (errorMessage.includes('401')) {
            alert('Authentication failed: Your session has expired. Please log in again.');
        } else if (errorMessage.includes('403')) {
            alert('Authentication failed: Insufficient permissions. Please ensure you are the repository owner.');
        } else {
            alert(`Authentication failed: ${errorMessage}`);
        }
        
        // Log detailed error information for debugging
        console.log('Detailed error information:', {
            message: error.message,
            status: error.status,
            stack: error.stack
        });
        
        handleLogout();
    }
}

async function loadUserData() {
    console.log('Loading user data...');
    try {
        // Verify token exists
        if (!accessToken) {
            throw new Error('No access token available');
        }

        const response = await fetch(`${GITHUB_API_URL}/user`, {
            headers: {
                'Authorization': `token ${accessToken}`, // Use 'token' prefix for GitHub API
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
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