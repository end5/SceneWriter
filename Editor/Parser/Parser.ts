import { TokenType, Token } from "./Token";
import { TokenStream } from './TokenStream';
import { SyntaxType, ErrorNode, SyntaxNode, isSyntaxNodeType, isErrorNode } from './SyntaxNode';
import { TextRange } from './TextRange';

export interface ParserError {
    range: TextRange;
    msg: string;
}

export function parse(tokens: Token[], text: string) {
    const stream = new TokenStream(tokens);
    const errors: ParserError[] = [];

    if (tokens.length <= 0)
        return { node: new SyntaxNode(SyntaxType.String, { start: { line: 0, col: 0 }, end: { line: 0, col: 0 } }, ''), errors };

    const root = concatAll(stream, text, errors);
    if (!root)
        return { node: new SyntaxNode(SyntaxType.String, { start: { line: 0, col: 0 }, end: { line: 0, col: 0 } }, ''), errors };

    return { node: root, errors };
}

function createError(node: ErrorNode): ParserError {
    return { range: node.range, msg: `Expected "${node.value}"` };
}

function getText(token: Token, text: string) {
    return text.slice(token.range.start.col + token.offset, token.range.end.col + token.offset);
}

function concatAll(stream: TokenStream, text: string, errors: ParserError[]) {
    const root = new SyntaxNode(SyntaxType.Concat, new TextRange(stream.current.range.start, stream.current.range.end));
    let newNode;
    let lastPos = stream.pos;

    while (!stream.eos()) {
        lastPos = stream.pos;

        newNode = codeBlock(stream, text, errors);
        if (lastPos === stream.pos) {
            // If first match in codeBlock didn't match, ignore error and resume checking
            newNode = textBlock(stream, text);
        }

        if (newNode) {
            if (isErrorNode(newNode)) {
                errors.push(createError(newNode));
            }
            else {
                // The article node needs sub node for checking
                if (isSyntaxNodeType(newNode, SyntaxType.Article)) {
                    const articleChild = concatAll(stream, text, errors);
                    if (articleChild)
                        newNode.right = articleChild;
                    else
                        newNode.right = new SyntaxNode(
                            SyntaxType.EmptyString,
                            new TextRange(stream.current.range.start, stream.current.range.end)
                        );
                    newNode.range.end = newNode.right.range.end;
                }
                root.children.push(newNode);
            }
        }

        // Force the stream forward in case nothing was found
        if (lastPos === stream.pos)
            if (!stream.eos())
                stream.pos++;
            else
                break;
    }

    if (root.children.length === 0) return;
    if (root.children.length === 1) return root.left;

    root.range.end = root.children[root.children.length - 1].range.end;

    return root;
}

function textBlock(stream: TokenStream, text: string) {
    const startToken = stream.current;
    let endToken;
    let token;
    let subText = '';
    let escapeOffset = 0;
    while (!stream.eos()) {
        stream.consume(TokenType.Whitespace);
        token = stream.consume(TokenType.String);
        if (!token) token = stream.consume(TokenType.Escape);
        if (!token) token = stream.consume(TokenType.Newline);
        if (!token) break;
        if (token.type === TokenType.Escape)
            escapeOffset = 2;
        else
            escapeOffset = 0;
        subText += text.slice(token.range.start.col + token.offset + escapeOffset, token.range.end.col + token.offset);
        endToken = token;
    }
    if (endToken) {
        return new SyntaxNode(SyntaxType.String,
            new TextRange(startToken.range.start, endToken.range.end),
            subText
        );
    }
    return;
}

function codeBlock(stream: TokenStream, text: string, errors: ParserError[]) {
    // don't advance token stream on error
    if (!stream.match(TokenType.BracketOpen))
        return new ErrorNode('[', stream.current.range);

    const bracketOpenToken = stream.consume(TokenType.BracketOpen)!;

    while (stream.consume(TokenType.Newline) || stream.consume(TokenType.Whitespace)) { }

    let outerNode;

    // if article is found, skip to the end of the current code block and get the next text or code block
    outerNode = articleBlock(stream, text);
    if (outerNode === undefined) {
        outerNode = new SyntaxNode(SyntaxType.Code, new TextRange(stream.current.range.start, stream.current.range.end));
        const preDotNode = preDotBlock(stream, text);
        if (isErrorNode(preDotNode)) return preDotNode;
        outerNode.children.push(preDotNode);

        const postDotNode = postDotBlock(stream, text);
        if (isErrorNode(postDotNode)) return postDotNode;
        outerNode.children.push(postDotNode);

        const specialArgsNode = specialArgs(stream, text);
        if (isErrorNode(specialArgsNode)) return specialArgsNode;
        outerNode.children.push(specialArgsNode);

        const pipedArgsNode = pipedArgs(stream, text, errors);
        if (isErrorNode(pipedArgsNode)) return pipedArgsNode;
        outerNode.children.push(pipedArgsNode);

        if (outerNode.children.length > 0)
            outerNode.range.end = outerNode.children[outerNode.children.length - 1].range.end;
    }

    // don't advance token stream on error
    if (!stream.match(TokenType.BracketClose))
        return new ErrorNode(']', bracketOpenToken.range);

    stream.consume(TokenType.BracketClose);

    return outerNode;
}

function articleBlock(stream: TokenStream, text: string) {
    let node;
    if (stream.match(TokenType.Article)) {
        node = new SyntaxNode(
            SyntaxType.Article,
            new TextRange(stream.current.range.start, stream.current.range.end),
            '',
            new SyntaxNode(
                SyntaxType.String,
                new TextRange(stream.current.range.start, stream.current.range.end),
                getText(stream.current, text)
            )
        );
        stream.consume(TokenType.Article);
    }
    return node;
}

function preDotBlock(stream: TokenStream, text: string) {
    // don't advance token stream on error
    if (!stream.match(TokenType.Arg))
        return new ErrorNode('Argument', stream.current.range);

    const preDotNode = new SyntaxNode(
        SyntaxType.String,
        new TextRange(stream.current.range.start, stream.current.range.end),
        getText(stream.current, text)
    );
    stream.consume(TokenType.Arg);

    return preDotNode;
}

function postDotBlock(stream: TokenStream, text: string) {
    let postDotNode;
    if (stream.consume(TokenType.Dot)) {
        if (stream.match(TokenType.Arg)) {
            postDotNode = new SyntaxNode(
                SyntaxType.String,
                new TextRange(stream.current.range.start, stream.current.range.end),
                getText(stream.current, text)
            );
            stream.consume(TokenType.Arg);
        }
        else {
            while (stream.consume(TokenType.Newline) || stream.consume(TokenType.Whitespace)) { }
            if (!stream.match(TokenType.Pipe))
                return new ErrorNode('|', stream.current.range);

            postDotNode = new SyntaxNode(
                SyntaxType.Exists,
                new TextRange(stream.current.range.start, stream.current.range.end)
            );
        }
    }
    if (!postDotNode)
        postDotNode = new SyntaxNode(
            SyntaxType.EmptyString,
            new TextRange(stream.current.range.start, stream.current.range.start),
        );

    return postDotNode;
}

function specialArgs(stream: TokenStream, text: string) {
    const args = new SyntaxNode(SyntaxType.Args, new TextRange(stream.current.range.start, stream.current.range.end));
    let subStr = '';

    while (stream.consume(TokenType.Whitespace)) {
        if (stream.match(TokenType.Arg)) {
            subStr += getText(stream.current, text);
            stream.consume(TokenType.Arg);
        }
        if (stream.match(TokenType.Dot)) {
            subStr += getText(stream.current, text);
            stream.consume(TokenType.Dot);
            if (!stream.match(TokenType.Arg))
                return new ErrorNode('Argument', stream.current.range);

            subStr += getText(stream.current, text);
            stream.consume(TokenType.Arg);
        }

        if (subStr.length > 0) {
            if (isNaN(+subStr))
                args.children.push(new SyntaxNode(
                    SyntaxType.String,
                    new TextRange(stream.current.range.start, stream.current.range.end),
                    subStr
                ));
            else
                args.children.push(new SyntaxNode(
                    SyntaxType.Number,
                    new TextRange(stream.current.range.start, stream.current.range.end),
                    subStr
                ));
            subStr = '';
        }
    }

    while (stream.consume(TokenType.Newline) || stream.consume(TokenType.Whitespace)) { }
    if (args.children.length === 0) return new SyntaxNode(SyntaxType.EmptyArgs, new TextRange(stream.current.range.start, stream.current.range.start));

    args.range.end = args.children[args.children.length - 1].range.end;
    return args;
}

function pipedArgs(stream: TokenStream, text: string, errors: ParserError[]) {
    const args = new SyntaxNode(SyntaxType.Args, new TextRange(stream.current.range.start, stream.current.range.end));
    let node;
    while (stream.consume(TokenType.Pipe)) {
        node = pipedConcatAll(stream, text, errors);
        if (isErrorNode(node)) return node;

        args.children.push(node);

        while (stream.consume(TokenType.Newline) || stream.consume(TokenType.Whitespace)) { }
    }

    if (args.children.length === 0) return new SyntaxNode(SyntaxType.EmptyArgs, new TextRange(stream.current.range.start, stream.current.range.start));

    args.range.end = args.children[args.children.length - 1].range.end;
    return args;
}

function pipedConcatAll(stream: TokenStream, text: string, errors: ParserError[]) {
    const root = new SyntaxNode(SyntaxType.Concat, new TextRange(stream.current.range.start, stream.current.range.end));
    let newNode;
    let lastPos = stream.pos;

    while (!stream.eos()) {
        lastPos = stream.pos;

        newNode = codeBlock(stream, text, errors);
        if (lastPos === stream.pos) {
            // If first match in codeBlock didn't match, ignore error and resume checking
            newNode = textBlock(stream, text);
        }

        if (newNode)
            if (isErrorNode(newNode)) {
                errors.push(createError(newNode));
            }
            else {
                // The article node needs sub node for checking
                if (isSyntaxNodeType(newNode, SyntaxType.Article)) {
                    const articleChild = pipedConcatAll(stream, text, errors);
                    if (articleChild) {
                        if (isSyntaxNodeType(articleChild, SyntaxType.EmptyArgs))
                            newNode.right = new SyntaxNode(
                                SyntaxType.EmptyString,
                                new TextRange(stream.current.range.start, stream.current.range.end)
                            );
                        else
                            newNode.right = articleChild;
                        newNode.range.end = newNode.right.range.end;
                    }
                }
                root.children.push(newNode);
            }

        while (stream.consume(TokenType.Newline) || stream.consume(TokenType.Whitespace)) { }

        if (lastPos === stream.pos) break;
    }

    if (root.children.length === 0)
        return new SyntaxNode(SyntaxType.EmptyArgs, new TextRange(stream.current.range.start, stream.current.range.start));
    if (root.children.length === 1)
        return root.left;

    root.range.end = root.children[root.children.length - 1].range.end;
    return root;
}
