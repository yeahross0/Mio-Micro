# Mio Micro

This project can extract the AI data from mio files and attempt to play the games.

[Test it out here](https://yeahross.itch.io/mio-micro). Drag and drop a MIO file and open the console logs to see the JSON output.

There are some notes on the file format in notes.md.

Note: The [NpmModules](https://github.com/yeahross0/Mio-Micro/tree/NpmModules) branch is being more actively worked on atm. I'll make it the main branch when its ready.

## Parser

A parser that can convert a binary mio file to JSON. A simple example JSON result:

```json
{
    "length": "Short",
    "command": "Poke!",
    "objects": [
        {
            "name": "LADYBIRD",
            "spriteSize": 64,
            "art": [
                {
                    "name": "WIGGLE",
                    "bank": {
                        "0": 0,
                        "1": 16
                    },
                    "collisionArea": {
                        "min": {
                            "x": 8,
                            "y": 3
                        },
                        "max": {
                            "x": 58,
                            "y": 56
                        }
                    }
                }
            ],
            "startInstruction": {
                "art": {
                    "index": 0,
                    "style": "Loop",
                    "speed": "Normal"
                },
                "location": {
                    "tag": "Position",
                    "position": {
                        "x": 96,
                        "y": 64
                    }
                }
            },
            "instructions": [
                {
                    "triggers": [
                        {
                            "tag": "TapThisObject"
                        }
                    ],
                    "actions": [
                        {
                            "tag": "Travel",
                            "travel": "GoStraight",
                            "from": {
                                "tag": "Current"
                            },
                            "direction": {
                                "tag": "Specific",
                                "direction": "North"
                            },
                            "speed": "Normal"
                        },
                        {
                            "tag": "SoundEffect",
                            "effect": 34
                        },
                        {
                            "tag": "Switch",
                            "switchTo": "On"
                        }
                    ]
                }
            ]
        }
    ],
    "winConditions": [
        [
            {
                "index": 0,
                "switchState": "On"
            }
        ]
    ],
    "layers": [
        0
    ]
}
```

## Player

A rough prototype mio file player so you can see if the parser is outputting sensible values.
Music and some AI functionality has not been implemented yet.
