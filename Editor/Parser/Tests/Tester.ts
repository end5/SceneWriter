import chalk = require("chalk");
import { Interpreter } from "../Interpreter";
import { lex } from "../Lexer";
import { Parser } from "../Parser";
import { TextRange } from "../TextRange";

export function test(
    name: string,
    input: {
        text: string, obj: Record<string, any>
    },
    output: {
        result: string | string[], ranges: TextRange[], code: string
    }
) {

    const lexResult = lex(input.text, true);

    const parser = new Parser(lexResult.map((state) => state.token), input.text);
    const parserResult = parser.parse();
    const interpreter = new Interpreter(parserResult.root, input.obj);
    const interpretResult = interpreter.interpret();
    const parserText = interpretResult.result;
    // console.log(JSON.stringify(interpretResult.stack));
    // const codeText = parserResult.root.toCode();

    const resultMatch = typeof output.result === 'string' ? parserText === output.result : output.result.includes(parserText);
    const posMatch = interpretResult.positions.every((pos, idx) =>
        pos.start.line === output.ranges[idx].start.line &&
        pos.start.col === output.ranges[idx].start.col &&
        pos.end.line === output.ranges[idx].end.line &&
        pos.end.col === output.ranges[idx].end.col
    );

    // if (resultMatch && codeText === codeResult)
    if (resultMatch)
        console.log('-- ' + name + ' ... Success');
    else {
        if (!resultMatch)
            console.log('-- ' + name + ' ... Failed: Result did not match');
        else if (!posMatch)
            console.log('-- ' + name + ' ... Failed: Positions did not match');
        else
            console.log('-- ' + name + ' ... Failed: Code did not match');
        // console.log(JSON.stringify(interpretResult.stack));
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
        console.log('| -- Positions');
        console.log('| ' + interpretResult.positions);
        // console.log('| -- Code');
        // console.log('| ' + codeText);

        console.log('| -- Errors');
        for (const error of parserResult.errors)
            console.log('| ' + chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg));
    }
}
