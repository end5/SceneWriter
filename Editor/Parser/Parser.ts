import { TokenType, Token } from "./Token";
import { TokenStream } from './TokenStream';
import { TextRange } from './TextRange';
import { NodeType, StringNode, ErrorNode, isErrorNode, NumberNode, AccessNode, RetrieveNode, ConcatNode, ExistsNode, EvalNode, FuncChild } from "./Node";

export interface ParserError {
    range: TextRange;
    msg: string;
}

export interface ParserResult {
    node: StringNode[];
    errors: ParserError[];
}

export class Parser {
    private stream: TokenStream;
    private errors: ParserError[] = [];
    private text: string;
    private globals: Record<string, any>;

    public constructor(tokens: Token[], text: string, globals: Record<string, any>) {
        this.stream = new TokenStream(tokens);
        this.text = text;
        this.globals = globals;
    }

    public parse() {
        if (this.stream.eos())
            return { node: [new StringNode(new TextRange(), '')], errors: [] };

        const root = this.concatAll();
        const errors = this.errors;
        if (!root)
            return { node: [new StringNode(new TextRange(), '')], errors };

        return { node: root, errors };
    }

    private createError(node: ErrorNode): ParserError {
        return { range: node.range, msg: `Expected "${node.value}"` };
    }

    private getText(token: Token) {
        return this.text.slice(token.range.start.col + token.offset, token.range.end.col + token.offset);
    }

    private concatAll() {
        let newNode;
        const arr = [];
        // let lastPos = stream.pos;

        while (!this.stream.eos()) {
            // lastPos = stream.pos;

            newNode = this.codeBlock();
            // if (lastPos === stream.pos) {
            if (!newNode) {
                // If first match in codeBlock didn't match, ignore error and resume checking
                newNode = this.textBlock();
            }

            if (newNode) {
                if (isErrorNode(newNode)) {
                    this.errors.push(this.createError(newNode));
                }
                else {
                    arr.push(newNode);
                }
            }

            // Force the stream forward in case nothing was found
            // if (lastPos === stream.pos)
            if (!newNode)
                this.stream.pos++;
        }

        if (arr.length === 0) {
            // Nothing so empty StringNode
            arr.push(new StringNode(
                new TextRange(this.stream.current.range.start, this.stream.current.range.end),
                ''
            ));
        }

        // Merge results into StringNode[]
        const result = [];
        for (const child of arr)
            if (child.type === NodeType.String)
                result.push(child);
            else
                result.push(...child.value);

        return result;

        // return new ConcatNode(
        //     NodeType.Concat,
        //     new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
        //     result,
        //     arr
        // );
    }

    private textBlock() {
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
            subText += this.text.slice(token.range.start.col + token.offset + escapeOffset, token.range.end.col + token.offset);
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

    private codeBlock() {
        // Leave if no bracket
        const bracketOpenToken = this.stream.consume(TokenType.BracketOpen);
        if (!bracketOpenToken) return;

        let codeNode = this.evalBlock();
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

    private evalBlock(): ErrorNode | ExistsNode | EvalNode {

        let identityNode = this.identityBlock();
        if (isErrorNode(identityNode)) return identityNode;

        if (this.stream.consume(TokenType.QuestionMark)) {
            const resultNodes = this.resultBlock();

            if (resultNodes.length === 0)
                return new ErrorNode(
                    new TextRange(identityNode.range.end, identityNode.range.end),
                    'at least 1 result'
                );

            if (resultNodes.length > 2)
                return new ErrorNode(
                    new TextRange(resultNodes[1].range.end, resultNodes[resultNodes.length - 1].range.end),
                    '2 results'
                );

            const resultNode = resultNodes[identityNode.value ? 0 : 1];

            return new ExistsNode(
                NodeType.Exists,
                new TextRange(identityNode.range.start, resultNodes[1].range.end),
                resultNode.value,
                [identityNode, resultNodes as [FuncChild, FuncChild?]]
            );
        }
        // else if (this.stream.consume(TokenType.Arrow)) {

        // }
        // else if (this.stream.consume(TokenType.Equal)) {

        // }
        else {
            const argNodes = this.argumentBlock();
            const resultNodes = this.resultBlock();

            let rangeEnd;
            if (resultNodes.length > 0)
                rangeEnd = resultNodes[resultNodes.length - 1].range.end;
            else if (argNodes.length > 0)
                rangeEnd = argNodes[argNodes.length - 1].range.end;
            else
                rangeEnd = identityNode.range.end;

            let resultNode;
            if (typeof identityNode.value === 'function') {
                // Function result
                const result = identityNode.value(
                    argNodes.map((child) => child.value),
                    resultNodes.reduce((arr, child) =>
                        arr.concat(child.value.map((child) => child.value)),
                        [] as string[]),
                );

                // If result was number, use it to pick the result node
                if (typeof result === 'number') {
                    if (resultNodes.length !== 0 && result >= 0 && result < resultNodes.length)
                        resultNode = resultNodes[result].value;
                    else
                        return new ErrorNode(
                            identityNode.range,
                            result + ' is out of range of results'
                        );
                }
                else
                    resultNode = [new StringNode(
                        new TextRange(identityNode.range.start, rangeEnd),
                        result + ''
                    )];
            }
            else if (typeof identityNode.value === 'number' || typeof identityNode.value === 'string') {
                resultNode = [new StringNode(
                    new TextRange(identityNode.range.start, rangeEnd),
                    identityNode.value + '' // Dont return numbers
                )];
            }
            else {
                return new ErrorNode(
                    identityNode.range,
                    'function, number or string'
                );
            }

            return new EvalNode(
                NodeType.Eval,
                new TextRange(identityNode.range.start, rangeEnd),
                resultNode,
                [identityNode, argNodes, resultNodes]
            );
        }
    }

    private identityBlock() {
        this.stream.whitespace();

        let identityNode = this.getIdentity();
        if (!identityNode)
            return new ErrorNode(
                new TextRange(this.stream.current.range.start, this.stream.current.range.end),
                'Identity'
            );

        // Retrieve node to get value from global
        let rootNode;

        // Check result
        if (!(identityNode.value in this.globals))
            return new ErrorNode(
                new TextRange(identityNode.range.start, identityNode.range.end),
                identityNode.value + ' does not exist in globals'
            );

        rootNode = new RetrieveNode(
            new TextRange(identityNode.range.start, identityNode.range.end),
            this.globals[identityNode.value],
            identityNode
        );

        while (this.stream.match(TokenType.Dot)) {
            this.stream.consume(TokenType.Dot);

            identityNode = this.getIdentity();
            if (!identityNode)
                return new ErrorNode(
                    new TextRange(this.stream.current.range.start, this.stream.current.range.end),
                    'Identity'
                );

            // Create tree shifting Retrieve node down for every Access
            //             Access
            //            /      \
            //        Access   Identity
            //       /      \
            // Retrieve   Identity
            //     |
            // Identity

            // Check result
            if (!rootNode.value[identityNode.value])
                return new ErrorNode(
                    new TextRange(identityNode.range.start, identityNode.range.end),
                    identityNode.value + ' does not exist in ' + rootNode.value
                );

            rootNode = new AccessNode(
                new TextRange(rootNode.range.start, identityNode.range.end),
                rootNode.value[identityNode.value],
                [rootNode, identityNode]
            );
        }

        return rootNode;
    }

    private argumentBlock() {
        const arr: (StringNode | NumberNode)[] = [];

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

        // Set range to cover all args
        // if (arr.length > 0) {
        //     return new Node(
        //         NodeType.Args,
        //         new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
        //         arr,
        //         arr
        //     )
        // }
        // else {
        //     return new Node(
        //         NodeType.Args,
        //         new TextRange(this.stream.current.range.start, this.stream.current.range.end),
        //         [],
        //         []
        //     );
        // }
        return arr;
    }

    private resultBlock() {
        this.stream.whitespace();

        const arr = [];

        if (this.stream.match(TokenType.Pipe)) {
            // Consume Pipe then ResultConcat 
            let node;
            while (this.stream.consume(TokenType.Pipe)) {
                node = this.resultConcat();
                arr.push(node);
            }
        }

        return arr;
    }

    private resultConcat() {
        const arr = [];
        let newNode;

        while (!this.stream.eos()) {

            newNode = this.codeBlock();
            if (!newNode) {
                newNode = this.textBlock();
            }

            if (newNode)
                if (isErrorNode(newNode)) {
                    this.errors.push(this.createError(newNode));
                }
                else {
                    arr.push(newNode);
                }

            this.stream.whitespace();

            if (!newNode) break;
        }

        if (arr.length === 0) {
            // Nothing so empty StringNode
            arr.push(new StringNode(
                new TextRange(this.stream.current.range.start, this.stream.current.range.end),
                ''
            ));
        }

        // Merge results into StringNode[]
        const result = [];
        for (const child of arr)
            if (child.type === NodeType.String)
                result.push(child);
            else
                result.push(...child.value);

        return new ConcatNode(
            NodeType.Concat,
            new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
            result,
            arr
        );
    }

    private getIdentity() {
        if (this.stream.match(TokenType.Identity)) {
            const token = this.stream.consume(TokenType.Identity)!;
            return new StringNode(
                new TextRange(token.range.start, token.range.end),
                this.getText(token)
            );
        }
    }

    private getValue() {
        let subStr = "";

        const start = this.stream.current;

        while (true) {
            if (this.stream.match(TokenType.String)) {
                subStr += this.getText(this.stream.current);
                this.stream.consume(TokenType.String);
            }
            else if (this.stream.match(TokenType.Dot)) {
                subStr += this.getText(this.stream.current);
                this.stream.consume(TokenType.Dot);
            }
            else if (this.stream.match(TokenType.QuestionMark)) {
                subStr += this.getText(this.stream.current);
                this.stream.consume(TokenType.QuestionMark);
            }
            else break;
        }

        if (subStr.length > 0) {
            if (isNaN(+subStr))
                return new StringNode(
                    new TextRange(start.range.start, this.stream.current.range.end),
                    subStr
                );
            else
                return new NumberNode(
                    new TextRange(start.range.start, this.stream.current.range.end),
                    +subStr
                );
        }
    }
}
