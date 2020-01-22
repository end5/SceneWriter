export enum TokenType {
    EOS = 0,
    Text = 1,
    Space = 2,
    NewLine = 3,
    LeftBracket = 4,
    RightBracket = 5,
    Dot = 6,
    Pipe = 7,
    GreaterThan = 8,
    Equal = 9,
}

export const TokenTypeNames = ['EOS', 'Text', 'Space', 'Newline', 'LeftBracket', 'RightBracket', 'Dot', 'Pipe', 'GreaterThan', 'Equal'];
