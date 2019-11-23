
enum Token {
    Escape = 'operator',
    Bracket = 'bracket',
    String = 'string',
    String2 = 'property',
    Pipe = 'builtin',
    Dot = 'operator',
    Arg = 'variable',
    Whitespace = 'whitespace',
    Number = 'number',
    Quote = 'quote',
    Keyword = 'keyword',
    Error = 'error',
}

class State {
    public stack: string[] = [];
}

export class CodeMirrorLexer implements CodeMirror.Mode<State> {
    public startState(): State {
        return new State();
    }

    public token(stream: CodeMirror.StringStream, state: State): string {
        if (stream.eat('\\')) {
            if (stream.eat('[') || stream.eat('|'))
                return Token.Escape;
            return Token.Error;
        }
        else if (stream.eat('[')) {
            state.stack.unshift('[');
            return Token.Bracket;
        }
        else if (stream.eat(']')) {
            if (state.stack.length > 0) {
                while (state.stack.length > 1 && state.stack[0] !== '[')
                    state.stack.shift();
                if (state.stack[0] === '[')
                    state.stack.shift();
                else
                    return Token.Error;
                return Token.Bracket;
            }
            else return Token.String;
        }
        else if (state.stack.length > 0) {
            // between [ and first |
            if (state.stack[0] === '[') {
                if (stream.eat('a') || stream.eat('A')) {
                    if (stream.eat('n') || stream.eat('N')) {
                        if (stream.peek() === ']')
                            return Token.Keyword;
                        stream.pos--;
                    }
                    if (stream.peek() === ']')
                        return Token.Keyword;
                    stream.pos--;
                }

                if (stream.eat('.'))
                    return Token.Dot;
                else if (stream.eat(' ') || stream.eat('\t')) {
                    while (stream.eatWhile(' ') || stream.eatWhile('\t')) { }
                    return Token.Whitespace;
                }
                else if (stream.eat('|')) {
                    state.stack.unshift('|');
                    return Token.Pipe;
                }
                else if (stream.eatWhile(/[^. \t|\]]/)) {
                    if (!isNaN(+stream.current))
                        return Token.Number;
                    else
                        return Token.Arg;
                }
            }
            // between first | and ]
            else if (state.stack[0] === '|') {
                if (stream.eat('|')) {
                    state.stack.unshift('|');
                    return Token.Pipe;
                }
                else if (stream.eatWhile(/[^[\]|\\]/))
                    return Token.String2;
            }
        }
        // outside string
        else if (stream.eatWhile(/[^[\\]/))
            return Token.String;
        stream.pos++;
        return Token.Error;
    }
}
