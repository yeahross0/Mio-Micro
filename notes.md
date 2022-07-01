# Notes on the mio Format

# Game Name

 - Offset: 0x1C
 - length: 20 bytes
 - null terminated if uses less than 20 bytes
 - Extended ASCII?

# Win Conditions

 - Offset: 0xE5B9
 - 6 Conditions
 - 1 hex digit for index
 - 1 hex digit for switch
   - if digit = 1: switch is on
   - if digit = 2: switch is off
 - calculating the offset of a particular condition: `0xE5B0 + condition_index * 6 + switch_check_index`

# Objects

 - Offset: 0xB100
 - 15 objects
 - offset for object: `0xB100 + index * 0x88`
 - the object is active if `data[offset + 5] = 0x01`
 - sprite size = `(data[offset + 4] + 1) * 16`
 - name starts at `offset + 6`, length is 18 bytes

# Art
 - Offset: `object_offset + 0x19 + index * 0x1C`
 - 1 to 4 `arts` per object
 - name starts at offset + 6, length is 18 bytes
 - I've given `bank` as an arbitrary name for the images position in the image data/spritesheet for this game
 - the banks for an art are one byte each and start at `offset + 2` and go on for `length` where `length = data[offset + 1]`
 - a bank is active if `data[offset]` is one of `[0x01, 0x02, 0x03, 0x04]`

# Assembly
 - Offset: `0xBBB9 + object_index * 720`
 - is active if `data[offset] = 0x04`

# Start Instruction
 - May be a point, area or another object + position offset
 - Sets initial art

## Art - Start Instruction
 - Offsets used here are the same as the `Assembly`
 - art index is the first hex digit of `data[offset + 1]`
 - style is the first hex digit of `data[offset + 2]`
   - if digit = 0: Hold
   - if digit = 1: Play Once
   - if digit = 2: Loop
 - speed is first hex digit of `data[offset + 3]`
   - if digit = 0: Slowest
   - if digit = 1: Slow
   - if digit = 2: Normal
   - if digit = 3: Fast
   - if digit = 4: Fastest

## Location - Start Instruction
 - type of location is based on `data[offset + 12]`
   - if value = 0x07: Point
   - if value = 0x97: Area
   - if the 4th bit of value is set: Another Object
 - the position data starts from `offset + 14`
   - it stores each number as a ten-bit two's complement integer
   - the bits for the number are stored across  two or three bytes
   - the order the bits are in for the position are different across the file
   - the x-coordinate of the position is stored as `GFEDCBA_	-----!IH`
     - where { A, B, C, D, E, F, G, H, I, ! } represents { 1, 2, 4, 8, 16, 32, 64, 128, 256, -512 } if they are set
   - the y-coordinate of the position is stored as `--------	EDCBA---	---!IHGF` from the same offset

## Area - Location

 - the end position starts from `offset + 16`
   - x: `-----CBA     -!!HGFED`
   - y: `--------     A-------	IHGFEDCBA	-------!`
 - if data[offset + 13] = 0x04: Try Not To Overlap
 - else: Anywhere

## Attach To Object - Location
 - index to the object is the first 3 bits in `data[offset + 13]` + the last bit in `data[offset + 14]` * 8
 - to get from the position to the offset position subtract { x: 96, y: 64 }

## Instruction
 - Offset: `object_offset + 72 + instruction_index * 120`
 - 1 to 6 triggers for each instruciton
 - 1 to 6 actions for each instruction

## Triggers
 - Offset: `instruction_offset + trigger_index * length`
   - where `length = 8`

## Trigger Tags

The value of `data[offset]` determines what the trigger is:

 - 0x01 - Tap This Object
 - 0x11 - Tap Anywhere
 - 0x02 - Exact Time
 - 0x12 - Random Time
 - 0x03 | 0x43 | 0x83 | 0xC3 - Contact (Touches)
 - 0x13 | 0x53 | 0x93 | 0xD3 - Contact (Overlap)
 - 0x?4 - Switch
 - 0x05 - Art (Specific Art)
 - 0x15 - Art (Finishes Playing)
 - 0xN6 - GameCondition

## Time Trigger

 - if `data[offset + 2] = 0x14`: Time End
 - Represented as Time N-M
 - first hex digit of `data[offset + 1]` determines the M value
   - the digit is between 0 and 15, where 0 is `Time 1-1` and 15 is `Time 4-4`
 - second hex digit of `data[offset + 1]` determines the N value
   - this digit * 4 gives the Time value it starts at

## Random Time Trigger

 - Start = same as before
 - End = same as before but add 1 to the offset

## Contact Trigger

 - if 6th bit is set in `data[offset + 6]`: Contact with Location
 - else: Contact with Another Object
 - position values: see code
 - index got in code by `let index = (this.data[offset] >> 6) + (this.data[offset + 1] % 4) * 4`
   - could be simpler probably

## Switch Trigger
 - index is 2nd hex digit of `data[offset + 1]`
 - switch is based on `data[offset + 2]`
   - if 0: Turns On
   - if 1: Is On
   - if 2: Turns Off
   - if 3: Is Off

## Art Trigger
 - index to the art is the first hex digit of `data[offset + 1]`

## Game Condition Trigger
 - based on `data[offset]`
   - if 0x06: Win
   - if 0x16: Lose
   - if 0x26: Has Been Won
   - if 0x36: Has Been Won
   - if 0x46: Not Yet Won
   - if 0x56: Not Yet Lost

## Actions

 - Offset: `instruction_offset + 48 + index * length`
   - where `length = 12`

## Action Tag

 - 0x01 - Travel Go Straight
 - 0x11 - Stop
 - 0x21 - Jump To
 - 0x31 - Swap
 - 0x41 - Roam
 - 0x51 - Target
 - 0x02 - Switch On
 - 0x12 - Switch Off
 - 0x03 - Lose
 - 0x04 - Change Art
 - 0x14 - Stop Playing Music
 - 0xN5 - Sound Effect
 - 0x06 - Screen Effect (Flash)
 - 0x16 - Screen Effect (Shake)
 - 0x26 - Screen Effect (Confetti)
 - 0x36 - Screen Effect (Freeze)

## Travel

// TODO: Write notes down

## Change Art Action

 - index is 1st hex digit of `data[offset + 1]`
 - style is 1st hex digit of `data[offset + 2]`
 - speed is 1st hex digit of `data[offset + 3]`