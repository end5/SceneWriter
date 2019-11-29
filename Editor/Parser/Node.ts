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
    (FuncNodes | StringNode)[]> { }

export class EvalNode extends Node<NodeType.Eval,
    StringNode[],
    [RetrieveNode | AccessNode, (StringNode | NumberNode)[], FuncChild[]]> { }

export class ExistsNode extends Node<NodeType.Exists,
    StringNode[],
    [RetrieveNode | AccessNode, [FuncChild, FuncChild?]]> { }

export class RangeNode extends Node<NodeType.Range,
    StringNode[],
    [RetrieveNode | AccessNode, NumberNode[], FuncChild[]]> { }

export class EqualsNode extends Node<NodeType.Equals,
    StringNode[],
    [RetrieveNode | AccessNode, (StringNode | NumberNode)[], FuncChild[]]> { }

export class AccessNode extends Node<NodeType.Access, any, [RetrieveNode | AccessNode, IdentityNode]> {
    public constructor(range: TextRange, value: any, children: [RetrieveNode | AccessNode, IdentityNode]) {
        super(NodeType.Access, range, value, children);
    }
}

export class RetrieveNode extends Node<NodeType.Retrieve, any, IdentityNode> {
    public constructor(range: TextRange, value: any, children: IdentityNode) {
        super(NodeType.Retrieve, range, value, children);
    }
}

export class NumberNode extends Node<NodeType.Number, number, never[]> {
    public constructor(range: TextRange, value: number) {
        super(NodeType.Number, range, value, []);
    }
}

export class StringNode extends Node<NodeType.String, string, never[]> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.String, range, value, []);
    }

export class IdentityNode extends Node<NodeType.Identity, string, never[]> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.Identity, range, value, []);
    }
}

export class ErrorNode extends Node<NodeType.Error, string, never[]> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.Error, range, value, []);
    }
}
