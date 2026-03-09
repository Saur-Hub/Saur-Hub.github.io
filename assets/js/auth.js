import { GITHUB_CLIENT_ID as CONFIG_CLIENT_ID } from './config.js';

// Development environment detection
const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// API Configuration
const NETLIFY_URL = isDev ? 'http://localhost:8888' : 'https://saur-hub-static.netlify.app';

// GitHub Configuration
export const GITHUB_API_URL = "https://api.github.com";
export const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_CLIENT_ID = CONFIG_CLIENT_ID;
// REDIRECT_URI matches the OAuth App callback URL configured on GitHub
// Development OAuth App: callback URL = http://localhost:8888/
// Production OAuth App: callback URL = https://saur-hub-static.netlify.app/
export const REDIRECT_URI = isDev ? "http://localhost:8888/" : "https://saur-hub-static.netlify.app/";

// Repository configuration
export const REPO_OWNER = "Saur-Hub";
const REPO_NAME = "Saur-Hub.github.io";
const DATA_FILE_PATH = "assets/data/watchlist.json";
const KEYWORDS_FILE_PATH = "assets/data/keywords.json";

// Token storage keys
const TOKEN_STORAGE_KEY = "github_token";

// State
export let accessToken = null;
export let userData = null;
export let watchlist = {
    movies: [],
    series: [],
    anime: []
};

function getAuthElements() {
    if (typeof document === 'undefined') {
        return {};
    }

    return {
        loginButton: document.getElementById("login-button"),
        userInfo: document.getElementById("user-info"),
        addButtonContainer: document.getElementById("add-button-container"),
        userAvatar: document.getElementById("user-avatar"),
        username: document.getElementById("username")
    };
}

function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

function decodeBase64Utf8(base64Text) {
    const binary = atob(base64Text);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export async function initializeAuth() {
    console.log("Initializing authentication...");
    
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
        console.log("Skipping auth initialization in non-browser environment");
        return;
    }
    
    try {
        // Check for existing token in session storage
        accessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
        if (accessToken) {
            console.log("Found existing access token");
            await loadUserData();
            return;
        }

        // Check for OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const state = urlParams.get("state");
        
        if (code && state) {
            // Verify state parameter
            const savedState = sessionStorage.getItem("oauth_state");
            if (state !== savedState) {
                throw new Error("Invalid state parameter");
            }
            sessionStorage.removeItem("oauth_state");

            // Exchange code for access token using Netlify function
            const tokenResponse = await fetch(`${NETLIFY_URL}/.netlify/functions/github-auth`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ code, state })
            });

            const data = await tokenResponse.json();
            
            if (data.error) {
                console.error("OAuth error:", data.error_description || data.error);
                throw new Error(data.error_description || data.error);
            }

            if (!data.access_token) {
                console.error("No access token in response:", data);
                throw new Error("Invalid token response");
            }

            accessToken = data.access_token;
            sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
            await loadUserData();
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        // If we get here, no valid token was found
        console.log("No existing access token found");
        const { loginButton, userInfo, addButtonContainer } = getAuthElements();
        if (loginButton) loginButton.style.display = "inline-flex";
        if (userInfo) userInfo.style.display = "none";
        if (addButtonContainer) addButtonContainer.style.display = "none";
    } catch (error) {
        console.error("Error during auth initialization:", error);
        handleLogout();
    }
}

export function handleLogin() {
    console.log("Initiating GitHub OAuth flow...");
    
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
        console.log("Login is only available in browser environment");
        return;
    }
    
    try {
        // Clear any existing tokens
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        
        // Generate a random state value for security
        const state = Math.random().toString(36).substring(7);
        sessionStorage.setItem("oauth_state", state);
        
        // Build the OAuth URL
        const params = new URLSearchParams({
            client_id: GITHUB_CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            scope: "repo,user",
            state: state
        });
        
        // Redirect to GitHub OAuth
        window.location.href = `${GITHUB_OAUTH_URL}?${params.toString()}`;
    } catch (error) {
        console.error("Login failed:", error);
        if (typeof alert !== 'undefined') {
            alert("Login failed: " + (error.message || "Please try again"));
        }
        handleLogout();
    }
}

async function loadUserData() {
    console.log("Loading user data...");
    
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        console.log("loadUserData is only available in browser environment");
        return;
    }
    
    try {
        if (!accessToken) {
            throw new Error("No access token available");
        }

        const response = await fetch(`${GITHUB_API_URL}/user`, {
            headers: {
                "Authorization": `token ${accessToken}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("GitHub API error:", response.status, errorData);
            throw new Error(`GitHub API error: ${response.status} ${errorData.message || "Unknown error"}`);
        }

        userData = await response.json();
        console.log("User data loaded:", userData.login);
        // Mark logged-in state in localStorage so other pages can detect login
        try {
            localStorage.setItem("github_logged_in", "true");
        } catch (e) {
            console.warn("Could not set github_logged_in flag in localStorage", e);
        }
        
        // Update UI
        const { loginButton, userInfo, addButtonContainer, userAvatar, username } = getAuthElements();
        if (loginButton) loginButton.style.display = "none";
        if (userInfo) userInfo.style.display = "flex";
        if (userAvatar) userAvatar.src = userData.avatar_url;
        if (username) username.textContent = userData.login;
        
        // Show add button only if user is repo owner
        if (userData.login === REPO_OWNER && addButtonContainer) {
            addButtonContainer.style.display = "block";
        }
        
        // Verify repository access
        const repoResponse = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}`, {
            headers: {
                "Authorization": `token ${accessToken}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!repoResponse.ok) {
            const errorData = await repoResponse.json().catch(() => ({}));
            console.error("Repository access error:", repoResponse.status, errorData);
            throw new Error(`Repository access error: ${repoResponse.status} ${errorData.message || "No access to repository"}`);
        }

        console.log("Repository access verified");
        
        // Load watchlist data
        await loadWatchlistData();
    } catch (error) {
        console.error("Error loading user data:", error);
        if (typeof alert !== 'undefined') {
            alert("Failed to load user data: " + error.message);
        }
        handleLogout();
    }
}

export function handleLogout() {
    accessToken = null;
    userData = null;
    
    // Only update storage and UI in browser environment
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem("github_logged_in");
        }
    } catch (e) {
        console.warn("Could not remove github_logged_in flag from localStorage", e);
    }
    
    // Update UI only if DOM is available
    if (typeof document !== 'undefined') {
        const { loginButton, userInfo, addButtonContainer } = getAuthElements();
        if (loginButton) loginButton.style.display = "block";
        if (userInfo) userInfo.style.display = "none";
        if (addButtonContainer) addButtonContainer.style.display = "none";
    }
    
    // Clear watchlist data
    watchlist.movies = [];
    watchlist.series = [];
    watchlist.anime = [];
    if (typeof window !== 'undefined' && window.renderWatchlist) {
        window.renderWatchlist?.("movies");
        window.renderWatchlist?.("series");
        window.renderWatchlist?.("anime");
    }
}

export async function loadWatchlistData() {
    try {
        // Build headers conditionally: include Authorization only when we have a valid accessToken
        const headers = {
            "Accept": "application/vnd.github.v3+json"
        };
        if (accessToken) headers["Authorization"] = `token ${accessToken}`;

        const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
            headers
        });
        
        if (response.status === 404) {
            // Create new watchlist file if it doesn"t exist
            watchlist = { movies: [], series: [], anime: [] };
            return watchlist;
        }
        
        const data = await response.json();
        const content = decodeBase64Utf8(data.content);
        const parsed = JSON.parse(content);
        watchlist = {
            movies: Array.isArray(parsed.movies) ? parsed.movies : [],
            series: Array.isArray(parsed.series) ? parsed.series : [],
            anime: Array.isArray(parsed.anime) ? parsed.anime : []
        };
        window.renderWatchlist?.("movies");
        window.renderWatchlist?.("series");
        window.renderWatchlist?.("anime");
        
        return watchlist;
    } catch (error) {
        console.error("Error loading watchlist data:", error);
        watchlist = { movies: [], series: [], anime: [] };
        return watchlist;
    }
}

export async function saveWatchlistData(data = null) {
    // Allow caller to pass the watchlist object to save; fall back to module-level `watchlist`.
    const toSave = data ?? watchlist;
    if (!accessToken || userData?.login !== REPO_OWNER) {
        throw new Error("Not authorized to save watchlist data");
    }

    try {
        // Get the current file (if it exists) to get the SHA
        let currentFile;
        try {
            const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
                headers: {
                    "Authorization": `token ${accessToken}`,
                    "Accept": "application/vnd.github.v3+json"
                }
            });
            // Only treat it as existing if we got a 200
            if (response.ok) {
                currentFile = await response.json();
            }
        } catch (e) {
            // File doesn"t exist yet or network error; will create on PUT
        }

        // Update module-level watchlist so future callers/readers see the latest data
        try {
            watchlist = JSON.parse(JSON.stringify(toSave));
        } catch (e) {
            // Fallback: keep existing watchlist
        }

        // GitHub expects base64-encoded content
        const content = encodeBase64Utf8(JSON.stringify(toSave, null, 2));
        const body = {
            message: "Update watchlist data",
            content
        };

        if (currentFile?.sha) {
            body.sha = currentFile.sha;
        }

        console.log("Saving watchlist to GitHub:", { path: DATA_FILE_PATH, size: content.length, preview: JSON.stringify(toSave).slice(0,200) });
        const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, {
            method: "PUT",
            headers: {
                "Authorization": `token ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Failed to save watchlist data:", response.status, errorData);
            throw new Error(`Failed to save watchlist data: ${response.status} ${errorData.message || "Unknown error"}`);
        } else {
            // Try to log commit info for visibility
            const respData = await response.json().catch(() => ({}));
            console.log("Watchlist saved:", respData.commit ? respData.commit.sha : respData);
            return respData;
        }
    } catch (error) {
        console.error("Error saving watchlist data:", error);
        throw error;
    }
}

// Save keywords array (owner-only). Accepts an array or object and writes to KEYWORDS_FILE_PATH
export async function saveKeywords(keywords) {
    const toSave = keywords;
    if (!accessToken || userData?.login !== REPO_OWNER) throw new Error("Not authorized");

    try {
        let currentFile;
        try {
            const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${KEYWORDS_FILE_PATH}`, {
                headers: {
                    "Authorization": `token ${accessToken}`,
                    "Accept": "application/vnd.github.v3+json"
                }
            });
            if (response.ok) {
                currentFile = await response.json();
            }
        } catch (e) {
            // file may not exist
        }

        const content = encodeBase64Utf8(JSON.stringify(toSave, null, 2));
        const body = {
            message: "Update keywords",
            content
        };

        if (currentFile?.sha) body.sha = currentFile.sha;

        const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${KEYWORDS_FILE_PATH}`, {
            method: "PUT",
            headers: {
                "Authorization": `token ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to save keywords: ${response.status} ${errorData.message || ""}`);
        }

        const respData = await response.json().catch(() => ({}));
        console.log("Keywords saved:", respData.commit ? respData.commit.sha : respData);
        return respData;
    } catch (error) {
        console.error("Error saving keywords:", error);
        throw error;
    }
}
