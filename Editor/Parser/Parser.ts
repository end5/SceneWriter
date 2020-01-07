import { ArgsNode, ConcatNode, ErrorNode, EvalNode, IdentityNode, isErrorNode, NumberNode, ResultsNode, RetrieveNode, StringNode, TextNodes } from "./Node";
import { TextRange } from './TextRange';
import { Token, TokenType } from "./Token";
import { TokenStream } from './TokenStream';

export interface ParserError {
    range: TextRange;
    msg: string;
}

export interface ParserResult {
    root: TextNodes;
    errors: ParserError[];
}

export class Parser {
    private stream: TokenStream;
    private errors: ParserError[] = [];
    private textStr: string;

    public constructor(tokens: Token[], text: string) {
        this.stream = new TokenStream(tokens);
        this.textStr = text;
    }

    public parse(): ParserResult {
        if (this.stream.eos())
            return { root: this.empty(), errors: [] };

        const root = this.concat();
        const errors = this.errors;
        if (!root)
            return { root: this.empty(), errors };

        return { root, errors };
    }

    /**
     * A ConcatNode with one blank StringNode with specified range
     * @param range
     */
    private empty(range = new TextRange()) {
        return new StringNode(range, '');
    }

    private createError(node: ErrorNode): ParserError {
        return { range: node.range, msg: `Expected "${node.value}"` };
    }

    private getText(token: Token) {
        return this.textStr.slice(token.range.start.col + token.offset, token.range.end.col + token.offset);
    }

    private concat() {
        let newNode;
        const arr = [];

        while (!this.stream.eos()) {
            // Search until something is found
            newNode = this.code();
            if (!newNode) newNode = this.text();
            if (!newNode) break;

            // Force the stream forward in case nothing was found
            if (!newNode) {
                this.stream.pos++;
                continue;
            }

            if (isErrorNode(newNode)) {
                this.errors.push(this.createError(newNode));
            }
            else {
                arr.push(newNode);
            }
        }

        // Nothing so force empty
        if (arr.length === 0)
            return this.empty(new TextRange(this.stream.current.range.start, this.stream.current.range.end));
        else if (arr.length === 1)
            return arr[0];
        else
            return new ConcatNode(
                new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
                arr
            );
    }

    private text() {
        const startToken = this.stream.current;
        let endToken;
        let token;
        let subText = '';
        let escapeOffset = 0;
        while (!this.stream.eos()) {
            this.stream.consume(TokenType.Space);
            token = this.stream.consume(TokenType.String);
            if (!token) token = this.stream.consume(TokenType.Escape);
            if (!token) token = this.stream.consume(TokenType.Newline);
            if (!token) break;
            if (token.type === TokenType.Escape)
                escapeOffset = 2;
            else
                escapeOffset = 0;
            subText += this.textStr.slice(token.range.start.col + token.offset + escapeOffset, token.range.end.col + token.offset);
            endToken = token;
        }
        if (endToken) {
            return new StringNode(
                new TextRange(startToken.range.start, endToken.range.end),
                subText
            );
        }
        return;
    }

    private code(): TextNodes | ErrorNode | undefined {
        // Leave if no bracket
        const bracketOpenToken = this.stream.consume(TokenType.BracketOpen);
        if (!bracketOpenToken) return;

        const codeNode = this.eval();
        if (isErrorNode(codeNode)) return codeNode;

        // don't advance token stream on error
        if (!this.stream.match(TokenType.BracketClose))
            return new ErrorNode(
                bracketOpenToken.range,
                ']'
            );

        this.stream.consume(TokenType.BracketClose);

        return codeNode;
    }

    private eval() {

        const identityNode = this.retrieve();
        if (isErrorNode(identityNode)) return identityNode;

        const argNodes = this.arguments();
        const resultNodes = this.results();

        let rangeEnd;
        if (resultNodes.children.length > 0)
            rangeEnd = resultNodes.children[resultNodes.children.length - 1].range.end;
        else if (argNodes.children.length > 0)
            rangeEnd = argNodes.children[argNodes.children.length - 1].range.end;
        else
            rangeEnd = identityNode.range.end;

        return new EvalNode(
            new TextRange(identityNode.range.start, rangeEnd),
            [identityNode, argNodes, resultNodes]
        );

    }

    private retrieve() {
        this.stream.whitespace();

        let token = this.stream.consume(TokenType.Identity);
        if (!token)
            return new ErrorNode(
                new TextRange(this.stream.current.range.start, this.stream.current.range.end),
                'Identity'
            );

        // Retrieve node to get value from global
        const rootNode = new RetrieveNode(
            new TextRange(token.range.start, token.range.end),
            [new IdentityNode(token.range, this.getText(token))]
        );

        while (this.stream.match(TokenType.Dot)) {
            this.stream.consume(TokenType.Dot);

            token = this.stream.consume(TokenType.Identity);
            if (!token)
                return new ErrorNode(
                    new TextRange(this.stream.current.range.start, this.stream.current.range.end),
                    'Identity'
                );

            rootNode.children.push(
                new IdentityNode(
                    new TextRange(token.range.start, token.range.end),
                    this.getText(token)
                )
            );

            rootNode.range.end = token.range.end;
        }

        return rootNode;
    }

    private arguments() {
        const arr = [];

        if (this.stream.whitespace()) {
            // Add Value nodes to Args node
            let valueNode;
            do {
                valueNode = this.getValue();
                if (!valueNode)
                    break;

                arr.push(valueNode);
            } while (this.stream.whitespace());
        }

        return new ArgsNode(
            new TextRange(),
            arr
        );
    }

    private results() {
        const arr = [];

        if (this.stream.match(TokenType.Pipe)) {
            // Consume Pipe then ResultConcat
            let node;
            while (this.stream.consume(TokenType.Pipe)) {
                node = this.resultConcat();
                arr.push(node);

                this.stream.whitespace();
            }
        }

        return new ResultsNode(
            new TextRange(),
            arr
        );
    }

    private resultConcat(): TextNodes {
        const arr = [];
        let newNode;

        while (!this.stream.eos()) {
            // Search until something is found
            newNode = this.code();
            if (!newNode) newNode = this.text();
            if (!newNode) break;

            if (isErrorNode(newNode)) {
                this.errors.push(this.createError(newNode));
            }
            else {
                arr.push(newNode);
            }
        }

        // Nothing so force empty
        if (arr.length === 0)
            return this.empty(new TextRange(this.stream.current.range.start, this.stream.current.range.end));
        else if (arr.length === 1)
            return arr[0];
        else
            return new ConcatNode(
                new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
                arr
            );
    }

    private getValue() {
        let subStr = "";

        const start = this.stream.current;
        let last;

        while (true) {
            if (this.stream.match(TokenType.String)) {
                subStr += this.getText(this.stream.current);
                last = this.stream.consume(TokenType.String);
            }
            else if (this.stream.match(TokenType.Dot)) {
                subStr += this.getText(this.stream.current);
                last = this.stream.consume(TokenType.Dot);
            }
            else break;
        }

        if (subStr.length > 0) {
            if (isNaN(+subStr))
                return new StringNode(
                    new TextRange(start.range.start, (last || start).range.end),
                    subStr
                );
            else
                return new NumberNode(
                    new TextRange(start.range.start, (last || start).range.end),
                    +subStr
                );
        }
    }
}
