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