// GitHub Configuration
export const GITHUB_API_URL = 'https://api.github.com';
export const GITHUB_DEVICE_CODE_URL = 'https://gh-device-auth.azurewebsites.net/api/device/code';
export const GITHUB_ACCESS_TOKEN_URL = 'https://gh-device-auth.azurewebsites.net/api/device/token';
export const GITHUB_CLIENT_ID = 'Ov23livEBhhIbW4Vf2TS';

// Polling configuration
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 12; // 1 minute total
const REPO_OWNER = 'Saur-Hub';
const REPO_NAME = 'Saur-Hub.github.io';
const DATA_FILE_PATH = 'assets/data/watchlist.json';

// Token storage keys
const TOKEN_STORAGE_KEY = 'github_token';

// State
export let accessToken = null;
export let userData = null;
export let watchlist = {
    movies: [],
    series: []
};

export async function initializeAuth() {
    console.log('Initializing authentication...');
    
    try {
        // Check for existing token in session storage
        accessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
        if (accessToken) {
            console.log('Found existing access token');
            await loadUserData();
            return;
        }

        // If we get here, no valid token was found
        console.log('No existing access token found');
        document.getElementById('login-button').style.display = 'inline-flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('add-button-container').style.display = 'none';
    } catch (error) {
        console.error('Error during auth initialization:', error);
        handleLogout();
    }
}

export async function handleLogin() {
    console.log('Initiating GitHub device flow...');
    try {
        // Clear any existing tokens
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        
        // Request device and user codes
        const deviceCodeResponse = await fetch(GITHUB_DEVICE_CODE_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Origin': window.location.origin,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                scope: 'repo,user'
            })
        });

        if (!deviceCodeResponse.ok) {
            throw new Error('Failed to initialize device flow');
        }

        const deviceData = await deviceCodeResponse.json();
        
        // Show verification UI
        showVerificationUI(deviceData.verification_uri, deviceData.user_code);
        
        // Start polling for token
        await pollForToken(deviceData.device_code, deviceData.interval || 5);
    } catch (error) {
        console.error('Login failed:', error);
        alert('Login failed: ' + (error.message || 'Please try again'));
        handleLogout();
    }
}

function showVerificationUI(verificationUri, userCode) {
    // Create modal for verification UI
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        text-align: center;
    `;
    
    modal.innerHTML = `
        <h3>Complete GitHub Authentication</h3>
        <p>1. Visit: <a href="${verificationUri}" target="_blank">${verificationUri}</a></p>
        <p>2. Enter code: <strong>${userCode}</strong></p>
        <p>Waiting for authentication...</p>
    `;
    
    document.body.appendChild(modal);
    window.currentAuthModal = modal;
}

async function pollForToken(deviceCode, interval) {
    let attempts = 0;
    
    while (attempts < MAX_POLL_ATTEMPTS) {
        try {
            const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    client_id: GITHUB_CLIENT_ID,
                    device_code: deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                })
            });

            const data = await response.json();
            
            if (data.access_token) {
                // Success! Store the token and clean up
                accessToken = data.access_token;
                sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
                if (window.currentAuthModal) {
                    document.body.removeChild(window.currentAuthModal);
                    window.currentAuthModal = null;
                }
                await loadUserData();
                return;
            }
            
            // If still authorizing, wait and try again
            if (data.error === 'authorization_pending') {
                await new Promise(resolve => setTimeout(resolve, interval * 1000));
                attempts++;
                continue;
            }
            
            // If other error, stop polling
            throw new Error(data.error_description || 'Authentication failed');
            
        } catch (error) {
            console.error('Polling error:', error);
            if (window.currentAuthModal) {
                document.body.removeChild(window.currentAuthModal);
                window.currentAuthModal = null;
            }
            throw error;
        }
    }
    
    // If we get here, polling timed out
    if (window.currentAuthModal) {
        document.body.removeChild(window.currentAuthModal);
        window.currentAuthModal = null;
    }
    throw new Error('Authentication timed out. Please try again.');
}

async function loadUserData() {
    console.log('Loading user data...');
    try {
        if (!accessToken) {
            throw new Error('No access token available');
        }

        const response = await fetch(`${GITHUB_API_URL}/user`, {
            headers: {
                'Authorization': `token ${accessToken}`,
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
            document.getElementById('add-button-container').style.display = 'block';
        }
        
        // Verify repository access
        const repoResponse = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}`, {
            headers: {
                'Authorization': `token ${accessToken}`,
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

export function handleLogout() {
    accessToken = null;
    userData = null;
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    
    // Update UI
    document.getElementById('login-button').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('add-button-container').style.display = 'none';
    
    // Clear watchlist data
    watchlist.movies = [];
    watchlist.series = [];
    window.renderWatchlist?.('movies');
    window.renderWatchlist?.('series');
}

export async function loadWatchlistData() {
    try {
        const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.status === 404) {
            // Create new watchlist file if it doesn't exist
            watchlist = { movies: [], series: [] };
            return watchlist;
        }
        
        const data = await response.json();
        const content = atob(data.content);
        watchlist = JSON.parse(content);
        window.renderWatchlist?.('movies');
        window.renderWatchlist?.('series');
        
        return watchlist;
    } catch (error) {
        console.error('Error loading watchlist data:', error);
        watchlist = { movies: [], series: [] };
        return watchlist;
    }
}

export async function saveWatchlistData() {
    if (!accessToken || userData?.login !== REPO_OWNER) return;

    try {
        // Get the current file (if it exists) to get the SHA
        let currentFile;
        try {
            const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
                headers: {
                    'Authorization': `token ${accessToken}`,
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

        const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${accessToken}`,
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