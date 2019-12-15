import { ConditionBuilder } from "../ConditionBuilder";
import { test } from "./Tester";

test('Retrieve string',
    {
        text: '[name]',
        obj: { name: 'Test' },
    },
    {
        result: 'Test',
        code: 'name',
        ranges: []
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
        ranges: []
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
        ranges: []
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
        ranges: []
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
        ranges: []
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
        ranges: []
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
        ranges: []
    }
);

test('Function - Create + Args',
    {
        text: '[isRed 0]',
        obj: { isRed: (args: any[]) => 'red' + args[0] },
    },
    {
        result: 'red0',
        code: 'isRed(0)',
        ranges: []
    }
);

test('Function - Selector[0]',
    {
        text: '[isRed|red|blue]',
        obj: { isRed: (args: any[], res: string[]) => ({ selector: 0 }) },
    },
    {
        result: 'red',
        code: 'isRed("red", "blue")',
        ranges: []
    }
);

test('Function - Selector[1]',
    {
        text: '[isRed|red|blue]',
        obj: { isRed: (args: any[], res: string[]) => ({ selector: 1 }) },
    },
    {
        result: 'blue',
        code: 'isRed("red", "blue")',
        ranges: []
    }
);

test('Function - Match[0]',
    {
        text: '[color red|red|blue]',
        obj: { color: (args: any[], res: string[]) => ({ selector: res.findIndex((r) => r === args[0]) }) },
    },
    {
        result: 'red',
        code: 'color(["red"], ["red", "blue"])',
        ranges: []
    }
);

test('Function - Match[1]',
    {
        text: '[color blue|red|blue]',
        obj: { color: (args: any[], res: string[]) => ({ selector: res.findIndex((r) => r === args[0]) }) },
    },
    {
        result: 'blue',
        code: 'color(["blue"], ["red", "blue"])',
        ranges: []
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
        ranges: []
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
        ranges: []
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
        ranges: []
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
        ranges: []
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
        ranges: []
    }
);

test('Code - Test',
    {
        text: '[name Thomas Justin Bert|THOMAS|JUSTIN|BERT|NOPE]',
        obj: {
            name: (args: any[], res: string[]) => ({ selector: args.findIndex((n) => n == 'Thomas') }),
            name__toCode: (identity: string, args: string[], results: string[]) => {
                const builder = new ConditionBuilder();
                for (let idx = 0; idx < args.length; idx++)
                    builder.if('name == ' + args[idx], results[idx]);
                builder.else(results[results.length - 1]);
                return builder.build();
            }
        },
    },
    {
        result: 'THOMAS',
        code: '(name == "Thomas" ? "THOMAS" : (name == "Justin" ? "JUSTIN" : (name == "Bert" ? "BERT" : "NOPE")',
        ranges: []
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
        ranges: []
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
            rand(args: any[], results: any[]) {
                return { selector: Math.floor(Math.random() * results.length) };
            },
            flags: {
                CAIT_FUCKED: true
            }
        },
    },
    {
        result: [`
Cait is sitting out by the fire, alternating between hugging her knees and warming her hands. She's humming a slow tune that tugs at your heartstrings though you're pretty sure you've never heard it before. Is this what music sounds like in Jassira?
`,
            `
Cait's sitting by the fire, but looks up at you as you pass by the fire with a little smile. <i>"If you want to have a quick chat, take your mind off things, I'm always game for it. Unless you'd like to take off a little stress from the road, that is..."</i>
`,
            `
Cait's parked herself by the fire, sitting cross-legged with her eyes closed and her staff lengthwise across her lap. She seems to be meditating — but what <i>do</i> devotees of Mallach meditate on? Fantasising about various deliciously lewd sex acts, perhaps? Does she have ritual mental exercises to get herself in the mood at-will?

Or maybe you're just overthinking things.
`],
        code: 'rand("\nCait is sitting out by the fire, alternating between hugging her knees and warming her hands. She\'s humming a slow tune that tugs at your heartstrings though you\'re pretty sure you\'ve never heard it before. Is this what music sounds like in Jassira?", "\nCait\'s sitting by the fire, but looks up at you as you pass by the fire with a little smile. <i>\"If you want to have a quick chat, take your mind off things, I\'m always game for it.\" " + (flags.CAIT_FUCKED ? "Unless you\'d like to take off a little stress from the road, that is..." : "") + "</i>", "\nCait\'s parked herself by the fire, sitting cross-legged with her eyes closed and her staff lengthwise across her lap. She seems to be meditating — but what <i>do</i> devotees of Mallach meditate on? Fantasising about various deliciously lewd sex acts, perhaps? Does she have ritual mental exercises to get herself in the mood at-will?\n\nOr maybe you\'re just overthinking things.")',
        ranges: []
    }
);
