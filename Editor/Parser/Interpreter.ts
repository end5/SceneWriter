import { AccessNode, AllNodes, NodeType, RetrieveNode } from "./Node";
import { Symbols } from "./Symbol";
import { TextRange } from './TextRange';

export interface InterpretError {
    range: TextRange;
    msg: string;
}

interface DiscoveryNode<T> {
    data: T;
    discovered: boolean;
}

export class Interpreter {
    private errors: InterpretError[] = [];
    private globals: Record<string, Symbols>;
    private root: AllNodes;

    public constructor(root: AllNodes, globals: Record<string, any>) {
        this.globals = globals;
        this.root = root;
    }

    private getName(node: AccessNode | RetrieveNode) {
        let name = '';
        let cur: AccessNode | RetrieveNode = node;
        while (cur.type === NodeType.Access) {
            name = cur.children[1].value + (name.length === 0 ? '' : '.' + name);
            cur = cur.children[0];
        }
        name = cur.value + (name.length === 0 ? '' : '.' + name);

        return name;
    }

    public interpret() {
        const stack: DiscoveryNode<AllNodes>[] = [{ data: this.root, discovered: false }];
        let node: DiscoveryNode<AllNodes>;
        const jumpStack: number[] = [];
        const valueStack: any[] = [];
        const posStack: TextRange[][] = [];
        const stackCopy: { state: DiscoveryNode<AllNodes>[], jump: number[], value: any[], pos: TextRange[][] }[] = [];

        let emptyList = false;

        while (stack.length > 0) {
            stackCopy.push({
                state: JSON.parse(JSON.stringify(stack)),
                jump: JSON.parse(JSON.stringify(jumpStack)),
                value: JSON.parse(JSON.stringify(valueStack)),
                pos: JSON.parse(JSON.stringify(posStack))
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
                    case NodeType.Retrieve:
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

                        // Reverse order
                        for (let idx = node.data.children.length - 1; idx >= 0; idx--)
                            stack.push({ data: node.data.children[idx], discovered: false });

                        //
                        jumpStack.push(valueStack.length);
                        continue;

                    case NodeType.Eval:
                        // Reverse order
                        stack.push({ data: node.data.children[2], discovered: false });
                        stack.push({ data: node.data.children[1], discovered: false });
                        stack.push({ data: node.data.children[0], discovered: false });
                        continue;

                    case NodeType.Access:
                        // Reverse order
                        stack.push({ data: node.data.children[1], discovered: false });
                        stack.push({ data: node.data.children[0], discovered: false });
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

                        if (node.data.type === NodeType.Concat)
                            valueStack.push('');
                        else
                            valueStack.push([]);

                        posStack.push([node.data.range]);
                        break;
                    }

                    if (jumpStack.length === 0) break;
                    const jumpPos = jumpStack.pop()!;

                    const arr = valueStack.splice(jumpPos);

                    if (node.data.type === NodeType.Concat)
                        valueStack.push(arr.join(''));
                    else
                        valueStack.push(arr);

                    const posArr = posStack.splice(jumpPos);
                    const nodes = [];
                    for (const child of posArr)
                        for (const textRange of child)
                            nodes.push(textRange);

                    posStack.push(nodes);
                    break;
                }

                case NodeType.Eval: {
                    // Reverse order
                    const results = valueStack.pop();
                    const args = valueStack.pop();
                    const identity = valueStack.pop();

                    const resultsPos = posStack.pop();
                    const argsPos = posStack.pop();
                    const identityPos = posStack.pop();

                    if (identity === undefined || args === undefined || results === undefined) break;
                    if (identityPos === undefined || argsPos === undefined || resultsPos === undefined) break;

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
                    if (!(node.data.value in this.globals)) {
                        this.errors.push({
                            msg: `${node.data.value} does not exist`,
                            range: node.data.range
                        });
                        break;
                    }

                    valueStack.push(this.globals[node.data.value]);
                    posStack.push([node.data.range]);
                    break;
                }

                case NodeType.Access: {
                    // Reverse order
                    const right = valueStack.pop();
                    const left = valueStack.pop();
                    if (left === undefined || right === undefined) break;

                    if (typeof left !== 'object') {
                        this.errors.push({
                            msg: `${this.getName(node.data)} is a value`,
                            range: node.data.range
                        });
                        break;
                    }

                    if (!(right in left)) {
                        this.errors.push({
                            msg: `${right} does not exist in ${this.getName(node.data)}`,
                            range: node.data.range
                        });
                        break;
                    }

                    valueStack.push(left[right]);
                    posStack.push([node.data.range]);
                    break;
                }
            }

            stack.pop();
        }

        return {
            result: valueStack[0],
            positions: posStack[0],
            errors: this.errors,
            stack: stackCopy
        };
    }
}

/*

"abc"
concat
|- string:a
|- string:b
|- string:c

| # | state         | stack         | value     | jump  | range    |
|___|_______________|_______________|___________|_______|__________|
| 0 | start         | concat      + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 1 | concat        | concat        |           | 0   + |          |
|   |               | string:c    + |           |       |          |
|   |               | string:b    + |           |       |          |
|   |               | string:a    + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 2 | string:a      | concat        | a       + | 0     | 0 1    + |
|   |               | string:c      |           |       |          |
|   |               | concat:b      |           |       |          |
|   |               | string:a    - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 3 | string:b      | concat        | a         | 0     | 0 1      |
|   |               | string:c      | b       + |       | 1 2    + |
|   |               | string:b    - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 4 | string:c      | concat        | a         | 0     | 0 1      |
|   |               | string:c    - | b         |       | 1 2      |
|   |               |               | c       + |       | 2 3    + |
|   |               |               |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 5 | concat        | concat      - | a       - | 0     | 0 1      |
|   |               |               | b       - |       | 1 2      |
|   |               |               | c       - |       | 2 3      |
|   |               |               | abc     + |       |          |
|___|_______________|_______________|___________|_______|__________|

"abcd"
concat
|- string:a
|- concat
|   |- string:b
|   |- string:c
|- string:d

| # | state         | stack         | value     | jump  | range    |
|___|_______________|_______________|___________|_______|__________|
| 0 | start         | concat      + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 1 | concat        | concat        |           | 0   + |          |
|   |               | string:d    + |           |       |          |
|   |               | concat      + |           |       |          |
|   |               | string:a    + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 2 | string:a      | concat        | a       + | 0     | 0 1    + |
|   |               | string:d      |           |       |          |
|   |               | concat        |           |       |          |
|   |               | string:a    - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 3 | concat        | concat        | a         | 0     | 0 1      |
|   |               | string:d      |           | 1   + |          |
|   |               | concat        |           |       |          |
|   |               | string:c    + |           |       |          |
|   |               | string:b    + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 4 | string:b      | concat        | a         | 0     | 0 1      |
|   |               | string:d      | b       + | 1     | 1 2    + |
|   |               | concat        |           |       |          |
|   |               | string:c      |           |       |          |
|   |               | string:b    - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 5 | string:c      | concat        | a         | 0     | 0 1      |
|   |               | string:d      | b         | 1     | 1 2      |
|   |               | concat        | c       + |       | 2 3    + |
|   |               | string:c    - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 6 | concat        | concat        | a         | 0     | 0 1      |
|   |               | string:d      | b       - | 1   - | 1 2      |
|   |               | concat        | c       - |       | 2 3      |
|   |               |               | bc      + |       |          |
|___|_______________|_______________|___________|_______|__________|
| 7 | string:d      | concat        | a         | 0     | 0 1      |
|   |               | string:d    - | bc        |       | 1 2      |
|   |               |               | d       + |       | 2 3      |
|   |               |               |           |       | 3 4    + |
|___|_______________|_______________|___________|_______|__________|
| 8 | concat        | concat      - | a       - | 0   - | 0 1      |
|   |               |               | bc      - |       | 1 2      |
|   |               |               | d       - |       | 2 3      |
|   |               |               | abcd    + |       | 3 4      |
|___|_______________|_______________|___________|_______|__________|

"[x]"
eval
|- retrieve:x
|- args
|- results

| # | state         | stack         | value     | jump  | range    |
|___|_______________|_______________|___________|_______|__________|
| 0 | start         | eval        + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 1 | eval          | eval          |           | 0   + | 1 2    + |
|   |               | results     + |           |       |          |
|   |               | args        + |           |       |          |
|   |               | retrieve:x  + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 2 | retrieve:x    | eval          | .x      + | 0     | 1 2      |
|   |               | results       |           |       |          |
|   |               | args          |           |       |          |
|   |               | retrieve:x  - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 3 | args          | eval          | .x        | 0     | 1 2      |
|   |               | results       | []      + |       |          |
|   |               | args        - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 4 | results       | eval          | .x        | 0     | 1 2      |
|   |               | results     - | []        |       |          |
|   |               |               | []      + |       |          |
|   |               |               |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 5 | eval          | eval        - | .x      - | 0   - | 1 2      |
|   |               |               | []      - |       |          |
|   |               |               | []      - |       |          |
|   |               |               | x       + |       |          |
|___|_______________|_______________|___________|_______|__________|

"[b|T|F]"
eval
|- retrieve:b
|- args
|- results
    |- string:T
    |- string:F

| # | state         | stack         | value     | jump  | range    |
|___|_______________|_______________|___________|_______|__________|
| 0 | start         | eval        + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 1 | eval          | eval          |           | 0   + | 1 6    + |
|   |               | results     + |           |       |          |
|   |               | args        + |           |       |          |
|   |               | retrieve:b  + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 2 | retrieve:b    | eval          | .b        | 0     | 1 6      |
|   |               | results       |           |       |          |
|   |               | args          |           |       |          |
|   |               | retrieve:b  - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 3 | args          | eval          | .b        | 0     | 1 6      |
|   |               | results       |           |       |          |
|   |               | args        - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 4 | results       | eval          | .b        | 0     | 1 6      |
|   |               | results       |           | 1   + |          |
|   |               | string:F    + |           |       |          |
|   |               | string:T    + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 5 | string:T      | eval          | .a        | 0     | 1 6      |
|   |               | results       | T       + | 1     | 3 4    + |
|   |               | string:F      |           |       |          |
|   |               | string:T    - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 6 | string:F      | eval          | .a        | 0     | 1 6      |
|   |               | results       | T         | 1     | 3 4      |
|   |               | string:F    - | F       + |       | 5 6    + |
|___|_______________|_______________|___________|_______|__________|
| 7 | results       | eval          | .a        | 0     | 1 6      |
|   |               | results     - | T       - | 1   - | 3 4      |
|   |               |               | F       - |       | 5 6      |
|   |               |               | [T, F]  + |       |          |
|___|_______________|_______________|___________|_______|__________|
| 8 | eval          | eval        - | .a      - | 0   - | 1 6    - |
|   |               |               | [T, F]  - |       | 3 4      |
|   |               |               | T       + |       | 5 6    - |
|___|_______________|_______________|___________|_______|__________|

"[x 1]"
eval
|- retrieve:x
|- args
|   |- number:1
|- results

| # | state         | stack         | value     | jump  | range    |
|___|_______________|_______________|___________|_______|__________|
| 0 | start         | eval        + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 1 | eval          | eval          |           | 0   + | 1 4    + |
|   |               | results     + |           |       |          |
|   |               | args        + |           |       |          |
|   |               | retrieve:x  + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 2 | retrieve:x    | eval          | .x        | 0     | 1 4      |
|   |               | results       |           |       |          |
|   |               | args          |           |       |          |
|   |               | retrieve:x  - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 3 | args          | eval          | .a        | 0     | 1 4      |
|   |               | results       |           | 1   + |          |
|   |               | args          |           |       |          |
|   |               | number:1    + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 4 | number:1      | eval          | .a        | 0     | 1 4      |
|   |               | results       | 1       + | 1     |          |
|   |               | args          |           |       |          |
|   |               | number:1    - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 5 | args          | eval          | .a        | 0     | 1 4      |
|   |               | results       | 1       - | 1   - |          |
|   |               | args        - | [1]     + |       |          |
|___|_______________|_______________|___________|_______|__________|
| 6 | results       | eval          | .a        | 0     | 1 4      |
|   |               | results     - | [1]       |       |          |
|   |               |               | []      + |       |          |
|___|_______________|_______________|___________|_______|__________|
| 7 | eval          | eval        - | .a      - | 0   - | 1 4      |
|   |               |               | [1]     - |       |          |
|   |               |               | []      - |       |          |
|   |               |               | 1       + |       |          |
|___|_______________|_______________|___________|_______|__________|

"[a.b]"
eval
|- access
|   |- retrieve:a
|   |- identity:b
|- args
|- results

| # | state         | stack         | value     | jump  | range    |
|___|_______________|_______________|___________|_______|__________|
| 0 | start         | eval        + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 1 | eval          | eval          |           | 0   + | 1 4    + |
|   |               | results     + |           |       |          |
|   |               | args        + |           |       |          |
|   |               | access      + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 2 | access        | eval          |           | 0     | 1 4      |
|   |               | results       |           |       |          |
|   |               | args          |           |       |          |
|   |               | access        |           |       |          |
|   |               | identity:a  + |           |       |          |
|   |               | retrieve:b  + |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 3 | retrieve:a    | eval          | .a      + | 0     | 1 4      |
|   |               | results       |           |       |          |
|   |               | args          |           |       |          |
|   |               | access        |           |       |          |
|   |               | identity:b    |           |       |          |
|   |               | retrieve:a  - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 4 | identity:b    | eval          | .a        | 0     | 1 4      |
|   |               | results       | b       + |       |          |
|   |               | args          |           |       |          |
|   |               | access        |           |       |          |
|   |               | identity:b  - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 5 | access        | eval          | .a      - | 0     | 1 4      |
|   |               | results       | b       - |       |          |
|   |               | args          | .a.b    + |       |          |
|   |               | access      - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 6 | args          | eval          | .a.b      | 0     | 1 4      |
|   |               | results       | []      + |       |          |
|   |               | args        - |           |       |          |
|___|_______________|_______________|___________|_______|__________|
| 7 | results       | eval          | .a.b      |       | 1 4      |
|   |               | results     - | []        |       |          |
|   |               |               | []      + |       |          |
|___|_______________|_______________|___________|_______|__________|
| 8 | eval          | eval        - | .a.b    - |       | 1 4      |
|   |               |               | []      - |       |          |
|   |               |               | []      - |       |          |
|   |               |               | b       + |       |          |
|___|_______________|_______________|___________|_______|__________|

*/
