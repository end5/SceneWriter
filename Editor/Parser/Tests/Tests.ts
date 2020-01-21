import { ConditionBuilder } from "../ConditionBuilder";
import { TextRange } from "../TextRange";
import { test } from "./Tester";

test('Nothing',
    {
        text: '',
        obj: {},
    },
    {
        result: '',
        code: '""',
        ranges: [new TextRange({ line: 0, col: 0 }, { line: 0, col: 0 })]
    }
);

test('String',
    {
        text: 'string',
        obj: {},
    },
    {
        result: 'string',
        code: '"string"',
        ranges: [new TextRange({ line: 0, col: 0 }, { line: 0, col: 6 })]
    }
);

test('Object',
    {
        text: '[test]',
        obj: { test: { a: 'a' } },
    },
    {
        result: '',
        code: '',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 5 })]
    }
);

test('Retrieve string',
    {
        text: '[name]',
        obj: { name: 'Test' },
    },
    {
        result: 'Test',
        code: 'name',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 5 })]
    }
);

test('Retrieve number',
    {
        text: '[str]',
        obj: { str: 100 },
    },
    {
        result: '100',
        code: 'str',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 4 })]
    }
);

test('Retrieve function',
    {
        text: '[isRed]',
        obj: { isRed: () => 'red' },
    },
    {
        result: 'red',
        code: 'isRed()',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 6 })]
    }
);

test('Access string',
    {
        text: '[pc.name]',
        obj: { pc: { name: 'Test' } },
    },
    {
        result: 'Test',
        code: 'pc.name',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 8 })]
    }
);

test('Access number',
    {
        text: '[pc.str]',
        obj: { pc: { str: 100 } },
    },
    {
        result: '100',
        code: 'pc.str',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 7 })]
    }
);

test('Access function',
    {
        text: '[pc.isRed]',
        obj: { pc: { isRed: () => 'red' } },
    },
    {
        result: 'red',
        code: 'pc.isRed()',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 9 })]
    }
);

test('Function - Create',
    {
        text: '[isRed]',
        obj: { isRed: () => 'red' },
    },
    {
        result: 'red',
        code: 'isRed()',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 6 })]
    }
);

test('Function - Create + Args',
    {
        text: '[isRed 0]',
        obj: { isRed: (arg1: number) => 'red' + arg1 },
    },
    {
        result: 'red0',
        code: 'isRed(0)',
        ranges: [new TextRange({ line: 0, col: 1 }, { line: 0, col: 8 })]
    }
);

test('Function - Selector[0]',
    {
        text: '[isRed|red|blue]',
        obj: { isRed: () => ({ selector: 0 }) },
    },
    {
        result: 'red',
        code: 'isRed("red", "blue")',
        ranges: [new TextRange({ line: 0, col: 7 }, { line: 0, col: 10 })]
    }
);

test('Function - Selector[1]',
    {
        text: '[isRed|red|blue]',
        obj: { isRed: () => ({ selector: 1 }) },
    },
    {
        result: 'blue',
        code: 'isRed("red", "blue")',
        ranges: [new TextRange({ line: 0, col: 11 }, { line: 0, col: 15 })]
    }
);

test('Function - Match[0]',
    {
        text: '[color red|red|blue]',
        obj: { color: (arg1: string, res1: string, res2: number) => ({ selector: arg1 === res1 ? 0 : 1 }) },
    },
    {
        result: 'red',
        code: 'color(["red"], ["red", "blue"])',
        ranges: [new TextRange({ line: 0, col: 11 }, { line: 0, col: 14 })]
    }
);

test('Function - Match[1]',
    {
        text: '[color blue|red|blue]',
        obj: { color: (arg1: string, res1: string, res2: number) => ({ selector: arg1 === res1 ? 0 : 1 }) },
    },
    {
        result: 'blue',
        code: 'color(["blue"], ["red", "blue"])',
        ranges: [new TextRange({ line: 0, col: 16 }, { line: 0, col: 20 })]
    }
);

test('Boolean - true',
    {
        text: '[color|red|blue]',
        obj: { color: true },
    },
    {
        result: 'red',
        code: '(color ? "red" : "blue")',
        ranges: [new TextRange({ line: 0, col: 7 }, { line: 0, col: 10 })]
    }
);

test('Boolean - false',
    {
        text: '[color|red|blue]',
        obj: { color: false },
    },
    {
        result: 'blue',
        code: '(color ? "red" : "blue")',
        ranges: [new TextRange({ line: 0, col: 11 }, { line: 0, col: 15 })]
    }
);

test('Concat',
    {
        text: 'Hi! My name is [pc.name]. How are you?',
        obj: { pc: { name: 'Thomas' } },
    },
    {
        result: 'Hi! My name is Thomas. How are you?',
        code: '"Hi! My name is " + pc.name + ". How are you?"',
        ranges: [
            new TextRange({ line: 0, col: 0 }, { line: 0, col: 15 }),
            new TextRange({ line: 0, col: 16 }, { line: 0, col: 23 }),
            new TextRange({ line: 0, col: 24 }, { line: 0, col: 38 })
        ]
    }
);

test('Code - Quotes',
    {
        text: '"Hi! My name is [pc.name]. How are you?"',
        obj: { pc: { name: 'Thomas' } },
    },
    {
        result: '"Hi! My name is Thomas. How are you?"',
        code: '"\\"Hi! My name is " + pc.name + ". How are you?\\""',
        ranges: [
            new TextRange({ line: 0, col: 0 }, { line: 0, col: 16 }),
            new TextRange({ line: 0, col: 17 }, { line: 0, col: 24 }),
            new TextRange({ line: 0, col: 25 }, { line: 0, col: 40 }),
        ]
    }
);

test('Code - Newline',
    {
        text: `This
is
a
new

line`,
        obj: {},
    },
    {
        result: `This
is
a
new

line`,
        code: `"This\\nis\\na\\nnew\\n\\nline"`,
        ranges: [new TextRange({ line: 0, col: 0 }, { line: 5, col: 4 })]
    }
);

test('Code - Test',
    {
        text: '[name Thomas Justin Bert|THOMAS|JUSTIN|BERT|NOPE]',
        obj: {
            name: (...args: string[]) => ({ selector: args.findIndex((n) => n == 'Thomas') }),
            name__info: {
                toCode: (args: string[], results: string[]) => {
                    const builder = new ConditionBuilder();
                    for (let idx = 0; idx < args.length; idx++)
                        builder.if('name == ' + args[idx], results[idx]);
                    builder.else(results[results.length - 1]);
                    return builder.build();
                }
            }
        },
    },
    {
        result: 'THOMAS',
        code: '(name == "Thomas" ? "THOMAS" : (name == "Justin" ? "JUSTIN" : (name == "Bert" ? "BERT" : "NOPE")',
        ranges: [new TextRange({ line: 0, col: 25 }, { line: 0, col: 31 })]
    }
);

test('Super',
    {
        text: `[store.open|"Welcome to [store.name]. My name is [person.name].
Is there anything I can help you with today?"|The sign says closed.]`,
        obj: {
            store: {
                open: true,
                name: 'TipTop'
            },
            person: {
                name: 'Thomas'
            }
        },
    },
    {
        result: `"Welcome to TipTop. My name is Thomas.
Is there anything I can help you with today?"`,
        code: `(store.open ? "\\"Welcome to " + store.name + ". My name is " + person.name + ".\\nIs there anything I can help you with today?\\"" : "The sign says closed.")`,
        ranges: [
            new TextRange({ line: 0, col: 12 }, { line: 0, col: 24 }),
            new TextRange({ line: 0, col: 25 }, { line: 0, col: 35 }),
            new TextRange({ line: 0, col: 36 }, { line: 0, col: 49 }),
            new TextRange({ line: 0, col: 50 }, { line: 0, col: 61 }),
            new TextRange({ line: 0, col: 62 }, { line: 1, col: 45 }),
        ]
    }
);

test('CoC2 parser code',
    {
        text: `[rand|
Cait is sitting out by the fire, alternating between hugging her knees and warming her hands. She's humming a slow tune that tugs at your heartstrings though you're pretty sure you've never heard it before. Is this what music sounds like in Jassira?
|
Cait's sitting by the fire, but looks up at you as you pass by the fire with a little smile. <i>"If you want to have a quick chat, take your mind off things, I'm always game for it. [flags.CAIT_FUCKED|Unless you'd like to take off a little stress from the road, that is...]"</i>
|
Cait's parked herself by the fire, sitting cross-legged with her eyes closed and her staff lengthwise across her lap. She seems to be meditating — but what <i>do</i> devotees of Mallach meditate on? Fantasising about various deliciously lewd sex acts, perhaps? Does she have ritual mental exercises to get herself in the mood at-will?

Or maybe you're just overthinking things.
]`,
        obj: {
            rand() {
                return { selector: 1 };
            },
            flags: {
                CAIT_FUCKED: true
            }
        },
    },
    {
        result: `
Cait's sitting by the fire, but looks up at you as you pass by the fire with a little smile. <i>"If you want to have a quick chat, take your mind off things, I'm always game for it. Unless you'd like to take off a little stress from the road, that is..."</i>
`,
        code: `rand("\\nCait is sitting out by the fire, alternating between hugging her knees and warming her hands. She\\'s humming a slow tune that tugs at your heartstrings though you\\'re pretty sure you\\'ve never heard it before. Is this what music sounds like in Jassira?\\n", "\\nCait\\'s sitting by the fire, but looks up at you as you pass by the fire with a little smile. <i>\\"If you want to have a quick chat, take your mind off things, I\\'m always game for it. " + (flags.CAIT_FUCKED ? "Unless you\\'d like to take off a little stress from the road, that is..." : "") + "\\"</i>\\n", "\\nCait\\'s parked herself by the fire, sitting cross-legged with her eyes closed and her staff lengthwise across her lap. She seems to be meditating — but what <i>do</i> devotees of Mallach meditate on? Fantasising about various deliciously lewd sex acts, perhaps? Does she have ritual mental exercises to get herself in the mood at-will?\\n\\nOr maybe you\\'re just overthinking things.\\n")`,
        ranges: [
            new TextRange({ line: 2, col: 1 }, { line: 3, col: 182 }),
            new TextRange({ line: 3, col: 201 }, { line: 3, col: 272 }),
            new TextRange({ line: 3, col: 273 }, { line: 4, col: 0 })
        ]
    }
);
