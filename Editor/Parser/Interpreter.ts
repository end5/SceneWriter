import { AllNodes, NodeType, StringNode } from "./Node";
import { Symbols } from "./Symbol";
import { TextRange } from './TextRange';

export interface ParserError {
    range: TextRange;
    msg: string;
}

interface DiscoveryNode<T> {
    data: T;
    discovered: boolean;
}

export class Interpreter {
    private errors: ParserError[] = [];
    private globals: Record<string, Symbols>;
    private root: AllNodes;

    public constructor(root: AllNodes, globals: Record<string, any>) {
        this.globals = globals;
        this.root = root;
    }

    public interpret() {
        const result = this.loop();
        const errors = this.errors;

        return result;
    }

    private loop() {
        const stack: DiscoveryNode<AllNodes>[] = [{ data: this.root, discovered: false }];
        let node: DiscoveryNode<AllNodes>;
        const jumpStack: number[] = [];
        const valueStack: any[] = [];
        const posStack: TextRange[][] = [];
        const stackCopy: { state: DiscoveryNode<AllNodes>[], jump: number[], value: any[] }[] = [];

        let emptyList = false;

        while (stack.length > 0) {
            stackCopy.push({
                state: JSON.parse(JSON.stringify(stack)),
                jump: JSON.parse(JSON.stringify(jumpStack)),
                value: JSON.parse(JSON.stringify(valueStack)),
            });

            node = stack[stack.length - 1];

            // Discover Section
            if (!node.discovered) {
                node.discovered = true;
                switch (node.data.type) {
                    case NodeType.Identity:
                    case NodeType.String:
                    case NodeType.Number:
                    case NodeType.Error:
                        break;

                    // These have children, so process the children first

                    // These are lists of unknown length.
                    // Store the starting position in jumpStack
                    // so we know where to return to.
                    case NodeType.Concat:
                    case NodeType.Args:
                    case NodeType.Results:
                        // When this node has no children,
                        // process it immediately instead of
                        // defering its processing and performing another loop
                        if (node.data.children.length === 0) {
                            emptyList = true;
                            break;
                        }

                        for (const child of node.data.children)
                            stack.push({ data: child, discovered: false });
                        //
                        jumpStack.push(valueStack.length);
                        continue;

                    case NodeType.Eval:
                        stack.push({ data: node.data.children[0], discovered: false });
                        stack.push({ data: node.data.children[1], discovered: false });
                        stack.push({ data: node.data.children[2], discovered: false });
                        continue;

                    case NodeType.Retrieve:
                        stack.push({ data: node.data.children, discovered: false });
                        continue;

                    case NodeType.Access:
                        stack.push({ data: node.data.children[0], discovered: false });
                        stack.push({ data: node.data.children[1], discovered: false });
                        continue;
                }
            }

            // Process Section
            switch (node.data.type) {
                case NodeType.Identity:
                case NodeType.Number:
                case NodeType.String:
                    valueStack.push(node.data.value);
                    posStack.push([node.data.range]);
                    break;

                case NodeType.Error:
                    break;

                case NodeType.Concat:
                case NodeType.Args:
                case NodeType.Results: {
                    if (emptyList) {
                        emptyList = false;
                        valueStack.push([]);
                        posStack.push([node.data.range]);
                        break;
                    }

                    if (jumpStack.length === 0) break;
                    const jumpPos = jumpStack.pop()!;

                    const arr = valueStack.splice(jumpPos).reverse();

                    if (node.data.type === NodeType.Concat)
                        valueStack.push(arr.join(''));
                    else
                        valueStack.push(arr);

                    const posArr = posStack.splice(jumpPos).reverse();
                    const nodes = [];
                    for (const child of posArr)
                        for (const textRange of child)
                            nodes.push(textRange);

                    posStack.push(nodes);
                    break;
                }

                case NodeType.Eval: {
                    const identity = valueStack.pop();
                    const args = valueStack.pop();
                    const results = valueStack.pop();

                    const identityPos = posStack.pop();
                    const argsPos = posStack.pop();
                    const resultsPos = posStack.pop();

                    if (identity === undefined || args === undefined || results === undefined) break;

                    if (typeof identity === 'function') {
                        const result = identity(args, results);
                        if (typeof result === 'object' && 'selector' in result && results[result.selector]) {
                            valueStack.push(results[result.selector]);
                            if (resultsPos)
                                posStack.push([resultsPos[result.selector]]);
                        }
                        else {
                            valueStack.push(result + '');
                            posStack.push([node.data.range]);
                        }
                    }
                    else if (typeof identity === 'boolean') {
                        if (identity && results[0]) {
                            valueStack.push(results[0]);
                            if (resultsPos)
                                posStack.push([resultsPos[0]]);
                        }
                        else if (!identity && results[1]) {
                            valueStack.push(results[1]);
                            if (resultsPos)
                                posStack.push([resultsPos[1]]);
                        }
                        else {
                            valueStack.push('');
                            posStack.push([node.data.range]);
                        }
                    }
                    else {
                        valueStack.push(identity + '');
                        posStack.push([node.data.range]);
                    }
                    break;
                }

                case NodeType.Retrieve: {
                    const identity = valueStack.pop();
                    if (identity !== undefined) {
                        valueStack.push(this.globals[identity]);
                        posStack.push([node.data.range]);
                    }
                    break;
                }

                case NodeType.Access: {
                    const left = valueStack.pop();
                    const right = valueStack.pop();
                    if (left !== undefined && right !== undefined && typeof left === 'object') {
                        valueStack.push(left[right]);
                        posStack.push([node.data.range]);
                    }
                    break;
                }
            }

            stack.pop();
        }

        return { result: valueStack[0], stack: stackCopy };
    }
}

/*

concat
|- string:a
|- string:b
|- string:c

jump    value       loop        stack
 v       v                       v
[]      []            start     [c]
[0]     []            concat  > [s:c, s:b, s:a, c]
[0]     [c]         < string:c  [s:b, s:a, c]
[0]     [b, c]      < string:b  [s:a, c]
[0]     [a, b, c]   < string:a  [c]
[]      [abc]       < concat    []

concat
|- string:a
|- concat
    |- string:b
    |- string:c

[]      []            start         [c]
[0]     []            concat      > [c, s:a, c]
[0,0]   []            concat      > [s:c, s:b, c, s:a, c]
[0,0]   [c]         < string:c      [s:b, c, s:a, c]
[0,0]   [b, c]      < string:b      [c, s:a, c]
[0]     [bc]        < concat        [s:a, c]
[0]     [a, bc]     < string:a      [c]
[]      [abc]       < concat        []

concat
|- concat
|   |- string:b
|   |- string:c
|- string:a

[]      []            start         [c]
[0]     []            concat      > [s:a, c, c]
[0]     [a]         < string:a      [c, c]
[1,0]   [a]           concat      > [s:c, s:b, c, c]
[1,0]   [c, a]      < string:c      [s:b, c, c]
[1,0]   [b, c, a]   < string:b      [c, c]
[0]     [bc, a]     < concat        [c]
[]      [bca]       < concat        []

eval
|- retrieve
|   |- identity:x
|- args
|- results

[]          []                start             [e]
[0]         []                eval            > [rs, a, r, e]
[0]         [[]]            < results           [a, r, e]
[0]         [[], []]        < args              [r, e]
[0]         [[], []]          retrieve        > [i:x, r, e]
[0]         [x, [], []]     < identity:x        [r, e]
[0]         [.x, [], []]    < retrieve          [e]
[0]         [x]             < eval              []

concat
|- string:a
|- eval
    |- retrieve
    |   |- identity:x
    |- args
    |- results
        |- string:y
        |- string:z

[0]         []                    start             [c]
[0]         []                    concat          > [e, s:a, c]
[0,0]       []                    eval            > [rs, a, r, e, s:a, c]
[0,0]       []                    results         > [s:z, s:y, rs, a, r, e, s:a, c]
[0,0,0]     [z]                 < string:z          [s:y, rs, a, r, e, s:a, c]
[0,0,0]     [y, z]              < string:y          [rs, a, r, e, s:a, c]
[0,0]       [[z, y]]            < results           [a, r, e, s:a, c]
[0,0]       [[], [z, y]]        < args              [r, e, s:a, c]
[0,0]       [[], [z, y]]          retrieve        > [i:x, r, e, s:a, c]
[0,0]       [x, [], [z, y]]     < identity:x        [r, e, s:a, c]
[0,0]       [.x, [], [z, y]]    < retrieve          [e, s:a, c]
[0]         [xyz]               < eval              [s:a, c]
[0]         [a]                 < string:a          [c]
[]          [axyz]              < concat            []

concat
|- eval
|   |- retrieve
|   |   |- identity:x
|   |- args
|   |   |- number:1
|   |- results
|       |- string:y
|       |- string:z
|- string:a

[0]         []                        start             [c]
[0]         []                        concat          > [s:a, e, c]
[0]         [a]                     < string:a          [e, c]
[1,0]       [a]                       eval            > [rs, a, r, e, c]
[1,1,0]     [a]                       results         > [s:z, s:y, rs, a, r, e, c]
[1,1,0]     [z, a]                  < string:z          [s:y, rs, a, r, e, c]
[1,1,0]     [y, z, a]               < string:y          [rs, a, r, e, c]
[1,0]       [[z, y], a]             < results           [a, r, e, c]
[2,1,0]     [[z, y], a]               args            > [n:1, a, r, e, c]
[2,1,0]     [1, [z, y], a]          < number:1          [a, r, e, c]
[1,0]       [[1], [z, y], a]        < args              [r, e, c]
[1,0]       [[1], [z, y], a]          retrieve        > [i:x, r, e, c]
[1,0]       [x, [1], [z, y], a]     < identity:x        [r, e, c]
[1,0]       [.x, [1], [z, y], a]    < retrieve          [e, c]
[0]         [x1yz, a]               < eval              [c]
[]          [ax1yz]                 < concat            []

eval
|- access
|   |- retrieve
|   |   |- identity:a
|   |- identity:b
|- args
|- results
    |- string:y
    |- string:z

[0]         []                    start             [e]
[0]         []                    eval            > [rs, a, ac, e]
[0,0]       [z]                   results         > [s:z, s:y, rs, a, ac, e]
[0,0]       [z]                 < string:z          [s:y, rs, a, ac, e]
[0,0]       [y, z]              < string:y          [rs, a, ac, e]
[0]         [[z, y]]            < results           [a, ac, e]
[0]         [[], [z, y]]        < args              [ac, e]
[0]         [[], [z, y]]          access          > [i:b, r, ac, e]
[0]         [b, [], [z, y]]     < identity:b        [r, ac, e]
[0]         [b, [], [z, y]]       retrieve        > [i:a, r, ac, e]
[0]         [a, b, [], [z, y]]  < identity:a        [r, ac, e]
[0]         [.a, b, [], [z, y]] < retrieve          [ac, e]
[0]         [.a.b, [], [z, y]]  < access            [e]
[]          [yz]                < eval              []

*/
