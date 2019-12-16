import chalk = require("chalk");
import { Interpreter } from "../Interpreter";
import { lex } from "../Lexer";
import { Parser } from "../Parser";
import { TextRange } from "../TextRange";

export interface TestInput {
    text: string;
    obj: Record<string, any>;
}

export interface TestOutput {
    result: string;
    ranges: TextRange[];
    code: string;
}

export function test(name: string, input: TestInput, output: TestOutput) {

    const lexResult = lex(input.text, true);

    const parser = new Parser(lexResult.map((state) => state.token), input.text);
    const parserResult = parser.parse();
    const interpreter = new Interpreter(parserResult.root, input.obj);
    const interpretResult = interpreter.interpret();

    const results = {
        text: interpretResult.result === output.result,
        pos: interpretResult.ranges.every((pos, idx) => compareTextRange(pos, output.ranges[idx])),
        // code: interpretResult.code === output.code,
        code: true,
    };

    if (results.text && results.pos && results.code) {
        console.log('-- ' + name + ' ... Success');
        return;
    }

    let log = '-- ' + name + ' ... Failed:';
    if (!results.text) log += ' Result';
    if (!results.pos) log += ' Positions';
    if (!results.code) log += ' Code';
    log += ' did not match';

    log += '\n| -- Lexer';
    for (const state of lexResult)
        log += '\n| ' +
            chalk.magenta(`[${state.lineNum}:${state.offset}]`) +
            chalk.magenta(new TextRange(state.token.range.start, state.token.range.end) + '') + ' ' +
            chalk.cyan(state.token.type) + ' ' +
            chalk.yellow(`<${state.codeStack.reverse()}>`) + ' ' +
            state.text;

    log += '\n| -- Result';
    log += '\n| ' + interpretResult.result;
    log += '\n| -- Ranges';
    log += '\n| ' + interpretResult.ranges;
    log += '\n| -- Code';
    log += '\n| ' + interpretResult.code;

    log += '\n| -- Errors';
    for (const error of parserResult.errors)
        log += '\n| ' + chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg);

    log += '\n| -- Stack';
    log += '\n| ' + JSON.stringify(interpretResult.stack);

    console.log(log);
}

function compareTextRange(a: TextRange, b: TextRange) {
    return a.start.line === b.start.line &&
        a.start.col === b.start.col &&
        a.end.line === b.end.line &&
        a.end.col === b.end.col;
}
