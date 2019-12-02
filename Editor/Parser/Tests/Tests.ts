import { test } from "./Tester";

test('Retrieve string',
    '[name]',
    { name: { value: 'Test' } },
    'Test'
);

test('Retrieve number',
    '[str]',
    { str: { value: 100 } },
    '100'
);

test('Retrieve function',
    '[isRed]',
    { isRed: { value: () => 'red' } },
    'red'
);

test('Access string',
    '[pc.name]',
    { pc: { children: { name: { value: 'Test' } } } },
    'Test'
);

test('Access number',
    '[pc.str]',
    { pc: { children: { str: { value: 100 } } } },
    '100'
);

test('Access function',
    '[pc.isRed]',
    { pc: { children: { isRed: { value: () => 'red' } } } },
    'red'
);

test('Function - Create',
    '[isRed]',
    { isRed: { value: (args: any[]) => 'red' } },
    'red'
);

test('Function - Create + Args',
    '[isRed 0]',
    { isRed: { value: (args: any[]) => 'red' + args[0] } },
    'red0'
);

test('Function - Selector[0]',
    '[isRed|red|blue]',
    { isRed: { value: (args: any[], res: string[]) => 0 } },
    'red'
);

test('Function - Selector[1]',
    '[isRed|red|blue]',
    { isRed: { value: (args: any[], res: string[]) => 1 } },
    'blue'
);

test('Function - Match[0]',
    '[color red|red|blue]',
    { color: { value: (args: any[], res: string[]) => res.findIndex(r => r === args[0]) } },
    'red'
);

test('Function - Match[1]',
    '[color blue|red|blue]',
    { color: { value: (args: any[], res: string[]) => res.findIndex(r => r === args[0]) } },
    'blue'
);

test('Boolean - true',
    '[color|red|blue]',
    { color: { value: true } },
    'red'
);

test('Boolean - false',
    '[color|red|blue]',
    { color: { value: false } },
    'blue'
);

test('Concat',
    'Hi! My name is [pc.name]. How are you?',
    { pc: { children: { name: { value: 'Thomas' } } } },
    'Hi! My name is Thomas. How are you?'
);

test('Code - Quotes',
    '"Hi! My name is [pc.name]. How are you?"',
    { pc: { children: { name: { value: 'Thomas' } } } },
    '"Hi! My name is Thomas. How are you?"'
);

test('Code - Newline',
    `"Welcome to [store.name]. My name is [pc.name]. Is there anything I can help you with today?"  
You promptly exit the store.`,
    { store: { children: { name: { value: 'TipTop' } } }, pc: { children: { name: { value: 'Thomas' } } } },
    `"Welcome to TipTop. My name is Thomas. Is there anything I can help you with today?"  
You promptly exit the store.`
);

test('Super',
    `[store.open|"Welcome to [store.name]. My name is [person.name].
Is there anything I can help you with today?"|The sign says closed.]`,
    {
        store: {
            children: {
                open: { value: true },
                name: { value: 'TipTop' }
            }
        },
        person: {
            children: {
                name: { value: 'Thomas' }
            }
        }
    },
    `"Welcome to TipTop. My name is Thomas.
Is there anything I can help you with today?"`
);
