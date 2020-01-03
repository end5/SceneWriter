export class StringStream {
    public pos: number = 0;
    private str: string;

    public constructor(str: string) {
        this.str = str;
    }

    /**
     * Returns true only if the stream is at the end of the string.
     */
    public eos(): boolean {
        return this.pos >= this.str.length;
    }

    /**
     * Returns char at pos without incrementing pos
     */
    public peek(): string {
        return this.str.charAt(this.pos);
    }

    /**
     * If the next character in the stream 'matches' the given argument, it is consumed and returned.
     * Otherwise, undefined is returned.
     * @param match A character
     */
    public eat(match: string): string | undefined {
        if (this.str.charAt(this.pos) === match) return this.str.charAt(this.pos++);
        return;
    }

    /**
     * Repeatedly eats characters that do not match the given characters. Returns true if any characters were eaten.
     * @param notChars Characters that do not match the string
     */
    public eatWhileNot(...notChars: string[]): boolean {
        const startPos = this.pos;
        let index = startPos;
        let matchFound = false;

        for (const char of notChars) {
            index = this.str.indexOf(char, startPos);

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
            this.pos = this.str.length;

        return this.pos > startPos;
    }
}
