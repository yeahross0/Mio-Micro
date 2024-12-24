# mio-player

Player for mio files. Files are loaded using the [mio-loader](https://www.npmjs.com/package/mio-loader) package.

Documentation upcoming.

## Usage

Rough example of usage:

```js
const mioData = ...;

const canvas = document.getElementById('canvas_game');
const context = canvas.getContext('2d');

document.addEventListener('mousemove', handleMouseMove, false);
canvas.addEventListener('mousedown', handleMouseDown, false);
document.addEventListener('mouseup', handleMouseUp, false);

canvas.addEventListener('touchstart', handleTouchStart, false);
document.addEventListener('touchend', handleTouchEnd, false);

function handleMouseMove(event) {
	if (typeof canvas !== 'undefined') {
		mioPlayer.setStylusPosition(event.clientX, event.clientY);
	}
}

function handleMouseDown(event) {
	if (event.button === 0) {
		mioPlayer.touchScreen();
	}
}

function handleMouseUp(event) {
	if (event.button === 0) {
		mioPlayer.withdrawTouchFromScreen();
	}
}

function handleTouchStart(event) {
	if (typeof canvas !== 'undefined') {
		let touch = event.touches[0] || event.changedTouches[0];
		mioPlayer.setStylusPosition(touch.clientX, touch.clientY);
	}
	mioPlayer.touchScreen();
}

function handleTouchEnd() {
	mioPlayer.withdrawTouchFromScreen();
}

const mioPlayer = new window.Mio.Player(canvas, document);

const loadSound = (name) => {
	let audio = new Audio('audio/' + name + '.ogg');
	audio.volume = 1;
	return audio;
};

let winSounds = [loadSound('win1'), loadSound('win2'), loadSound('win3')];
let loseSounds = [loadSound('lose1'), loadSound('lose2'), loadSound('lose3')];

let sounds = [];
mioPlayer.soundNames.forEach(name => {
	let audio = loadSound(name);
	sounds.push(audio);
});

mioPlayer.sounds = sounds;
mioPlayer.winSounds = winSounds;
mioPlayer.loseSounds = loseSounds;

let fontBitmap = new Image();
fontBitmap.src = 'images/miofont.png';

mioPlayer.fontBitmap = fontBitmap;

function windowSize(window) {
	return [window.innerWidth, window.innerHeight];
}

function windowScale(window) {
	let [width, height] = windowSize(window);
	return Math.min(width / Mio.ORIGINAL_CANVAS_WIDTH, height / Mio.ORIGINAL_CANVAS_HEIGHT);
}

function handleWindowResize(event) {
	scale = windowScale(window);
	mioPlayer.scaleCanvas(scale);
	if (mioData == null) {
		context.drawImage(intro, 0, 0);
	}
}

window.addEventListener('resize', handleWindowResize, false)

mioPlayer.loadAndStart(mioData);
```
