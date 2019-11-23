import { StringStream } from './StringStream';
import { TokenType, Token } from './Token';
import { TextRange } from './TextRange';

export interface LexerState {
    codeStack: string[];
    beginNewline: boolean;
    escaped: boolean;
    text: string;
    lineNum: number;
    offset: number;
    token: Token;
}

export function lex(text: string): Token[];
export function lex(text: string, returnStates: boolean): LexerState[];
export function lex(text: string, returnStates?: boolean): Token[] | LexerState[] {
    const tokens: Token[] = [];
    const states: LexerState[] = [];
    const stream = new StringStream(text);
    const state: LexerState = {
        codeStack: [],
        beginNewline: false,
        escaped: false,
        text: '',
        lineNum: 0,
        offset: 0,
        token: { type: TokenType.String, offset: 0, range: new TextRange() }
    };

    while (!stream.eos()) {
        state.token = createToken(stream, state);

        if (returnStates)
            state.text = text.slice(state.token.range.start.col + state.offset, state.token.range.end.col + state.offset);

        // Force the stream position forward if nothing matched
        if (state.token.type === TokenType.Error && state.token.range.start.line === state.token.range.end.line && state.token.range.start.col === state.token.range.end.col)
            stream.pos++;

        tokens.push(state.token);

        if (returnStates)
            states.push(JSON.parse(JSON.stringify(state)));

        if (state.token.type === TokenType.Newline) {
            state.lineNum++;
            state.offset = stream.pos;
        }
    }

    if (returnStates)
        return states;

    return tokens;
}

function createToken(stream: StringStream, state: LexerState): Token {
    const start = { line: state.lineNum, col: stream.pos - state.offset };
    return {
        type: tokenize(stream, state),
        offset: state.offset,
        range: new TextRange(start, { line: state.lineNum, col: stream.pos - state.offset })
    };
}

enum TokenSymbol {
    Newline = '\n',
    Escape = '\\',
    BracketOpen = '[',
    BracketClose = ']',
    Pipe = '|',
    Dot = '.',
    Space = ' ',
    Tab = '\t',
}

function tokenize(stream: StringStream, state: LexerState) {
    if (state.escaped) {
        state.escaped = false;
        stream.pos++;
        return TokenType.String;
    }
    if (state.beginNewline) {
        state.beginNewline = false;
        if (stream.eat(TokenSymbol.Tab) || stream.eat(TokenSymbol.Space)) {
            while (stream.eat(TokenSymbol.Tab) || stream.eat(TokenSymbol.Space)) { }
            return TokenType.Whitespace;
        }
    }
    if (stream.eat(TokenSymbol.Newline)) {
        state.beginNewline = true;
        return TokenType.Newline;
    }
    else if (stream.eat(TokenSymbol.Escape)) {
        if (stream.peek() === TokenSymbol.BracketOpen) {
            state.escaped = true;
            return TokenType.Escape;
        }
        return TokenType.Error;
    }
    else if (stream.eat(TokenSymbol.BracketOpen)) {
        state.codeStack.unshift(TokenSymbol.BracketOpen);
        return TokenType.BracketOpen;
    }
    else if (stream.eat(TokenSymbol.BracketClose)) {
        if (state.codeStack.length > 0) {
            while (state.codeStack.length > 1 && state.codeStack[0] !== TokenSymbol.BracketOpen)
                state.codeStack.shift();
            if (state.codeStack[0] === TokenSymbol.BracketOpen)
                state.codeStack.shift();
            else
                return TokenType.Error;
            return TokenType.BracketClose;
        }
        else return TokenType.String;
    }
    else if (state.codeStack.length > 0) {
        // between [ and first |
        if (state.codeStack[0] === TokenSymbol.BracketOpen) {
            if (stream.eat('a') || stream.eat('A')) {
                if (stream.eat('n') || stream.eat('N')) {
                    if (stream.peek() === TokenSymbol.BracketClose) {
                        return TokenType.Article;
                    }
                    stream.pos--;
                }
                if (stream.peek() === TokenSymbol.BracketClose) {
                    return TokenType.Article;
                }
                stream.pos--;
            }

            if (stream.eat(TokenSymbol.Dot)) {
                return TokenType.Dot;
            }
            else if (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) {
                while (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) { }
                return TokenType.Whitespace;
            }
            else if (stream.eat(TokenSymbol.Pipe)) {
                state.codeStack.unshift(TokenSymbol.Pipe);
                return TokenType.Pipe;
            }
            else if (stream.eatWhileNot(
                TokenSymbol.Dot,
                TokenSymbol.Space,
                TokenSymbol.Tab,
                TokenSymbol.Pipe,
                TokenSymbol.BracketClose,
                TokenSymbol.Newline,
            )) {
                return TokenType.Arg;
            }
        }
        // between first | and ]
        if (state.codeStack[0] === TokenSymbol.Pipe) {
            if (stream.eat(TokenSymbol.Pipe)) {
                state.codeStack.unshift(TokenSymbol.Pipe);
                return TokenType.Pipe;
            }
            else if (stream.eatWhileNot(
                TokenSymbol.BracketOpen,
                TokenSymbol.BracketClose,
                TokenSymbol.Pipe,
                TokenSymbol.Newline,
                TokenSymbol.Escape,
            ))
                return TokenType.String;
        }
    }
    // outside string
    else if (stream.eatWhileNot(
        TokenSymbol.BracketOpen,
        TokenSymbol.Newline,
        TokenSymbol.Escape,
    ))
        return TokenType.String;
    return TokenType.Error;
}
