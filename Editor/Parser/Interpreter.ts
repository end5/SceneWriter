import { AccessNode, AllNodes, NodeType, RetrieveNode } from "./Node";
import { TextRange } from './TextRange';

export interface InterpretError {
    range: TextRange;
    msg: string;
}

interface DiscoveryNode<T> {
    data: T;
    discovered: boolean;
}

const escapePairs: [RegExp, string][] = [[/\n/g, '\\n'], [/'/g, '\\\''], [/"/g, '\\"']];

export class Interpreter {
    private errors: InterpretError[] = [];
    private globals: Record<string, any>;
    private root: AllNodes;

    public constructor(root: AllNodes, globals: Record<string, any>) {
        this.globals = globals;
        this.root = root;
    }

    private getName(node: AccessNode | RetrieveNode) {
        let name = '';
        let cur = node;
        while (cur.type === NodeType.Access) {
            name = cur.children[1].value + (name.length === 0 ? '' : '.' + name);
            cur = cur.children[0];
        }
        name = cur.value + (name.length === 0 ? '' : '.' + name);

        return name;
    }

    private getToCode(arr: string[]) {
        let obj = this.globals;
        for (let idx = 0; idx < arr.length; idx++) {
            if (!(arr[idx] in obj)) return;
            if (idx === arr.length - 1)
                obj = obj[arr[idx] + '__toCode'];
            else
                obj = obj[arr[idx]];
        }
        if (typeof obj !== 'function') return;
        return obj as (args: string[], results: string[]) => string;
    }

    public interpret() {
        const stack: DiscoveryNode<AllNodes>[] = [{ data: this.root, discovered: false }];
        let node: DiscoveryNode<AllNodes>;
        const jumpStack: number[] = [];
        const valueStack: any[] = [];
        const rangeStack: (TextRange | TextRange[])[] = [];
        const codeStack: string[] = [];
        // For debugging
        // const stackCopy: {
        //     state: typeof stack,
        //     value: typeof valueStack,
        //     jump: typeof jumpStack,
        //     pos: typeof posStack,
        //     code: typeof codeStack
        // }[] = [];

        while (stack.length > 0) {
            // For debugging
            // stackCopy.push({
            //     state: JSON.parse(JSON.stringify(stack)),
            //     jump: JSON.parse(JSON.stringify(jumpStack)),
            //     value: JSON.parse(JSON.stringify(valueStack)),
            //     pos: JSON.parse(JSON.stringify(posStack)),
            //     code: JSON.parse(JSON.stringify(codeStack))
            // });

            node = stack[stack.length - 1];

            // Discover Section
            if (!node.discovered) {
                node.discovered = true;
                switch (node.data.type) {
                    // No children, so nothing to discover
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

                        // This pos helps the stack from becoming unstable
                        rangeStack.push(node.data.range);
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
                case NodeType.String:
                    rangeStack.push(node.data.range);
                    valueStack.push(node.data.value);
                    // Always escape strings
                    codeStack.push('"' + escapePairs.reduce((str, pair) => str.replace(pair[0], pair[1]), node.data.value) + '"');
                    break;

                case NodeType.Number:
                case NodeType.Identity:
                    valueStack.push(node.data.value);
                    codeStack.push(node.data.value + '');
                    break;

                case NodeType.Args:
                case NodeType.Results:
                case NodeType.Error:
                    break;

                case NodeType.Concat: {
                    if (jumpStack.length === 0) return 'Attempted to get value from empty jumpStack';
                    const jumpPos = jumpStack.pop()!;

                    valueStack.push(valueStack.splice(jumpPos).join(''));

                    // Flatten ranges
                    const rangeArr = rangeStack.splice(jumpPos);
                    const nodes = [];
                    for (const child of rangeArr)
                        if (Array.isArray(child))
                            nodes.push(...child);
                        else
                            nodes.push(child);

                    rangeStack.push(nodes);

                    const codeArr = codeStack.splice(jumpPos);
                    codeStack.push(codeArr.join(' + '));

                    break;
                }

                case NodeType.Eval: {
                    // Reverse order
                    if (jumpStack.length < 2) return 'Attempted to get 2 values from empty jumpStack';
                    const jumpPosResults = jumpStack.pop()!;
                    const jumpPosArgs = jumpStack.pop()!;

                    const results = valueStack.splice(jumpPosResults);
                    const args = valueStack.splice(jumpPosArgs);
                    const identity = valueStack.pop();

                    const resultsPos = rangeStack.splice(jumpPosResults);
                    // Not used but still need to be removed from the stack
                    const argsPos = rangeStack.splice(jumpPosArgs);
                    const evalPos = rangeStack.pop();

                    if (typeof identity === 'function') {
                        const result = identity(args, results);
                        // Handle selecting from results here
                        if (typeof result === 'object' && 'selector' in result && results[result.selector]) {
                            valueStack.push(results[result.selector]);
                            rangeStack.push(resultsPos[result.selector]);
                        }
                        else {
                            valueStack.push(result + '');
                            rangeStack.push(node.data.range);
                        }
                    }
                    else if (typeof identity === 'boolean') {
                        // condition ? [result1] : result2
                        if (identity && results[0]) {
                            valueStack.push(results[0]);
                            rangeStack.push(resultsPos[0]);
                        }
                        // condition ? result1 : [result2]
                        else if (!identity && results[1]) {
                            valueStack.push(results[1]);
                            rangeStack.push(resultsPos[1]);
                        }
                        // condition ? result1 : []
                        // condition ? [] : result2
                        else {
                            valueStack.push('');
                            rangeStack.push(node.data.range);
                        }
                    }
                    else {
                        valueStack.push(identity + '');
                        rangeStack.push(node.data.range);
                    }

                    const resultsCode = codeStack.splice(jumpPosResults);
                    const argsCode = codeStack.splice(jumpPosArgs);
                    const identityCode = codeStack.pop();
                    if (!identityCode) return 'Identity not found on codeStack';

                    // Get toCode function
                    const toCodeFunc = this.getToCode(identityCode.split('.'));

                    if (toCodeFunc) {
                        codeStack.push(toCodeFunc(argsCode, resultsCode));
                    }
                    else {
                        // Defaults
                        // type function        -> identity()
                        // type other           -> identity
                        // args + results       -> identity([arg0, arg1, ...], [result0, result1, ...])
                        // args                 -> identity(arg0, arg1, ...)
                        // type bool + results  -> identity ? result0 : (result1 or "")
                        // results              -> identity(result0, result1, ...)
                        if (argsCode.length === 0 && resultsCode.length === 0) {
                            if (typeof identity === 'function')
                                codeStack.push(identityCode + '()');
                            else
                                codeStack.push(identityCode);
                        }
                        else if (argsCode.length > 0 && resultsCode.length > 0)
                            codeStack.push(`${identityCode}([${argsCode.join(', ')}], [${resultsCode.join(', ')}])`);
                        else if (argsCode.length > 0)
                            codeStack.push(`${identityCode}(${argsCode.join(', ')})`);
                        else {
                            if (typeof identity === 'boolean' && (resultsCode.length === 1 || resultsCode.length === 2))
                                codeStack.push(`(${identityCode} ? ${resultsCode[0]} : ${resultsCode[1] || '""'})`);
                            else
                                codeStack.push(`${identityCode}(${resultsCode.join(', ')})`);
                        }
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

                    codeStack.push(node.data.value);
                    break;
                }

                case NodeType.Access: {
                    // Reverse order
                    const right = valueStack.pop();
                    const left = valueStack.pop();

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

                    const rightCode = codeStack.pop();
                    const leftCode = codeStack.pop();

                    codeStack.push(leftCode + '.' + rightCode);

                    break;
                }
            }

            stack.pop();
        }

        return {
            result: valueStack[0] + '',
            ranges: (Array.isArray(rangeStack[0]) ? rangeStack[0] : [rangeStack[0]]) as TextRange[],
            code: codeStack[0],
            errors: this.errors,
            // For debugging
            // stack: stackCopy
        };
    }
}
