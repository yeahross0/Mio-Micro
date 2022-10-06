const MidiWriter = require('midi-writer-js');

const TRACK_COUNT = 4;
const BASE_SONG_OFFSET = 0xB961;
const BASE_INSTRUMENT_OFFSET = 0xBA6B;
const BASE_VOLUME_OFFSET = 0xBA61;
const BASE_DRUM_OFFSET = 0xB9E1;
const SIMULTANEOUS_DRUMS = 4;
const VOLUME_MULTIPLIER = 13;

const notes = {
	[0]: 'G',
	[1]: 'G#',
	[2]: 'A',
	[3]: 'A#',
	[4]: 'B',
	[5]: 'C',
	[6]: 'C#',
	[7]: 'D',
	[8]: 'D#',
	[9]: 'E',
	[10]: 'F',
	[11]: 'F#',
	[12]: 'G',
	[13]: 'G#',
	[14]: 'A',
	[15]: 'A#',
	[16]: 'B',
	[17]: 'C',
	[18]: 'C#',
	[19]: 'D',
	[20]: 'D#',
	[21]: 'E',
	[22]: 'F',
	[23]: 'F#',
	[24]: 'G'
};

const instrumentCodes = [0, 18, 6, 22, 73, 56, 65, 75, 24, 29, 106, 33, 40, 13, 11, 47, 72, 78, 17, 38, 77, 59,
	126, 124, 60, 61, 62, 123, 66, 125, 68, 122, 53, 54, 52, 49, 67, 121, 119, 48, 83, 84,
	85, 86, 87, 88, 89, 90];

const instrumentLengths = [
	6, 10, 4, 9, 8, 2, 4, 8,
	4, 16, 4, 4, 8, 2, 10, 3,
	20, 5, 8, 3, 4, 1, 7, 2,
	2, 2, 2, 3, 1, 3.5, 2, 2,
	3, 8, 9, 9, 3, 2, 2, 12,
	8, 9, 12, 8, 12, 5, 4, 3
];

const basePitches = [
	2, 2, 2, 2, 4, 2, 2, 3,
	2, 2, 2, 2, 2, 2, 2, 2,
	2, 2, 2, 2, 2, 2, 2, 2,
	2, 2, 2, 2, 2, 2, 2, 2,
	2, 2, 2, 2, 2, 2, 2, 2,
	3, 3, 3, 1, 2, 4, 4, 1,
];

const buildMidiFile = (mioData, loopTimes = 0) => {
	let tracks = [];

	let trackLength = 32;

	let skipDrums = false;
	for (let trackIndex = 0; trackIndex < TRACK_COUNT; trackIndex++) {
		let track = new MidiWriter.Track();

		let songOffset = BASE_SONG_OFFSET + trackIndex * trackLength;

		let instrumentUsed = mioData[BASE_INSTRUMENT_OFFSET + trackIndex];
		console.debug('Using instrument', instrumentUsed);
		let volume = mioData[BASE_VOLUME_OFFSET + trackIndex] * VOLUME_MULTIPLIER;

		let notesUsed = []
		
		let base = basePitches[instrumentUsed];

		for (let i = 0; i < 25; i++) {
			if (i <= 4) {
				notesUsed.push(notes[i] + base);
			} else if (i <= 16) {
				notesUsed.push(notes[i] + (base + 1));
			} else {
				notesUsed.push(notes[i] + (base + 2));
			}
		}

		// Workarounds for instruments that are causing problems in timidity
		let channel = trackIndex + 1;
		if (instrumentUsed === 38) {
			channel = 1;
		}
		if (instrumentUsed === 37) {
			skipDrums = true;
		}
		track.addEvent(new MidiWriter.ProgramChangeEvent({ channel, instrument: parseInt(instrumentCodes[instrumentUsed]) }));
		for (let loopIter = 0; loopIter <= loopTimes; loopIter++) {
			for (let i = 0; i < trackLength; i++) {
				let note = mioData[songOffset + i];
				if (note !== 255) {
					let noteLength = (instrumentLengths[instrumentUsed] * 8);
					let startTick = 32 * i + loopIter * 1024;
					if (noteLength + startTick > (1 + loopTimes) * 1024) {
						noteLength = (1 + loopTimes) * 1024 - startTick;
					}
					let duration = 'T' + noteLength;
					track.addEvent(new MidiWriter.NoteEvent({
						pitch: notesUsed[note],
						duration,
						startTick,
						channel,
						velocity: volume
					}));
				}
			}
		}

		tracks.push(track);
	}

	if (!skipDrums) {

		let track = new MidiWriter.Track();

		let volume = mioData[BASE_VOLUME_OFFSET + 4] * VOLUME_MULTIPLIER;


		for (let loopIter = 0; loopIter <= loopTimes; loopIter++) {
			for (let i = 0; i < trackLength; i++) {
				for (let drumIndex = 0; drumIndex < SIMULTANEOUS_DRUMS; drumIndex++) {
					let drumUsed = mioData[BASE_DRUM_OFFSET + i + drumIndex * 32];
					if (drumUsed !== 255) {
						let drumConversion = [35, 38, 42, 46, 49, 45, 50, 47, 31, 39, 54, 73, 80, 81];
						let duration = 'T32';
						track.addEvent([
							new MidiWriter.NoteEvent({
								pitch: drumConversion[drumUsed],
								duration,
								channel: 10,
								startTick: 32 * i + loopIter * 1024,
								velocity: volume
							}),
						]);
					}
				}
			}
		}

		tracks.push(track);
	}

	let write = new MidiWriter.Writer(tracks);

	return write.buildFile()
}

module.exports = buildMidiFile;