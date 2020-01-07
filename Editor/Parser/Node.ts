import { TextRange } from "./TextRange";

export enum NodeType {
    Identity = 'identity',
    String = 'string',
    Number = 'number',
    Concat = 'concat',
    Eval = 'eval',
    Retrieve = 'retrieve',
    Args = 'args',
    Results = 'results',
    Error = 'error'
}

export class Node<T extends NodeType, C, V> {
    public constructor(
        public readonly type: T,
        public readonly range: TextRange,
        public children: C,
        public value: V,
    ) { }
}

export function isErrorNode(node: Node<NodeType, any, any>): node is ErrorNode {
    return node.type === NodeType.Error;
}

export type AllNodes = StringNode | ConcatNode | EvalNode | NumberNode | IdentityNode | RetrieveNode | ErrorNode | ArgsNode | ResultsNode;

export type TextNodes = StringNode | ConcatNode | EvalNode;

export class ConcatNode extends Node<NodeType.Concat, TextNodes[], undefined> {
    public constructor(range: TextRange, children: TextNodes[]) {
        super(NodeType.Concat, range, children, undefined);
    }
}

export class EvalNode extends Node<NodeType.Eval, [RetrieveNode, ArgsNode, ResultsNode], undefined> {
    public constructor(range: TextRange, children: [RetrieveNode, ArgsNode, ResultsNode]) {
        super(NodeType.Eval, range, children, undefined);
    }
}

export class ArgsNode extends Node<NodeType.Args, (StringNode | NumberNode)[], undefined> {
    public constructor(range: TextRange, children: (StringNode | NumberNode)[]) {
        super(NodeType.Args, range, children, undefined);
    }
}

export class ResultsNode extends Node<NodeType.Results, TextNodes[], undefined> {
    public constructor(range: TextRange, children: TextNodes[]) {
        super(NodeType.Results, range, children, undefined);
    }
}

export class RetrieveNode extends Node<NodeType.Retrieve, IdentityNode[], undefined> {
    public constructor(range: TextRange, children: IdentityNode[]) {
        super(NodeType.Retrieve, range, children, undefined);
    }
}

export class NumberNode extends Node<NodeType.Number, never[], number> {
    public constructor(range: TextRange, value: number) {
        super(NodeType.Number, range, [], value);
    }
}

export class StringNode extends Node<NodeType.String, never[], string> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.String, range, [], value);
    }
}

export class IdentityNode extends Node<NodeType.Identity, never[], string> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.Identity, range, [], value);
    }
}

export class ErrorNode extends Node<NodeType.Error, never[], string> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.Error, range, [], value);
    }
}
