// Development environment detection
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// API Configuration
const NETLIFY_URL = isDev ? 'http://localhost:8888' : 'https://saur-hub-static.netlify.app';

// GitHub Configuration
export const GITHUB_API_URL = "https://api.github.com";
export const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_CLIENT_ID = "Ov23livEBhhIbW4Vf2TS";
export const REDIRECT_URI = isDev ? "http://localhost:8888/watchlist.html" : "https://saur-hub-static.netlify.app/watchlist.html";

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
    series: []
};

export async function initializeAuth() {
    console.log("Initializing authentication...");
    
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
        document.getElementById("login-button").style.display = "inline-flex";
        document.getElementById("user-info").style.display = "none";
        document.getElementById("add-button-container").style.display = "none";
    } catch (error) {
        console.error("Error during auth initialization:", error);
        handleLogout();
    }
}

export function handleLogin() {
    console.log("Initiating GitHub OAuth flow...");
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
        alert("Login failed: " + (error.message || "Please try again"));
        handleLogout();
    }
}

async function loadUserData() {
    console.log("Loading user data...");
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
        document.getElementById("login-button").style.display = "none";
        document.getElementById("user-info").style.display = "flex";
        document.getElementById("user-avatar").src = userData.avatar_url;
        document.getElementById("username").textContent = userData.login;
        
        // Show add button only if user is repo owner
        if (userData.login === REPO_OWNER) {
            document.getElementById("add-button-container").style.display = "block";
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
        alert("Failed to load user data: " + error.message);
        handleLogout();
    }
}

export function handleLogout() {
    accessToken = null;
    userData = null;
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    try {
        localStorage.removeItem("github_logged_in");
    } catch (e) {
        console.warn("Could not remove github_logged_in flag from localStorage", e);
    }
    
    // Update UI
    document.getElementById("login-button").style.display = "block";
    document.getElementById("user-info").style.display = "none";
    document.getElementById("add-button-container").style.display = "none";
    
    // Clear watchlist data
    watchlist.movies = [];
    watchlist.series = [];
    window.renderWatchlist?.("movies");
    window.renderWatchlist?.("series");
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
            watchlist = { movies: [], series: [] };
            return watchlist;
        }
        
        const data = await response.json();
        const content = atob(data.content);
        watchlist = JSON.parse(content);
        window.renderWatchlist?.("movies");
        window.renderWatchlist?.("series");
        
        return watchlist;
    } catch (error) {
        console.error("Error loading watchlist data:", error);
        watchlist = { movies: [], series: [] };
        return watchlist;
    }
}

export async function saveWatchlistData(data = null) {
    // Allow caller to pass the watchlist object to save; fall back to module-level `watchlist`.
    const toSave = data ?? watchlist;
    if (!accessToken || userData?.login !== REPO_OWNER) return;

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
        const content = btoa(JSON.stringify(toSave, null, 2));
        const body = {
            message: "Update watchlist data",
            content,
            branch: "master"
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
        alert("Failed to save watchlist data. Please try again.");
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

        const content = btoa(JSON.stringify(toSave, null, 2));
        const body = {
            message: "Update keywords",
            content,
            branch: "master"
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
