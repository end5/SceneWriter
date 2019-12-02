import { TextRange } from "./TextRange";
import { ParserObject } from "./ParserObject";

export enum NodeType {
    Identity = 'identity',
    String = 'string',
    Number = 'number',
    Concat = 'concat',
    Eval = 'eval',
    Return = 'return',
    Exists = 'exists',
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

export type FuncChild = StringNode | ConcatNode | FuncNodes;
export type FuncNodes = EvalNode | ReturnNode | ExistsNode;

export class ConcatNode extends Node<NodeType.Concat,
    StringNode[],
    (FuncNodes | StringNode)[]> {
    public constructor(range: TextRange, result: StringNode[], children: (FuncNodes | StringNode)[]) {
        super(NodeType.Concat, range, result, children);
    }

    public toCode(): string {
        return this.children.map((child) => child.toCode()).join(' + ');
    }
}

export class EvalNode extends Node<NodeType.Eval,
    StringNode[],
    [RetrieveNode | AccessNode, (StringNode | NumberNode)[], FuncChild[]]> {

    public constructor(range: TextRange, result: StringNode[], children: [RetrieveNode | AccessNode, (StringNode | NumberNode)[], FuncChild[]]) {
        super(NodeType.Eval, range, result, children);
    }

    public toCode(): string {
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

export class ReturnNode extends Node<NodeType.Return, StringNode[], [RetrieveNode | AccessNode]> {
    public constructor(range: TextRange, result: StringNode[], children: [RetrieveNode | AccessNode]) {
        super(NodeType.Return, range, result, children);
    }

    public toCode(): string {
        return this.children[0].toCode();
    }
}

export class ExistsNode extends Node<NodeType.Exists,
    StringNode[],
    [RetrieveNode | AccessNode, [FuncChild, FuncChild?]]> {

    public constructor(range: TextRange, result: StringNode[], children: [RetrieveNode | AccessNode, [FuncChild, FuncChild?]]) {
        super(NodeType.Exists, range, result, children);
    }

    public toCode(): string {
        return '(' + this.children[0].toCode() + ' ? ' +
            this.children[1][0].toCode() +
            ' : ' +
            (this.children[1][1] ? this.children[1][1]!.toCode() : '""') + ')';
    }
}

export class AccessNode extends Node<NodeType.Access, ParserObject, [RetrieveNode | AccessNode, IdentityNode]> {
    public constructor(range: TextRange, result: ParserObject, children: [RetrieveNode | AccessNode, IdentityNode]) {
        super(NodeType.Access, range, result, children);
    }

    public toCode(): string {
        return this.children[0].toCode() + '.' + this.children[1].toCode();
    }
}

export class RetrieveNode extends Node<NodeType.Retrieve, ParserObject, IdentityNode> {
    public constructor(range: TextRange, result: ParserObject, children: IdentityNode) {
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

export class StringNode extends Node<NodeType.String, string, never[]> {
    public constructor(range: TextRange, result: string) {
        super(NodeType.String, range, result, []);
    }

    public toCode(): string {
        return '"' + this.result.replace('"', '\\"').replace('\'', '\\\'').replace('\n', '\\n') + '"';
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
