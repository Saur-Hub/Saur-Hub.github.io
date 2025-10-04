'use strict';

/**
 * Audio player functionality
 */
const aud = document.getElementById('aud-player');
const myImage = document.getElementById('my-image');
const counter = document.getElementById('counter');

if (aud && myImage) {
    try {
        aud.currentTime = 20;

        const play = async () => {
            try {
                await aud.play();
            } catch (error) {
                console.error('Error playing audio:', error);
            }
        };

        const stop = () => {
            aud.pause();
        };

        myImage.addEventListener('click', play);
        myImage.addEventListener('mouseover', play);
        myImage.addEventListener('mouseout', stop);
    } catch (error) {
        console.error('Error setting up audio:', error);
    }
}

/**
 * Visitor counter functionality
 */
const updateVisitorCount = () => {
    try {
        if (!counter) return;

        // Only increment/show counter for logged-in users (GitHub login flag)
        const isLoggedIn = localStorage.getItem('github_logged_in') === 'true';
        if (!isLoggedIn) {
            counter.style.display = 'none';
            return;
        }

        // Maintain a visitorHistory array so each open increments the history
        let history = [];
        try {
            const raw = localStorage.getItem('visitorHistory');
            if (raw) history = JSON.parse(raw);
        } catch (e) {
            console.warn('Invalid visitorHistory in localStorage, resetting', e);
            history = [];
        }

        // Push a timestamp entry for this visit
        history.push({ ts: new Date().toISOString() });
        try {
            localStorage.setItem('visitorHistory', JSON.stringify(history));
        } catch (e) {
            console.warn('Failed to persist visitorHistory', e);
        }

        counter.textContent = history.length;
    } catch (error) {
        console.error('Error updating visitor count:', error);
        // Fallback if localStorage is not available
        if (counter) counter.style.display = 'none';
    }
};

updateVisitorCount();