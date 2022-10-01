# mio-loader

A loader for binary mio files. An example output after loading might be:

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
                },
                null,
                null,
                null
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

Documentation upcoming.