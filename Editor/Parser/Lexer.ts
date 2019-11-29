import { StringStream } from './StringStream';
import { TokenType, Token } from './Token';
import { TextRange } from './TextRange';

export interface LexerState {
    codeStack: CodeState[];
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
        codeStack: [CodeState.Text],
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
            states.push(copyState(state));

        if (state.token.type === TokenType.Newline) {
            state.lineNum++;
            state.offset = stream.pos;
        }
    }

    if (returnStates)
        return states;

    return tokens;
}

function copyState(state: LexerState) {
    const copy: LexerState = JSON.parse(JSON.stringify(state));
    copy.token.range = new TextRange(copy.token.range.start, copy.token.range.end)
    return copy;
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
    QuestionMark = '?',
    Dot = '.',
    Space = ' ',
    Tab = '\t',
}

enum CodeState {
    Text = 't',
    CodeStart = '[',
    Identity = 'i',
    Arguments = 'a',
    Results = 'r'
}

function tokenize(stream: StringStream, state: LexerState) {
    if (state.escaped) {
        state.escaped = false;
        stream.pos++;
        return TokenType.String;
    }
    if (state.beginNewline) {
        state.beginNewline = false;
        if (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) {
            while (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) { }
            return TokenType.Space;
        }
    }
    // Always - <...[... ...|...]...>
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
    // Bracket Open - <...>[... ...|<...>]<...>
    if (state.codeStack[0] === CodeState.Text || state.codeStack[0] === CodeState.Results) {
        if (stream.eat(TokenSymbol.BracketOpen)) {
            // Move state from (Text or Results) to CodeStart
            state.codeStack.unshift(CodeState.CodeStart);
            return TokenType.BracketOpen;
        }
    }
    // Text - <...>[... ...|...]<...>
    if (state.codeStack[0] === CodeState.Text) {
        if (stream.eatWhileNot(
            TokenSymbol.BracketOpen,
            TokenSymbol.Newline,
            TokenSymbol.Escape,
        ))
            return TokenType.String;
    }
    // Start - ...[<>... ...|...]...
    if (state.codeStack[0] === CodeState.CodeStart) {
        if (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) {
            while (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) { }
            return TokenType.Space;
        }
        // Move state from CodeStart to Identity
        state.codeStack.unshift(CodeState.Identity);
    }
    // Identity - ...[<...> ...|...]...
    if (state.codeStack[0] === CodeState.Identity) {
        if (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) {
            while (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) { }
            // Move state from Identity to Arguments
            state.codeStack.unshift(CodeState.Arguments);
            return TokenType.Space;
        }
        else if (stream.eat(TokenSymbol.Dot)) {
            return TokenType.Dot;
        }
        else if (stream.eat(TokenSymbol.QuestionMark)) {
            return TokenType.QuestionMark;
        }
        else if (stream.eat(TokenSymbol.Pipe)) {
            // Move state from Identity to Results
            state.codeStack.unshift(CodeState.Results);
            return TokenType.Pipe;
        }
        else {
            if (stream.eatWhileNot(
                TokenSymbol.Space,
                TokenSymbol.Tab,
                TokenSymbol.Newline,
                TokenSymbol.Dot,
                TokenSymbol.QuestionMark,
                TokenSymbol.Pipe,
                TokenSymbol.BracketClose,
            )) {
                return TokenType.Identity;
            }
        }
    }
    // Bracket Close - ...[...< ...|...>]...
    if (
        state.codeStack[0] === CodeState.Identity ||
        state.codeStack[0] === CodeState.Arguments ||
        state.codeStack[0] === CodeState.Results
    ) {
        if (stream.eat(TokenSymbol.BracketClose)) {
            // Move state from (Identity, Arguments or Results) to (Text or Results)
            while (state.codeStack.length > 0 && (state.codeStack[0] !== CodeState.Text && state.codeStack[0] !== CodeState.Results))
                state.codeStack.shift();
            if (state.codeStack[0] !== CodeState.Text && state.codeStack[0] !== CodeState.Results)
                return TokenType.Error;
            return TokenType.BracketClose;
        }
    }
    // Arguments - ...[... <...>|...]...
    if (state.codeStack[0] === CodeState.Arguments) {
        if (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) {
            while (stream.eat(TokenSymbol.Space) || stream.eat(TokenSymbol.Tab)) { }
            return TokenType.Space;
        }
        else if (stream.eat(TokenSymbol.Dot)) {
            return TokenType.Dot;
        }
        else if (stream.eat(TokenSymbol.Pipe)) {
            // Move state from Arguments to Results
            state.codeStack.unshift(CodeState.Results);
            return TokenType.Pipe;
        }
        else if (stream.eatWhileNot(
            TokenSymbol.Space,
            TokenSymbol.Tab,
            TokenSymbol.Newline,
            TokenSymbol.Dot,
            TokenSymbol.Pipe,
            TokenSymbol.BracketClose,
        )) {
            return TokenType.String;
        }
    }
    // Results - ...[... ...|<...>]...
    if (state.codeStack[0] === CodeState.Results) {
        if (stream.eat(TokenSymbol.Pipe)) {
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
    return TokenType.Error;
}
