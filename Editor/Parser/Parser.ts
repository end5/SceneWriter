import { LangError } from "./LangError";
import { Lexer } from "./Lexer";
import { ArgsNode, ConcatNode, EvalNode, IdentityNode, NumberNode, ResultsNode, RetrieveNode, StringNode, TextNodes } from "./Node";
import { TextPosition, TextRange } from "./TextRange";
import { TokenType } from "./Token";

export interface ParserResult {
    root: TextNodes;
    errors: LangError[];
}

export class Parser {
    private lexer: Lexer;
    private errors: LangError[] = [];

    public constructor(text: string) {
        this.lexer = new Lexer(text);
    }

    public parse(): ParserResult {
        return { root: this.concat(), errors: this.errors };
    }

    /**
     * A ConcatNode with one blank StringNode with specified range
     * @param range
     */
    private empty() {
        return new StringNode(this.createRange(), '');
    }

    private createStartPostion(): TextPosition {
        return { line: this.lexer.lineStart, col: this.lexer.colStart };
    }

    private createEndPostion(): TextPosition {
        return { line: this.lexer.lineEnd, col: this.lexer.colEnd };
    }

    private createRange() {
        return new TextRange(this.createStartPostion(), this.createEndPostion());
    }

    private createError(msg: string, range?: TextRange) {
        this.errors.push(new LangError(range || this.createRange(), msg));
    }

    private concat() {
        let newNode;
        const arr = [];

        while (this.lexer.peek() !== TokenType.EOS) {
            // Search until something is found
            newNode = this.code();
            if (!newNode) newNode = this.text();
            if (!newNode) break;

            arr.push(newNode);
        }

        // Nothing so force empty
        if (arr.length === 0)
            return this.empty();
        else if (arr.length === 1)
            return arr[0];
        else
            return new ConcatNode(
                new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
                arr
            );
    }

    private text() {
        const start = this.createStartPostion();
        let subText = '';
        let type = this.lexer.peek();
        while (type === TokenType.Space || type === TokenType.NewLine || type === TokenType.Text || type === TokenType.Dot) {
            subText += this.lexer.getText();
            type = this.lexer.advance();
        }
        if (subText.length === 0) return;
        const end = this.createStartPostion();
        return new StringNode(
            new TextRange(start, end),
            subText
        );
    }

    private code(): TextNodes | undefined {
        // Leave if no bracket
        if (this.lexer.peek() !== TokenType.LeftBracket) return;
        const start = this.createStartPostion();
        this.lexer.advance();

        const codeNode = this.eval();
        if (!codeNode) return;

        // don't advance token stream on error
        if (this.lexer.peek() !== TokenType.RightBracket) {
            this.createError(`Missing ]`, new TextRange(start, this.createStartPostion()));
            return;
        }

        this.lexer.advance();

        return codeNode;
    }

    private eval() {
        const identityNode = this.retrieve();
        if (!identityNode) return;

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
        this.whitespace();

        if (this.lexer.peek() !== TokenType.Text) {
            this.createError(`Missing Identifier`);
            return;
        }

        // Retrieve node to get value from global
        const rootNode = new RetrieveNode(
            this.createRange(),
            [new IdentityNode(this.createRange(), this.lexer.getText())]
        );

        this.lexer.advance();

        while (this.lexer.peek() === TokenType.Dot) {
            this.lexer.advance();

            if (this.lexer.peek() !== TokenType.Text) {
                this.createError(`Missing Identifier`);
                return;
            }

            rootNode.children.push(
                new IdentityNode(this.createRange(), this.lexer.getText())
            );

            this.lexer.advance();

            rootNode.range.end = rootNode.children[rootNode.children.length - 1].range.end;
        }

        return rootNode;
    }

    private arguments() {
        const arr = [];
        const start = this.createStartPostion();

        // Add Value nodes to Args node
        let valueNode;
        while (this.lexer.peek() === TokenType.Space) {
            this.lexer.advance();

            valueNode = this.getValue();
            if (!valueNode)
                break;

            arr.push(valueNode);
        }

        let end = this.createStartPostion();
        if (arr.length > 0)
            end = arr[arr.length - 1].range.end;

        return new ArgsNode(new TextRange(start, end), arr);
    }

    private results() {
        const arr = [];
        const start = this.createStartPostion();

        // Consume Pipe then ResultConcat
        let node;
        while (this.lexer.peek() === TokenType.Pipe) {
            this.lexer.advance();

            node = this.resultConcat();
            if (!node) break;

            arr.push(node);
        }

        let end = this.createStartPostion();
        if (arr.length > 0)
            end = arr[arr.length - 1].range.end;

        return new ResultsNode(new TextRange(start, end), arr);
    }

    private resultConcat(): TextNodes | undefined {
        const arr = [];
        let newNode;

        while (this.lexer.peek() !== TokenType.EOS) {
            // Search until something is found
            newNode = this.code();
            if (!newNode) newNode = this.text();
            if (!newNode) break;

            arr.push(newNode);
        }

        // Nothing so force empty
        if (arr.length === 0)
            return;
        else if (arr.length === 1)
            return arr[0];
        else
            return new ConcatNode(
                new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
                arr
            );
    }

    private whitespace() {
        let type = this.lexer.peek();
        while (type === TokenType.Space || type === TokenType.NewLine) {
            type = this.lexer.advance();
        }
    }

    private getValue() {
        let subStr = "";
        const start = this.createStartPostion();

        let type = this.lexer.peek();
        while (type === TokenType.Text || type === TokenType.Dot) {
            subStr += this.lexer.getText();
            type = this.lexer.advance();
        }

        const end = this.createStartPostion();

        if (subStr.length > 0) {
            if (isNaN(+subStr))
                return new StringNode(
                    new TextRange(start, end),
                    subStr
                );
            else
                return new NumberNode(
                    new TextRange(start, end),
                    +subStr
                );
        }
    }
}
