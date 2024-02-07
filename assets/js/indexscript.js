'use strict'

var aud = document.getElementById('aud-player')
var myImage = document.getElementById('my-image')
console.log(aud)
console.log(myImage)
aud.currentTime = 20

function play() {
  aud.play();
}

function stop(){
  aud.pause();
}

myImage.addEventListener('click', play)
myImage.addEventListener('mouseover',play)
myImage.addEventListener('mouseout',stop)


// Check if the visitor count has already been set
if (localStorage.getItem('visitorCount') === null) {

	// If not, set the visitor count to 1
	localStorage.setItem('visitorCount', 1);
	document.getElementById('counter').innerHTML = '1';

} else {
	// If so, increment the visitor count
	let count = parseInt(localStorage.getItem('visitorCount')) + 1;

	localStorage.setItem('visitorCount', count);
	document.getElementById('counter').innerHTML = count;
}

/*
// Check if the user ID cookie exists
let userId = getCookie('userID');

if (userId === '') {
	// If not, set a new user ID and count
	userId = generateRandomId();
	setCookie('userID', userId, 365);
	let visitCount = parseInt(getCookie('visitCount')) || 0;
	visitCount++;
	setCookie('visitCount', visitCount, 365);
	document.getElementById('counter').innerHTML = visitCount;
} else {
	// If so, get the visit count
	let visitCount = parseInt(getCookie('visitCount'));
	document.getElementById('counter').innerHTML = visitCount;
}

// Function to generate a random user ID
function generateRandomId() {
	return Math.random().toString(36).substring(2) + Date.now();
}

// Function to get a cookie value
function getCookie(name) {
	let cookieValue = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
	return cookieValue ? cookieValue.pop() : '';
}

// Function to set a cookie value
function setCookie(name, value, days) {
	let expires = '';
	if (days) {
		let date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = '; expires=' + date.toUTCString();
	}
	document.cookie = name + '=' + (value || '') + expires + '; path=/';
}*/