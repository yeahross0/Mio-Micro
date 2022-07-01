
const WIN_CONDITIONS_COUNT = 6;
const SWITCH_CONDITIONS_COUNT = 6;
const OBJECT_COUNT = 15;
const OBJECT_ART_COUNT = 4;
const ART_BANK_COUNT = 4;
const INSTRUCTION_COUNT = 6;
const TRIGGER_COUNT = 6;
const ACTION_COUNT = 6;

function slice_from(data, offset, length) {
	return data.slice(offset, offset + length);
}

function name_from_data(data, offset, length) {
	let slice = slice_from(data, offset, length);
	let null_terminator_index = slice.findIndex(e => e == 0);
	if (null_terminator_index !== -1) {
		length = null_terminator_index;
		slice = slice_from(data, offset, length);
	}
	
	return String.fromCharCode(...slice);
}


function first_hex_digit(_byte) {
	return _byte >> 4;
}

function second_hex_digit(_byte) {
	return _byte & 0x0F;
}

const Switch = {
	On: 'On',
	Off: 'Off'
};

const AnimationStyle = {
	Hold: 'Hold',
	PlayOnce: 'PlayOnce',
	Loop: 'Loop'
};

function style_from_number(digit) {
	switch (digit) {
		case 0: {
			return AnimationStyle.Hold;
		}
		case 1: {
			return AnimationStyle.PlayOnce;
		}
		//case 2:
		default: {
			return AnimationStyle.Loop;
		}
	}
}

const Speed = {
	Slowest: 'Slowest',
	Slow: 'Slow',
	Normal: 'Normal',
	Fast: 'Fast',
	Fastest: 'Fastest'
};

function speed_from_number(digit) {
	switch (digit) {
		case 0: {
			return Speed.Slowest;
		}
		case 1: {
			return Speed.Slow;
		}
		case 2: {
			return Speed.Normal;
		}
		case 3: {
			return Speed.Fast;
		}
		//case 4: {
		default: {
			return Speed.Fastest;
		}
	}
}

const Overlap = {
	Anywhere: 'Anywhere',
	TryNotToOverlap: 'TryNotToOverlap'
};

const Time = {
	End: 'End'
};

const TouchesWhat = {
	Location: 'Location',
	AnotherObject: 'AnotherObject'
};

const ContactType = {
	Touch: 'Touch',
	Overlap: 'Overlap',
};

const SwitchWhen = {
	TurnsOn: 'TurnsOn',
	IsOn: 'IsOn',
	TurnsOff: 'TurnsOff',
	IsOff: 'IsOff'
};

const GameCondition = {
	Win: 'Win',
	Loss: 'Loss',
	HasBeenWon: 'HasBeenWon',
	HasBeenLost: 'HasBeenLost',
	NotYetWon: 'NotYetWon',
	NotYetLost: 'NotYetLost'
};

const Trigger = {
	TapThisObject: 'TapThisObject',
	TapAnywhere: 'TapAnywhere',
	TimeExact: 'TimeExact',
	TimeRandom: 'TimeRandom',
	Contact: 'Contact',
	Switch: 'Switch',
	SpecificArt: 'SpecificArt',
	FinishesPlaying: 'FinishesPlaying',
	GameCondition: 'GameCondition'
};

const Action = {
	Travel: 'Travel',
	Switch: 'Switch',
	Lose: 'Lose',
	ChangeArt: 'ChangeArt',
	StopPlaying: 'StopPlaying',
	SoundEffect: 'SoundEffect',
	ScreenEffect: 'ScreenEffect'
};

const FromLocation = {
	Current: 'Current',
	AnotherPosition: 'AnotherPosition',
	AnotherObject: 'AnotherObject',
};

const Direction = {
	Random: 'Random',
	Location: 'Location',
	Specific: 'Specific'
};

const SpecificDirection = {
	North: 'North',
	NorthEast: 'NorthEast',
	East: 'East',
	SouthEast: 'SouthEast',
	South: 'South',
	SouthWest: 'SouthWest',
	West: 'West',
	NorthWest: 'NorthWest'
};

const Travel = {
	GoStraight: 'GoStraight',
	Stop: 'Stop',
	JumpToPosition: 'JumpToPosition',
	JumpToArea: 'JumpToArea',
	JumpToObject: 'JumpToObject',
	Swap: 'Swap',
	Roam: 'Roam',
	Target: 'Target'
};

const Roam = {
	Wiggle: 'Wiggle',
	Insect: 'Insect',
	Reflect: 'Reflect',
	Bounce: 'Bounce'
};

const ScreenEffect = {
	Flash: 'Flash',
	Shake: 'Shake',
	Confetti: 'Confetti',
	Freeze: 'Freeze'
};

const Length = {
	Short: 'Short',
	Long: 'Long',
	Boss: 'Boss'
};

const StartLocation = {
	Position: 'Position',
	Area: 'Area',
	AttachToObject: 'AttachToObject'
};

class GameData {
	constructor(data) {
		this.data = data;
	}
	
	get name() {
		let offset = 0x001C;
		let length = 20;
		return name_from_data(this.data, offset, length);
	}
	
	get length() {
		if (second_hex_digit(this.data[0xE605]) === 0) {
			return Length.Short;
		} else if (second_hex_digit(this.data[0xE605]) === 1) {
			return Length.Long;
		} else {
			return Length.Boss;
		}
	}
	
	object(index) {
		return new ObjectData(this.data, index);
	}
	
	win_condition(condition_index, switch_index) {
		let offset = 0xE5B9 + condition_index * 6 + switch_index;
		let switch_state;
		switch (second_hex_digit(this.data[offset])) {
			case 1:
				switch_state = Switch.On;
				break;
			case 2:
				switch_state = Switch.Off;
				break;
			default:
				return null;
		}
		let index = first_hex_digit(this.data[offset]);
		return { index, switch_state };
	}
}

function object_offset(index) {
	return 0xB100 + index * 0x88;
}

function assembly_offset(index) {
	return 0xBBB9 + index * 720;
}

class ObjectData {
	constructor(data, index) {
		this.data = data;
		this.index = index;
	}
	
	get offset() {
		return object_offset(this.index);
	}
	
	get is_active() {
		let offset = this.offset + 5;
		return this.data[offset] == 0x01;
	}
	
	get name() {
		let offset = this.offset + 6;
		let length = 18;
		return name_from_data(this.data, offset, length);
	}
	
	get sprite_size() {
		let offset = this.offset + 4;
		return 16 * (this.data[offset] + 1);
	}
	
	art(index) {
		return new ArtData(this.data, this, index);
	}
	
	get assembly() {
		return new AssemblyData(this.data, this);
	}
}


class ArtData {
	constructor(data, object, index) {
		this.data = data;
		this.object = object;
		this.index = index;
	}
	
	get offset() {
		return this.object.offset + 0x19 + this.index * 0x1C;
	}
	
	get is_active() {
		let offset = this.offset;
		let _byte = this.data[offset];
		let has_valid_first_byte = _byte == 0x00 || _byte == 0x01 ||  _byte == 0x02 || _byte == 0x03 || _byte == 0x04;
		return has_valid_first_byte && this.count != 0;
	}
	
	get count() {
		let count = this.data[this.offset + 1];
		//console.assert(count < ART_BANK_COUNT);
		return count;
	}
	
	get name() {
		let offset = this.offset + 6;
		let length = 18;
		return name_from_data(this.data, offset, length);
	}
	
	get bank() {
		let offset = this.offset + 2;
		let length = this.count;
		return slice_from(this.data, offset, length);
	}
}

class AssemblyData {
	constructor(data, object) {
		this.data = data;
		this.object = object;
	}
	
	get offset() {
		return assembly_offset(this.object.index);
	}
	
	get is_active() {
		let offset = this.offset;
		return this.data[offset] == 0x04;
	}

	get start_instruction() {
		let offset = this.offset;
		let length = 0x48;
		
		let position_slice = slice_from(this.data, offset + 14, 8);
		
		let x = position_from_scambled_data(position_slice, 'GFEDCBA-	-----!IH');
		let y = position_from_scambled_data(position_slice, '--------	EDCBA---	---!IHGF');
		let position = { x, y };
		
		let index = first_hex_digit(this.data[offset + 1]);
		let style = style_from_number(first_hex_digit(this.data[offset + 2]));
		let speed = speed_from_number(first_hex_digit(this.data[offset + 3]));
		let art = {
			index,
			style,
			speed
		};
		
		let location;
		if (this.data[offset + 12] == 0x07) {
			location = { tag: StartLocation.Position, position };
		} else if (this.data[offset + 12] == 0x87) {
			let overlap;
			if (this.data[offset + 13] == 0x04) {
				overlap = Overlap.TryNotToOverlap;
			} else {
			// } else if (this.offset + 13] == 0x00) {
				overlap = Overlap.Anywhere;
			}
			let position_slice = slice_from(this.data, offset + 16, 4);
		
			let x = position_from_scambled_data(position_slice, '-----CBA	-!IHGFED');
			let y = position_from_scambled_data(position_slice, '--------	A-------	IHGFEDCB	-------!');
			let min = position;
			let max = { x, y };
			location = { tag: StartLocation.Area, area: { min, max }, overlap };
		} else if ((this.data[offset + 12] & 0x10) != 0) {
			let index = (this.data[offset + 13] >> 5) + (this.data[offset + 14] % 2) * 8;
			let _offset = {
				x: position.x - 96,
				y: position.y - 64
			};
			location = { tag: StartLocation.AttachToObject, index, offset: _offset }
		} else {
			console.warn('Not known start location type');
		}
		
		return { art, location };
	}
	
	instruction(index) {
		return new InstructionData(this.data, this, index);
	}
}

function position_from_scambled_data(data, unscramble_instructions) {
	let position = 0;
	let split_instructions = unscramble_instructions.split('\t');
	for (let byte_index = 0; byte_index < split_instructions.length; byte_index++) {
		for (let bit_index = 0; bit_index < split_instructions[byte_index].length; bit_index++) {
			let is_bit_set = (data[byte_index] & (1 << (7 - bit_index))) != 0;
			if (!is_bit_set) {
				continue;
			}
			switch (split_instructions[byte_index][bit_index]) {
				case '!': {
					position -= 512; 
					break;
				}
				case 'I': {
					position += 256;
					break;
				}
				case 'H': {
					position += 128;
					break;
				}
				case 'G': {
					position += 64;
					break;
				}
				case 'F': {
					position += 32;
					break;
				}
				case 'E': {
					position += 16;
					break;
				}
				case 'D': {
					position += 8;
					break;
				}
				case 'C': {
					position += 4;
					break;
				}
				case 'B': {
					position += 2;
					break;
				}
				case 'A': {
					position += 1;
					break;
				}
			}
		}
	}
	
	return position;
}

let has_bits_set = (data, bits) => {
	return (data & bits) == bits;
};

class InstructionData {
	constructor(data, assembly, index) {
		this.data = data;
		this.assembly = assembly;
		this.index = index;
	}
	
	get offset() {
		return this.assembly.offset + 72 + this.index * 120;
	}
	
	get is_active() {
		return this.trigger(0) !== null;
	}
	
	trigger(index) {
		let length = 8;
		let offset = this.offset + index * length;
		
		let trigger_slice = slice_from(this.data, offset, length);
		let trigger_tag =  trigger_slice[0];
		
		let time_from_data = (data, offset) => {
			return first_hex_digit(data[offset]) + (second_hex_digit(data[offset + 1]) & 0x0F) * 16;
		};
		
		if ((trigger_tag & 0b00011111) == 0x01) {
			return { tag: Trigger.TapThisObject };
		} else if ((trigger_tag & 0b00011111) == 0x11) {
			return { tag: Trigger.TapAnywhere };
		} else if (trigger_tag == 0x02) {
			let time;
			if (this.data[offset + 2] == 0x14) {
				time = Time.End;
			} else {
				time = time_from_data(this.data, offset + 1);
			}
			return { tag: Trigger.TimeExact, when: time };
		} else if (trigger_tag == 0x12) {
			let start = time_from_data(this.data, offset + 1);
			let end;
			if (second_hex_digit(this.data[offset + 3]) == 0x02) {
				end = Time.End;
			} else {
				end = time_from_data(this.data, offset + 2);
			}
			return { tag: Trigger.TimeRandom, start, end };
		} else if (second_hex_digit(trigger_tag) == 0x03) {
			let contact;
			if ([0x13, 0x53, 0x93, 0xD3].includes(this.data[offset])) {
				contact = ContactType.Overlap;
			} else {
				contact = ContactType.Touch;
			}
			let touches;
			if (has_bits_set(this.data[offset + 6], 0x04)) {
				let position_slice = slice_from(this.data, offset + 1, 3);
				let x = position_from_scambled_data(position_slice, 'FEDCBA__	____!IHG');
				let y = position_from_scambled_data(position_slice, '________	DCBA____	__!IHGFE');
				let min = { x, y };
				position_slice = slice_from(this.data, offset + 3, 4);
				x = position_from_scambled_data(position_slice, 'BA------	!IHGFEDC');
				y = position_from_scambled_data(position_slice, '--------	--------	HGFEDCBA	------!I');
				let max = { x, y };
				touches = { what: TouchesWhat.Location, area: { min, max }};
			} else {
				let index = (this.data[offset] >> 6) + (this.data[offset + 1] % 4) * 4
				touches = { what: TouchesWhat.AnotherObject, index };
			}
			return { tag: Trigger.Contact, contact, touches };
		} else if (second_hex_digit(trigger_tag) == 0x04) {
			let index = first_hex_digit(this.data[offset + 1]);
			let switch_when;
			switch (this.data[offset + 2]) {
				case 0: {
					switch_when = SwitchWhen.TurnsOn;
					break;
				}
				case 1: {
					switch_when = SwitchWhen.IsOn;
					break;
				}
				case 2: {
					switch_when = SwitchWhen.TurnsOff;
					break;
				}
				case 3: {
					switch_when = SwitchWhen.IsOff;
					break;
				}
				default: {
					console.warn('Unreachable SwitchWhen');
				}
			}
			return { tag: Trigger.Switch, index, switch_when };
		} else if (trigger_tag == 0x05) {
			let index = first_hex_digit(this.data[offset + 1]);
			return { tag: Trigger.SpecificArt, index };
		} else if (trigger_tag == 0x15) {
			return { tag: Trigger.FinishesPlaying };
		} else if (second_hex_digit(trigger_tag) == 0x06) {
			let digit = first_hex_digit(trigger_tag);
			let condition;
			switch (digit) {
				case 0: {
					condition = GameCondition.Win;
					break;
				}
				case 1: {
					condition = GameCondition.Loss;
					break;
				}
				case 2: {
					condition = GameCondition.HasBeenWon;
					break;
				}
				case 3: {
					condition = GameCondition.HasBeenLost;
					break;
				}
				case 4: {
					condition = GameCondition.NotYetWon;
					break;
				}
				case 5: {
					condition = GameCondition.NotYetLost;
					break;
				}
				default: {
					console.warn('Unreachable GameCondition');
				}
			}
			return { tag: Trigger.GameCondition, condition };
		} else {
			//console.warn('Unreachable Trigger');
			return null;
		}
	}
	
	action(index) {
		let length = 12;
		let offset = this.offset + 48 + index * length;
		
		let action_slice = slice_from(this.data, offset, length);
		let action_tag =  action_slice[0];
		
		let common_position = (data, offset) => {
			let position_slice = slice_from(data, offset, 4);
			let x = position_from_scambled_data(position_slice, 'BA000000	!IHGFEDC');
			let y = position_from_scambled_data(position_slice, '--------	--------	HGFEDCBA	------!I');
			return { x, y };
		};
		
		if (action_tag == 0x01) {
			let speed;
			if (this.data[offset + 8] === 1) {
				speed = Speed.Fastest;
			} else {
				let speed_digit = this.data[offset + 7] >> 6;
				speed = speed_from_number(speed_digit);
			}
			//let speed_digit = this.data[offset + 8] * 4 + this.data[offset + 7] >> 6;
			//let speed = speed_from_number(speed_digit);
			
			let position_slice = slice_from(this.data, offset + 2, 3);
			let x = position_from_scambled_data(position_slice, 'HGFEDCBA	------!I');
			let y = position_from_scambled_data(position_slice, '--------	FEDCBA--	----!IHG');
			let position = { x, y };
			
			let from;
			if (second_hex_digit(this.data[offset + 1]) == 0) {
				from = { tag: FromLocation.Current };
			} else if (second_hex_digit(this.data[offset + 1]) == 1) {
				from = { tag: FromLocation.AnotherPosition, position };
			} else if (has_bits_set(this.data[offset + 1], 5)) {
				let index = first_hex_digit(this.data[offset + 1]);
				from = { tag: FromLocation.AnotherObject, index, offset: offset_from_position(position) };
			} else {
				console.warn('Unreachable FromLocation');
			}
			
			let direction_digit = this.data[offset + 4];
			let direction;
			
			if (direction_digit == 0x10) {
				direction = { tag: Direction.Random };
			} else if (has_bits_set(direction_digit, 0x20)) {
				let position = common_position(this.data, offset + 4);
			
				direction = { tag: Direction.Location, position };
			} else {
				let direction_digit = Math.floor((this.data[offset + 7] % 0x40) / 4);
				let dir;
				switch (direction_digit) {
					case 0: {
						dir = SpecificDirection.North;
						break;
					}
					case 1: {
						dir = SpecificDirection.NorthEast;
						break;
					}
					case 2: {
						dir = SpecificDirection.East;
						break;
					}
					case 3: {
						dir = SpecificDirection.SouthEast;
						break;
					}
					case 4: {
						dir = SpecificDirection.South;
						break;
					}
					case 5: {
						dir = SpecificDirection.SouthWest;
						break;
					}
					case 6: {
						dir = SpecificDirection.West;
						break;
					}
					case 7: {
						dir = SpecificDirection.NorthWest;
						break;
					}
					default: {
						console.warn('Unreachable SpecificDirection');
					}
				}
				direction = { tag: Direction.Specific, direction: dir };
			}
			return { tag: Action.Travel, travel: Travel.GoStraight, from, direction, speed };
		} else if (action_tag == 0x11) {
			return { tag: Action.Travel, travel: Travel.Stop };
		} else if (action_tag == 0x21) {
			let move_to_digit = this.data[offset + 1] & 0x00011111;
			
			let position = common_position(this.data, offset + 2);
			
			if (move_to_digit == 0x00) {
				return { tag: Action.Travel, travel: Travel.JumpToPosition, position };
			} else if (second_hex_digit(move_to_digit) == 0x01) {
				let index = (this.data[offset + 2] >> 2) & 0x0F;
				return { tag: Action.Travel, travel: Travel.JumpToObject, index, offset: offset_from_position(position) };
			} else {
				let position_slice = slice_from(this.data, offset + 5, 3);
				let x = position_from_scambled_data(position_slice, 'FEDCBA--	----!IHG');
				let y = position_from_scambled_data(position_slice, '--------	DCBA----	--!IHGFE');
				let max = { x, y };
				let area = { min: position, max };
				let overlap = first_hex_digit(this.data[offset + 1]) == 1 ? Overlap.Anywhere : Overlap.TryNotToOverlap;
				return { tag: Action.Travel, travel: Travel.JumpToArea, area, overlap };
			}
		} else if (action_tag == 0x31) {
			let index = second_hex_digit(this.data[offset + 1]);
			return { tag: Action.Travel, travel: Travel.Swap, index };
		} else if (action_tag == 0x41) {
			let position_slice = slice_from(this.data, offset + 1, 4);
			let x = position_from_scambled_data(position_slice, 'A-------	IHGFEDCB	-------!');
			let y = position_from_scambled_data(position_slice, '--------	--------	GFEDCBA-	-----!IH');
			let min = { x, y };
			position_slice = slice_from(this.data, offset + 4, 3);
			x = position_from_scambled_data(position_slice, 'EDBCA---	---!IHGF');
			y = position_from_scambled_data(position_slice, '--------	CBA-----	-!IHGFED');
			let max = { x, y };
			let area = { min, max };
			let roam_type_digit = this.data[offset + 1] % 4;
			let roam;
			switch (roam_type_digit) {
				case 0: {
					roam = Roam.Wiggle;
					break;
				}
				case 1: {
					roam = Roam.Insect;
					break;
				}
				case 2: {
					roam = Roam.Reflect;
					break;
				}
				case 3: {
					roam = Roam.Bounce;
					break;
				}
				default:
					console.warn('Unreachable Roam');
			}
			let overlap;
			if (has_bits_set(this.data[offset + 1], 0x08)) {
				overlap = Overlap.TryNotToOverlap;
			} else {
				overlap = Overlap.Anywhere;
			}
			let speed_digit = (this.data[offset + 6] >> 7) + (this.data[offset + 7] & 0x01) * 2;
			let speed = speed_from_number(speed_digit);
			return { tag: Action.Travel, travel: Travel.Roam, roam, area, overlap, speed };
		} else if (action_tag == 0x51) {
			let index = second_hex_digit(this.data[offset + 1]);
			let position_slice = slice_from(this.data, offset + 1, 3);
			let x = position_from_scambled_data(position_slice, 'DCBA----	--!IHGFE');
			let y = position_from_scambled_data(position_slice, '--------	BA------	!IHGFEDC');
			let position = { x, y };
			let speed_digit = this.data[offset + 4] & 0b00000111;
			let speed = speed_from_number(speed_digit);
			return { tag: Action.Travel, travel: Travel.Target, index, offset: offset_from_position(position), speed };
		} else if (action_tag == 0x02) {
			return { tag: Action.Switch, switch_to: Switch.On };
		} else if (action_tag == 0x12) {
			return { tag: Action.Switch, switch_to: Switch.Off };
		} else if (second_hex_digit(action_tag) == 0x03) {
			return { tag: Action.Lose };
		} else if (action_tag == 0x04) {
			let index = first_hex_digit(this.data[offset + 1]);
			let style = style_from_number(first_hex_digit(this.data[offset + 2]));
			let speed = speed_from_number(first_hex_digit(this.data[offset + 3]));
			return { tag: Action.ChangeArt, index, style, speed };
		} else if (action_tag == 0x14) {
			return { tag: Action.StopPlaying };
		}
		else if (second_hex_digit(this.data[offset]) == 5) {
			// TODO:
			let effect = first_hex_digit(this.data[offset]) * 8 + first_hex_digit(this.data[offset + 1]);
			return { tag: Action.SoundEffect, effect };
		} else if (action_tag == 0x06) {
			return { tag: Action.ScreenEffect, effect: ScreenEffect.Flash };
		} else if (action_tag == 0x16) {
			return { tag: Action.ScreenEffect, effect: ScreenEffect.Shake };
		} else if (action_tag == 0x26) {
			return { tag: Action.ScreenEffect, effect: ScreenEffect.Confetti };
		} else if (action_tag == 0x36) {
			return { tag: Action.ScreenEffect, effect: ScreenEffect.Freeze };
		} else {
			//console.warn('Unreachable Action');
			return null;
		}
	}
}

function offset_from_position(position) {
	return { x: position.x - 96, y: position.y - 64 };
}
