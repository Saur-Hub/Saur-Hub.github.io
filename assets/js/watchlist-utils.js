'use strict';

/**
 * Escape HTML special characters.
 * @param {string} text - Raw text.
 * @returns {string} Escaped text.
 */
export function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

/**
 * Validate a string input.
 * @param {string} input - Value to validate.
 * @param {number} maxLength - Maximum allowed length.
 * @param {boolean} allowEmpty - Whether empty values are allowed.
 * @returns {boolean} True when input is valid.
 */
export function isValidInput(input, maxLength = 500, allowEmpty = false) {
    if (typeof input !== 'string') return false;
    if (!allowEmpty && input.trim().length === 0) return false;
    if (input.length > maxLength) return false;
    return true;
}

/**
 * Parse a year value from strings like "2019" or "2019-2021".
 * @param {string} yearStr - Year string.
 * @returns {number} Parsed start year or 0.
 */
export function parseYear(yearStr) {
    if (!yearStr) return 0;
    const match = yearStr.toString().match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check duplicate by title and year.
 * @param {Array<{title:string,year:string}>} list - Existing list.
 * @param {{title:string,year:string}} candidate - Candidate item.
 * @returns {boolean} True if duplicate exists.
 */
export function isDuplicate(list, candidate) {
    if (!Array.isArray(list)) return false;
    return list.some(it => (it.title === candidate.title && it.year === candidate.year));
}

/**
 * Determine target list type from OMDB details.
 * @param {Object} details - OMDB details object.
 * @returns {'movies'|'series'|'anime'} Destination list type.
 */
export function determineListType(details) {
    const type = (details?.Type || '').toLowerCase();
    const genre = (details?.Genre || '').toLowerCase();

    if (genre.includes('animation')) {
        return 'anime';
    }
    if (type === 'movie') {
        return 'movies';
    }
    return 'series';
}

/**
 * Normalize and validate OMDB details payload.
 * @param {Object} data - Raw OMDB response object.
 * @returns {Object|null} Normalized details or null when invalid.
 */
export function normalizeOmdbDetails(data) {
    if (!data || !data.imdbID || !data.Title || !data.Year) {
        return null;
    }

    const type = (data.Type || '').toLowerCase();
    if (type && type !== 'movie' && type !== 'series' && type !== 'episode') {
        return null;
    }

    return {
        ...data,
        Title: String(data.Title).trim(),
        Year: String(data.Year).trim(),
        imdbID: String(data.imdbID).trim(),
        imdbRating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : 'N/A',
        Poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : 'assets/imgs/no-poster.png',
        Type: type || 'movie',
        Genre: data.Genre || ''
    };
}

/**
 * Sort a list by key.
 * @param {Array<Object>} items - Items to sort.
 * @param {'year-desc'|'year-asc'|'title-asc'} sortKey - Sort mode.
 * @returns {Array<Object>} Sorted copy of the input.
 */
export function sortItemsByKey(items, sortKey = 'year-desc') {
    const clone = [...(items || [])];

    if (sortKey === 'title-asc') {
        clone.sort((a, b) => (a.title || '').localeCompare((b.title || '')));
        return clone;
    }

    if (sortKey === 'year-asc') {
        clone.sort((a, b) => parseYear(a.year) - parseYear(b.year));
        return clone;
    }

    clone.sort((a, b) => parseYear(b.year) - parseYear(a.year));
    return clone;
}
