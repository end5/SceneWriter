import { TokenType, Token } from "./Token";
import { TokenStream } from './TokenStream';
import { TextRange } from './TextRange';
import { NodeType, StringNode, ErrorNode, isErrorNode, NumberNode, AccessNode, RetrieveNode, ConcatNode, ExistsNode, EvalNode, FuncChild, IdentityNode, ReturnNode } from "./Node";
import { ParserObject } from "./ParserObject";

export interface ParserError {
    range: TextRange;
    msg: string;
}

export interface ParserResult {
    root: ConcatNode;
    errors: ParserError[];
}

export class Parser {
    private stream: TokenStream;
    private errors: ParserError[] = [];
    private text: string;
    private globals: Record<string, ParserObject>;

    public constructor(tokens: Token[], text: string, globals: Record<string, ParserObject>) {
        this.stream = new TokenStream(tokens);
        this.text = text;
        this.globals = globals;
    }

    public parse(): ParserResult {
        if (this.stream.eos())
            return { root: this.empty(), errors: [] };

        const root = this.concatAll();
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
        const result = new StringNode(range, '');
        return new ConcatNode(
            range,
            [result],
            [result]
        );
    }

    private createError(node: ErrorNode): ParserError {
        return { range: node.range, msg: `Expected "${node.result}"` };
    }

    private getText(token: Token) {
        return this.text.slice(token.range.start.col + token.offset, token.range.end.col + token.offset);
    }

    private concatAll() {
        let newNode;
        const arr = [];

        while (!this.stream.eos()) {
            // Search until something is found
            newNode = this.codeBlock();
            if (!newNode) {
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
            if (!newNode)
                this.stream.pos++;
        }

        // Nothing so force empty
        if (arr.length === 0) {
            return this.empty(new TextRange(this.stream.current.range.start, this.stream.current.range.end));
        }

        /////////////////
        // Compute result
        /////////////////

        // Merge results into StringNode[]
        const result = [];
        for (const child of arr)
            if (child.type === NodeType.String)
                result.push(child);
            else
                result.push(...child.result);

        /////////////////

        return new ConcatNode(
            new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
            result,
            arr
        );
    }

    private textBlock() {
        /////////////////
        // Compute result
        /////////////////

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

    private evalBlock(): ErrorNode | ExistsNode | EvalNode | ReturnNode {

        let identityNode = this.identityBlock();
        if (isErrorNode(identityNode)) return identityNode;

        const argNodes = this.argumentBlock();
        const resultNodes = this.resultBlock();

        let rangeEnd;
        if (resultNodes.length > 0)
            rangeEnd = resultNodes[resultNodes.length - 1].range.end;
        else if (argNodes.length > 0)
            rangeEnd = argNodes[argNodes.length - 1].range.end;
        else
            rangeEnd = identityNode.range.end;

        /////////////////
        // Check result
        /////////////////

        if (!('value' in identityNode.result))
            return new ErrorNode(
                new TextRange(identityNode.range.start, identityNode.range.end),
                'parser object with value'
            );

        /////////////////

        if (typeof identityNode.result.value === 'function') {
            /////////////////
            // Compute result
            /////////////////

            // Function result
            const result = identityNode.result.value(
                argNodes.map((child) => child.result),
                resultNodes.reduce((arr, child) =>
                    arr.concat(child.result.map((child) => child.result)),
                    [] as string[]),
            );

            let resultNode;
            // If result was number, use it to pick the result node
            if (typeof result === 'number') {
                if (resultNodes.length !== 0 && result >= 0 && result < resultNodes.length)
                    resultNode = resultNodes[result].result;
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

            /////////////////

            return new EvalNode(
                new TextRange(identityNode.range.start, rangeEnd),
                resultNode,
                [identityNode, argNodes, resultNodes]
            );
        }
        else if (typeof identityNode.result.value === 'boolean') {
            /////////////////
            // Check result
            /////////////////

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

            /////////////////
            // Compute result
            /////////////////

            let resultNode = resultNodes[identityNode.result.value ? 0 : 1]
            // No result, use empty
            if (resultNode === undefined) {
                resultNode = this.empty(new TextRange(resultNodes[0].range.end, resultNodes[0].range.end));
            }

            /////////////////

            return new ExistsNode(
                new TextRange(identityNode.range.start, resultNodes[resultNodes.length - 1].range.end),
                resultNode.result,
                [identityNode, resultNodes as [FuncChild, FuncChild?]]
            );
        }
        else if (typeof identityNode.result.value === 'number' || typeof identityNode.result.value === 'string') {
            /////////////////
            // Compute result
            /////////////////

            return new ReturnNode(
                new TextRange(identityNode.range.start, rangeEnd),
                [new StringNode(
                    new TextRange(identityNode.range.start, rangeEnd),
                    identityNode.result.value + '' // Dont return numbers
                )],
                [identityNode]
            );

            /////////////////
        }
        
        return new ErrorNode(
            identityNode.range,
            'function, number or string'
        );
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

        /////////////////
        // Check result
        /////////////////

        // Check value exists in globals
        if (!(identityNode.result in this.globals))
            return new ErrorNode(
                new TextRange(identityNode.range.start, identityNode.range.end),
                identityNode.result + ' does not exist in globals'
            );

        /////////////////
        // Compute result
        /////////////////

        rootNode = new RetrieveNode(
            new TextRange(identityNode.range.start, identityNode.range.end),
            this.globals[identityNode.result],
            identityNode
        );

        /////////////////

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

            /////////////////
            // Check result
            /////////////////

            // Check value for children
            if (!('children' in rootNode.result))
                return new ErrorNode(
                    new TextRange(identityNode.range.start, identityNode.range.end),
                    rootNode.result + ' has no children'
                );
            else if (!(identityNode.result in rootNode.result.children))
                return new ErrorNode(
                    new TextRange(identityNode.range.start, identityNode.range.end),
                    identityNode.result + ' does not exist in ' + rootNode.children
                );

            /////////////////
            // Compute result
            /////////////////

            rootNode = new AccessNode(
                new TextRange(rootNode.range.start, identityNode.range.end),
                rootNode.result.children[identityNode.result],
                [rootNode, identityNode]
            );

            /////////////////
        }

        return rootNode;
    }

    private argumentBlock() {
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
            // Search until something is found
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

        // Nothing so force empty
        if (arr.length === 0) {
            return this.empty(new TextRange(this.stream.current.range.start, this.stream.current.range.end));
        }

        /////////////////
        // Compute result
        /////////////////

        // Merge results into StringNode[]
        const result = [];
        for (const child of arr)
            if (child.type === NodeType.String)
                result.push(child);
            else
                result.push(...child.result);

        /////////////////

        return new ConcatNode(
            new TextRange(arr[0].range.start, arr[arr.length - 1].range.end),
            result,
            arr
        );
    }

    private getIdentity() {
        /////////////////
        // Compute result
        /////////////////

        if (this.stream.match(TokenType.Identity)) {
            const token = this.stream.consume(TokenType.Identity)!;
            return new IdentityNode(
                new TextRange(token.range.start, token.range.end),
                this.getText(token)
            );
        }
    }

    private getValue() {
        /////////////////
        // Compute result
        /////////////////

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
