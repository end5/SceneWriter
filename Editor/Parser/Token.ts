export enum TokenType {
    EOS = 0,
    Text = 1,
    Space = 2,
    NewLine = 3,
    LeftBracket = 4,
    RightBracket = 5,
    Dot = 6,
    Pipe = 7,
    LeftParen = 8,
    RightParen = 9,
}

export const TokenTypeNames = ['EOS', 'Text', 'Space', 'Newline', 'LeftBracket', 'RightBracket', 'Dot', 'Pipe', 'LeftParen', 'RightParen'];
