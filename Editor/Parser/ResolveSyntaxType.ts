import { ResultNode } from './InterpretNode';
import { createElement } from '../Display/Create';
import { articlize } from './Articles';
import { SyntaxType, SyntaxNode } from './SyntaxNode';
import { ICodeMask } from './CodeMask';
import { checkCode } from './CheckCode';

interface ResolveOptions { noDOM?: boolean; }
type ResolveFunction = (syntax: SyntaxNode, nodes: ResultNode[], mask: ICodeMask, globals: Record<string, any>, options?: ResolveOptions) => ResolveResult;
interface ResolveResult { value: any; children: ResultNode[]; }

function resolveString(syntax: SyntaxNode, nodes: ResultNode[]): ResolveResult {
    return { value: syntax.value, children: [] };
}

function resolveNumber(syntax: SyntaxNode, nodes: ResultNode[]): ResolveResult {
    return { value: +syntax.value, children: [] };
}

function resolveEmptyString(): ResolveResult {
    return { value: '', children: [] };
}

function resolveEmptyArgs(): ResolveResult {
    return { value: [], children: [] };
}

function resolveConcat(syntax: SyntaxNode, nodes: ResultNode[], options?: ResolveOptions): ResolveResult {
    let value;
    if (options && options.noDOM) {
        value = nodes.reduce((prev, curr) => {
            return curr.value == null ? prev : prev + curr.value;
        }, '');
    }
    else {
        value = document.createElement('span');
        for (const node of nodes) {
            if (node != null) {
                if (node instanceof HTMLElement)
                    value.appendChild(node.value);
                else
                    value.appendChild(createElement('span', node.value));
            }
        }
    }
    return { value, children: nodes };
}

function resolveCode(syntax: SyntaxNode, nodes: ResultNode[], mask: ICodeMask, globals: Record<string, any>): ResolveResult {
    const [preDotNode, attributeNode, spArgsNode, argsNode] = nodes;

    const preDot: string = preDotNode.value;
    // attributeNode.value will be either string | true
    // true = an existence check
    // string = value
    const existenceCheck = typeof attributeNode.value === 'boolean';
    let attribute: string = existenceCheck ? '' : attributeNode.value;
    const spArgs: any[] = spArgsNode.value;
    const args: any[] = argsNode.value;
    let index;

    const codeError = checkCode(mask, preDot, attributeNode.value, spArgs.length, args.length);
    if (codeError) throw new Error(codeError);

    const canFlagParse = preDot === 'flags';
    if (canFlagParse) {
        // If no special args treat as ternary on truthiness
        if (spArgs.length <= 0) {
            if (globals[preDot][attribute])
                return { value: args[0], children: [argsNode.children[0]] };
            else
                return { value: args[1], children: [argsNode.children[1]] };
        }

        // If strict equality on a special arg just use the corresponding variation
        const strictMatch = spArgs.findIndex((sp) => globals[preDot][attribute] === sp);
        if (strictMatch >= 0) {
            return { value: args[strictMatch], children: [argsNode.children[strictMatch]] };
        }

        // Try to match number ranges, if no matches use the fall-through variant if there is one, else use empty string
        index = spArgs.findIndex((sp, idx) => globals[preDot][attribute] >= sp && (!spArgs[idx + 1] || globals[preDot][attribute] < spArgs[idx + 1]));
        if (index >= 0) {
            return { value: args[index], children: [argsNode.children[index]] };
        }
        if (args.length - 1 === spArgs.length) {
            return { value: args[args.length - 1], children: [argsNode.children[args.length - 1]] };
        }
        return { value: '', children: [] };
    }

    // Do a dot parse - these are very complex
    if (attribute || existenceCheck) {
        // There are a few special aliases we have to check for
        const dotObj = (() => {
            switch (preDot) {
                case 'party': return globals.PlayerParty;
                case 'eParty': return globals.CombatManager.enemyParty;
                case 'aParty': return globals.CombatManager.allyParty;
                default: return globals[preDot];
            }
        })();

        if (!dotObj) {
            // If the property exists but is just set to undefined, use the second argument if there is one
            // This allows for things like [companion.|companion is set|companion is not set]
            //  where the lone dot is what I like to call an "existence" parser
            if (preDot in globals) {
                if (!attribute && args[1])
                    return { value: args[1], children: [argsNode.children[1]] };
                else
                    return { value: '', children: [] };
            }
            throw new Error(`Could not find object "${preDot}"`);
        }

        // Set lastChar for [tps] purposes if we're processing a character dot parser
        if (globals.CHAR_CLASSES.Creature && dotObj instanceof globals.CHAR_CLASSES.Creature)
            globals.lastChar = dotObj;

        // SPECIAL CASE HACKING FOR OTHER COCK PARSING
        const isOther = attribute.slice(-5) === 'Other';
        const currentCock = dotObj.defaultCockIdx;
        if (isOther) {
            dotObj.setDefaultCock(currentCock ? 0 : 1);
            attribute = attribute.slice(0, -5);
        }

        // Try to do an old-school TiTS-esque parser
        const getDescArgs = spArgs.length > 0 ? spArgs : args;
        let oldSchool;
        if ('getDescription' in dotObj)
            oldSchool = dotObj.getDescription(attribute, getDescArgs);
        if (typeof oldSchool === 'string') {
            // RESTORE DEFAULT COCK IF WE NEED TO
            if (isOther) dotObj.setDefaultCock(currentCock);

            return { value: oldSchool, children: [] };
        }

        // If the provided attribute doesn't exist on our dotObj we can't do anything - raise an error
        if (!(attribute in dotObj)) {
            // RESTORE DEFAULT COCK IF WE NEED TO
            if (isOther) dotObj.setDefaultCock(currentCock);

            throw new Error(`Could not find attribute "${attribute}" in object "${preDot}"`);
        }

        const dotObjProperty = dotObj[attribute];

        // Handle it as a function, this can do many different things
        if (typeof dotObjProperty === 'function') {
            // The arguments passed to the function can be either "space args" or "regular args"
            // Take [pc.mf|boy|girl] and [pc.ra lupine|scary wolf|not a wolf] for example
            // The first does simply pc.mf('boy','girl'), the latter does pc.ra('lupine') and then uses the result to ternary resultArgs
            const funcArgsNode = spArgs.length > 0 ? nodes[2] : nodes[3];
            const resultArgsNode = args.length <= 0 ? nodes[2] : nodes[3];
            const result = dotObjProperty.bind(dotObj)(...funcArgsNode.value);

            // RESTORE DEFAULT COCK IF WE NEED TO
            if (isOther) dotObj.setDefaultCock(currentCock);

            return handleFunctionResult(result, funcArgsNode, resultArgsNode, dotObj);
        }

        // RESTORE DEFAULT COCK IF WE NEED TO
        if (isOther) dotObj.setDefaultCock(currentCock);

        // Boolean, ternary the first two args
        if (typeof dotObjProperty === 'boolean') {
            let _args;
            let _node;

            if (args.length <= 0) {
                _args = spArgs;
                _node = spArgsNode;
            }
            else {
                _args = args;
                _node = argsNode;
            }

            if (dotObjProperty && _args[0])
                return { value: _args[0], children: [_node.children[0]] };
            else if (!dotObjProperty && _args[1])
                return { value: _args[1], children: [_node.children[1]] };
            else
                return { value: '', children: [] };
        }

        // If all else fails, just try to toString the result :shrug:
        return { value: dotObjProperty.toString(), children: [] };
    }

    // do a dayNight parser
    index = globals.night ? 1 : 0;
    if (preDot === 'dayNight' && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]]
        };

    // do a silly parser
    index = globals.night ? 1 : 0;
    if (preDot === 'silly' && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]],
        };

    // do a plural parse
    index = globals.Parser.plural ? 0 : 1;
    if ((preDot === 'plural' || preDot === 'p') && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]]
        };

    // do a singular parse
    index = globals.Parser.plural ? 1 : 0;
    if ((preDot === 'singular' || preDot === 's') && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]]
        };

    // third-person singular parse
    index = globals.Parser.lastChar.isPC() || globals.Parser.lastChar.isPlural ? 1 : 0;
    if (preDot === 'tps' && args[index])
        return {
            value: args[index],
            children: typeof index === 'number' ? [argsNode.children[index]] : []
        };

    // do a rand parser
    if (preDot === 'rand') {
        const randItem = globals.randCollection(...args);
        if (randItem)
            return {
                value: randItem,
                children: [argsNode.children[args.indexOf(randItem)]]
            };
    }

    // buttslut mode parser
    index = globals.buttslut ? 0 : 1;
    if (preDot === 'buttslut' && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]]
        };

    // hitMiss parser
    index = globals.hitObj.hit ? 0 : 1;
    if (preDot === 'hitMiss' && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]]
        };

    // critHitMiss parser
    index = globals.hitObj.crit ? 0 : globals.hitObj.hit ? 1 : 2;
    if (preDot === 'critHitMiss' && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]]
        };

    // atCamp parser
    index = globals.atCamp() ? 0 : 1;
    if (preDot === 'atCamp' && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]]
        };

    // atFH parser
    index = globals.atFH() ? 0 : 1;
    if (preDot === 'atFH' && args[index])
        return {
            value: args[index],
            children: [argsNode.children[index]]
        };

    return { value: '', children: [] };
}

function handleFunctionResult(result: any, funcArgsNode: ResultNode | undefined, resultArgsNode: ResultNode | undefined, dotObj: object): ResolveResult {
    const funcArgs = funcArgsNode ? funcArgsNode.value : [];
    const resultArgs = resultArgsNode ? resultArgsNode.value : [];

    // The function returned a string, just use it!
    if (typeof result === 'string') {
        return { value: result, children: [] };
    }

    // Function returned a number, these functions are supposed to return the index of the funcArg that was "valid"
    // If its >= 0 there was a valid funcArg, use the corresponding resultArg
    // Otherwise if it's -1, use an optionally provided fallback/failed/other argument, which would be the resultArg that has no corresponding funcArg
    // MAKE SURE WE ALSO HAD SPECIAL ARGS
    if (typeof result === 'number' && resultArgs.length > 0) {
        if (result === -1 && resultArgs.length === funcArgs.length + 1)
            return { value: resultArgs[resultArgs.length - 1], children: [resultArgsNode!.children[resultArgs.length - 1]] };
        else if (resultArgs[result])
            return { value: resultArgs[result], children: [resultArgsNode!.children[result]] };
        else
            return { value: '', children: [] };
    }

    // Wow this can do crazy shit
    if (typeof result === 'function') {
        const _result = result.bind(dotObj)(...resultArgs);
        return handleFunctionResult(_result, resultArgsNode, undefined, dotObj);
    }

    // Finally, just try to ternary the first two resultArgs on what the function returned
    if (result && resultArgs[0])
        return { value: resultArgs[0], children: [resultArgsNode!.children[0]] };
    else if (!result && resultArgs[1])
        return { value: resultArgs[1], children: [resultArgsNode!.children[1]] };
    else
        return { value: '', children: [] };
}

function resolveArgs(syntax: SyntaxNode, nodes: ResultNode[]): ResolveResult {
    return { value: nodes.map((node) => node.value), children: nodes };
}

function resolveExists(syntax: SyntaxNode, nodes: ResultNode[]): ResolveResult {
    return { value: true, children: [] };
}

function resolveArticle(syntax: SyntaxNode, nodes: ResultNode[]): ResolveResult {
    const article = nodes[0].value; // a, A, an, An
    if (nodes.length <= 1)
        return { value: article, children: nodes };
    else {
        const results = nodes[1].value + ''; // the rest
        let value;

        if (isUpperCase(article))
            value = upperCaseFirst(articlize(fastTrimLeft(results)));
        else
            value = articlize(fastTrimLeft(results));

        const newArticle = fastTrimLeft(value).slice(0, 2).trim();

        return { value, children: [new ResultNode(nodes[0].range, [], newArticle), nodes[1]] };
    }
}

function fastTrimLeft(text: string) {
    let start = -1;
    while (text.charCodeAt(++start) < 33);
    return text.slice(start);
}

function isUpperCase(text: string) {
    const character = fastTrimLeft(text).charAt(0);
    return isNaN(+character) && character === character.toUpperCase();
}

function upperCaseFirst(text: string) {
    return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function resolveError(syntax: SyntaxNode): ResolveResult {
    throw new Error(syntax.value);
}

export const ResolveSyntaxTypeTable: Record<SyntaxType, ResolveFunction> = {
    [SyntaxType.String]: resolveString,
    [SyntaxType.Number]: resolveNumber,
    [SyntaxType.EmptyString]: resolveEmptyString,
    [SyntaxType.EmptyArgs]: resolveEmptyArgs,
    [SyntaxType.Concat]: resolveConcat,
    [SyntaxType.Code]: resolveCode,
    [SyntaxType.Args]: resolveArgs,
    [SyntaxType.Exists]: resolveExists,
    [SyntaxType.Article]: resolveArticle,
    [SyntaxType.Error]: resolveError,
};
