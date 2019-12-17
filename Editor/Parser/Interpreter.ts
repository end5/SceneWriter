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
        const posStack: (TextRange | TextRange[])[] = [];
        const stackCopy: { state: DiscoveryNode<AllNodes>[], jump: number[], value: any[], pos: TextRange[][] }[] = [];

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
                        // Don't process nodes with no children
                        if (node.data.children.length === 0) {
                            stack.pop();
                            continue;
                        }

                        // Reverse order
                        for (let idx = node.data.children.length - 1; idx >= 0; idx--)
                            stack.push({ data: node.data.children[idx], discovered: false });

                        //
                        jumpStack.push(valueStack.length);
                        continue;

                    case NodeType.Args:
                    case NodeType.Results:
                        // Does not process
                        stack.pop();

                        // Reverse order
                        if (node.data.children.length > 0)
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
                        posStack.push(node.data.range);
                        continue;

                    case NodeType.Access:
                        // Reverse order
                        stack.push({ data: node.data.children[1], discovered: false });
                        stack.push({ data: node.data.children[0], discovered: false });
                        continue;
                }
            }

            // console.log(node.data.type + ' ' + node.data.value);
            // Process Section
            switch (node.data.type) {
                case NodeType.Number:
                case NodeType.String:
                    posStack.push(node.data.range);
                case NodeType.Identity:
                    valueStack.push(node.data.value);
                    break;

                case NodeType.Args:
                case NodeType.Results:
                case NodeType.Error:
                    break;

                case NodeType.Concat: {
                    if (jumpStack.length === 0) break;
                    const jumpPos = jumpStack.pop()!;

                    if (node.data.type === NodeType.Concat)
                        valueStack.push(valueStack.splice(jumpPos).join(''));
                    else
                        valueStack.push(valueStack.splice(jumpPos));

                    const posArr = posStack.splice(jumpPos);
                    const nodes = [];
                    for (const child of posArr)
                        if (Array.isArray(child))
                            nodes.push(...child);
                        else
                            nodes.push(child);

                    posStack.push(nodes);

                    break;
                }

                case NodeType.Eval: {
                    // Reverse order
                    if (jumpStack.length < 2) break;
                    const jumpPosResults = jumpStack.pop()!;
                    const jumpPosArgs = jumpStack.pop()!;

                    const results = valueStack.splice(jumpPosResults);
                    const args = valueStack.splice(jumpPosArgs);
                    const identity = valueStack.pop();

                    const resultsPos = posStack.splice(jumpPosResults);
                    const argsPos = posStack.splice(jumpPosArgs);
                    const evalPos = posStack.pop();

                    if (typeof identity === 'function') {
                        const result = identity(args, results);
                        if (typeof result === 'object' && 'selector' in result && results[result.selector]) {
                            valueStack.push(results[result.selector]);
                            posStack.push(resultsPos[result.selector]);
                        }
                        else {
                            valueStack.push(result + '');
                            posStack.push(node.data.range);
                        }
                    }
                    else if (typeof identity === 'boolean') {
                        if (identity && results[0]) {
                            valueStack.push(results[0]);
                            posStack.push(resultsPos[0]);
                        }
                        else if (!identity && results[1]) {
                            valueStack.push(results[1]);
                            posStack.push(resultsPos[1]);
                        }
                        else {
                            valueStack.push('');
                            posStack.push(node.data.range);
                        }
                    }
                    else {
                        valueStack.push(identity + '');
                        posStack.push(node.data.range);
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
                    break;
                }
            }

            stack.pop();
        }

        return {
            result: valueStack[0] + '',
            ranges: (Array.isArray(posStack[0]) ? posStack[0] : [posStack[0]]) as TextRange[],
            code: '',
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

| # | state         | stack         | value     | jump  | range             |
|___|_______________|_______________|___________|_______|___________________|
| 0 | start         | concat      + |           |       |                   |
|___|_______________|_______________|___________|_______|___________________|
| 1 | concat        | concat        |           | 0   + |                   |
|   |               | string:c    + |           |       |                   |
|   |               | string:b    + |           |       |                   |
|   |               | string:a    + |           |       |                   |
|___|_______________|_______________|___________|_______|___________________|
| 2 | string:a      | concat        | a       + | 0     | 0 1             + |
|   |               | string:c      |           |       |                   |
|   |               | concat:b      |           |       |                   |
|   |               | string:a    - |           |       |                   |
|___|_______________|_______________|___________|_______|___________________|
| 3 | string:b      | concat        | a         | 0     | 0 1               |
|   |               | string:c      | b       + |       | 1 2             + |
|   |               | string:b    - |           |       |                   |
|___|_______________|_______________|___________|_______|___________________|
| 4 | string:c      | concat        | a         | 0     | 0 1               |
|   |               | string:c    - | b         |       | 1 2               |
|   |               |               | c       + |       | 2 3             + |
|   |               |               |           |       |                   |
|___|_______________|_______________|___________|_______|___________________|
| 5 | concat        | concat      - | a       - | 0     | 0 1             - |
|   |               |               | b       - |       | 1 2             - |
|   |               |               | c       - |       | 2 3             - |
|   |               |               | abc     + |       | [0 1, 2 3, 3 4] + |
|___|_______________|_______________|___________|_______|___________________|

"abcd"
concat
|- string:a
|- concat
|   |- string:b
|   |- string:c
|- string:d

| # | state         | stack         | value     | jump  | range                 |
|___|_______________|_______________|___________|_______|_______________________|
| 0 | start         | concat      + |           |       |                       |
|___|_______________|_______________|___________|_______|_______________________|
| 1 | concat        | concat        |           | 0   + |                       |
|   |               | string:d    + |           |       |                       |
|   |               | concat      + |           |       |                       |
|   |               | string:a    + |           |       |                       |
|___|_______________|_______________|___________|_______|_______________________|
| 2 | string:a      | concat        | a       + | 0     | 0 1                 + |
|   |               | string:d      |           |       |                       |
|   |               | concat        |           |       |                       |
|   |               | string:a    - |           |       |                       |
|___|_______________|_______________|___________|_______|_______________________|
| 3 | concat        | concat        | a         | 0     | 0 1                   |
|   |               | string:d      |           | 1   + |                       |
|   |               | concat        |           |       |                       |
|   |               | string:c    + |           |       |                       |
|   |               | string:b    + |           |       |                       |
|___|_______________|_______________|___________|_______|_______________________|
| 4 | string:b      | concat        | a         | 0     | 0 1                   |
|   |               | string:d      | b       + | 1     | 1 2                 + |
|   |               | concat        |           |       |                       |
|   |               | string:c      |           |       |                       |
|   |               | string:b    - |           |       |                       |
|___|_______________|_______________|___________|_______|_______________________|
| 5 | string:c      | concat        | a         | 0     | 0 1                   |
|   |               | string:d      | b         | 1     | 1 2                   |
|   |               | concat        | c       + |       | 2 3                 + |
|   |               | string:c    - |           |       |                       |
|___|_______________|_______________|___________|_______|_______________________|
| 6 | concat        | concat        | a         | 0     | 0 1                   |
|   |               | string:d      | b       - | 1   - | 1 2                 - |
|   |               | concat        | c       - |       | 2 3                 - |
|   |               |               | bc      + |       | [1 2, 2 3]          + |
|___|_______________|_______________|___________|_______|_______________________|
| 7 | string:d      | concat        | a         | 0     | 0 1                   |
|   |               | string:d    - | bc        |       | [1 2, 2 3]            |
|   |               |               | d       + |       | 3 4                 + |
|___|_______________|_______________|___________|_______|_______________________|
| 8 | concat        | concat      - | a       - | 0   - | 0 1                 - |
|   |               |               | bc      - |       | [1 2, 2 3]          - |
|   |               |               | d       - |       | 3 4                 - |
|   |               |               | abcd    + |       | [0 1, 1 2, 2 3, 3 4]+ |
|___|_______________|_______________|___________|_______|_______________________|

"[x]"
eval
|- retrieve:x
|- args
|- results

| # | state         | stack         | value     | jump  | range         |
|___|_______________|_______________|___________|_______|_______________|
| 0 | start         | eval        + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 1 | eval          | eval          |           |       | 1 2         + |
|   |               | results     + |           |       |               |
|   |               | args        + |           |       |               |
|   |               | retrieve:x  + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 2 | retrieve:x    | eval          | .x      + |       | 1 2           |
|   |               | results       |           |       |               |
|   |               | args          |           |       |               |
|   |               | retrieve:x  - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 3 | args          | eval          | .x        | 0   + | 1 2           |
|   |               | results       |           |       |               |
|   |               | args        - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 4 | results       | eval          | .x        | 0     | 1 2           |
|   |               | results     - |           | 0   + |               |
|   |               |               |           |       |               |
|   |               |               |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 5 | eval          | eval        - | .x      - | 0   - | 1 2           |
|   |               |               | x       + | 0   - |               |
|___|_______________|_______________|___________|_______|_______________|

"[b|T|F]"
eval
|- retrieve:b
|- args
|- results
    |- string:T
    |- string:F

| # | state         | stack         | value     | jump  | range         |
|___|_______________|_______________|___________|_______|_______________|
| 0 | start         | eval        + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 1 | eval          | eval          |           |       | 1 6         + |
|   |               | results     + |           |       |               |
|   |               | args        + |           |       |               |
|   |               | retrieve:b  + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 2 | retrieve:b    | eval          | .b        |       | 1 6           |
|   |               | results       |           |       |               |
|   |               | args          |           |       |               |
|   |               | retrieve:b  - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 3 | args          | eval          | .b        | 1   + | 1 6           |
|   |               | results       |           |       |               |
|   |               | args        - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 4 | results       | eval          | .b        | 1     | 1 6           |
|   |               | results     - |           | 1   + |               |
|   |               | string:F    + |           |       |               |
|   |               | string:T    + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 5 | string:T      | eval          | .b        | 1     | 1 6           |
|   |               | results       | T       + | 1     | 3 4         + |
|   |               | string:F      |           |       |               |
|   |               | string:T    - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 6 | string:F      | eval          | .b        | 1     | 1 6           |
|   |               | results       | T         | 1     | 3 4           |
|   |               | string:F    - | F       + |       | 5 6         + |
|___|_______________|_______________|___________|_______|_______________|
| 7 | eval          | eval        - | .b      - | 1   - | 1 6         - |
|   |               |               | T         | 1   - | 3 4           |
|   |               |               | F       - |       | 5 6         - |
|___|_______________|_______________|___________|_______|_______________|

"[x 1]"
eval
|- retrieve:x
|- args
|   |- number:1
|- results

| # | state         | stack         | value     | jump  | range         |
|___|_______________|_______________|___________|_______|_______________|
| 0 | start         | eval        + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 1 | eval          | eval          |           |       | 1 4         + |
|   |               | results     + |           |       |               |
|   |               | args        + |           |       |               |
|   |               | retrieve:x  + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 2 | retrieve:x    | eval          | .x        |       | 1 4           |
|   |               | results       |           |       |               |
|   |               | args          |           |       |               |
|   |               | retrieve:x  - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 3 | args          | eval          | .x        | 1   + | 1 4           |
|   |               | results       |           |       |               |
|   |               | args        - |           |       |               |
|   |               | number:1    + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 4 | number:1      | eval          | .x        | 1     | 1 4           |
|   |               | results       | 1       + |       | 3 4         + |
|   |               | number:1    - |           |       |               |
|   |               |               |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 5 | results       | eval          | .x        | 1     | 1 4           |
|   |               | results     - | 1         | 2   + | 3 4           |
|   |               |               |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 6 | eval          | eval        - | .x      - | 1   - | 1 4           |
|   |               |               | 1       - | 2   - | 3 4         - |
|   |               |               | x1      + |       |               |
|___|_______________|_______________|___________|_______|_______________|

"[a.b]"
eval
|- access
|   |- retrieve:a
|   |- identity:b
|- args
|- results

| # | state         | stack         | value     | jump  | range         |
|___|_______________|_______________|___________|_______|_______________|
| 0 | start         | eval        + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 1 | eval          | eval          |           |       | 1 4         + |
|   |               | results     + |           |       |               |
|   |               | args        + |           |       |               |
|   |               | access      + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 2 | access        | eval          |           |       | 1 4           |
|   |               | results       |           |       |               |
|   |               | args          |           |       |               |
|   |               | access        |           |       |               |
|   |               | identity:a  + |           |       |               |
|   |               | retrieve:b  + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 3 | retrieve:a    | eval          | .a      + |       | 1 4           |
|   |               | results       |           |       |               |
|   |               | args          |           |       |               |
|   |               | access        |           |       |               |
|   |               | identity:b    |           |       |               |
|   |               | retrieve:a  - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 4 | identity:b    | eval          | .a        |       | 1 4           |
|   |               | results       | b       + |       |               |
|   |               | args          |           |       |               |
|   |               | access        |           |       |               |
|   |               | identity:b  - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 5 | access        | eval          | .a      - |       | 1 4           |
|   |               | results       | b       - |       |               |
|   |               | args          | .a.b    + |       |               |
|   |               | access      - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 6 | args          | eval          | .a.b      | 0   + | 1 4           |
|   |               | results       |           |       |               |
|   |               | args        - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 7 | results       | eval          | .a.b      | 0     | 1 4           |
|   |               | results     - |           | 0   + |               |
|   |               |               |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 8 | eval          | eval        - | .a.b    - | 0   - | 1 4           |
|   |               |               | b       + | 0   - |               |
|___|_______________|_______________|___________|_______|_______________|

"[b|Tr|Fa]"
eval
|- retrieve:b
|- args
|- results
    |- concat
    |   |- string:T
    |   |- string:r
    |- concat
        |- string:F
        |- string:a

| # | state         | stack         | value     | jump  | range         |
|___|_______________|_______________|___________|_______|_______________|
| 0 | start         | eval        + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 1 | eval          | eval          |           |       | 1 6         + |
|   |               | results     + |           |       |               |
|   |               | args        + |           |       |               |
|   |               | retrieve:b  + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 2 | retrieve:b    | eval          | .b        |       | 1 6           |
|   |               | results       |           |       |               |
|   |               | args          |           |       |               |
|   |               | retrieve:b  - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 3 | args          | eval          | .b        | 1   + | 1 6           |
|   |               | results       |           |       |               |
|   |               | args        - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 4 | results       | eval          | .b        | 1     | 1 6           |
|   |               | results     - |           | 1   + |               |
|   |               | concat      + |           |       |               |
|   |               | concat      + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 5 | concat        | eval          | .b        | 1     | 1 6           |
|   |               | concat        |           | 1     |               |
|   |               | concat        |           | 1   + |               |
|   |               | string:r    + |           |       |               |
|   |               | string:T    + |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 6 | string:T      | eval          | .b        | 1     | 1 6           |
|   |               | concat        | T       + | 1     | 3 4         + |
|   |               | concat        |           | 1     |               |
|   |               | string:r      |           |       |               |
|   |               | string:T    - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 7 | string:r      | eval          | .b        | 1     | 1 6           |
|   |               | concat        | T         | 1     | 3 4           |
|   |               | concat        | r       + | 1     | 4 5         + |
|   |               | string:r    - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
| 8 | concat        | eval          | .b        | 1     | 1 6           |
|   |               | concat        | T       - | 1     | 3 4         - |
|   |               | concat      - | r       - | 1   - | 4 5         - |
|   |               |               | Tr      + |       | [3 4, 4 5]  + |
|___|_______________|_______________|___________|_______|_______________|
| 9 | concat        | eval          | .b        | 1     | 1 6           |
|   |               | concat        | Tr        | 1     | [3 4, 4 5]    |
|   |               | string:a      |           | 1   + |               |
|   |               | string:F      |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
|10 | string:F      | eval          | .b        | 1     | 1 6           |
|   |               | concat        | Tr        | 1     | [3 4, 4 5]    |
|   |               | string:a      | F       + | 1     | 5 6         + |
|   |               | string:F    - |           |       |               |
|___|_______________|_______________|___________|_______|_______________|
|11 | string:a      | eval          | .b        | 1     | 1 6           |
|   |               | concat        | Tr        | 1     | [3 4, 4 5]    |
|   |               | string:a    - | F         | 1     | 5 6           |
|   |               |               | a       + |       | 6 7         + |
|___|_______________|_______________|___________|_______|_______________|
|12 | concat        | eval          | .b        | 1     | 1 6           |
|   |               | concat      - | Tr        | 1     | [3 4, 4 5]    |
|   |               |               | F       - | 1   - | 5 6         - |
|   |               |               | a       - |       | 6 7         - |
|   |               |               | Fa      + |       | [5 6, 6 7]  + |
|___|_______________|_______________|___________|_______|_______________|
|13 | eval          | eval        - | .b      - | 1   - | 1 6         - |
|   |               |               | Tr        | 1   - | [3 4, 4 5]    |
|   |               |               | Fa      - |       | [5 6, 6 7]  - |
|   |               |               |           |       |               |
|___|_______________|_______________|___________|_______|_______________|

*/
