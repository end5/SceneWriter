import { Token, TokenType } from "./Token";

export class TokenStream {
    private tokens: Token[];
    public pos: number;
    public constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.pos = 0;
    }

    public get current(): Token {
        if (this.tokens.length <= 0)
            throw new RangeError("Token stream is empty");
        if (this.pos >= this.tokens.length)
            return this.tokens[this.tokens.length - 1];
        return this.tokens[this.pos];
    }

    public get last(): Token {
        if (this.tokens.length <= 0)
            throw new RangeError();
        return this.tokens[this.tokens.length - 1];
    }

    public eos(): boolean {
        return this.pos >= this.tokens.length;
    }

    public match<T extends TokenType>(type: T) {
        return !this.eos() && this.tokens[this.pos].type === type;
    }

    public consume<T extends TokenType>(type: T) {
        if (!this.eos() && this.tokens[this.pos].type === type)
            return this.tokens[this.pos++] as Token<T>;
        return;
    }

    public whitespace() {
        let ate = false;
        while (!this.eos() && (
            this.tokens[this.pos].type === TokenType.Newline ||
            this.tokens[this.pos].type === TokenType.Space
        )) {
            this.pos++
            ate = true;
        }
        return ate;
    }
}
