import { TextRange } from "./TextRange";

export enum NodeType {
    Identity = 0,
    String = 1,
    Number = 2,
    Concat = 3,
    Eval = 4,
    Retrieve = 5,
    Args = 6,
    Results = 7
}

export const NodeTypeNames = ['Identifier', 'String', 'Number', 'Concat', 'Eval', 'Retrieve', 'Args', 'Results'];

export class Node<T extends NodeType, C, V> {
    public constructor(
        public readonly type: T,
        public readonly range: TextRange,
        public children: C,
        public value: V,
    ) { }
}

export type AllNodes = StringNode | ConcatNode | EvalNode | NumberNode | IdentityNode | RetrieveNode | ArgsNode | ResultsNode;

export type TextNodes = StringNode | ConcatNode | EvalNode;

export class ConcatNode extends Node<NodeType.Concat, TextNodes[], undefined> {
    public constructor(range: TextRange, children: TextNodes[]) {
        super(NodeType.Concat, range, children, undefined);
    }
}

export enum EvalOperator {
    Default = 0,
    Range = 1,
    Equal = 2
}

export class EvalNode extends Node<NodeType.Eval, [RetrieveNode, ArgsNode, ResultsNode], EvalOperator> {
    public constructor(range: TextRange, children: [RetrieveNode, ArgsNode, ResultsNode], operator: EvalOperator = EvalOperator.Default) {
        super(NodeType.Eval, range, children, operator);
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
