import { LangError } from "./LangError";
import { AllNodes, ArgsNode, ConcatNode, EvalNode, IdentityNode, NodeType, NumberNode, ResultsNode, RetrieveNode, StringNode, TextNodes } from "./Node";
import { Product } from "./Product";
import { TextRange } from "./TextRange";

interface FunctionInfo {
    argResultValidator?: ((args: (string | number)[], results: string[]) => string | undefined)[];
    toCode?: (identifier: string, args: (string | number)[], results: string[]) => string;
    includeResults?: boolean;
    mapArgsCallbacks?: ((args: string) => string)[];
}

interface RetrieveObj {
    value?: any;
    self?: object;
    caps?: boolean;
    info?: FunctionInfo;
}

const escapePairs: [RegExp, string][] = [[/\n/g, '\\n'], [/'/g, '\\\''], [/"/g, '\\"']];
const FUNC_INFO_STRING = '__info';

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
        this.errors.push(new LangError(msg, range));
    }

    public interpret(node: TextNodes, globals: Record<string, any>) {
        this.errors = [];
        this.globals = globals;
        let output;
        try {
            output = this.processNode(node) as Product<string, TextRange | TextRange[]>;
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
            result: output.value,
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

    private evalStringNode(node: StringNode): Product<string, TextRange> {
        return new Product(
            node.range,
            node.value,
            '"' + this.escape(node.value) + '"'
        );
    }

    private evalNumberNode(node: NumberNode): Product<number, TextRange> {
        return new Product(
            node.range,
            node.value,
            node.value + ''
        );
    }

    private evalIdentityNode(node: IdentityNode): Product<string, TextRange> {
        return new Product(
            node.range,
            node.value,
            node.value + ''
        );
    }

    private evalConcatNode(node: ConcatNode): Product<string, TextRange[]> {
        const products = node.children.map((child) => this.processNode(child) as Product<string, TextRange | TextRange[]>);

        const ranges: TextRange[] = [];
        for (const child of products)
            if (Array.isArray(child.range))
                ranges.push(...child.range);
            else
                ranges.push(child.range);

        console.log(ranges);
        let valueStr = '';
        let codeStr = '';
        for (const product of products) {
            valueStr += product.value;
            if (codeStr.charAt(codeStr.length - 1) == '"' && product.code.charAt(0) == '"') {
                codeStr = codeStr.slice(0, codeStr.length - 1) + product.code.slice(1);
            }
            else {
                if (codeStr.length > 0)
                    codeStr += ' + ';
                codeStr += product.code;
            }
        }

        return new Product(
            ranges,
            valueStr,
            codeStr
        );
    }

    private evalRetrieveNode(node: RetrieveNode): Product<RetrieveObj, TextRange> {
        const values = node.children.map((child) => this.processNode(child) as Product<string, TextRange>);
        let obj = this.globals;
        let name = '';
        let codeStr = '';

        let infoObj;
        let identity;
        let selfObj;
        let caps = false;
        let lowerCaseIdentity;
        for (let idx = 0; idx < values.length; idx++) {
            identity = values[idx].value;

            // Determine if capitalization is needed
            if (idx == values.length - 1) {
                lowerCaseIdentity = identity.charAt(0).toLocaleLowerCase() + identity.slice(1);
                if (!(identity in obj) && lowerCaseIdentity in obj) {
                    caps = true;
                    identity = lowerCaseIdentity;
                }
            }

            // Error check
            if (typeof obj !== 'object' || !(identity in obj)) {
                this.createError(
                    node.range,
                    `"${identity}" does not exist${name ? ` in "${name}"` : ''}`
                );
                return new Product(
                    node.range,
                    {},
                    ''
                );
            }

            // Check for <name>__info
            if (idx === values.length - 1 && (identity + FUNC_INFO_STRING) in obj) {
                infoObj = obj[identity + FUNC_INFO_STRING];
            }

            selfObj = obj;
            obj = obj[identity];
            if (name.length > 0) {
                name += '.';
                codeStr += '.';
            }
            name += identity;
            if (idx === values.length - 1 && infoObj && infoObj.identityOverride)
                codeStr += infoObj.identityOverride;
            else
                codeStr += identity + (typeof obj === 'function' ? '()' : '');
        }

        return new Product(
            node.range,
            {
                value: obj,
                self: selfObj,
                caps,
                info: infoObj
            },
            codeStr
        );
    }

    private evalArgsNode(node: ArgsNode): Product<(Product<string, TextRange> | Product<number, TextRange>)[], TextRange> {
        return new Product(
            node.range,
            node.children.map((child) => this.processNode(child)) as (Product<string, TextRange> | Product<number, TextRange>)[],
            ''
        );
    }

    private evalResultsNode(node: ResultsNode): Product<(Product<string, TextRange | TextRange[]>)[], TextRange> {
        return new Product(
            node.range,
            node.children.map((child) => this.processNode(child)) as (Product<string, TextRange | TextRange[]>)[],
            ''
        );
    }

    private evalEvalNode(node: EvalNode): Product<string, TextRange | TextRange[]> {
        // Error checking
        let errorStart = this.errors.length;
        if (node.children.length !== 3) {
            this.createError(node.range, 'incorrect amount of children for EvalNode');
        }
        else if (node.children[0].type !== NodeType.Retrieve) {
            this.createError(node.range, 'EvalNode children[0] was not a RetrieveNode');
        }
        else if (node.children[1].type !== NodeType.Args) {
            this.createError(node.range, 'EvalNode children[1] was not a ArgsNode');
        }
        else if (node.children[2].type !== NodeType.Results) {
            this.createError(node.range, 'EvalNode children[1] was not a ResultsNode');
        }

        if (errorStart !== this.errors.length)
            return new Product(new TextRange(node.range.start, node.range.start), '', '');

        const retrieve = this.evalRetrieveNode(node.children[0]);
        const args = this.evalArgsNode(node.children[1]);
        const results = this.evalResultsNode(node.children[2]);

        if (!('value' in retrieve.value))
            return new Product(new TextRange(node.range.start, node.range.start), '', '');

        const identifier = this.getName(node.children[0]);

        const argsValueArr = args.value.map((child) => child.value);
        let argsCodeArr = args.value.map((child) => child.code);

        const resultsValueArr = results.value.map((child) => child.value);
        const resultsCodeArr = results.value.map((child) => child.code);

        let resultValue = retrieve.value.value;

        if (typeof resultValue === 'function') {
            // Error checking
            errorStart = this.errors.length;

            // Validate args and results
            if (retrieve.value.info && retrieve.value.info.argResultValidator) {
                for (const validator of retrieve.value.info.argResultValidator) {
                    const validResult = validator(argsValueArr, resultsValueArr);
                    if (validResult != null) {
                        this.createError(node.range, '"' + identifier + '" ' + validResult);
                        break;
                    }
                }
            }
            // No args or results if no validator
            else {
                if (argsValueArr.length > 0)
                    this.createError(args.range, identifier + ' does not use arguments');
                if (resultsValueArr.length > 0)
                    this.createError(results.range, identifier + ' does not use results');
            }

            // Return on error
            if (errorStart !== this.errors.length)
                return new Product(new TextRange(node.range.start, node.range.start), '', '');

            // Evaluate
            if (retrieve.value.info && retrieve.value.info.includeResults)
                resultValue = resultValue.call(retrieve.value.self, argsValueArr, resultsValueArr);
            else
                resultValue = resultValue.apply(retrieve.value.self, argsValueArr);

            if (resultValue == null) {
                this.createError(node.range, identifier + ' is ' + resultValue);
                return new Product(new TextRange(node.range.start, node.range.start), '', '');
            }
        }

        // Error checking
        errorStart = this.errors.length;
        switch (typeof resultValue) {
            case 'boolean': {
                if (resultsValueArr.length == 0) {
                    this.createError(node.range, identifier + ' needs at least 1 result');
                }
                else if (resultsValueArr.length > 2) {
                    this.createError(node.range, identifier + ' has ' + (resultsValueArr.length - 2) + ' results than needed');
                }
                break;
            }
            case 'object': {
                this.createError(node.range, identifier + ' cannot be displayed');
                break;
            }
        }
        if (errorStart !== this.errors.length) {
            return new Product(new TextRange(node.range.start, node.range.start), '', '');
        }

        let returnValue = '';
        let returnRange: TextRange | TextRange[] = node.range;
        let returnCode = '';

        if (typeof resultValue === 'number') {
            // Evaluate
            if (results.value.length > 0 && results.value[resultValue]) {
                returnValue = results.value[resultValue].value;
                returnRange = results.value[resultValue].range;
            }
            else {
                returnValue = "";
                returnRange = new TextRange(node.range.end, node.range.end);
            }

            // To Code
            for (let idx = 0; idx < resultsCodeArr.length; idx++) {
                returnCode += '(' + retrieve.code + ' == ' + idx + ' ? ';
                if (idx < resultsCodeArr.length)
                    returnCode += resultsCodeArr[idx];
                else
                    returnCode += '""';
                returnCode += ' : ';
                if (idx + 1 === resultsCodeArr.length)
                    returnCode += '""';
            }
            returnCode += ')'.repeat(resultsCodeArr.length);
        }
        else if (typeof resultValue === 'boolean') {
            // Evaluate
            // condition ? [result1] : result2
            if (resultValue && results.value.length > 0 && results.value[0]) {
                returnValue = results.value[0].value;
                returnRange = results.value[0].range;
            }
            // condition ? result1 : [result2]
            else if (!resultValue && results.value.length > 1 && results.value[1]) {
                returnValue = results.value[1].value;
                returnRange = results.value[1].range;
            }
            // condition ? result1 : []
            // condition ? [] : result2
            else {
                returnValue = '';
                returnRange = node.range;
            }

            // To Code
            // type bool + results  -> identity ? result0 : (result1 or "")
            if (resultsCodeArr.length === 1)
                returnCode = '(' + retrieve.code + ' ? ' + resultsCodeArr[0] + ' : "")';
            if (resultsCodeArr.length === 2)
                returnCode = '(' + retrieve.code + ' ? ' + resultsCodeArr[0] + ' : ' + resultsCodeArr[1] + ')';
        }
        else {
            returnValue = resultValue + '';
            returnRange = node.range;
            returnCode = retrieve.code;
        }

        if (retrieve.value.info && retrieve.value.info.toCode) {
            if (retrieve.value.info.mapArgsCallbacks)
                for (const preprocessor of retrieve.value.info.mapArgsCallbacks)
                    argsCodeArr = argsCodeArr.map(preprocessor);
            returnCode = retrieve.value.info.toCode(retrieve.code, argsCodeArr, resultsCodeArr);
        }

        if (retrieve.value.caps && returnValue.length > 0) {
            returnValue = returnValue.charAt(0).toLocaleUpperCase() + returnValue.slice(1);
        }

        return new Product(returnRange, returnValue + '', returnCode);
    }
}
