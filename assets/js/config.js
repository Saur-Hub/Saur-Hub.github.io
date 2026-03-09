/**
 * Site Configuration
 * 
 * This file contains configuration values that should be kept secure.
 * In development, these can be set directly. In production, they should be
 * injected via environment variables during the build process.
 * 
 * Usage:
 * - Set via environment variables in Netlify/build process
 * - Or add to window.siteConfig before loading this script
 */

// Get config from window object (set by environment) or use defaults
const envConfig = typeof window !== 'undefined' ? window.siteConfig || {} : {};

// Development environment detection
const isDev = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// GitHub OAuth Client IDs (different for dev and production)
// Development: Create an OAuth App with callback URL: http://localhost:8888/
// Production: Create an OAuth App with callback URL: https://saur-hub-static.netlify.app/
export const GITHUB_CLIENT_ID = isDev 
  ? (envConfig.GITHUB_CLIENT_ID_DEV || 'Ov23lic8uJO3RrwFczlc')      // Development OAuth App
  : (envConfig.GITHUB_CLIENT_ID_PROD || 'Ov23livEBhhIbW4Vf2TS');      // Production OAuth App

export const OMDB_API_BASE = envConfig.OMDB_API_BASE || 'https://www.omdbapi.com';

// Don't export secrets that should only be on the server
// export const GITHUB_CLIENT_SECRET = envConfig.GITHUB_CLIENT_SECRET; // This should NEVER be in client-side code
