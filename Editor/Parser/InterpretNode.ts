import { SyntaxNode, SyntaxType, SyntaxNodeChildrenMap } from './SyntaxNode';
import { TextRange } from './TextRange';

export class InterpretNode<T extends SyntaxType = SyntaxType> {
    public readonly syntax: SyntaxNode<T>;
    public result?: ResultNode;
    public children: InterpretNode<SyntaxNodeChildrenMap[T][number]>[] = [];
    public constructor(syntax: SyntaxNode<T>) {
        this.syntax = syntax;
    }
    public get left(): InterpretNode<SyntaxNodeChildrenMap[T][0]> | undefined {
        return this.children[0] as InterpretNode<SyntaxNodeChildrenMap[T][0]>;
    }
    public get right(): InterpretNode<SyntaxNodeChildrenMap[T][1]> | undefined {
        return this.children[1] as InterpretNode<SyntaxNodeChildrenMap[T][1]>;
    }
}

export class ResultNode {
    public constructor(
        public range: TextRange,
        public children: ResultNode[],
        public value?: any
    ) { }
    public toString() {
        return this.range + ' ' + this.value;
    }
}
