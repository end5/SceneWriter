import { TextRange } from './TextRange';

export enum TokenType {
    Escape = 'escape',
    BracketOpen = 'bracket open',
    BracketClose = 'bracket close',
    Pipe = 'pipe',
    QuestionMark = 'question mark',
    Dot = 'dot',
    String = 'string',
    Space = 'whitespace',
    Identity = 'identity',
    Newline = 'newline',
    Error = 'error'
}

export interface Token<T extends TokenType = TokenType> {
    type: T;
    offset: number;
    range: TextRange;
}
