import { TextRange } from "./TextRange";

export enum NodeType {
    Identity = 'identity',
    String = 'string',
    Number = 'number',
    Concat = 'concat',
    Eval = 'eval',
    Exists = 'exists',
    Range = 'range',
    Equals = 'equals',
    Retrieve = 'retrieve',
    Access = 'access',
    Args = 'args',
    Results = 'results',
    Error = 'error'
}

export class Node<T extends NodeType, V, C> {
    public constructor(
        public readonly type: T,
        public readonly range: TextRange,
        public value: V,
        public children: C
    ) { }
}

export function isErrorNode(node: Node<NodeType, any, any>): node is ErrorNode {
    return node.type === NodeType.Error;
}

export type FuncChild = StringNode | ConcatNode | FuncNodes;
export type FuncNodes = EvalNode | ExistsNode;// | RangeNode | EqualsNode;

export class ConcatNode extends Node<NodeType.Concat,
    StringNode[],
    (FuncNodes | StringNode)[]> {
    public constructor(range: TextRange, value: StringNode[], children: (FuncNodes | StringNode)[]) {
        super(NodeType.Concat, range, value, children);
    }

    public toCode(): string {
        // return this.children.map((child) => child.toCode()).join('\n');
        return this.children.map((child) => child.toCode()).join(' + ');
    }
}

export class EvalNode extends Node<NodeType.Eval,
    StringNode[],
    [RetrieveNode | AccessNode, (StringNode | NumberNode)[], FuncChild[]]> {

    public constructor(range: TextRange, value: StringNode[], children: [RetrieveNode | AccessNode, (StringNode | NumberNode)[], FuncChild[]]) {
        super(NodeType.Eval, range, value, children);
    }

    public toCode(): string {
        if (this.children[1].length === 0 && this.children[2].length === 0)
            return this.children[0].toCode() + '();';
        else
            return this.children[0].toCode() +
                '([' +
                this.children[1].map((child) => child.toCode()).join(', ') +
                '], [' +
                this.children[2].map((child) => child.toCode()).join(', ') +
                ']);';
    }
}

export class ExistsNode extends Node<NodeType.Exists,
    StringNode[],
    [RetrieveNode | AccessNode, [FuncChild, FuncChild?]]> {

    public constructor(range: TextRange, value: StringNode[], children: [RetrieveNode | AccessNode, [FuncChild, FuncChild?]]) {
        super(NodeType.Exists, range, value, children);
    }

    public toCode(): string {
        return this.children[0].toCode() + ' ? ' +
            this.children[1][0].toCode() +
            ' : ' +
            (this.children[1][1] ? this.children[1][1]!.toCode() : '""');
        // return 'if (' + this.children[0].toCode() + ') {\n' +
        //     this.children[1][0].toCode() +
        //     '\n}\nelse {\n' +
        //     this.children[1][0].toCode() +
        //     '\n}';
    }
}

export class RangeNode extends Node<NodeType.Range,
    StringNode[],
    [RetrieveNode | AccessNode, NumberNode[], FuncChild[]]> {

    public constructor(range: TextRange, value: StringNode[], children: [RetrieveNode | AccessNode, NumberNode[], FuncChild[]]) {
        super(NodeType.Range, range, value, children);
    }
}

export class EqualsNode extends Node<NodeType.Equals,
    StringNode[],
    [RetrieveNode | AccessNode, (StringNode | NumberNode)[], FuncChild[]]> {

    public constructor(range: TextRange, value: StringNode[], children: [RetrieveNode | AccessNode, (StringNode | NumberNode)[], FuncChild[]]) {
        super(NodeType.Equals, range, value, children);
    }
}

export class AccessNode extends Node<NodeType.Access, any, [RetrieveNode | AccessNode, IdentityNode]> {
    public constructor(range: TextRange, value: any, children: [RetrieveNode | AccessNode, IdentityNode]) {
        super(NodeType.Access, range, value, children);
    }

    public toCode(): string {
        return this.children[0].toCode() + '.' + this.children[1].toCode();
    }
}

export class RetrieveNode extends Node<NodeType.Retrieve, any, IdentityNode> {
    public constructor(range: TextRange, value: any, children: IdentityNode) {
        super(NodeType.Retrieve, range, value, children);
    }

    public toCode(): string {
        return this.children.toCode();
    }
}

export class NumberNode extends Node<NodeType.Number, number, never[]> {
    public constructor(range: TextRange, value: number) {
        super(NodeType.Number, range, value, []);
    }

    public toCode(): string {
        return this.value + '';
    }
}

export class StringNode extends Node<NodeType.String, string, never[]> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.String, range, value, []);
    }

    public toCode(): string {
        return '"' + this.value + '"';
    }
}

export class IdentityNode extends Node<NodeType.Identity, string, never[]> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.Identity, range, value, []);
    }

    public toCode(): string {
        return this.value;
    }
}

export class ErrorNode extends Node<NodeType.Error, string, never[]> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.Error, range, value, []);
    }
}
