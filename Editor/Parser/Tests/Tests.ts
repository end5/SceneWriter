import { ConditionBuilder } from "../ConditionBuilder";
import { test } from "./Tester";

test('Retrieve string',
    '[name]',
    { name: { type: 'string', value: 'Test' } },
    'Test',
    'name'
);

test('Retrieve number',
    '[str]',
    { str: { type: 'number', value: 100 } },
    '100',
    'str'
);

test('Retrieve function',
    '[isRed]',
    { isRed: { type: 'function', value: () => 'red' } },
    'red',
    'isRed()'
);

test('Access string',
    '[pc.name]',
    { pc: { type: 'object', children: { name: { type: 'string', value: 'Test' } } } },
    'Test',
    'pc.name'
);

test('Access number',
    '[pc.str]',
    { pc: { type: 'object', children: { str: { type: 'number', value: 100 } } } },
    '100',
    'pc.str'
);

test('Access function',
    '[pc.isRed]',
    { pc: { type: 'object', children: { isRed: { type: 'function', value: () => 'red' } } } },
    'red',
    'pc.isRed()'
);

test('Function - Create',
    '[isRed]',
    { isRed: { type: 'function', value: (args: any[]) => 'red' } },
    'red',
    'isRed()'
);

test('Function - Create + Args',
    '[isRed 0]',
    { isRed: { type: 'function', value: (args: any[]) => 'red' + args[0] } },
    'red0',
    'isRed(0)'
);

test('Function - Selector[0]',
    '[isRed|red|blue]',
    { isRed: { type: 'function', value: (args: any[], res: string[]) => 0 } },
    'red',
    'isRed("red", "blue")'
);

test('Function - Selector[1]',
    '[isRed|red|blue]',
    { isRed: { type: 'function', value: (args: any[], res: string[]) => 1 } },
    'blue',
    'isRed("red", "blue")'
);

test('Function - Match[0]',
    '[color red|red|blue]',
    { color: { type: 'function', value: (args: any[], res: string[]) => res.findIndex((r) => r === args[0]) } },
    'red',
    'color(["red"], ["red", "blue"])'
);

test('Function - Match[1]',
    '[color blue|red|blue]',
    { color: { type: 'function', value: (args: any[], res: string[]) => res.findIndex((r) => r === args[0]) } },
    'blue',
    'color(["blue"], ["red", "blue"])'
);

test('Boolean - true',
    '[color|red|blue]',
    { color: { type: 'boolean', value: true } },
    'red',
    '(color ? "red" : "blue")'
);

test('Boolean - false',
    '[color|red|blue]',
    { color: { type: 'boolean', value: false } },
    'blue',
    '(color ? "red" : "blue")'
);

test('Concat',
    'Hi! My name is [pc.name]. How are you?',
    { pc: { type: 'object', children: { name: { type: 'string', value: 'Thomas' } } } },
    'Hi! My name is Thomas. How are you?',
    '"Hi! My name is " + pc.name + ". How are you?"'
);

test('Code - Quotes',
    '"Hi! My name is [pc.name]. How are you?"',
    { pc: { type: 'object', children: { name: { type: 'string', value: 'Thomas' } } } },
    '"Hi! My name is Thomas. How are you?"',
    '"\\"Hi! My name is " + pc.name + ". How are you?\\""'
);

test('Code - Newline',
    `"Welcome to [store.name]. My name is [pc.name]. Is there anything I can help you with today?"
You promptly exit the store.`,
    {
        store: { type: 'object', children: { name: { type: 'string', value: 'TipTop' } } }, pc: { type: 'object', children: { name: { type: 'string', value: 'Thomas' } } }
    },
    `"Welcome to TipTop. My name is Thomas. Is there anything I can help you with today?"
You promptly exit the store.`,
    `"\\"Welcome to " + store.name + ". My name is " + pc.name + ". Is there anything I can help you with today?\\"\\nYou promptly exit the store."`
);

test('Code - Test',
    '[name Thomas Justin Bert|THOMAS|JUSTIN|BERT|NOPE]',
    {
        name: {
            type: 'function',
            value: (args: any[], res: string[]) => args.findIndex((n) => n == 'Thomas'),
            toCode: (identity: string, args: string[], results: string[]) => {
                const builder = new ConditionBuilder();
                for (let idx = 0; idx < args.length; idx++)
                    builder.if('name == ' + args[idx], results[idx]);
                builder.else(results[results.length - 1]);
                return builder.build();
            }
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
            type: 'object',
            children: {
                open: { type: 'boolean', value: true },
                name: { type: 'string', value: 'TipTop' }
            }
        },
        person: {
            type: 'object',
            children: {
                name: { type: 'string', value: 'Thomas' }
            }
        }
    },
    `"Welcome to TipTop. My name is Thomas.
Is there anything I can help you with today?"`,
    `(store.open ? "\\"Welcome to " + store.name + ". My name is " + person.name + ".\\nIs there anything I can help you with today?\\"" : "The sign says closed.")`
);
