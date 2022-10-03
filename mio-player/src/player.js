const Mio = require('mio-loader');
const EventEmitter = require('events').EventEmitter;

const ORIGINAL_CANVAS_WIDTH = 192;
const ORIGINAL_CANVAS_HEIGHT = 128;

function windowSizeComparedToOriginal(width, height) {
	return Math.min(width / ORIGINAL_CANVAS_WIDTH, height / ORIGINAL_CANVAS_HEIGHT);
}

let silentMusicPlayer = {
	playMusic: () => false,
	pauseMusic: () => false,
	hasTrackEnded: () => false,
};

class Player extends EventEmitter {
	mouseDown = false;
	_musicPlayer = silentMusicPlayer;
	gameId = 0;
	shouldShowCommand = true;
	isInfiniteMode = false;
	isPaused = false;

	constructor(canvas, document) {
		super();

		this.canvas = canvas;
		this.context = canvas.getContext('2d');

		this.collisionCanvas = document.createElement('canvas');
		this.collisionContext = this.collisionCanvas.getContext('2d');
	}

	get soundNames() {
		return audioNames;
	}

	set sounds(sounds) {
		this._sounds = sounds;
	}

	set winSounds(sounds) {
		this._winSounds = sounds;
	}

	set loseSounds(sounds) {
		this._loseSounds = sounds;
	}

	set fontBitmap(fontBitmap) {
		this._fontBitmap = fontBitmap;
	}

	set musicPlayer(musicPlayer) {
		this._musicPlayer = musicPlayer;
	}

	touchScreen() {
		this.mouseDown = true;
	}

	withdrawTouchFromScreen() {
		this.mouseDown = false;
	}

	setStylusPosition(x, y) {
		let rect = this.canvas.getBoundingClientRect();
		let scale = windowSizeComparedToOriginal(this.canvas.width, this.canvas.height);
		mouse.x = Math.floor((x - rect.left) / scale);
		mouse.y = Math.floor((y - rect.top) / scale);
	}

	scaleCanvas(scale) {
		this.canvas.width = ORIGINAL_CANVAS_WIDTH * scale;
		this.canvas.height = ORIGINAL_CANVAS_HEIGHT * scale;
		this.context.scale(scale, scale);
		this.context.imageSmoothingEnabled = false;
	}

	stop() {
		this.gameId++;
	}
	
	loadAndStart(data) {
		this.gameId++;
		let gameData = new Mio.GameData(data);
		console.log(gameData.name);
		console.log(gameData.command);

		let backgroundImage = backgroundImageFromData(this.context, data)

		let { imageData, collisionData } = objectImagesFromGameData(gameData, this.context);

		let winConditions = winConditionsFromGameData(gameData);
		console.log(winConditions);

		let command = gameData.command;
		let length = gameData.length;

		let objects = objectsFromGameData(gameData, collisionData);

		console.log(objects);

		let layers = layersFromData(data, objects.length);

		let properties = propertiesFromObjects(objects)

		jumpToStartingPositions(objects, properties, collisionData);

		console.log(properties);

		this.emit('loaded');

		this._musicPlayer.playMusic();

		requestAnimationFrame(() => {

			if (this.shouldShowCommand) {
				drawText(this.context, this._fontBitmap, command);
			}

			this.emit('playing');

			this.runFrame(
				{ id: this.gameId, length, objects, winConditions, layers, collisionData, command },
				{ properties, winStatus: Mio.GameCondition.NotYetWon, frame: 0, time: 0, lastTimestamp: null, isFrozen: false, collisionPixels: [] },
				{ imageData, backgroundImage, sounds: this._sounds, winSounds: this._winSounds, loseSounds: this._loseSounds }
			);
		})
	}

	runFrame(gameData, state, assets) {
		// TODO: Code reuse
		let end;
		if (gameData.length === Mio.Length.Short) {
			end = 32;
		} else if (gameData.length === Mio.Length.Long) {
			end = 64;
		}
		let endFrame = typeof end !== 'undefined' ? end * 7.5 : undefined;
		if (gameData.id !== this.gameId) {
			return;
		}

		const emitEndedEvent = () => {
			if (!this.isPaused) {
				this.emit('ended');
			}
		};
		// TODO: Relies on number > undefined being false, change to something more obvious
		if (state.frame > endFrame && !this.isInfiniteMode) {
			emitEndedEvent();
			this.isPaused = true;
		} else if (gameData.length === Mio.Length.Boss) {
			let hasConcluded = (state.winStatus === Mio.GameCondition.HasBeenWon || state.winStatus === Mio.GameCondition.HasBeenLost);
			if (hasConcluded && state.frame % 240 === 0 && !this.isInfiniteMode) {
				emitEndedEvent();
				this.isPaused = true;
			} else {
				this.isPaused = false;
			}
		} else {
			this.isPaused = false;
		}

		let frameDelay = 1000 / 60;
		if (this.isPaused) {
			this._musicPlayer.pauseMusic();
			this.drawGame(state, gameData, assets);
			this.context.fillStyle = "#88888844";
			this.context.fillRect(0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
		} else {
			if (state.time > state.frame * frameDelay) {
				if (this._musicPlayer.hasTrackEnded() && gameData.length === Mio.Length.Boss) {
					this._musicPlayer.playMusic();
				}

				this.updateGame(gameData, state, assets);
				this.emit('frameupdate', state.frame, endFrame);
			}
		}

		requestAnimationFrame(time => {
			if (this.isPaused) {
				state.lastTimestamp = null;
			} else {
				if (state.lastTimestamp === null) {
					state.lastTimestamp = time;
				}

				const MAX_PLAUSIBLE_DELTA = 50;
				state.time += Math.min(time - state.lastTimestamp, MAX_PLAUSIBLE_DELTA);
				state.lastTimestamp = time;
			}
			this.runFrame(gameData, state, assets);
		})
	}

	drawGame(state, gameData, assets) {
		if (state.isFrozen) {
			this.context.filter = 'invert(1)';
		} else {
			this.context.filter = 'none';
		}
		this.context.drawImage(assets.backgroundImage, 0, 0);
		this.collisionContext.clearRect(0, 0, this.collisionCanvas.width, this.collisionCanvas.height);

		let layerCount = Math.min(gameData.layers.length, state.properties.length);

		for (let layer = 0; layer < layerCount; layer++) {
			let i = gameData.layers[layer];
			let props = state.properties[i];
			if (props !== null) {
				let size = props.size;
				let halfSize = size / 2;
				let bank = props.art.bankIndex;
				let image = assets.imageData[bank];
				let position = props.position;
				this.context.drawImage(image, Math.floor(position.x - halfSize), Math.floor(position.y - halfSize));
				let collisionImage = gameData.collisionData[bank].sprite;
				this.collisionContext.drawImage(collisionImage, Math.floor(position.x - halfSize), Math.floor(position.y - halfSize));
			}
		}

		if (state.frame < 45 && this.shouldShowCommand) {
			drawText(this.context, this._fontBitmap, gameData.command);
		}
	}

	updateGame(gameData, state, assets) {
		let oldWinStatus = state.winStatus;

		this.updateMouse(mouse);

		if (!state.isFrozen) {
			let triggeredActions = triggeredActionsThisFrame(state, gameData);

			applyAllActions(triggeredActions, state, gameData, assets);

			updateAnimations(state, gameData);

			moveObjects(state, gameData);

			updateSwitchStates(state.properties);

			winGameIfConditionsAreMet(state, gameData, oldWinStatus, assets.winSounds);

			loseIfOutOfTime(state, gameData, assets.loseSounds);
		}

		this.drawGame(state, gameData, assets);

		state.collisionPixels = this.collisionContext.getImageData(0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT).data;

		state.frame++;
	}

	updateMouse(mouse) {
		if (mouse.state === ButtonState.Up || mouse.state === ButtonState.Release) {
			if (this.mouseDown) {
				console.log('Mouse pressed');
				mouse.state = ButtonState.Press;
			} else {
				mouse.state = ButtonState.Up;
			}
		} else if (mouse.state === ButtonState.Down || mouse.state === ButtonState.Press) {
			if (this.mouseDown) {
				mouse.state = ButtonState.Down;
			} else {
				mouse.state = ButtonState.Release;
			}
		}
	}
}

const BACKGROUND_WIDTH = 192;
const BACKGROUND_HEIGHT = 128;
const BACKGROUND_PIXEL_COUNT = BACKGROUND_WIDTH * BACKGROUND_HEIGHT;
const COLOUR_BYTES_COUNT = 4;
// TODO: Make algorithm that doesn't rely on luck
const MAX_BEFORE_GAME_JUMP_ATTEMPTS = 18;
const MAX_DURING_GAME_JUMP_ATTEMPTS = 6;

let drawText = (context, fontBitmap, text, size = 16) => {
	if (typeof fontBitmap === 'undefined') {
		return;
	}
	let gradient = context.createLinearGradient(0, 0, 1, 100);
	gradient.addColorStop(0, 'white');
	gradient.addColorStop(0.6, 'white');
	gradient.addColorStop(0.675, 'gray');

	let w = 18;
	let h = 18;

	let widthInPixels = 0;

	let firstChar = new TextEncoder().encode(text)[0];
	if ((firstChar & 0xE0) !== 0xE0) {

		for (let i = 0; i < text.length; i++) {
			let letter = text[i];
			let letterWidth = letterSpacing[letter] || w;

			widthInPixels += letterWidth;
		}

		let startOffset = BACKGROUND_WIDTH / 2 - widthInPixels / 2;

		let offsetSoFar = startOffset;

		for (let i = 0; i < text.length; i++) {
			let letterIndex = indexInFontBitmap(text[i]);
			let bitmapIndex = letterIndex < 256 ? letterIndex : 32;
			let bitmapX = bitmapIndex % 16 * w;
			let bitmapY = Math.floor(bitmapIndex / 16) * h;

			let args = [fontBitmap, bitmapX, bitmapY, w - 1, h - 1, offsetSoFar, BACKGROUND_HEIGHT / 2 - h + 5, w, h];

			context.drawImage(...args);

			let letterWidth = letterSpacing[text[i]] || w;
			offsetSoFar += letterWidth;
		}
	} else {
		context.font = size + 'px warioware-diy-ds-microgame-font';
		context.lineWidth = 2;
		context.textAlign = "center";
		//text = text.split("").join(String.fromCharCode(0x200A))
		context.strokeText(text, BACKGROUND_WIDTH / 2, BACKGROUND_HEIGHT / 2);

		context.fillStyle = gradient;
		context.textAlign = "center";
		context.fillText(text, BACKGROUND_WIDTH / 2, BACKGROUND_HEIGHT / 2);
	}
}

let randomInRange = (min, max) => min + (max - min) * Math.random();
let randomIntInRange = (min, max) => Math.floor(randomInRange(min, max));
let randomInArray = (array) => array[randomIntInRange(0, array.length)];

function positionInArea(area, size) {
	let halfSize = size / 2;
	let minX = area.min.x + halfSize;
	let maxX = area.max.x - halfSize;
	let x;
	if (minX > maxX) {
		x = (area.min.x + area.max.x) / 2;
	} else {
		x = randomIntInRange(minX, maxX);
	}
	let minY = area.min.y + halfSize;
	let maxY = area.max.y - halfSize;
	let y;
	if (minY > maxY) {
		y = (area.min.y + area.max.y) / 2;
	} else {
		y = randomIntInRange(minY, maxY);
	}
	return { x, y }
}

function animationTimeFromSpeed(speed) {
	let animationTimeMap = {
		[Mio.Speed.Slowest]: 60,
		[Mio.Speed.Slow]: 30,
		[Mio.Speed.Normal]: 15,
		[Mio.Speed.Fast]: 8,
		[Mio.Speed.Fastest]: 4
	};

	return animationTimeMap[speed];
}

function valueFromSpeed(speed) {
	let speedMap = {
		[Mio.Speed.Slowest]: 0.5,
		[Mio.Speed.Slow]: 1,
		[Mio.Speed.Normal]: 1.5,
		[Mio.Speed.Fast]: 3,
		[Mio.Speed.Fastest]: 6
	};
	return speedMap[speed];
}

const ActiveTravel = {
	GoStraight: 'GoStraight',
	GoToPoint: 'GoToPoint',
	GoToObject: 'GoToObject',
	Roam: 'Mio.Roam',
	AttachTo: 'AttachTo',
	Stop: 'Stop',
	JumpToPosition: 'JumpToPosition',
	JumpToArea: 'JumpToArea',
	Swap: 'Swap'
};

const BounceDirection = {
	Left: 'Left',
	Right: 'Right',
	None: 'None'
};

function colourFromPixelValue(pixel) {
	switch (pixel) {
		case 0x00: {
			return [0, 0, 0, 0];
		}
		case 0x01: {
			return [0, 0, 0, 255];
		}
		case 0x02: {
			return [255, 222, 156, 255];
		}
		case 0x03: {
			return [255, 173, 49, 255];
		}
		case 0x04: {
			return [198, 74, 0, 255];
		}
		case 0x05: {
			return [255, 0, 0, 255];
		}
		case 0x06: {
			return [206, 107, 239, 255];
		}
		case 0x07: {
			return [16, 198, 206, 255];
		}
		case 0x08: {
			return [41, 107, 198, 255];
		}
		case 0x09: {
			return [8, 148, 82, 255];
		}
		case 0x0A: {
			return [115, 214, 57, 255];
		}
		case 0x0B: {
			return [255, 255, 90, 255];
		}
		case 0x0C: {
			return [123, 123, 123, 255];
		}
		case 0x0D: {
			return [198, 198, 198, 255];
		}
		case 0x0E: {
			return [255, 255, 255, 255];
		}
		// Value of hidden colour learnt from https://github.com/xperia64/DIYEdit/blob/master/src/com/xperia64/diyedit/editors/GameEdit.java
		case 0x0F: {
			return [74, 156, 173, 255];
		}
		default: {
			console.warn('Unreachable Pixel Colour', pixel);
			return [128, 128, 128, 128];
		}
	}
}

function backgroundPixelsFromData(data) {
	let scrambledPixels = [];

	for (let i = Mio.BACKGROUND_OFFSET; i <= Mio.BACKGROUND_OFFSET + Mio.BACKGROUND_LENGTH; i++) {
		scrambledPixels.push(Mio.secondHexDigit(data[i]));
		scrambledPixels.push(Mio.firstHexDigit(data[i]));
	}

	let backgroundPixels = new Uint8ClampedArray(BACKGROUND_PIXEL_COUNT * COLOUR_BYTES_COUNT);

	for (let i = 0; i < BACKGROUND_PIXEL_COUNT; i++) {
		let blockSize = 1536;
		let blockIndex = Math.floor(i / blockSize);
		let internalIndex = i % blockSize;
		let gridSquareIndex = Math.floor(internalIndex / 64);
		let gridColumnIndex = i % 8;
		let gridRowIndex = Math.floor(internalIndex / 8) % 8;
		let columnIndex = (gridSquareIndex * 8 + gridColumnIndex);
		let rowIndex = (blockIndex * 8 + gridRowIndex);

		let colour = colourFromPixelValue(scrambledPixels[i]);

		for (let c = 0; c < colour.length; c++) {
			let index = rowIndex * BACKGROUND_WIDTH + columnIndex;
			backgroundPixels[index * COLOUR_BYTES_COUNT + c] = colour[c];
		}
	}

	return backgroundPixels;
}

function backgroundImageFromData(context, data) {
	let backgroundPixels = backgroundPixelsFromData(data);

	let backgroundImageData = context.createImageData(BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
	backgroundImageData.data.set(backgroundPixels);

	let tempCanvas = document.createElement('canvas');
	let tempContext = tempCanvas.getContext('2d');

	tempCanvas.width = BACKGROUND_WIDTH;
	tempCanvas.height = BACKGROUND_HEIGHT;
	tempContext.putImageData(backgroundImageData, 0, 0);
	let backgroundImage = new Image();
	backgroundImage.src = tempCanvas.toDataURL();

	return backgroundImage;
}

function gridsUsedFromSize(size) {
	let gridMultiplier = 4;
	switch (size) {
		case 16: {
			return 1 * gridMultiplier;
		}
		case 32: {
			return 4 * gridMultiplier;
		}
		case 48: {
			return 9 * gridMultiplier;
		}
		case 64: {
			return 16 * gridMultiplier;
		}
		default: {
			console.warn('Unreachable Size');
			return null;
		}
	}
}

function objectImagesFromGameData(gameData, context) {
	let imagesOffset = 0x3104;
	let imagesLength = 0xB103 - imagesOffset;
	let imagesPixel = [];
	for (let i = imagesOffset; i <= imagesOffset + imagesLength; i++) {
		imagesPixel.push(Mio.secondHexDigit(gameData.data[i]));
		imagesPixel.push(Mio.firstHexDigit(gameData.data[i]));
	}

	let imageData = {};
	let collisionData = {};

	for (let i = 0; i < Mio.OBJECT_COUNT; i++) {
		let object = gameData.object(i);
		if (!object.isActive) {
			continue;
		}

		let size = object.spriteSize;

		for (let j = 0; j < Mio.ART_BANK_COUNT; j++) {
			let art = object.art(j);
			if (!art.isActive) {
				continue;
			}
			let bank = art.bank;
			for (let b = 0; b < bank.length; b++) {
				const gridWidth = 8;
				const gridHeight = 8;
				let gridsUsed = gridsUsedFromSize(size);

				let firstGrid = bank[b] * 4;
				let firstPixelIndex = firstGrid * gridWidth * gridHeight;
				let totalPixelCount = gridsUsed * gridWidth * gridHeight;

				let image = context.createImageData(size, size);
				let collisionImage = context.createImageData(size, size);
				for (let index = 0; index < totalPixelCount; index++) {
					let pixel = imagesPixel[firstPixelIndex + index];
					let grid = Math.floor(index / 64);
					let internal_grid_index = index % 64;
					let gridColumnIndex = index % 8;
					let gridRowIndex = Math.floor(internal_grid_index / 8);
					let gridBaseX = grid % Math.floor(size / 8);
					let gridBaseY = Math.floor(grid / Math.floor(size / 8));
					let columnIndex = gridBaseX * 8 + gridColumnIndex;
					let rowIndex = gridBaseY * 8 + gridRowIndex;

					let colour = colourFromPixelValue(pixel);

					for (let c = 0; c < colour.length; c++) {
						let pixelIndex = rowIndex * size + columnIndex;
						image.data[pixelIndex * COLOUR_BYTES_COUNT + c] = colour[c];
						// Pastes the object id onto the rgb of the collisonImage then copies the alpha
						let paste;
						if (c < 3) {
							paste = i;
						} else {
							paste = colour[c];
						}
						collisionImage.data[pixelIndex * COLOUR_BYTES_COUNT + c] = paste;
					}
				}
				let tempCanvas = document.createElement('canvas');
				let tempContext = tempCanvas.getContext('2d');

				tempCanvas.width = size;
				tempCanvas.height = size;
				tempContext.putImageData(image, 0, 0);
				let sprite = new Image();
				sprite.src = tempCanvas.toDataURL();
				imageData[bank[b]] = sprite;
				collisionData[bank[b]] = collisionImage.data;
				let collisionSprite = new Image();
				tempContext.putImageData(collisionImage, 0, 0);
				collisionSprite.src = tempCanvas.toDataURL();
				collisionData[bank[b]].sprite = collisionSprite;
			}
		}
	}

	return { imageData, collisionData };
}

function winConditionsFromGameData(gameData) {
	let winConditions = [];

	for (let i = 0; i < Mio.WIN_CONDITIONS_COUNT; i++) {
		winConditions.push([]);
		for (let j = 0; j < Mio.SWITCH_CONDITIONS_COUNT; j++) {
			let condition = gameData.winCondition(i, j);
			if (condition !== null) {
				winConditions[i].push(condition);
			}
		}
	}

	return winConditions;
}

function artSetFromObject(object, collisionData) {
	let artSet = [];
	for (let a = 0; a < Mio.OBJECT_ART_COUNT; a++) {
		let art = object.art(a);
		if (art.isActive) {
			let bank = art.bank;

			// TODO: Clean up this collision area gathering code
			let leftest = null;
			let rightest = null;
			let toppest = null;
			let bottomest = null;
			let size = object.spriteSize;
			let totalPixelCount = size * size;
			for (let b = 0; b < bank.length; b++) {
				let collisionImage = collisionData[bank[b]];
				for (let index = 0; index < totalPixelCount; index++) {
					let alpha = collisionImage[index * COLOUR_BYTES_COUNT + 3];
					if (alpha !== 0) {
						let rowIndex = index % size;
						let columnIndex = Math.floor(index / size);
						if (leftest === null) {
							leftest = rowIndex;
							rightest = rowIndex + 1;
							toppest = columnIndex;
							bottomest = columnIndex + 1;
						} else {
							leftest = Math.min(leftest, rowIndex);
							rightest = Math.max(rightest, rowIndex + 1);
							toppest = Math.min(toppest, columnIndex);
							bottomest = Math.max(bottomest, columnIndex + 1);
						}
					}
				}
			}
			// TODO: What should the collision area size be when there aren't any pixels
			leftest = leftest !== null ? leftest : 0;
			toppest = toppest !== null ? toppest : 0;
			rightest = rightest !== null ? rightest : size;
			bottomest = bottomest !== null ? bottomest : size;
			let collisionArea = {
				min: {
					x: leftest,
					y: toppest
				},
				max: {
					x: rightest,
					y: bottomest
				}
			};

			artSet.push({ name: art.name, bank, collisionArea });
		} else {
			artSet.push(null);
		}
	}

	return artSet;
}

function objectsFromGameData(gameData, collisionData) {
	let objects = [];

	for (let i = 0; i < Mio.OBJECT_COUNT; i++) {
		let object = gameData.object(i);

		if (object.isActive) {
			let artSet = artSetFromObject(object, collisionData);

			let assembly = object.assembly;

			if (assembly.isActive) {
				let startInstruction = assembly.startInstruction;

				let instructions = [];

				for (let ins = 0; ins < Mio.INSTRUCTION_COUNT; ins++) {
					let instruction = assembly.instruction(ins);
					if (instruction.isActive) {
						let triggers = [];
						for (let t = 0; t < Mio.TRIGGER_COUNT; t++) {
							let trigger = instruction.trigger(t);
							if (trigger !== null) {
								triggers.push(trigger);
							}
						}
						let actions = [];
						for (let a = 0; a < Mio.ACTION_COUNT; a++) {
							let action = instruction.action(a);
							if (action !== null) {
								actions.push(action);
							}
						}
						instructions.push({ triggers, actions });
					}
				}

				objects.push({
					name: object.name,
					spriteSize: object.spriteSize,
					art: artSet,
					startInstruction,
					instructions,
				});
			} else {
				objects.push(null);
			}
		} else {
			objects.push(null);
		}
	}

	return objects;
}

function propertiesFromObjects(objects) {
	let properties = [];

	for (let i = 0; i < objects.length; i++) {
		if (objects[i] === null) {
			properties.push(null);
			continue;
		}
		let size = objects[i].spriteSize;
		let position = null;
		let travel = [{ tag: ActiveTravel.Stop }];

		let StartArt = objects[i].startInstruction.art;
		let artIndex = StartArt.index;
		let art = objects[i].art[artIndex];
		let bankIndex = art.bank[0];

		properties.push({
			position,
			size,
			art: {
				bankIndex,
				artIndex,
				style: StartArt.style,
				speed: StartArt.speed,
				finishedPlaying: false,
				animationIndex: 0,
				timeToNextChange: animationTimeFromSpeed(StartArt.speed)
			},
			travel,
			switchState: Mio.SwitchWhen.IsOff,
			nextSwitchState: Mio.SwitchWhen.IsOff,
		});
	}

	return properties;
}

function layersFromData(data, objectsLength) {
	let layers = [];

	for (let layer = 0; layer < objectsLength; layer++) {
		let index = data[Mio.LAYER_OFFSET + objectsLength - layer - 1];
		layers.push(index);
	}

	return layers;
}

function jumpToStartingPositions(objects, properties, collisionData) {
	for (let i = 0; i < objects.length; i++) {
		if (objects[i] === null) {
			continue;
		}
		let location = objects[i].startInstruction.location;
		let size = objects[i].spriteSize;
		let props = properties[i];
		if (location.tag === Mio.StartLocation.Position) {
			props.position = clonePosition(location.position);
		} else if (location.tag === Mio.StartLocation.Area) {
			let area = cloneArea(location.area);
			let artIndex = props.art.artIndex;
			let collisionArea = objects[i].art[artIndex].collisionArea;
			area.min.x -= collisionArea.min.x;
			area.min.y -= collisionArea.min.y;
			area.max.x += props.size - collisionArea.max.x;
			area.max.y += props.size - collisionArea.max.y;
			if (location.overlap === Mio.Overlap.Anywhere) {
				props.position = positionInArea(area, size);
			} else {
				attemptToJump(properties, i, area, collisionData, MAX_BEFORE_GAME_JUMP_ATTEMPTS);
			}
		} else if (location.tag === Mio.StartLocation.AttachToObject) {
			props.travel = [{
				tag: ActiveTravel.AttachTo,
				index: location.index,
				offset: location.offset
			}];
		}
	}

	// Should work without this, but should stop it from getting stuck in exceptional circumstances
	let tries = 50;
	// TODO: Do this recursively instead
	while (properties.some(p => p !== null && p.position === null) && tries >= 0) {
		tries--;
		for (let i = 0; i < objects.length; i++) {
			if (objects[i] === null) {
				continue;
			}
			let location = objects[i].startInstruction.location;
			let props = properties[i];
			if (location.tag === Mio.StartLocation.AttachToObject && props.position === null) {
				let otherIndex = location.index;
				if (properties[otherIndex].position !== null) {
					props.position = clonePosition(properties[otherIndex].position);
					props.position.x += location.offset.x;
					props.position.y += location.offset.y;
				}
			}
		}
	}
}

const ButtonState = {
	Up: 'Up',
	Release: 'Release',
	Down: 'Down',
	Press: 'Press'
};

let mouse = {
	x: 0,
	y: 0,
	state: ButtonState.Up,
};

const areaFromProperties = props => {
	let size = props.size;
	let halfSize = size / 2;
	return {
		min: {
			x: props.position.x - halfSize,
			y: props.position.y - halfSize
		},
		max: {
			x: props.position.x + halfSize,
			y: props.position.y + halfSize
		}
	};
};

class CollisionObject {
	constructor(props, collisionData) {
		this.props = props;
		this.collisionData = collisionData;

		this.size = props.size;
		this.halfSize = props.size / 2;

		this.area = areaFromProperties(props);

		this.bank = props.art.bankIndex;

		this.data = collisionData[this.bank];

		if (this.data == null) {
			console.warn('Collision Data is null')
		}
	}

	pixelPosition(x, y) {
		let pixelX = x - Math.floor(this.props.position.x) + this.halfSize;
		let pixelY = y - Math.floor(this.props.position.y) + this.halfSize;

		return { x: pixelX, y: pixelY };
	}

	isPointOutsideArea(x, y) {
		let position = this.pixelPosition(x, y);
		return position.x < 0 || position.y >= this.size ||
			position.y < 0 || position.y >= this.size;
	}

	isPixelVisible(x, y) {
		let pixelPosition = this.pixelPosition(x, y);
		let index = Math.floor(pixelPosition.y * this.size + pixelPosition.x);

		let alpha = this.data[index * COLOUR_BYTES_COUNT + 3];
		console.assert(alpha !== undefined);
		return alpha !== 0;
	}

	isTouching(other) {
		let commonArea = areaInCommon(this.area, other.area);

		for (let x = commonArea.min.x; x < commonArea.max.x; x++) {
			for (let y = commonArea.min.y; y < commonArea.max.y; y++) {
				let pixel = this.isPixelVisible(x, y);
				let otherPixel = other.isPixelVisible(x, y);
				if (pixel && otherPixel) {
					return true;
				}
			}
		}

		return false;
	}
}

class CollisionArea {
	constructor(area) {
		this.area = cloneArea(area);
		// TODO: ?
		if (this.area.min.x == this.area.max.x) {
			this.area.max.x++;
		}
		if (this.area.min.y == this.area.max.y) {
			this.area.max.y++;
		}
	}

	isPixelVisible() {
		return true;
	}
}

let areaInCommon = (area, otherArea) => {
	return {
		min: {
			x: Math.floor(Math.max(area.min.x, otherArea.min.x)),
			y: Math.floor(Math.max(area.min.y, otherArea.min.y))
		},
		max: {
			x: Math.floor(Math.min(area.max.x, otherArea.max.x)),
			y: Math.floor(Math.min(area.max.y, otherArea.max.y))
		},
	}
};

// TODO: Replace usages of this with .isTouching
function areTouching(properties, index, otherIndex, collisionData) {
	let a = new CollisionObject(properties[index], collisionData);
	let b = new CollisionObject(properties[otherIndex], collisionData);

	let commonArea = areaInCommon(a.area, b.area);

	for (let x = commonArea.min.x; x < commonArea.max.x; x++) {
		for (let y = commonArea.min.y; y < commonArea.max.y; y++) {
			if (a.isPointOutsideArea(x, y) || b.isPointOutsideArea(x, y)) {
				continue;
			}
			if (a.bank in collisionData && b.bank in collisionData) {
				let pixel = a.isPixelVisible(x, y);
				let otherPixel = b.isPixelVisible(x, y);
				if (pixel && otherPixel) {
					return true;
				}
			}
		}
	}

	return false;
}

function attemptToJump(properties, index, area, collisionData, maxJumpAttempts) {
	let props = properties[index];
	attempts_loop: for (let attempts = 0; attempts < maxJumpAttempts; attempts++) {
		props.position = positionInArea(area, props.size);
		object_loop: for (let otherIndex = 0; otherIndex < Mio.OBJECT_COUNT; otherIndex++) {
			if (index === otherIndex) {
				continue object_loop;
			}
			if (properties[otherIndex] === null || properties[otherIndex].position === null) {
				continue object_loop;
			}
			if (areTouching(properties, index, otherIndex, collisionData)) {
				continue attempts_loop;
			}
		}
		break;
	}
}

const hasMadeContact = (props, trigger, collided) => {
	if (trigger.contact === Mio.ContactType.Overlap) {
		return collided;
	} else {
		if (!collided) {
			trigger.wasTouchedPreviousFrame = false;
			return false;
		} else {
			if (trigger.wasTouchedPreviousFrame) {
				return false;
			} else {
				trigger.wasTouchedPreviousFrame = true;
				return true;
			}
		}
	}
}

const timeWithEnd = (gameLength, time) => {
	if (time === Mio.Time.End) {
		if (gameLength === Mio.Length.Short || gameLength === Mio.Length.Boss) {
			return 32;
		} else if (gameLength === Mio.Length.Long) {
			return 64;
		}
	} else {
		return time;
	}
};

function isThisObjectTapped(mouse, collisionPixels, i) {
	if (mouse.state === ButtonState.Press) {
		let pixelX = Math.floor(mouse.x);
		let pixelY = Math.floor(mouse.y);
		let index = Math.floor(pixelY * BACKGROUND_WIDTH + pixelX);
		let objectPixelIsOnTop = collisionPixels[index * COLOUR_BYTES_COUNT] === i;
		let isPixelVisible = collisionPixels[index * COLOUR_BYTES_COUNT + 3] === 255;
		let isTapped = objectPixelIsOnTop && isPixelVisible;
		return isTapped;
	} else {
		return false;
	}
}

function hasHitTime(state, gameLength, trigger) {
	let when = timeWithEnd(gameLength, trigger.when);

	if (when % 2 === 0) {
		when = (when / 2) * 15;
	} else {
		when = Math.floor(when / 2) * 15 + 8;
	}
	return when === state.frame;
}

function hasHitRandomTime(state, gameLength, trigger) {
	let fifteenth = state.frame % 15;
	let isQuarter = fifteenth === 0 || (fifteenth % 8 === 0);
	if (trigger.hasBeenTriggered) {
		return false;
	} else if (isQuarter) {
		let start = trigger.start;
		let end = timeWithEnd(gameLength, trigger.end);
		let quarter = fifteenth === 0 ? Math.floor(state.frame / 15) * 2 : Math.floor((state.frame - 1) / 15) * 2 + 1;
		let r = randomIntInRange(Math.max(start, quarter), end + 1);
		let triggered = r === quarter;
		if (triggered) {
			trigger.hasBeenTriggered = true;
		}

		return triggered;
	} else {
		return false;
	}
}

function doesConditionMatchWinStatus(condition, winStatus) {
	if (condition === Mio.GameCondition.Win
		&& winStatus === Mio.GameCondition.Win) {
		return true;
	} else if (condition === Mio.GameCondition.Loss
		&& winStatus === Mio.GameCondition.Loss) {
		return true;
	} else if (condition === Mio.GameCondition.HasBeenWon
		&& (winStatus === Mio.GameCondition.Win
			|| winStatus === Mio.GameCondition.HasBeenWon)) {
		return true;
	} else if (condition === Mio.GameCondition.HasBeenLost
		&& (winStatus === Mio.GameCondition.Loss
			|| winStatus === Mio.GameCondition.HasBeenLost)) {
		return true;
	} else if (condition === Mio.GameCondition.NotYetLost
		&& (winStatus !== Mio.GameCondition.Loss
			&& winStatus !== Mio.GameCondition.HasBeenLost)) {
		return true;
	} else if (condition === Mio.GameCondition.NotYetWon
		&& (winStatus !== Mio.GameCondition.Win
			&& winStatus !== Mio.GameCondition.HasBeenWon)) {
		return true;
	} else {
		return false;
	}
}

function doesSwitchMatch(when, switchState) {
	if (when === Mio.SwitchWhen.IsOn
		&& (switchState === Mio.SwitchWhen.IsOn
			|| switchState === Mio.SwitchWhen.TurnsOn)) {
		return true;
	} else if (when === Mio.SwitchWhen.IsOff
		&& (switchState === Mio.SwitchWhen.IsOff
			|| switchState === Mio.SwitchWhen.TurnsOff)) {
		return true;
	} else if (when === Mio.SwitchWhen.TurnsOn
		&& switchState === Mio.SwitchWhen.TurnsOn) {
		return true;
	} else if (when === Mio.SwitchWhen.TurnsOff
		&& switchState === Mio.SwitchWhen.TurnsOff) {
		return true;
	} else {
		return false;
	}
}

function isTriggered(state, i, trigger, gameData) {
	let props = state.properties[i];
	switch (trigger.tag) {
		case Mio.Trigger.TapAnywhere: {
			return mouse.state === ButtonState.Press;
		}
		case Mio.Trigger.TapThisObject: {
			return isThisObjectTapped(mouse, state.collisionPixels, i);
		}
		case Mio.Trigger.TimeExact: {
			return hasHitTime(state, gameData.length, trigger);
		}
		case Mio.Trigger.TimeRandom: {
			return hasHitRandomTime(state, gameData.length, trigger);
		}
		case Mio.Trigger.Contact: {
			let collisionObject = new CollisionObject(props, gameData.collisionData);
			let other;
			if (trigger.touches.what === Mio.TouchesWhat.Location) {
				other = new CollisionArea(trigger.touches.area);
			} else {
				other = new CollisionObject(state.properties[trigger.touches.index], gameData.collisionData);
			}
			let collided = collisionObject.isTouching(other);
			return hasMadeContact(props, trigger, collided);
		}
		case Mio.Trigger.Switch: {
			let when = trigger.switchWhen;
			let switchState = state.properties[trigger.index].switchState;
			return doesSwitchMatch(when, switchState);
		}
		case Mio.Trigger.FinishesPlaying: {
			return props.art.finishedPlaying;
		}
		case Mio.Trigger.SpecificArt: {
			return props.art.artIndex === trigger.index;
		}
		case Mio.Trigger.GameCondition: {
			let condition = trigger.condition;
			let winStatus = state.winStatus;
			return doesConditionMatchWinStatus(condition, winStatus);
		}
		default: {
			console.warn('Unreachable Mio.Trigger');
		}
	}
}

const possibleDirections = [
	Mio.SpecificDirection.North,
	Mio.SpecificDirection.NorthEast,
	Mio.SpecificDirection.East,
	Mio.SpecificDirection.SouthEast,
	Mio.SpecificDirection.South,
	Mio.SpecificDirection.SouthWest,
	Mio.SpecificDirection.West,
	Mio.SpecificDirection.NorthWest
];

let velocityFromDirection = (direction, speed) => {
	let diagonalSpeed = speed / Math.sqrt(2);
	switch (direction) {
		case Mio.SpecificDirection.North: {
			return { x: 0, y: -speed };
		}
		case Mio.SpecificDirection.NorthEast: {
			return { x: diagonalSpeed, y: -diagonalSpeed };
		}
		case Mio.SpecificDirection.East: {
			return { x: speed, y: 0 };
		}
		case Mio.SpecificDirection.SouthEast: {
			return { x: diagonalSpeed, y: diagonalSpeed };
		}
		case Mio.SpecificDirection.South: {
			return { x: 0, y: speed };
		}
		case Mio.SpecificDirection.SouthWest: {
			return { x: -diagonalSpeed, y: diagonalSpeed };
		}
		case Mio.SpecificDirection.West: {
			return { x: -speed, y: 0 };
		}
		case Mio.SpecificDirection.NorthWest: {
			return { x: -diagonalSpeed, y: -diagonalSpeed };
		}
	}
};

function clonePosition(position) {
	return { x: position.x, y: position.y };
}

function cloneArea(area) {
	return { min: clonePosition(area.min), max: clonePosition(area.max) };
}

function goStraightTravel(action, state) {
	let fromPosition = null;
	if (action.from.tag === Mio.FromLocation.AnotherPosition) {
		fromPosition = clonePosition(action.from.position);
	} else if (action.from.tag === Mio.FromLocation.AnotherObject) {
		// TODO: Is this done from the position at the start of the frame?
		fromPosition = clonePosition(state.properties[action.from.index].position);
		fromPosition.x += action.from.offset.x;
		fromPosition.y += action.from.offset.y;
	}
	let speed = valueFromSpeed(action.speed);
	let travel;
	if (action.direction.tag === Mio.Direction.Random) {
		let direction = randomInArray(possibleDirections);
		let velocity = velocityFromDirection(direction, speed);
		travel = { tag: ActiveTravel.GoStraight, velocity, fromPosition };
	} else if (action.direction.tag === Mio.Direction.Specific) {
		let direction = action.direction.direction;
		let velocity = velocityFromDirection(direction, speed);
		travel = { tag: ActiveTravel.GoStraight, velocity, fromPosition };
	} else {
		let position = action.direction.position;
		travel = { tag: ActiveTravel.GoToPoint, position, speed, fromPosition };
	}
	return travel;
}

function jumpToAreaTravel(action, props, collisionArea) {
	let area = cloneArea(action.area);
	area.min.x -= collisionArea.min.x;
	area.min.y -= collisionArea.min.y;
	area.max.x += props.size - collisionArea.max.x;
	area.max.y += props.size - collisionArea.max.y;
	return { tag: ActiveTravel.JumpToArea, area, overlap: action.overlap };
}

function roamTravel(action, state, props, collisionArea) {
	let speed = valueFromSpeed(action.speed);
	let direction = randomInArray(possibleDirections);
	let velocity = velocityFromDirection(direction, speed);
	let area = cloneArea(action.area);
	let halfSize = props.size / 2;
	area.min.x += halfSize;
	area.min.y += halfSize;
	area.max.x -= halfSize;
	area.max.y -= halfSize;

	area.min.x -= collisionArea.min.x;
	area.min.y -= collisionArea.min.y;
	area.max.x += props.size - collisionArea.max.x;
	area.max.y += props.size - collisionArea.max.y;
	let overlap = action.overlap;
	let travel;
	let roam = action.roam;
	let tag = ActiveTravel.Roam;
	let lastTravel = props.travel[props.travel.length - 1];
	if (roam === Mio.Roam.Wiggle) {
		travel = { tag, roam, area, speed, overlap };
	} else if (roam === Mio.Roam.Insect) {
		if (lastTravel.roam === Mio.Roam.Insect) {
			velocity = lastTravel.velocity;
		}
		travel = { tag, roam, area, speed, overlap, velocity };
	} else if (roam === Mio.Roam.Reflect) {

		//let initialSpeed = randomInRange(0, 1) >= 0.5 ? speed : -speed;
		if (area.min.x < area.max.x && area.min.y < area.max.y) {
			let angle = randomInRange(0, Math.PI * 2);
			velocity = { x: speed * Math.cos(angle), y: speed * Math.sin(angle) };
		} else if (area.min.x > area.max.x) {
			//velocity = { x: 0, y: initialSpeed };
		} else {
			//velocity = { x: initialSpeed, y: 0 };
		}
		let angle = randomInRange(0, Math.PI * 2);
		velocity = { x: speed * Math.cos(angle), y: speed * Math.sin(angle) };
		if (lastTravel.tag === ActiveTravel.GoStraight) {
			// TODO: Adjust for speed
			velocity = clonePosition(lastTravel.velocity);
			let d = Math.sqrt(Math.pow(velocity.x, 2) + Math.pow(velocity.y, 2));
			velocity.x = velocity.x / d * speed;
			velocity.y = velocity.y / d * speed;
		}
		travel = { tag, roam, area, speed, overlap, velocity };
	} else if (roam === Mio.Roam.Bounce) {
		let acceleration = speed / 16;

		let velocity = {
			x: 0,
			y: props.position.y > area.min.y ? -Math.sqrt(2 * acceleration * (props.position.y - area.min.y)) : 0.0
		};
		if ((props.position.x < area.min.x || props.position.x > area.max.x) && (props.position.y < area.max.y) && area.max.x > area.min.x) {
			velocity.y = 0.0;
		}
		let direction = randomInArray([BounceDirection.Left, BounceDirection.Right]);
		let horizontalSpeed = speed / 2;
		if (direction === BounceDirection.Left) {
			velocity.x = horizontalSpeed;
		} else {
			velocity.x -= horizontalSpeed;
		}

		if (lastTravel.tag === ActiveTravel.GoStraight) {
			// TODO: Add velocity to GoToPoint to use here? or just calc now. and check if gotopoint is called same frame as bounce in game this affects before thought
			//velocity.x = lastTravel.velocity.x;
			//velocity.y = lastTravel.velocity.y || velocity.y;
			velocity = clonePosition(lastTravel.velocity);

		} else if (lastTravel.tag === ActiveTravel.GoToPoint) {
			let position = lastTravel.position;
			let targetVector = { x: position.x - props.position.x, y: position.y - props.position.y };
			let d = Math.sqrt(Math.pow(targetVector.x, 2) + Math.pow(targetVector.y, 2));
			velocity = {
				x: targetVector.x / d * speed / 2,
				y: targetVector.y / d * speed
			};
		} else if (lastTravel.tag === ActiveTravel.Roam && (lastTravel.roam === Mio.Roam.Bounce || lastTravel.roam === Mio.Roam.Reflect)) {
			velocity = clonePosition(lastTravel.velocity);
		} else if (lastTravel.tag === ActiveTravel.GoToObject) {
			let position = state.properties[lastTravel.index].position;
			let targetVector = { x: position.x - props.position.x, y: position.y - props.position.y };
			let d = Math.sqrt(Math.pow(targetVector.x, 2) + Math.pow(targetVector.y, 2));
			velocity = {
				x: targetVector.x / d * speed,
				y: targetVector.y / d * speed
			};
		}
		travel = { tag, roam, area, speed, overlap, velocity, acceleration };
	}

	return travel;
}

function pushToTravelQueue(action, state, props, collisionArea) {
	switch (action.travel) {
		case Mio.Travel.GoStraight: {
			let travel = goStraightTravel(action, state);
			props.travel.push(travel);
			return;
		}
		case Mio.Travel.Stop: {
			props.travel.push({ tag: ActiveTravel.Stop });
			return;
		}
		case Mio.Travel.JumpToPosition: {
			props.travel.push({ tag: ActiveTravel.JumpToPosition, position: clonePosition(action.position) });
			props.travel.push({ tag: ActiveTravel.Stop });
			return;
		}
		case Mio.Travel.JumpToArea: {
			let travel = jumpToAreaTravel(action, props, collisionArea);
			props.travel.push(travel);
			props.travel.push({ tag: ActiveTravel.Stop });
			return;
		}
		case Mio.Travel.JumpToObject: {
			props.travel.push({ tag: ActiveTravel.AttachTo, index: action.index, offset: action.offset });
			return;
		}
		case Mio.Travel.Roam: {
			let travel = roamTravel(action, state, props, collisionArea);
			props.travel.push(travel);
			return;
		}
		case Mio.Travel.Swap: {
			props.travel.push({ tag: ActiveTravel.Swap, index: action.index });
			props.travel.push({ tag: ActiveTravel.Stop });
			state.properties[action.index].travel.push({ tag: ActiveTravel.Stop });
			return;
		}
		case Mio.Travel.Target: {
			let index = action.index;
			let offset = action.offset;
			let speed = valueFromSpeed(action.speed);
			props.travel.push({ tag: ActiveTravel.GoToObject, index, offset, speed });
			return;
		}
		default: {
			console.warn('Unreachable Mio.Travel', action.travel);
			return;
		}
	}
}

function applyAction(state, i, action, gameData, assets) {
	let props = state.properties[i];
	switch (action.tag) {
		case Mio.Action.Travel: {
			let artIndex = props.art.artIndex;
			let collisionArea = gameData.objects[i].art[artIndex].collisionArea;
			pushToTravelQueue(action, state, props, collisionArea);
			return;
		}
		case Mio.Action.Switch: {
			let newSwitch;
			if (action.switchTo === Mio.Switch.Off) {
				newSwitch = Mio.SwitchWhen.TurnsOff;
			} else {
				newSwitch = Mio.SwitchWhen.TurnsOn;
			}
			props.nextSwitchState = newSwitch;
			return;
		}
		case Mio.Action.Lose: {
			console.log('Lose Mio.Action Applied. winStatus before: {:?}', state.winStatus);
			if (
				state.winStatus !== Mio.GameCondition.Win &&
				state.winStatus !== Mio.GameCondition.Loss &&
				state.winStatus !== Mio.GameCondition.HasBeenLost &&
				state.winStatus !== Mio.GameCondition.HasBeenWon
			) {
				randomInArray(assets.loseSounds).play();
				state.winStatus = Mio.GameCondition.Loss;
				this.emit('lost');
			}
			return;
		}
		case Mio.Action.StopPlaying: {
			props.art.style = Mio.AnimationStyle.Hold;
			return;
		}
		case Mio.Action.ChangeArt: {
			props.art.artIndex = action.index;
			let art = gameData.objects[i].art[action.index];
			let bank = art.bank[0];
			props.art.bankIndex = bank;
			props.art.animationIndex = 0;
			props.art.finishedPlaying = false;
			props.art.timeToNextChange = animationTimeFromSpeed(action.speed);
			props.art.speed = action.speed;
			props.art.style = action.style;
			if (art.bank.length === 1) {
				props.art.style = Mio.AnimationStyle.Hold;
			}
			return;
		}
		case Mio.Action.SoundEffect: {
			let sound = assets.sounds[action.effect];
			if (sound.paused) {
				sound.play();
			} else if (sound.currentTime > 0.025) {
				sound.pause();
				sound.currentTime = 0;
				sound.play();
			}

			return;
		}
		case Mio.Action.ScreenEffect: {
			// TODO: Implement others
			if (action.effect === Mio.ScreenEffect.Freeze) {
				state.isFrozen = true;
			}
			return;
		}
	}
}

function triggeredActionsThisFrame(state, gameData) {
	let triggeredActions = [];
	for (let i = 0; i < gameData.objects.length; i++) {
		triggeredActions.push([]);
		if (gameData.objects[i] === null) continue;
		let object = gameData.objects[i];
		for (let ins = 0; ins < object.instructions.length; ins++) {
			// To avoid short-circuiting as game logic requires collision checking for touches trigger
			let triggered = object.instructions[ins].triggers
				.map(trigger => isTriggered(state, i, trigger, gameData))
				.every(result => result === true);
			if (triggered) {
				let actions = object.instructions[ins].actions;
				triggeredActions[i] = triggeredActions[i].concat(actions);
			}
		}
	}

	return triggeredActions;
}

function applyAllActions(triggeredActions, state, gameData, assets) {
	for (let i = 0; i < triggeredActions.length; i++) {
		triggeredActions[i].forEach(action => applyAction(state, i, action, gameData, assets));
	}
}

function updateAnimations(state, gameData) {
	for (let i = 0; i < gameData.objects.length; i++) {
		if (gameData.objects[i] === null) continue;
		let object = gameData.objects[i];
		let props = state.properties[i];

		let art = object.art[props.art.artIndex]
		let animationIndex = props.art.animationIndex;
		animationIndex++;
		animationIndex %= art.bank.length;

		let bank = art.bank[animationIndex];

		props.art.finishedPlaying = false;

		let goToNextImage = props => {
			props.art.animationIndex = animationIndex;
			props.art.bankIndex = bank;
			props.art.timeToNextChange = animationTimeFromSpeed(props.art.speed);
		};

		if (props.art.style !== Mio.AnimationStyle.Hold) {
			props.art.timeToNextChange--;
		}

		if (props.art.style !== Mio.AnimationStyle.Hold && props.art.timeToNextChange <= 0) {
			if (animationIndex === 0) {
				if (props.art.style === Mio.AnimationStyle.Loop) {
					goToNextImage(props);
				} else if (props.art.style === Mio.AnimationStyle.PlayOnce) {
					props.art.style = Mio.AnimationStyle.Hold;
					props.art.finishedPlaying = true;
				}
			} else {
				goToNextImage(props);
			}
		}
	}
}

function moveObjects(state, gameData) {
	for (let i = 0; i < gameData.objects.length; i++) {
		if (gameData.objects[i] === null) continue;
		let props = state.properties[i];
		for (let t = 0; t < props.travel.length; t++) {
			let travel = props.travel[t];

			if (t < props.travel.length - 1
				&& (travel.tag === ActiveTravel.GoStraight
					|| travel.tag === ActiveTravel.GoToPoint
					|| travel.tag === ActiveTravel.GoToObject
					|| travel.tag === ActiveTravel.Roam
					|| travel.tag === ActiveTravel.Stop)) {
				continue;
			}

			let moveCoordinateTo = (x, other, velocity) => {
				if (Math.abs(x - other) > Math.abs(velocity)) {
					return x + velocity;
				} else {
					return other;
				}
			};
			let moveToward = (props, position) => {
				let targetVector = { x: position.x - props.position.x, y: position.y - props.position.y };
				let d = Math.sqrt(Math.pow(targetVector.x, 2) + Math.pow(targetVector.y, 2));
				let velocity = {
					x: targetVector.x / d * travel.speed,
					y: targetVector.y / d * travel.speed
				};
				props.position = {
					x: moveCoordinateTo(props.position.x, position.x, velocity.x),
					y: moveCoordinateTo(props.position.y, position.y, velocity.y)
				};
				return velocity;
			};

			switch (travel.tag) {
				case ActiveTravel.JumpToPosition: {
					props.position = clonePosition(travel.position);
					break;
				}
				case ActiveTravel.JumpToArea: {
					if (travel.overlap === Mio.Overlap.Anywhere) {
						props.position = positionInArea(travel.area, props.size);
					} else {
						attemptToJump(state.properties, i, travel.area, gameData.collisionData, MAX_DURING_GAME_JUMP_ATTEMPTS);
					}
					break;
				}
				case ActiveTravel.Swap: {
					let temp = clonePosition(props.position);
					props.position = clonePosition(state.properties[travel.index].position);
					state.properties[travel.index].position = temp;
					break;
				}
				case ActiveTravel.GoStraight: {
					if (travel.fromPosition != null) {
						props.position = travel.fromPosition;
						travel.fromPosition = null;
					}
					props.position.x += travel.velocity.x;
					props.position.y += travel.velocity.y;
					break;
				}
				case ActiveTravel.GoToPoint: {
					if (travel.fromPosition != null) {
						props.position = travel.fromPosition;
						travel.fromPosition = null;
					}
					let position = clonePosition(travel.position);
					moveToward(props, position);
					break;
				}
				case ActiveTravel.GoToObject: {
					let position = clonePosition(state.properties[travel.index].position);
					position.x += travel.offset.x;
					position.y += travel.offset.y;
					moveToward(props, position);
					break;
				}
				case ActiveTravel.AttachTo: {
					let position = clonePosition(state.properties[travel.index].position);
					position.x += travel.offset.x;
					position.y += travel.offset.y;
					props.position = position;
					break;
				}
				case ActiveTravel.Roam: {
					let area = travel.area;
					let centre = { x: (area.min.x + area.max.x) / 2, y: (area.min.y + area.max.y) / 2 };
					let isPositionInArea = (position, area) => {
						return position.x >= area.min.x && position.x <= area.max.x
							&& position.y >= area.min.y && position.y <= area.max.y;
					};
					let isPositionInExtendedArea = (position, area) => {
						if (area.min.x <= area.max.x && area.min.y <= area.max.y) {
							return position.x >= area.min.x && position.x <= area.max.x
								&& position.y >= area.min.y && position.y <= area.max.y;
						}
						if (area.min.x > area.max.x) {
							return position.x.toFixed(2) === ((area.min.x + area.max.x) / 2).toFixed(2)
								&& position.y >= area.min.y && position.y <= area.max.y;
						}
						if (area.min.y > area.max.y) {
							return position.x >= area.min.x && position.x <= area.max.x
								&& position.y.toFixed(2) === ((area.min.y + area.max.y) / 2).toFixed(2);
						}
					};
					if (travel.roam === Mio.Roam.Wiggle) {
						if (isPositionInArea(props.position, area)) {
							let directions = possibleDirections;
							if (travel.overlap === Mio.Overlap.TryNotToOverlap) {
								let position = clonePosition(props.position);
								let nonOverlappingDirections = [];
								direction_loop: for (let d = 0; d < possibleDirections.length; d++) {
									props.position = clonePosition(position);
									let direction = possibleDirections[d];
									let velocity = velocityFromDirection(direction, travel.speed);
									props.position.x += velocity.x;
									props.position.y += velocity.y;
									object_loop: for (let otherIndex = 0; otherIndex < Mio.OBJECT_COUNT; otherIndex++) {
										if (i === otherIndex) {
											continue object_loop;
										}
										if (state.properties[otherIndex] === null || state.properties[otherIndex].position === null) {
											continue object_loop;
										}
										if (areTouching(state.properties, i, otherIndex, gameData.collisionData)) {
											continue direction_loop;
										}
									}

									nonOverlappingDirections.push(direction);
								}
								if (nonOverlappingDirections.length === 0) {
									directions = possibleDirections;
								} else {
									directions = nonOverlappingDirections;
								}

								props.position = clonePosition(position);
							}
							let direction = randomInArray(directions);
							let velocity = velocityFromDirection(direction, travel.speed);

							props.position.x += velocity.x;
							props.position.y += velocity.y;
						} else if (area.min.x > area.max.x || area.min.y > area.max.y) {
							// TODO: Duplicate code
							if (area.min.x > area.max.x || area.min.y > area.max.y) {
								area = cloneArea(area);
								area.min.x -= gameData.objects[i].spriteSize / 2;
								area.min.y -= gameData.objects[i].spriteSize / 2;
								area.max.x += gameData.objects[i].spriteSize / 2;
								area.max.y += gameData.objects[i].spriteSize / 2;
							}
							if (isPositionInArea(props.position, area)) {
								let directions = possibleDirections;
								if (travel.overlap === Mio.Overlap.TryNotToOverlap) {
									let position = clonePosition(props.position);
									let nonOverlappingDirections = [];
									direction_loop: for (let d = 0; d < possibleDirections.length; d++) {
										props.position = clonePosition(position);
										let direction = possibleDirections[d];
										let velocity = velocityFromDirection(direction, travel.speed);
										props.position.x += velocity.x;
										props.position.y += velocity.y;
										object_loop: for (let otherIndex = 0; otherIndex < Mio.OBJECT_COUNT; otherIndex++) {
											if (i === otherIndex) {
												continue object_loop;
											}
											if (state.properties[otherIndex] === null || state.properties[otherIndex].position === null) {
												continue object_loop;
											}
											if (areTouching(state.properties, i, otherIndex, gameData.collisionData)) {
												continue direction_loop;
											}
										}

										nonOverlappingDirections.push(direction);
									}
									if (nonOverlappingDirections.length === 0) {
										directions = possibleDirections;
									} else {
										directions = nonOverlappingDirections;
									}

									props.position = clonePosition(position);
								}
								let direction = randomInArray(directions);
								let velocity = velocityFromDirection(direction, travel.speed);

								props.position.x += velocity.x;
								props.position.y += velocity.y;
							} else {
								moveToward(props, centre);
							}
						} else {
							moveToward(props, centre);
						}

					} else if (travel.roam === Mio.Roam.Insect) {
						if (isPositionInArea(props.position, area)) {
							const CHANGE_DIRECTION_PROBABILTY = 0.05;
							if (randomInRange(0, 1) < CHANGE_DIRECTION_PROBABILTY) {
								let direction = randomInArray(possibleDirections);
								travel.velocity = velocityFromDirection(direction, travel.speed);
							}
							props.position.x += travel.velocity.x;
							props.position.y += travel.velocity.y;
						} else {
							let direction = randomInArray(possibleDirections);
							travel.velocity = velocityFromDirection(direction, travel.speed);
							moveToward(props, centre);
						}
					} else if (travel.roam === Mio.Roam.Reflect) {
						if (travel.overlap === Mio.Overlap.TryNotToOverlap) {
							let touching = false;
							let touchingIndex;
							object_loop: for (let otherIndex = 0; otherIndex < Mio.OBJECT_COUNT; otherIndex++) {
								if (i === otherIndex) {
									continue object_loop;
								}
								if (state.properties[otherIndex] === null || state.properties[otherIndex].position === null) {
									continue object_loop;
								}
								if (areTouching(state.properties, i, otherIndex, gameData.collisionData)) {
									touchingIndex = otherIndex;
									touching = true;
								}
							}
							if (touching) {
								if (props.position.x < state.properties[touchingIndex].position.x) {
									travel.velocity.x = -Math.abs(travel.velocity.x);
								}
								if (props.position.x > state.properties[touchingIndex].position.x) {
									travel.velocity.x = Math.abs(travel.velocity.x);
								}
								if (props.position.y < state.properties[touchingIndex].position.y) {
									travel.velocity.y = -Math.abs(travel.velocity.y);
								}
								if (props.position.y > state.properties[touchingIndex].position.y) {
									travel.velocity.y = Math.abs(travel.velocity.y);
								}
							}
						}
						if (isPositionInExtendedArea(props.position, area)) {
							if (Math.floor(props.position.x) > area.max.x) {
								travel.velocity.x = -Math.abs(travel.velocity.x);
							}
							if (props.position.x < area.min.x) {
								travel.velocity.x = Math.abs(travel.velocity.x);
							}
							if (Math.floor(props.position.y) > area.max.y) {
								travel.velocity.y = -Math.abs(travel.velocity.y);
							}
							if (props.position.y < area.min.y) {
								travel.velocity.y = Math.abs(travel.velocity.y);
							}

							// When area is smaller than object
							if (props.position.x >= area.max.x && props.position.x <= area.min.x) {
								travel.velocity.x = 0;
								travel.velocity.y = travel.velocity.y > 0 ? travel.speed : -travel.speed;

								//props.position.x = (area.min.x + area.max.x) / 2.0;
							}
							if (props.position.y >= area.max.y && props.position.y <= area.min.y) {
								travel.velocity.y = 0;
								travel.velocity.x = travel.velocity.x > 0 ? travel.speed : -travel.speed;
								//props.position.y = (area.min.y + area.max.y) / 2.0;
							}
							props.position.x += travel.velocity.x;
							props.position.y += travel.velocity.y;
						} else {
							// TODO: Does this cause problems when velocity is specifically set using GoStraight?
							travel.velocity = moveToward(props, centre);
						}
					} else if (travel.roam === Mio.Roam.Bounce) {
						// TODO: Implement TryNotToOverlap (properly) for bounce
						if (travel.overlap === Mio.Overlap.TryNotToOverlap) {
							let touching = false;
							let touchingIndex;
							object_loop: for (let otherIndex = 0; otherIndex < Mio.OBJECT_COUNT; otherIndex++) {
								if (i === otherIndex) {
									continue object_loop;
								}
								if (state.properties[otherIndex] === null || state.properties[otherIndex].position === null) {
									continue object_loop;
								}
								if (areTouching(state.properties, i, otherIndex, gameData.collisionData)) {
									touchingIndex = otherIndex;
									touching = true;
								}
							}
							if (touching) {
								if (Math.abs(props.position.x - state.properties[touchingIndex].position.x) > Math.abs(props.position.y - state.properties[touchingIndex].position.y)) {
									if (props.position.x < state.properties[touchingIndex].position.x) {
										travel.velocity.x = -Math.abs(travel.velocity.x);
									}
									if (props.position.x > state.properties[touchingIndex].position.x) {
										travel.velocity.x = Math.abs(travel.velocity.x);
									}
								} else {
									if (props.position.y < state.properties[touchingIndex].position.y) {
										// Dunno why I put this as it
										travel.velocity.y = props.position.y > travel.area.min.y ? -Math.sqrt(2 * travel.acceleration * (travel.area.max.y - travel.area.min.y)) : 0.0;
									}
									if (props.position.y > state.properties[touchingIndex].position.y) {
										travel.velocity.y = 0;
									}
								}
							}
						}
						if (props.position.y < area.min.y) {
							// TODO: Why is abs necessary?
							travel.velocity.y += Math.abs(travel.acceleration);
						} else if (props.position.y <= area.max.y) {
							travel.velocity.y += travel.acceleration;
						} else if (Math.floor(props.position.y) > area.max.y) {
							travel.velocity.y = props.position.y > travel.area.min.y ? -Math.sqrt(2 * travel.acceleration * (props.position.y - travel.area.min.y)) : 0.0;
						}
						if (Math.floor(props.position.x) > area.max.x) {
							travel.velocity.x = -Math.abs(travel.velocity.x);
						} else if (Math.floor(props.position.x) < area.min.x) {
							travel.velocity.x = Math.abs(travel.velocity.x);
						}
						let horizontalSpeed = travel.speed / 2;
						if (area.min.x >= area.max.x) {
							let centreX = (area.min.x + area.max.x) / 2.0
							if (props.position.x > centreX) {
								horizontalSpeed = -horizontalSpeed;
							}
							props.position.x = moveCoordinateTo(props.position.x, centreX, horizontalSpeed);
						} else {
							props.position.x += travel.velocity.x;
						}
						props.position.y += travel.velocity.y;
					}
					break;
				}
			}
		}

		props.travel = [props.travel[props.travel.length - 1]];
	}

	for (let i = 0; i < gameData.objects.length; i++) {
		if (gameData.objects[i] === null) continue;
		let props = state.properties[i];
		let travel = props.travel[0];
		if (travel.tag === ActiveTravel.AttachTo) {
			let position = clonePosition(state.properties[travel.index].position);
			position.x += travel.offset.x;
			position.y += travel.offset.y;
			props.position = position;
		}
	}
}

function updateSwitchStates(properties) {
	for (let i = 0; i < properties.length; i++) {
		let props = properties[i];
		if (props === null) continue;
		if (props.switchState === Mio.SwitchWhen.TurnsOff) {
			props.switchState = Mio.SwitchWhen.IsOff;
		} else if (props.switchState === Mio.SwitchWhen.TurnsOn) {
			props.switchState = Mio.SwitchWhen.IsOn;
		}
		if (props.nextSwitchState === Mio.SwitchWhen.TurnsOn && props.switchState === Mio.SwitchWhen.IsOff) {
			props.switchState = Mio.SwitchWhen.TurnsOn;
		}
		if (props.nextSwitchState === Mio.SwitchWhen.TurnsOff && props.switchState === Mio.SwitchWhen.IsOn) {
			props.switchState = Mio.SwitchWhen.TurnsOff;
		}
	}
}

function winGameIfConditionsAreMet(state, gameData, oldWinStatus, winSounds) {
	if (Mio.GameCondition.Win === oldWinStatus) {
		state.winStatus = Mio.GameCondition.HasBeenWon;
	} else if (Mio.GameCondition.Loss === oldWinStatus) {
		state.winStatus = Mio.GameCondition.HasBeenLost;
	}

	if (state.winStatus === Mio.GameCondition.NotYetWon) {
		for (let conditionIndex = 0; conditionIndex < gameData.winConditions.length; conditionIndex++) {
			let conditions = gameData.winConditions[conditionIndex];
			let won = null;
			for (let which = 0; which < conditions.length; which++) {
				let winCondition = conditions[which];
				let switchWhen = winCondition.switchState;
				let props = state.properties[winCondition.index];
				let switchMatchesCondition;
				if (switchWhen === Mio.Switch.On
					&& (props.switchState === Mio.SwitchWhen.IsOn
						|| props.switchState === Mio.SwitchWhen.TurnsOn)) {
					switchMatchesCondition = true;
				} else if (switchWhen === Mio.Switch.Off
					&& (props.switchState === Mio.SwitchWhen.IsOff
						|| props.switchState === Mio.SwitchWhen.TurnsOff)) {
					switchMatchesCondition = true;
				} else {
					switchMatchesCondition = false;
				}
				if (won !== null) {
					won = won && switchMatchesCondition;
				} else {
					won = switchMatchesCondition;
				}
			}

			if (won === true) {
				console.log('Game Won');
				randomInArray(winSounds).play();
				state.winStatus = Mio.GameCondition.Win;
				this.emit('won');
			}
		}
	}
}

function loseIfOutOfTime(state, gameData, loseSounds) {
	let end;
	if (gameData.length === Mio.Length.Short) {
		end = 32;
	} else if (gameData.length === Mio.Length.Long) {
		end = 64;
	}
	if (gameData.length !== Mio.Length.Boss) {
		if (state.frame === end * 7.5) {
			if (state.winStatus !== Mio.GameCondition.Win
				&& state.winStatus !== Mio.GameCondition.Loss
				&& state.winStatus !== Mio.GameCondition.HasBeenLost
				&& state.winStatus !== Mio.GameCondition.HasBeenWon) {
				randomInArray(loseSounds).play();
				state.winStatus = Mio.GameCondition.Loss;
				console.log('Ran out of time');
				this.emit('lost');
			}
		}
	}
}



const letterSpacing = {
	[' ']: 4,
	['!']: 4,
	['"']: 8,
	["#"]: 15,
	['$']: 15,
	['%']: 15,
	['\'']: 5,
	['(']: 8,
	[')']: 8,
	['*']: 13,
	['+']: 13,
	[',']: 5,
	['-']: 13,
	['.']: 5,
	['/']: 15,
	['0']: 15,
	['1']: 10,
	['2']: 14,
	['3']: 14,
	['4']: 14,
	['5']: 14,
	['6']: 14,
	['7']: 14,
	['8']: 14,
	['9']: 14,
	[':']: 5,
	[';']: 5,
	['<']: 14,
	['=']: 13,
	['>']: 14,
	['?']: 13,
	['@']: 16,
	['A']: 15,
	['B']: 15,
	['C']: 15,
	['D']: 14,
	['E']: 15,
	['F']: 14,
	['G']: 15,
	['H']: 15,
	['I']: 13,
	['J']: 15,
	['K']: 14,
	['L']: 14,
	['M']: 17,
	['N']: 15,
	['O']: 15,
	['P']: 15,
	['Q']: 15,
	['R']: 14,
	['S']: 14,
	['T']: 15,
	['U']: 14,
	['V']: 15,
	['W']: 16,
	['X']: 16,
	['Y']: 15,
	['Z']: 14,
	['[']: 8,
	[']']: 8,
	['a']: 9,
	['b']: 9,
	['c']: 9,
	['d']: 9,
	['e']: 9,
	['f']: 9,
	['g']: 9,
	['h']: 9,
	['i']: 5,
	['j']: 9,
	['k']: 9,
	['l']: 6,
	['m']: 9,
	['n']: 9,
	['o']: 9,
	['p']: 9,
	['q']: 9,
	['r']: 9,
	['s']: 9,
	['t']: 9,
	['u']: 9,
	['v']: 9,
	['w']: 9,
	['x']: 9,
	['y']: 9,
	['z']: 9,
	['~']: 11,
	['À']: 15,
	['Á']: 15,
	['Â']: 15,
	['Ä']: 15,
	['È']: 15,
	['É']: 15,
	['Ê']: 15,
	['Ë']: 15,
	['Ì']: 13,
	['Í']: 13,
	['Î']: 13,
	['Ï']: 13,
	['Ò']: 15,
	['Ó']: 15,
	['Ô']: 15,
	['Ö']: 15,
	['Œ']: 16,
	['Ù']: 14,
	['Ú']: 14,
	['Û']: 14,
	['Ü']: 14,
	['Ç']: 14,
	['Ñ']: 15,
	['à']: 9,
	['á']: 9,
	['â']: 9,
	['ä']: 9,
	['è']: 9,
	['é']: 9,
	['ê']: 9,
	['ë']: 9,
	['ì']: 9,
	['í']: 9,
	['î']: 9,
	['ï']: 9,
	['ò']: 9,
	['ó']: 9,
	['ô']: 9,
	['ö']: 9,
	['œ']: 9,
	['ù']: 9,
	['ú']: 9,
	['û']: 9,
	['ü']: 9,
	['ç']: 9,
	['ñ']: 9,
	['ß']: 14,
	['£']: 13,
	['€']: 13,
	['܀']: 15,
	['܁']: 15,
	['܂']: 15,
	['܃']: 15,
	['܄']: 15,
	['܅']: 15,
	["܆"]: 15,
	["܇"]: 15,
	["܈"]: 15,
	["܉"]: 15,
	["܊"]: 15,
	["܋"]: 15,
	["܌"]: 15,
	["܍"]: 15,
	["܎"]: 15,
	["܏"]: 15,
	["ܐ"]: 15,
	["ܑ"]: 15,
	["ܒ"]: 15,
	["ܓ"]: 17,
	["ܔ"]: 17,
	["ܕ"]: 17,
	["ܖ"]: 13,
	["ܗ"]: 13,
};

function indexInFontBitmap(letter) {
	const conversionMap = {
		['À']: 128,
		['Á']: 129,
		['Â']: 130,
		['Ä']: 131,
		['È']: 132,
		['É']: 133,
		['Ê']: 134,
		['Ë']: 135,
		['Ì']: 136,
		['Í']: 137,
		['Î']: 138,
		['Ï']: 139,
		['Ò']: 140,
		['Ó']: 141,
		['Ô']: 142,
		['Ö']: 143,
		['Œ']: 144,
		['Ù']: 145,
		['Ú']: 146,
		['Û']: 147,
		['Ü']: 148,
		['Ç']: 149,
		['Ñ']: 150,
		['à']: 151,
		['á']: 152,
		['â']: 153,
		['ä']: 154,
		['è']: 155,
		['é']: 156,
		['ê']: 157,
		['ë']: 158,
		['ì']: 159,
		['í']: 160,
		['î']: 161,
		['ï']: 162,
		['ò']: 163,
		['ó']: 164,
		['ô']: 165,
		['ö']: 166,
		['œ']: 167,
		['ù']: 168,
		['ú']: 169,
		['û']: 170,
		['ü']: 171,
		['ç']: 172,
		['ñ']: 173,
		['ß']: 174,
		['£']: 176,
		['€']: 177,
		['܀']: 1,
		['܁']: 2,
		['܂']: 3,
		['܃']: 4,
		['܄']: 5,
		['܅']: 6,
		["܆"]: 7,
		["܇"]: 8,
		["܈"]: 9,
		["܉"]: 10,
		["܊"]: 11,
		["܋"]: 12,
		["܌"]: 13,
		["܍"]: 14,
		["܎"]: 15,
		["܏"]: 16,
		["ܐ"]: 17,
		["ܑ"]: 18,
		["ܒ"]: 19,
		["ܓ"]: 20,
		["ܔ"]: 21,
		["ܕ"]: 22,
		["ܖ"]: 23,
		["ܗ"]: 24,
	};
	let code = conversionMap[letter];
	return code !== undefined ? code : letter.charCodeAt(0);
}


let audioNames = [
	'explosion',
	'glass',
	'gong',
	'spring',
	'pistol',
	'slice',
	'camera',
	'splash',
	'correct',
	'incorrect',
	'switch',
	'input',
	'falling',
	'wiggle',
	'rising',
	'victory',
	'batting',
	'swing',
	'impact',
	'kick',
	'racquet',
	'bowling',
	'sunk_putt',
	'whistle',
	'frying_pan',
	'bell',
	'knife_chop',
	'mobile_phone',
	'razor',
	'mobile_phone',
	'popped_cork',
	'water',
	'sneeze',
	'snap',
	'munching',
	'gulp',
	'punch',
	'foot_stamp',
	'gasp',
	'applause',
	'cat',
	'big_dog',
	'pig',
	'small_dog',
	'wolf',
	'crow',
	'tiger',
	'wing_flap',
	'baby',
	'giggle',
	'scream',
	'too_bad',
	'kung_fu',
	'lets_fight',
	'cheering',
	'booing',
	'mario_jump',
	'coin',
	'power_up',
	'power_down',
	'shell_kick',
	'cannon',
	'struck',
	'barrel_hop',
];

module.exports = {
	Player, ORIGINAL_CANVAS_WIDTH, ORIGINAL_CANVAS_HEIGHT
};
