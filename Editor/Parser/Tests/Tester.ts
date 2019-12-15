import chalk = require("chalk");
import { Interpreter } from "../Interpreter";
import { lex } from "../Lexer";
import { Parser } from "../Parser";
import { TextRange } from "../TextRange";

export function test(name: string, text: string, obj: Record<string, any>, result: string | string[], codeResult: string) {

    const lexResult = lex(text, true);

    const parser = new Parser(lexResult.map((state) => state.token), text);
    const parserResult = parser.parse();
    const interpreter = new Interpreter(parserResult.root, obj);
    const interpretResult = interpreter.interpret();
    const parserText = interpretResult.result;
    // console.log(JSON.stringify(interpretResult.stack));
    // const codeText = parserResult.root.toCode();

    const resultMatch = typeof result === 'string' ? parserText === result : result.includes(parserText);

    // if (resultMatch && codeText === codeResult)
    if (resultMatch)
        console.log('-- ' + name + ' ... Success');
    else {
        if (!resultMatch)
            console.log('-- ' + name + ' ... Failed: Result did not match');
        else
            console.log('-- ' + name + ' ... Failed: Code did not match');
        console.log(JSON.stringify(interpretResult.stack));
        console.log('| -- Lexer');
        for (const state of lexResult)
            console.log('| ' +
                chalk.magenta(`[${state.lineNum}:${state.offset}]`) +
                chalk.magenta(new TextRange(state.token.range.start, state.token.range.end) + '') + ' ' +
                chalk.cyan(state.token.type) + ' ' +
                chalk.yellow(`<${state.codeStack.reverse()}>`) + ' ' +
                state.text
            );

        console.log('| -- Result');
        console.log('| ' + parserText);
        // console.log('| -- Code');
        // console.log('| ' + codeText);

        console.log('| -- Errors');
        for (const error of parserResult.errors)
            console.log('| ' + chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg));
    }
}
