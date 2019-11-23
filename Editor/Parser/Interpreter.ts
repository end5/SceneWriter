import { SyntaxNode } from './SyntaxNode';
import { InterpretNode, ResultNode } from './InterpretNode';
import { ResolveSyntaxTypeTable } from './ResolveSyntaxType';
import { TextRange } from './TextRange';
import { ICodeMask } from './CodeMask';

interface DiscoveryNode<T> {
    data: T;
    discovered: boolean;
}

export interface InterpretErrorNode {
    node: SyntaxNode;
    msg: string;
}

export function interpret(root: SyntaxNode, mask: ICodeMask, globals: { [x: string]: any }, noDOM?: boolean) {
    return processTree(new InterpretNode(root), mask, globals, noDOM);
}

function processTree(root: InterpretNode, mask: ICodeMask, globals: { [x: string]: any }, noDOM?: boolean) {
    const errors: InterpretErrorNode[] = [];
    const stack: DiscoveryNode<InterpretNode>[] = [{ data: root, discovered: false }];
    let node: DiscoveryNode<InterpretNode>;
    let result: any;
    let values;

    while (stack.length > 0) {
        node = stack[0];

        if (!node.discovered) {
            node.discovered = true;
            if (node.data.syntax.children.length > 0) {
                node.data.children = node.data.syntax.children.map((child) => new InterpretNode(child));
                stack.unshift(...node.data.children.map((child) => ({ data: child, discovered: false })));
                // children exist, delay processing
                continue;
            }
        }

        if (!(node.data.syntax.type in ResolveSyntaxTypeTable))
            throw new Error('Unknown Syntax Node Type');

        values = node.data.children.filter((child) => child.result).map((child) => child.result!);

        try {
            result = ResolveSyntaxTypeTable[node.data.syntax.type](node.data.syntax, values, mask, globals, { noDOM });
            node.data.result = new ResultNode(node.data.syntax.range, result.children, result.value);
        }
        catch (error) {
            if ('message' in error)
                errors.push({ node: node.data.syntax, msg: error.message });
        }

        stack.shift();
    }

    if (root.result)
        return { result: flatten(root.result), errors, tree: root };
    else
        return { result: [new ResultNode(new TextRange({ line: 0, col: 0 }, { line: 0, col: 0 }), [], '')], errors, tree: root };
}

function flatten(root: ResultNode) {
    const stack = [root];
    const out: ResultNode[] = [];
    let node;

    while (stack.length > 0) {
        node = stack.shift()!;
        if (node.children.length <= 0)
            out.push(node);
        else
            stack.unshift(...node.children);
    }

    return out;
}
