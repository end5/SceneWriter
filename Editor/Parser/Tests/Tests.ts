import { ConditionBuilder } from "../ConditionBuilder";
import { test } from "./Tester";

test('Retrieve string',
    '[name]',
    { name: 'Test' },
    'Test',
    'name'
);

test('Retrieve number',
    '[str]',
    { str: 100 },
    '100',
    'str'
);

test('Retrieve function',
    '[isRed]',
    { isRed: () => 'red' },
    'red',
    'isRed()'
);

test('Access string',
    '[pc.name]',
    { pc: { name: 'Test' } },
    'Test',
    'pc.name'
);

test('Access number',
    '[pc.str]',
    { pc: { str: 100 } },
    '100',
    'pc.str'
);

test('Access function',
    '[pc.isRed]',
    { pc: { isRed: () => 'red' } },
    'red',
    'pc.isRed()'
);

test('Function - Create',
    '[isRed]',
    { isRed: () => 'red' },
    'red',
    'isRed()'
);

test('Function - Create + Args',
    '[isRed 0]',
    { isRed: (args: any[]) => 'red' + args[0] },
    'red0',
    'isRed(0)'
);

test('Function - Selector[0]',
    '[isRed|red|blue]',
    { isRed: (args: any[], res: string[]) => ({ selector: 0 }) },
    'red',
    'isRed("red", "blue")'
);

test('Function - Selector[1]',
    '[isRed|red|blue]',
    { isRed: (args: any[], res: string[]) => ({ selector: 1 }) },
    'blue',
    'isRed("red", "blue")'
);

test('Function - Match[0]',
    '[color red|red|blue]',
    { color: (args: any[], res: string[]) => ({ selector: res.findIndex((r) => r === args[0]) }) },
    'red',
    'color(["red"], ["red", "blue"])'
);

test('Function - Match[1]',
    '[color blue|red|blue]',
    { color: (args: any[], res: string[]) => ({ selector: res.findIndex((r) => r === args[0]) }) },
    'blue',
    'color(["blue"], ["red", "blue"])'
);

test('Boolean - true',
    '[color|red|blue]',
    { color: true },
    'red',
    '(color ? "red" : "blue")'
);

test('Boolean - false',
    '[color|red|blue]',
    { color: false },
    'blue',
    '(color ? "red" : "blue")'
);

test('Concat',
    'Hi! My name is [pc.name]. How are you?',
    { pc: { name: 'Thomas' } },
    'Hi! My name is Thomas. How are you?',
    '"Hi! My name is " + pc.name + ". How are you?"'
);

test('Code - Quotes',
    '"Hi! My name is [pc.name]. How are you?"',
    { pc: { name: 'Thomas' } },
    '"Hi! My name is Thomas. How are you?"',
    '"\\"Hi! My name is " + pc.name + ". How are you?\\""'
);

test('Code - Newline',
    `This
is
a
new

line`,
    {},
    `This
is
a
new

line`,
    `"This\\nis\\na\\nnew\\n\\nline"`
);

test('Code - Test',
    '[name Thomas Justin Bert|THOMAS|JUSTIN|BERT|NOPE]',
    {
        name: (args: any[], res: string[]) => ({ selector: args.findIndex((n) => n == 'Thomas') }),
        name__toCode: (identity: string, args: string[], results: string[]) => {
            const builder = new ConditionBuilder();
            for (let idx = 0; idx < args.length; idx++)
                builder.if('name == ' + args[idx], results[idx]);
            builder.else(results[results.length - 1]);
            return builder.build();
        }
    },
    'THOMAS',
    '(name == "Thomas" ? "THOMAS" : (name == "Justin" ? "JUSTIN" : (name == "Bert" ? "BERT" : "NOPE")'
);

test('Super',
    `[store.open|"Welcome to [store.name]. My name is [person.name].
Is there anything I can help you with today?"|The sign says closed.]`,
    {
        store: {
            open: true,
            name: 'TipTop'
        },
        person: {
            name: 'Thomas'
        }
    },
    `"Welcome to TipTop. My name is Thomas.
Is there anything I can help you with today?"`,
    `(store.open ? "\\"Welcome to " + store.name + ". My name is " + person.name + ".\\nIs there anything I can help you with today?\\"" : "The sign says closed.")`
);
