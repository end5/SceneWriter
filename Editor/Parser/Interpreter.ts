import { AllNodes, NodeType, RetrieveNode } from "./Node";
import { TextRange } from './TextRange';

export interface InterpretError {
    range: TextRange;
    msg: string;
}

interface DiscoveryNode<T> {
    data: T;
    discovered: boolean;
}

interface State {
    nodes: DiscoveryNode<AllNodes>[];
    value: any[];
    jump: number[];
    range: (TextRange | TextRange[])[];
    code: string[];
}

const escapePairs: [RegExp, string][] = [[/\n/g, '\\n'], [/'/g, '\\\''], [/"/g, '\\"']];

export class Interpreter {
    private errors: InterpretError[] = [];
    private state: State;
    // For debugging
    private stackCopy: State[] = [];

    private readonly valueOffset = 2;

    public constructor() {
        this.state = this.createStack();
    }

    private createStack(): State {
        return {
            nodes: [],
            value: [],
            jump: [],
            range: [],
            code: []
        };
    }

    private storeStack() {
        this.stackCopy.push({
            nodes: JSON.parse(JSON.stringify(this.state.nodes)),
            jump: JSON.parse(JSON.stringify(this.state.jump)),
            value: JSON.parse(JSON.stringify(this.state.value)),
            range: JSON.parse(JSON.stringify(this.state.range)),
            code: JSON.parse(JSON.stringify(this.state.code))
        });
    }

    private createResult() {
        return {
            result: this.state.value[0] + '',
            ranges: (Array.isArray(this.state.range[0]) ? this.state.range[0] : [this.state.range[0]]) as TextRange[],
            code: this.state.code[0],
            errors: this.errors,
            // For debugging
            stack: this.stackCopy
        };
    }

    private getName(node: RetrieveNode) {
        return node.children.map((child) => child.value).join('.');
    }

    public interpret(root: AllNodes, globals: Record<string, any>) {
        this.state = this.createStack();
        this.state.nodes.push({ data: root, discovered: false });

        let node: DiscoveryNode<AllNodes>;

        while (this.state.nodes.length > 0) {
            // For debugging
            this.storeStack();

            node = this.state.nodes[this.state.nodes.length - 1];

            // Discover Section
            if (!node.discovered) {
                node.discovered = true;
                switch (node.data.type) {
                    // No children, so nothing to discover
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
                        // Don't process nodes with no children
                        if (node.data.children.length === 0) {
                            this.state.nodes.pop();
                            continue;
                        }

                        // Reverse order
                        if (node.data.children.length > 0)
                            for (let idx = node.data.children.length - 1; idx >= 0; idx--)
                                this.state.nodes.push({ data: node.data.children[idx], discovered: false });

                        //
                        this.state.jump.push(this.state.value.length - this.valueOffset);
                        continue;

                    case NodeType.Args:
                    case NodeType.Results:
                        // Does not process
                        this.state.nodes.pop();

                        // Reverse order
                        if (node.data.children.length > 0)
                            for (let idx = node.data.children.length - 1; idx >= 0; idx--)
                                this.state.nodes.push({ data: node.data.children[idx], discovered: false });

                        //
                        this.state.jump.push(this.state.value.length - this.valueOffset);
                        continue;

                    case NodeType.Eval:
                        // Reverse order
                        this.state.nodes.push({ data: node.data.children[2], discovered: false });
                        this.state.nodes.push({ data: node.data.children[1], discovered: false });
                        this.state.nodes.push({ data: node.data.children[0], discovered: false });

                        // This range helps the stack from becoming unstable
                        this.state.range.push(node.data.range);
                        continue;

                    case NodeType.Retrieve:
                        // Reverse order
                        if (node.data.children.length > 0)
                            for (let idx = node.data.children.length - 1; idx >= 0; idx--)
                                this.state.nodes.push({ data: node.data.children[idx], discovered: false });

                        //
                        this.state.jump.push(this.state.value.length - this.valueOffset);
                        continue;
                }
            }

            // Process Section
            switch (node.data.type) {
                case NodeType.String:
                    this.state.range.push(node.data.range);
                    this.state.value.push(node.data.value);
                    // Always escape strings
                    this.state.code.push('"' + escapePairs.reduce((str, pair) => str.replace(pair[0], pair[1]), node.data.value) + '"');
                    break;

                case NodeType.Number:
                    this.state.range.push(node.data.range);

                case NodeType.Identity:
                    this.state.value.push(node.data.value);
                    this.state.code.push(node.data.value + '');
                    break;

                case NodeType.Args:
                case NodeType.Results:
                case NodeType.Error:
                    break;

                case NodeType.Concat: {
                    if (this.state.jump.length === 0) {
                        this.errors.push({
                            msg: 'Attempted to get value from empty jump stack',
                            range: node.data.range
                        });
                        return this.createResult();
                    }
                    const jumpPos = this.state.jump.pop()!;

                    this.state.value.push(this.state.value.splice(jumpPos).join(''));

                    // Flatten ranges
                    const rangeArr = this.state.range.splice(jumpPos);
                    const nodes = [];
                    for (const child of rangeArr)
                        if (Array.isArray(child))
                            nodes.push(...child);
                        else
                            nodes.push(child);

                    this.state.range.push(nodes);

                    const codeArr = this.state.code.splice(jumpPos);
                    this.state.code.push(codeArr.join(' + '));

                    break;
                }

                case NodeType.Eval: {
                    // Reverse order
                    if (this.state.jump.length < 2) {
                        this.errors.push({
                            msg: 'Attempted to get 2 values from empty jump stack',
                            range: node.data.range
                        });
                        return this.createResult();
                    }
                    const jumpPosResults = this.state.jump.pop()!;
                    const jumpPosArgs = this.state.jump.pop()!;

                    const results = this.state.value.splice(jumpPosResults);
                    const args = this.state.value.splice(jumpPosArgs);
                    const retrieveInfo = this.state.value.pop();
                    const retrieve = this.state.value.pop();

                    // -1 because of the extra "info" on the value stack
                    const resultsPos = this.state.range.splice(jumpPosResults - 1);
                    // Not used but still need to be removed from the stack
                    this.state.range.splice(jumpPosArgs - 1);
                    this.state.range.pop();

                    const errorCount = this.errors.length;

                    // Error checking
                    if (typeof retrieve === 'function') {
                        if (typeof retrieveInfo === 'object') {
                            if ('argsCount' in retrieveInfo && args.length < retrieveInfo.argsCount) {
                                this.errors.push({
                                    msg: `${this.getName(node.data.children[0])} needs ${args.length - retrieveInfo.argsCount} more args`,
                                    range: node.data.range
                                });
                            }
                            if ('resultsCount' in retrieveInfo && results.length < retrieveInfo.resultsCount) {
                                this.errors.push({
                                    msg: `${this.getName(node.data.children[0])} needs ${results.length - retrieveInfo.resultsCount} more results`,
                                    range: node.data.range
                                });
                            }
                        }
                    }
                    else if (typeof retrieve === 'boolean') {
                        if (results.length == 0) {
                            this.errors.push({
                                msg: this.getName(node.data.children[0]) + ' needs at least 1 result',
                                range: node.data.range
                            });
                        }
                        else if (results.length > 2) {
                            this.errors.push({
                                msg: this.getName(node.data.children[0]) + ' can have up to 2 results',
                                range: node.data.range
                            });
                        }
                    }
                    else if (typeof retrieve === 'object' || retrieve === null || retrieve === undefined) {
                        this.errors.push({
                            msg: `${this.getName(node.data.children[0])} cannot be displayed`,
                            range: node.data.range
                        });
                    }

                    if (errorCount === this.errors.length) {
                        if (typeof retrieve === 'function') {
                            const result = retrieve(args, results);
                            // Handle selecting from results here
                            if (typeof result === 'object' && 'selector' in result && results[result.selector]) {
                                this.state.value.push(results[result.selector]);
                                this.state.range.push(resultsPos[result.selector]);
                            }
                            else {
                                this.state.value.push(result + '');
                                this.state.range.push(node.data.range);
                            }
                        }
                        else if (typeof retrieve === 'boolean') {
                            // condition ? [result1] : result2
                            if (retrieve && results.length > 0 && results[0]) {
                                this.state.value.push(results[0]);
                                this.state.range.push(resultsPos[0]);
                            }
                            // condition ? result1 : [result2]
                            else if (!retrieve && results.length > 1 && results[1]) {
                                this.state.value.push(results[1]);
                                this.state.range.push(resultsPos[1]);
                            }
                            // condition ? result1 : []
                            // condition ? [] : result2
                            else {
                                this.state.value.push('');
                                this.state.range.push(node.data.range);
                            }
                        }
                        else {
                            this.state.value.push(retrieve + '');
                            this.state.range.push(node.data.range);
                        }
                    }
                    else {
                        this.state.value.push('');
                        this.state.range.push(node.data.range);
                    }

                    // -1 because of the extra "info" on the value stack
                    const resultsCode = this.state.code.splice(jumpPosResults - 1);
                    const argsCode = this.state.code.splice(jumpPosArgs - 1);
                    const retrieveCode = this.state.code.pop();
                    if (!retrieveCode) {
                        this.errors.push({
                            msg: 'Retrieve code not found on code stack',
                            range: node.data.range
                        });
                        return this.createResult();
                    }

                    if (typeof retrieveInfo === 'object' && 'toCode' in retrieveInfo) {
                        this.state.code.push(retrieveInfo.toCode(argsCode, resultsCode));
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
                            if (typeof retrieve === 'function')
                                this.state.code.push(retrieveCode + '()');
                            else
                                this.state.code.push(retrieveCode);
                        }
                        else if (argsCode.length > 0 && resultsCode.length > 0)
                            this.state.code.push(`${retrieveCode}([${argsCode.join(', ')}], [${resultsCode.join(', ')}])`);
                        else if (argsCode.length > 0)
                            this.state.code.push(`${retrieveCode}(${argsCode.join(', ')})`);
                        else {
                            if (typeof retrieve === 'boolean') {
                                if (resultsCode.length === 1)
                                    this.state.code.push(`(${retrieveCode} ? ${resultsCode[0]} : "")`);
                                if (resultsCode.length === 2)
                                    this.state.code.push(`(${retrieveCode} ? ${resultsCode[0]} : ${resultsCode[1]})`);
                            }
                            else
                                this.state.code.push(`${retrieveCode}(${resultsCode.join(', ')})`);
                        }
                    }

                    break;
                }

                case NodeType.Retrieve: {
                    if (this.state.jump.length === 0) {
                        this.errors.push({
                            msg: 'Attempted to get value from empty jump stack',
                            range: node.data.range
                        });
                        return this.createResult();
                    }
                    const jumpPos = this.state.jump.pop()!;

                    let obj = globals;
                    const identities = this.state.value.splice(jumpPos);
                    let name = '';

                    let infoObj = {};
                    let broke = false;
                    for (let idx = 0; idx < identities.length; idx++) {
                        if (typeof obj !== 'object' || !(identities[idx] in obj)) {
                            this.errors.push({
                                msg: `"${node.data.value}" does not exist${name ? ` in "${name}"` : ''}`,
                                range: node.data.range
                            });
                            broke = true;
                            break;
                        }

                        if (idx === identities.length - 1 && (identities[idx] + '__info') in obj) {
                            infoObj = obj[identities[idx] + '__info'];
                        }

                        obj = obj[identities[idx]];
                        name += (name ? '.' : '') + identities[idx];
                    }

                    if (broke) {
                        this.state.value.push({});
                        this.state.value.push(infoObj);
                    }
                    else {
                        this.state.value.push(obj);
                        this.state.value.push(infoObj);
                    }

                    const codeName = this.state.code.splice(jumpPos);
                    this.state.code.push(codeName.join('.'));

                    break;
                }
            }

            this.state.nodes.pop();
        }

        return this.createResult();
    }
}
