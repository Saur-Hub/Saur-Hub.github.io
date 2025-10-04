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

        let count = 1;
        const stored = localStorage.getItem('visitorCount');

        if (stored !== null) {
            count = parseInt(stored, 10) + 1;
        }

        localStorage.setItem('visitorCount', count);
        counter.textContent = count;
    } catch (error) {
        console.error('Error updating visitor count:', error);
        // Fallback if localStorage is not available
        if (counter) counter.style.display = 'none';
    }
};

updateVisitorCount();