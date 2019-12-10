import { Symbols } from "./Symbol";
import { TextRange } from "./TextRange";

export enum NodeType {
    Identity = 'identity',
    String = 'string',
    Newline = 'newline',
    Number = 'number',
    Concat = 'concat',
    Eval = 'eval',
    Return = 'return',
    Conditional = 'conditional',
    Range = 'range',
    Equals = 'equals',
    Retrieve = 'retrieve',
    Access = 'access',
    Args = 'args',
    Results = 'results',
    Error = 'error'
}

export class Node<T extends NodeType, R, C> {
    public constructor(
        public readonly type: T,
        public readonly range: TextRange,
        public result: R,
        public children: C
    ) { }
}

export function isErrorNode(node: Node<NodeType, any, any>): node is ErrorNode {
    return node.type === NodeType.Error;
}

export type AllNodes = FuncChild | NumberNode | IdentityNode | AccessNode | RetrieveNode;
export type FuncChild = StringNode | ConcatNode | FuncNodes;
export type FuncNodes = EvalNode | ReturnNode | ConditionalNode;
export type ResultNodes = StringNode;

export class ConcatNode extends Node<NodeType.Concat,
    ResultNodes[],
    FuncChild[]> {
    public constructor(range: TextRange, result: ResultNodes[], children: FuncChild[]) {
        super(NodeType.Concat, range, result, children);
    }

    public toCode(): string {
        return this.children.map((child) => child.toCode()).join(' + ');
    }
}

export class EvalNode extends Node<NodeType.Eval,
    ResultNodes[],
    [RetrieveNode | AccessNode, (StringNode | NumberNode)[], ConcatNode[]]> {

    public constructor(range: TextRange, result: ResultNodes[], children: [RetrieveNode | AccessNode, (StringNode | NumberNode)[], ConcatNode[]]) {
        super(NodeType.Eval, range, result, children);
    }

    public toCode(): string {
        const result = this.children[0].result;
        if (result.type === 'function' && result.toCode) {
            return result.toCode(
                this.children[0].toCode(),
                this.children[1].map((child) => child.toCode()),
                this.children[2].map((child) => child.toCode())
            );
        }
        else {
            if (this.children[1].length === 0 && this.children[2].length === 0)
                return this.children[0].toCode() + '()';
            else if (this.children[1].length > 0 && this.children[2].length > 0)
                return this.children[0].toCode() +
                    '([' +
                    this.children[1].map((child) => child.toCode()).join(', ') +
                    '], [' +
                    this.children[2].map((child) => child.toCode()).join(', ') +
                    '])';
            else if (this.children[1].length > 0)
                return this.children[0].toCode() + '(' +
                    this.children[1].map((child) => child.toCode()).join(', ') +
                    ')';
            else
                return this.children[0].toCode() + '(' +
                    this.children[2].map((child) => child.toCode()).join(', ') +
                    ')';
        }
    }
}

export class ReturnNode extends Node<NodeType.Return,
    ResultNodes[],
    [RetrieveNode | AccessNode]> {
    public constructor(range: TextRange, result: ResultNodes[], children: [RetrieveNode | AccessNode]) {
        super(NodeType.Return, range, result, children);
    }

    public toCode(): string {
        return this.children[0].toCode();
    }
}

export class ConditionalNode extends Node<NodeType.Conditional,
    ResultNodes[],
    [RetrieveNode | AccessNode, [FuncChild, FuncChild]]> {

    public constructor(range: TextRange, result: ResultNodes[], children: [RetrieveNode | AccessNode, [FuncChild, FuncChild]]) {
        super(NodeType.Conditional, range, result, children);
    }

    public toCode(): string {
        return '(' + this.children[0].toCode() + ' ? ' +
            this.children[1][0].toCode() +
            ' : ' +
            (this.children[1][1] ? this.children[1][1]!.toCode() : '""') + ')';
    }
}

export class AccessNode extends Node<NodeType.Access,
    Symbols,
    [RetrieveNode | AccessNode, IdentityNode]> {
    public constructor(range: TextRange, result: Symbols, children: [RetrieveNode | AccessNode, IdentityNode]) {
        super(NodeType.Access, range, result, children);
    }

    public toCode(): string {
        return this.children[0].toCode() + '.' + this.children[1].toCode();
    }
}

export class RetrieveNode extends Node<NodeType.Retrieve, Symbols, IdentityNode> {
    public constructor(range: TextRange, result: Symbols, children: IdentityNode) {
        super(NodeType.Retrieve, range, result, children);
    }

    public toCode(): string {
        return this.children.toCode();
    }
}

export class NumberNode extends Node<NodeType.Number, number, never[]> {
    public constructor(range: TextRange, result: number) {
        super(NodeType.Number, range, result, []);
    }

    public toCode(): string {
        return this.result + '';
    }
}

const escapePairs: [RegExp, string][] = [[/\n/g, '\\n'], [/'/g, '\\\''], [/"/g, '\\"']];

export class StringNode extends Node<NodeType.String, string, never[]> {
    public constructor(range: TextRange, result: string) {
        super(NodeType.String, range, result, []);
    }

    public toCode(): string {
        return '"' + escapePairs.reduce((str, pair) => str.replace(pair[0], pair[1]), this.result) + '"';
    }
}

export class IdentityNode extends Node<NodeType.Identity, string, never[]> {
    public constructor(range: TextRange, result: string) {
        super(NodeType.Identity, range, result, []);
    }

    public toCode(): string {
        return this.result;
    }
}

export class ErrorNode extends Node<NodeType.Error, string, never[]> {
    public constructor(range: TextRange, result: string) {
        super(NodeType.Error, range, result, []);
    }
}
