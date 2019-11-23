import { TextRange } from './TextRange';

export enum SyntaxType {
    String = 'string',
    Number = 'number',
    EmptyString = 'empty string',
    Concat = 'concat',
    Code = 'code',
    Args = 'args',
    EmptyArgs = 'empty args',
    Exists = 'exists',
    Article = 'article',
    Error = 'error'
}

export interface SyntaxNodeChildrenMap extends Record<SyntaxType, (never | SyntaxType)[]> {
    [SyntaxType.Concat]: (
        SyntaxType.Article | SyntaxType.Code | SyntaxType.String | SyntaxType.Concat
    )[];
    [SyntaxType.Code]: [
        SyntaxType.String,
        SyntaxType.String | SyntaxType.Exists | SyntaxType.EmptyString,
        SyntaxType.Args | SyntaxType.EmptyArgs,
        SyntaxType.Args | SyntaxType.EmptyArgs,
        ...never[]
    ];
    [SyntaxType.Article]: [
        SyntaxType.String,
        SyntaxType.Article | SyntaxType.Code | SyntaxType.String | SyntaxType.Concat | SyntaxType.EmptyString,
        ...never[]
    ];
    [SyntaxType.Args]: (
        SyntaxType.Concat |
        SyntaxType.Article |
        SyntaxType.Code |
        SyntaxType.String |
        SyntaxType.Number |
        SyntaxType.EmptyArgs
    )[];
    [SyntaxType.EmptyString]: never[];
    [SyntaxType.EmptyArgs]: never[];
    [SyntaxType.Number]: never[];
    [SyntaxType.String]: never[];
    [SyntaxType.Exists]: never[];
    [SyntaxType.Error]: never[];
}

export function isSyntaxNodeType<N extends SyntaxNode<SyntaxType>, T extends SyntaxType>(node: N, type: T): node is Extract<SyntaxNode<T>, N> {
    return node.type === type;
}

export class SyntaxNode<T extends SyntaxType = SyntaxType> {
    public readonly value: string;
    public children: SyntaxNode<SyntaxNodeChildrenMap[T][number]>[] = [];
    public readonly type: T;
    public readonly range: TextRange;
    public constructor(type: T, range: TextRange, value?: string, left?: SyntaxNode<SyntaxNodeChildrenMap[T][0]>, right?: SyntaxNode<SyntaxNodeChildrenMap[T][1]>) {
        this.type = type;
        this.range = range;
        this.value = value || '';
        if (left !== undefined)
            this.left = left;
        if (right !== undefined)
            this.right = right;
    }
    public get left(): SyntaxNode<SyntaxNodeChildrenMap[T][0]> {
        return this.children[0] as SyntaxNode<SyntaxNodeChildrenMap[T][0]>;
    }
    public set left(node: SyntaxNode<SyntaxNodeChildrenMap[T][0]>) {
        this.children[0] = node;
    }
    public get right(): SyntaxNode<SyntaxNodeChildrenMap[T][1]> {
        return this.children[1] as SyntaxNode<SyntaxNodeChildrenMap[T][1]>;
    }
    public set right(node: SyntaxNode<SyntaxNodeChildrenMap[T][1]>) {
        this.children[1] = node;
    }
}

export class ErrorNode extends SyntaxNode<SyntaxType.Error> {
    public constructor(value: string, range: TextRange) {
        super(SyntaxType.Error, range, value);
    }
}

export function isErrorNode(node: SyntaxNode): node is ErrorNode {
    return node.type === SyntaxType.Error;
}
