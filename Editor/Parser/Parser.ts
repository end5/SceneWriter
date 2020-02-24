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
    private lexer: Lexer = new Lexer('');
    private errors: LangError[] = [];

    public parse(text: string): ParserResult {
        this.lexer = new Lexer(text);
        this.errors = [];
        return { root: this.concat(), errors: this.errors };
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
        this.errors.push(new LangError(msg, range || this.createRange()));
    }

    private concat() {
        let newNode;
        const arr = [];
        let start = this.lexer.offsetEnd;

        while (this.lexer.peek() !== TokenType.EOS) {
            // Search until something is found
            newNode = this.code();
            if (!newNode) newNode = this.text();
            if (!newNode && start === this.lexer.offsetEnd)
                this.lexer.advance();

            start = this.lexer.offsetEnd;
            if (newNode)
                arr.push(newNode);
        }

        // Nothing so force empty
        if (arr.length === 0)
            return new StringNode(new TextRange(), '');
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
        while (
            type !== TokenType.EOS &&
            type !== TokenType.LeftBracket &&
            type !== TokenType.RightBracket &&
            type !== TokenType.Pipe
        ) {
            subText += this.lexer.getText();
            type = this.lexer.advance();
        }
        if (subText.length === 0) return;

        return new StringNode(
            new TextRange(start, this.createStartPostion()),
            subText
        );
    }

    private code(): TextNodes | undefined {
        // Leave if no bracket
        if (this.lexer.peek() !== TokenType.LeftBracket) return;
        const start = this.createStartPostion();
        this.lexer.advance();

        const codeNode = this.eval();

        this.whitespace();

        // don't advance token stream on error
        if (this.lexer.peek() !== TokenType.RightBracket) {
            this.createError(`Missing ]`, new TextRange(start, this.createStartPostion()));
            return;
        }

        if (codeNode)
            this.lexer.advance();

        return codeNode;
    }

    private eval() {
        this.whitespace();

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

        let dotRange = this.createRange();
        while (this.lexer.peek() === TokenType.Dot) {
            this.lexer.advance();

            if (this.lexer.peek() !== TokenType.Text) {
                this.createError(`Missing Identifier`, dotRange);
                return;
            }

            rootNode.children.push(
                new IdentityNode(this.createRange(), this.lexer.getText())
            );

            this.lexer.advance();

            dotRange = this.createRange();

            rootNode.range.end = rootNode.children[rootNode.children.length - 1].range.end;
        }

        return rootNode;
    }

    private arguments() {
        const arr = [];
        const start = this.createStartPostion();

        // Add Value nodes to Args node
        let valueNode = this.getValue();
        if (valueNode) arr.push(valueNode);

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

        // Indentation
        let indent = 0;
        while (this.lexer.peek() === TokenType.NewLine) {
            // In case of multiple newlines before pipe
            indent = 0;
            this.lexer.advance();
            while (this.lexer.peek() === TokenType.Space) {
                indent += this.lexer.getText().length;
                this.lexer.advance();
            }
        }

        // Consume Pipe then ResultConcat
        let node;
        while (this.lexer.peek() === TokenType.Pipe) {
            this.lexer.advance();

            node = this.resultConcat(indent);
            if (!node)
                if (this.lexer.peek() === TokenType.Pipe || this.lexer.peek() === TokenType.RightBracket)
                    node = new StringNode(new TextRange(this.createStartPostion(), this.createStartPostion()), '');
                else
                    break;

            arr.push(node);
        }

        let end = this.createStartPostion();
        if (arr.length > 0)
            end = arr[arr.length - 1].range.end;

        return new ResultsNode(new TextRange(start, end), arr);
    }

    private resultConcat(indent: number): TextNodes | undefined {
        const arr = [];
        let newNode;

        while (this.lexer.peek() !== TokenType.EOS) {
            // Search until something is found
            newNode = this.resultText(indent);
            if (!newNode) newNode = this.code();
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

    private resultText(indent: number) {
        const start = this.createStartPostion();
        let subText = '';
        let newlines = '';
        let type = this.lexer.peek();

        infiniteLoop: while (true) {
            switch (type) {
                case TokenType.LeftBracket:
                    // whitespace before [
                    subText += newlines;

                case TokenType.EOS:
                case TokenType.RightBracket:
                case TokenType.Pipe:
                    break infiniteLoop;

                case TokenType.NewLine:
                    newlines += this.lexer.getText();
                    type = this.lexer.advance();

                    let indentText = '';
                    while (this.lexer.peek() === TokenType.Space) {
                        indentText += this.lexer.getText();
                        type = this.lexer.advance();
                    }

                    if (indentText.length >= indent)
                        newlines += indentText.substr(indent);
                    break;

                default:
                    subText += newlines + this.lexer.getText();
                    newlines = '';
                    type = this.lexer.advance();
                    break;
            }
        }

        if (subText.length === 0) return;

        return new StringNode(
            new TextRange(start, this.createStartPostion()),
            subText
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
        let groupStart: TextPosition | undefined;
        infiniteLoop: while (true) {
            switch (type) {
                case TokenType.Space:
                    if (groupStart)
                        break infiniteLoop;

                case TokenType.Text:
                case TokenType.Dot:
                    subStr += this.lexer.getText();
                    type = this.lexer.advance();
                    break;

                case TokenType.LeftParen:
                    if (!groupStart)
                        groupStart = this.createStartPostion();
                    else
                        subStr += this.lexer.getText();
                    type = this.lexer.advance();
                    break;

                case TokenType.RightParen:
                    if (groupStart)
                        groupStart = undefined;
                    else
                        subStr += this.lexer.getText();
                    type = this.lexer.advance();
                    break;

                default:
                    break infiniteLoop;
            }
        }

        const end = this.createStartPostion();

        if (groupStart)
            this.createError('Missing ")"', new TextRange(groupStart, end));

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
        return;
    }
}
