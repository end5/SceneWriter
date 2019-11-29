import { test } from "./Tester";

test('Retrieve string',
    '[name]',
    { name: 'Test' },
    'Test'
);

test('Retrieve number',
    '[str]',
    { str: 100 },
    '100'
);

test('Retrieve function',
    '[isRed]',
    { isRed: () => 'red' },
    'red'
);

test('Access string',
    '[pc.name]',
    { pc: { name: 'Test' } },
    'Test'
);

test('Access number',
    '[pc.str]',
    { pc: { str: 100 } },
    '100'
);

test('Access function',
    '[pc.isRed]',
    { pc: { isRed: () => 'red' } },
    'red'
);

test('Function - Create',
    '[isRed]',
    { isRed: (args: any[]) => 'red' },
    'red'
);

test('Function - Create + Args',
    '[isRed 0]',
    { isRed: (args: any[]) => 'red' + args[0] },
    'red0'
);

test('Function - Selector[0]',
    '[isRed|red|blue]',
    { isRed: (args: any[], res: string[]) => 0 },
    'red'
);

test('Function - Selector[1]',
    '[isRed|red|blue]',
    { isRed: (args: any[], res: string[]) => 1 },
    'blue'
);

test('Function - Match[0]',
    '[color red|red|blue]',
    { color: (args: any[], res: string[]) => res.findIndex(r => r === args[0]) },
    'red'
);

test('Function - Match[1]',
    '[color blue|red|blue]',
    { color: (args: any[], res: string[]) => res.findIndex(r => r === args[0]) },
    'blue'
);

test('Exists - true',
    '[color?|red|blue]',
    { color: true },
    'red'
);

test('Exists - false',
    '[color?|red|blue]',
    { color: undefined },
    'blue'
);
