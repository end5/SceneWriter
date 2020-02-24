import { TokenType } from "./Token";

enum TokenSymbol {
    Space = ' ',
    Tab = '\t',
    Newline = '\n',
    LeftBracket = '[',
    RightBracket = ']',
    Dot = '.',
    Pipe = '|',
    LeftParen = '(',
    RightParen = ')'
}

export class Lexer {
    private pos: number = 0;
    private start: number = 0;
    private lineNum: number = 0;
    private offset: number = 0;
    private lastLine: number = 0;
    private lastCol: number = 0;
    private token?: TokenType;
    public constructor(public readonly text: string) { }

    public get offsetStart() { return this.start; }
    public get offsetEnd() { return this.pos; }
    public get lineStart() { return this.lastLine; }
    public get colStart() { return this.lastCol; }
    public get lineEnd() { return this.lineNum; }
    public get colEnd() { return this.pos - this.offset; }
    /**
     * Repeatedly eats characters that match the given characters. Returns true if any characters were eaten.
     * @param chars Characters that match the string
     */
    private eatWhile(...chars: string[]): boolean {
        const start = this.pos;
        let idx = 0;
        while (idx < chars.length) {
            if (this.text.charAt(this.pos) !== chars[idx])
                idx++;
            else {
                this.pos++;
                idx = 0;
            }
        }
        return this.pos !== start;
    }

    /**
     * Repeatedly eats characters that do not match the given characters. Returns true if any characters were eaten.
     * @param notChars Characters that do not match the string
     */
    private eatWhileNot(...notChars: string[]): boolean {
        const startPos = this.pos;
        let index = startPos;
        let matchFound = false;

        for (const char of notChars) {
            index = this.text.indexOf(char, startPos);

            // Match was found
            if (~index) {
                matchFound = true;
                // char found at start position
                // cannnot progress
                if (index === startPos) {
                    this.pos = startPos;
                    break;
                }
                // Match found at farther position
                if (this.pos > index || this.pos === startPos)
                    this.pos = index;
            }
        }

        // Nothing matched so the rest of the string is ok
        if (!matchFound)
            this.pos = this.text.length;

        return this.pos > startPos;
    }

    public getText() {
        return this.text.slice(this.start, this.pos);
    }

    public peek(): TokenType {
        if (!this.token)
            this.token = this.advance();
        return this.token;
    }

    public advance(): TokenType {
        this.start = this.pos;
        this.lastLine = this.lineNum;
        this.lastCol = this.pos - this.offset;

        this.token = this.tokenize();
        return this.token;
    }

    private tokenize(): TokenType {
        if (this.pos >= this.text.length)
            return TokenType.EOS;

        switch (this.text.charAt(this.pos)) {
            case TokenSymbol.Tab:
            case TokenSymbol.Space: {
                this.eatWhile(TokenSymbol.Space, TokenSymbol.Tab);
                return TokenType.Space;
            }
            case TokenSymbol.Newline: {
                this.lineNum++;
                this.offset = ++this.pos;
                return TokenType.NewLine;
            }
            case TokenSymbol.LeftBracket: {
                this.pos++;
                return TokenType.LeftBracket;
            }
            case TokenSymbol.RightBracket: {
                this.pos++;
                return TokenType.RightBracket;
            }
            case TokenSymbol.Dot: {
                this.pos++;
                return TokenType.Dot;
            }
            case TokenSymbol.Pipe: {
                this.pos++;
                return TokenType.Pipe;
            }
            case TokenSymbol.LeftParen: {
                this.pos++;
                return TokenType.LeftParen;
            }
            case TokenSymbol.RightParen: {
                this.pos++;
                return TokenType.RightParen;
            }
            default: {
                this.eatWhileNot(
                    TokenSymbol.Tab,
                    TokenSymbol.Space,
                    TokenSymbol.Newline,
                    TokenSymbol.LeftBracket,
                    TokenSymbol.RightBracket,
                    TokenSymbol.Dot,
                    TokenSymbol.Pipe,
                    TokenSymbol.LeftParen,
                    TokenSymbol.RightParen
                );
                return TokenType.Text;
            }
        }
    }
}
