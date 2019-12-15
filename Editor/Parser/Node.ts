import { Symbols } from "./Symbol";
import { TextRange } from "./TextRange";

export enum NodeType {
    Identity = 'identity',
    String = 'string',
    Newline = 'newline',
    Number = 'number',
    Concat = 'concat',
    Eval = 'eval',
    List = 'list',
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

export type AllNodes = StringNode | ConcatNode | EvalNode | NumberNode | IdentityNode | AccessNode | RetrieveNode | ErrorNode | ArgsNode | ResultsNode;

export type TextNodes = StringNode | ConcatNode | EvalNode;

export class ConcatNode extends Node<NodeType.Concat, TextNodes[], undefined> {
    public constructor(range: TextRange, children: TextNodes[]) {
        super(NodeType.Concat, range, children, undefined);
    }

    // public toCode(): string {
    //     return this.children.map((child) => child.toCode()).join(' + ');
    // }
}

export class EvalNode extends Node<NodeType.Eval,
    [RetrieveNode | AccessNode, ArgsNode, ResultsNode],
    undefined> {

    public constructor(range: TextRange, children: [RetrieveNode | AccessNode, ArgsNode, ResultsNode]) {
        super(NodeType.Eval, range, children, undefined);
    }

    // public toCode(): string {
    //     const result = this.children[0].result;
    //     if (result.type === 'function' && result.toCode) {
    //         return result.toCode(
    //             this.children[0].toCode(),
    //             this.children[1].map((child) => child.toCode()),
    //             this.children[2].map((child) => child.toCode())
    //         );
    //     }
    //     else {
    //         if (this.children[1].length === 0 && this.children[2].length === 0)
    //             return this.children[0].toCode() + '()';
    //         else if (this.children[1].length > 0 && this.children[2].length > 0)
    //             return this.children[0].toCode() +
    //                 '([' +
    //                 this.children[1].map((child) => child.toCode()).join(', ') +
    //                 '], [' +
    //                 this.children[2].map((child) => child.toCode()).join(', ') +
    //                 '])';
    //         else if (this.children[1].length > 0)
    //             return this.children[0].toCode() + '(' +
    //                 this.children[1].map((child) => child.toCode()).join(', ') +
    //                 ')';
    //         else
    //             return this.children[0].toCode() + '(' +
    //                 this.children[2].map((child) => child.toCode()).join(', ') +
    //                 ')';
    //     }
    // }
}

export class ArgsNode extends Node<NodeType.Args,
    (StringNode | NumberNode)[],
    undefined> {

    public constructor(range: TextRange, children: (StringNode | NumberNode)[]) {
        super(NodeType.Args, range, children, undefined);
    }
}

export class ResultsNode extends Node<NodeType.Results,
TextNodes[],
    undefined> {

    public constructor(range: TextRange, children: TextNodes[]) {
        super(NodeType.Results, range, children, undefined);
    }
}

export class AccessNode extends Node<NodeType.Access, [RetrieveNode | AccessNode, IdentityNode], undefined> {
    public constructor(range: TextRange, children: [RetrieveNode | AccessNode, IdentityNode]) {
        super(NodeType.Access, range, children, undefined);
    }

    // public toCode(): string {
    //     return this.children[0].toCode() + '.' + this.children[1].toCode();
    // }
}

export class RetrieveNode extends Node<NodeType.Retrieve, IdentityNode, undefined> {
    public constructor(range: TextRange, children: IdentityNode) {
        super(NodeType.Retrieve, range, children, undefined);
    }

    // public toCode(): string {
    //     return this.children.toCode();
    // }
}

export class NumberNode extends Node<NodeType.Number, never[], number> {
    public constructor(range: TextRange, value: number) {
        super(NodeType.Number, range, [], value);
    }

    // public toCode(): string {
    //     return this.result + '';
    // }
}

// const escapePairs: [RegExp, string][] = [[/\n/g, '\\n'], [/'/g, '\\\''], [/"/g, '\\"']];

export class StringNode extends Node<NodeType.String, never[], string> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.String, range, [], value);
    }

    // public toCode(): string {
    //     return '"' + escapePairs.reduce((str, pair) => str.replace(pair[0], pair[1]), this.result) + '"';
    // }
}

export class IdentityNode extends Node<NodeType.Identity, never[], string> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.Identity, range, [], value);
    }

    // public toCode(): string {
    //     return this.result;
    // }
}

export class ErrorNode extends Node<NodeType.Error, never[], string> {
    public constructor(range: TextRange, value: string) {
        super(NodeType.Error, range, [], value);
    }
}
