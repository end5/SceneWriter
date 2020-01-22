import { LangError } from "./LangError";
import { AllNodes, ArgsNode, ConcatNode, EvalNode, IdentityNode, NodeType, NumberNode, ResultsNode, RetrieveNode, StringNode, TextNodes } from "./Node";
import { Product } from "./Product";
import { TextRange } from "./TextRange";

interface FunctionInfo {
    argResultValidator?: (args: (string | number)[], results: string[]) => string | undefined;
    toCode?: (args: (string | number)[], results: string[]) => string;
}

interface RetrieveObj {
    value?: any;
    self?: object;
    caps?: boolean;
    info?: FunctionInfo;
}

const escapePairs: [RegExp, string][] = [[/\n/g, '\\n'], [/'/g, '\\\''], [/"/g, '\\"']];

export class Interpreter {
    private errors: LangError[] = [];
    private globals: Record<string, any> = {};

    private getName(node: RetrieveNode) {
        let name = '';
        for (let idx = 0; idx < node.children.length; idx++) {
            if (idx > 0) name += '.';
            name += node.children[idx].value;
        }
        return name;
    }

    private escape(text: string) {
        let escapedText = text;
        for (const pair of escapePairs) {
            escapedText = escapedText.replace(pair[0], pair[1]);
        }
        return escapedText;
    }

    private createError(range: TextRange, msg: string) {
        this.errors.push(new LangError(range, msg));
    }

    public interpret(node: TextNodes, globals: Record<string, any>) {
        this.errors = [];
        this.globals = globals;
        let output;
        try {
            output = this.processNode(node);
        }
        catch (err) {
            this.createError(node.range, err);
            return {
                result: '',
                ranges: [node.range],
                code: '',
                errors: this.errors
            };
        }
        return {
            result: output.value as string,
            ranges: (Array.isArray(output.range) ? output.range : [output.range]),
            code: output.code,
            errors: this.errors
        };
    }

    private processNode(node: AllNodes) {
        switch (node.type) {
            case NodeType.Identity: return this.evalIdentityNode(node);
            case NodeType.String: return this.evalStringNode(node);
            case NodeType.Number: return this.evalNumberNode(node);
            case NodeType.Concat: return this.evalConcatNode(node);
            case NodeType.Eval: return this.evalEvalNode(node);
            case NodeType.Retrieve: return this.evalRetrieveNode(node);
            case NodeType.Args: return this.evalArgsNode(node);
            case NodeType.Results: return this.evalResultsNode(node);
        }
    }

    private evalStringNode(node: StringNode): Product<string> {
        return new Product(
            node.range,
            node.value,
            '"' + this.escape(node.value) + '"'
        );
    }

    private evalNumberNode(node: NumberNode): Product<number> {
        return new Product(
            node.range,
            node.value,
            node.value + ''
        );
    }

    private evalIdentityNode(node: IdentityNode): Product<string> {
        return new Product(
            node.range,
            node.value,
            node.value + ''
        );
    }

    private evalConcatNode(node: ConcatNode): Product<string> {
        const values = node.children.map((child) => this.processNode(child));
        const ranges = [];
        for (const child of values)
            if (Array.isArray(child.range))
                ranges.push(...child.range);
            else
                ranges.push(child.range);

        let valueStr = '';
        let codeStr = '';
        for (let idx = 0; idx < values.length; idx++) {
            valueStr += values[idx].value;
            if (idx > 0) codeStr += ' + ';
            codeStr += values[idx].code;
        }

        return new Product(
            ranges,
            valueStr,
            codeStr
        );
    }

    private evalRetrieveNode(node: RetrieveNode): Product<RetrieveObj> {
        const values = node.children.map((child) => this.processNode(child) as Product<string>);
        let obj = this.globals;
        let name = '';

        let infoObj;
        let identity;
        let selfObj;
        const caps = false;
        for (let idx = 0; idx < values.length; idx++) {
            identity = values[idx].value;

            // Determine if capitalization is needed
            // if (identity.charAt(0).toLocaleUpperCase() === identity.charAt(0)) {
            //     caps = true;
            //     identity = identity.charAt(0).toLocaleLowerCase() + identity.slice(1);
            // }

            if (typeof obj !== 'object' || !(identity in obj)) {
                this.createError(
                    node.range,
                    `"${identity}" does not exist${name ? ` in "${name}"` : ''}`
                );
                return new Product<RetrieveObj>(
                    node.range,
                    {},
                    ''
                );
            }

            if (idx === values.length - 1 && (identity + '__info') in obj) {
                infoObj = obj[identity + '__info'];
            }

            selfObj = obj;
            obj = obj[identity];
            if (name.length > 0) name += '.';
            name += identity;
        }

        return new Product<RetrieveObj>(
            node.range,
            {
                value: obj,
                self: selfObj,
                caps,
                info: infoObj
            },
            name
        );
    }

    private evalArgsNode(node: ArgsNode): Product<(Product<string> | Product<number>)[]> {
        return new Product(
            node.range,
            node.children.map((child) => this.processNode(child)) as (Product<string> | Product<number>)[],
            ''
        );
    }

    private evalResultsNode(node: ResultsNode): Product<(Product<string>)[]> {
        return new Product(
            node.range,
            node.children.map((child) => this.processNode(child)) as (Product<string>)[],
            ''
        );
    }

    private evalEvalNode(node: EvalNode): Product<string> {
        let errorMsg;
        if (node.children.length !== 3) {
            errorMsg = 'incorrect amount of children for EvalNode';
        }
        else if (node.children[0].type !== NodeType.Retrieve) {
            errorMsg = 'EvalNode children[0] was not a RetrieveNode';
        }
        else if (node.children[1].type !== NodeType.Args) {
            errorMsg = 'EvalNode children[1] was not a ArgsNode';
        }
        else if (node.children[2].type !== NodeType.Results) {
            errorMsg = 'EvalNode children[1] was not a ResultsNode';
        }

        // Error checking
        if (errorMsg) {
            this.createError(node.range, errorMsg);
            return new Product(node.range, '', '');
        }

        const retrieveProduct = this.evalRetrieveNode(node.children[0]);
        const argsProduct = this.evalArgsNode(node.children[1]);
        const resultsProduct = this.evalResultsNode(node.children[2]);

        const retrieveValue = retrieveProduct.value.value;
        const retrieveSelf = retrieveProduct.value.self;
        const retrieveInfo = retrieveProduct.value.info;
        const retrieveCaps = retrieveProduct.value.caps;
        const retrieveCode = retrieveProduct.code;

        const argsValueArr = argsProduct.value.map((child) => child.value);
        const argsCodeArr = argsProduct.value.map((child) => child.code);

        const resultsValueArr = resultsProduct.value.map((child) => child.value);
        const resultsCodeArr = resultsProduct.value.map((child) => child.code);

        // Error checking
        if (typeof retrieveValue === 'function' && retrieveInfo) {
            if (retrieveInfo.argResultValidator) {
                const validResult = retrieveInfo.argResultValidator(argsValueArr, resultsValueArr);
                if (validResult != null) {
                    errorMsg = '"' + this.getName(node.children[0]) + '" ' + validResult;
                }
            }
        }
        else if (typeof retrieveValue === 'boolean') {
            if (resultsValueArr.length == 0) {
                errorMsg = this.getName(node.children[0]) + ' needs at least 1 result';
            }
            else if (resultsValueArr.length > 2) {
                errorMsg = this.getName(node.children[0]) + ' can have up to 2 results';
            }
        }
        else if (typeof retrieveValue === 'object' || retrieveValue == null) {
            errorMsg = this.getName(node.children[0]) + ' cannot be displayed';
        }
        if (errorMsg) {
            this.createError(node.range, errorMsg);
        }

        let returnValue = '';
        let returnRange: TextRange | TextRange[] = node.range;
        let returnCode = '';
        if (!errorMsg) {
            if (typeof retrieveValue === 'function') {
                const funcResult = retrieveValue.apply(retrieveSelf, argsValueArr.concat(resultsValueArr));
                // Handle selecting from results here
                if (typeof funcResult === 'object' && 'selector' in funcResult && resultsProduct.value[funcResult.selector]) {
                    returnValue = resultsProduct.value[funcResult.selector].value;
                    returnRange = resultsProduct.value[funcResult.selector].range;
                }
                else {
                    returnValue = funcResult + '';
                    returnRange = node.range;
                }

                // nothing              -> identity()
                // args + results       -> identity([arg0, arg1, ...], [result0, result1, ...])
                // args                 -> identity(arg0, arg1, ...)
                // results              -> identity(result0, result1, ...)
                if (argsCodeArr.length === 0 && resultsCodeArr.length === 0)
                    returnCode = retrieveCode + '()';
                else if (argsCodeArr.length > 0 && resultsCodeArr.length > 0)
                    returnCode = retrieveCode + '([' + argsCodeArr.join(', ') + '], [' + resultsCodeArr.join(', ') + '])';
                else if (argsCodeArr.length > 0)
                    returnCode = retrieveCode + '(' + argsCodeArr.join(', ') + ')';
                else
                    returnCode = retrieveCode + '(' + resultsCodeArr.join(', ') + ')';
            }
            else if (typeof retrieveValue === 'boolean') {
                // condition ? [result1] : result2
                if (retrieveValue && resultsProduct.value.length > 0 && resultsProduct.value[0]) {
                    returnValue = resultsProduct.value[0].value;
                    returnRange = resultsProduct.value[0].range;
                }
                // condition ? result1 : [result2]
                else if (!retrieveValue && resultsProduct.value.length > 1 && resultsProduct.value[1]) {
                    returnValue = resultsProduct.value[1].value;
                    returnRange = resultsProduct.value[1].range;
                }
                // condition ? result1 : []
                // condition ? [] : result2
                else {
                    returnValue = '';
                    returnRange = node.range;
                }

                // type bool + results  -> identity ? result0 : (result1 or "")
                if (resultsCodeArr.length === 1)
                    returnCode = '(' + retrieveCode + ' ? ' + resultsCodeArr[0] + ' : "")';
                if (resultsCodeArr.length === 2)
                    returnCode = '(' + retrieveCode + ' ? ' + resultsCodeArr[0] + ' : ' + resultsCodeArr[1] + ')';
            }
            else {
                returnValue = retrieveValue + '';
                returnRange = node.range;
                returnCode = retrieveCode;
            }

            if (retrieveInfo && retrieveInfo.toCode) {
                returnCode = retrieveInfo.toCode(argsCodeArr, resultsCodeArr);
            }

        }

        if (retrieveCaps && returnValue.length > 0) {
            returnValue = returnValue.charAt(0).toLocaleUpperCase() + returnValue.slice(1);
        }

        return new Product(returnRange, returnValue + '', returnCode);
    }
}
