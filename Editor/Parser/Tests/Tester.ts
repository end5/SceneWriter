import chalk = require("chalk");
import { Interpreter } from "../Interpreter";
import { Lexer } from "../Lexer";
import { AllNodes } from "../Node";
import { Parser } from "../Parser";
import { TextRange } from "../TextRange";
import { TokenType } from "../Token";

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

    const lexer = new Lexer(input.text);
    const parser = new Parser(input.text);
    const parserResult = parser.parse();
    const interpreter = new Interpreter();
    const interpretResult = interpreter.interpret(parserResult.root, input.obj);

    const results = {
        text: interpretResult.result === output.result,
        pos: (output.ranges.length === 0 && interpretResult.ranges.length === 0) || interpretResult.ranges.every((pos, idx) => compareTextRange(pos, output.ranges[idx])),
        code: interpretResult.code === output.code,
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
    let token = lexer.peek();
    while (token !== TokenType.EOS) {
        log += '\n| ' +
            chalk.magenta(new TextRange({ line: lexer.lineStart, col: lexer.colStart }, { line: lexer.lineEnd, col: lexer.colEnd }) + '') + ' ' +
            chalk.cyan(token) + ' ' +
            lexer.getText();
        token = lexer.advance();
    }

    log += '\n| -- Parser';
    log += printNode(parserResult.root);
    log += '\n| -- Result';
    log += '\n| ' + interpretResult.result;
    log += '\n| -- Ranges';
    log += '\n| ' + interpretResult.ranges;
    log += '\n| -- Code';
    log += '\n| ' + interpretResult.code;
    log += '\n| -- Errors';
    for (const error of parserResult.errors)
        log += '\n| ' + chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg);
    for (const error of interpretResult.errors)
        log += '\n| ' + chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg);

    console.log(log);
}

function printNode(node: AllNodes, indent: number = 0): string {
    return `\n| ${'  '.repeat(indent)}${node.range} ${node.type} ${node.value != null ? `"${node.value}"` : ''}${(node.children as AllNodes[]).map((child) => printNode(child, indent + 1)).join('')}`;
}

function compareTextRange(a: TextRange, b: TextRange) {
    return a.start.line === b.start.line &&
        a.start.col === b.start.col &&
        a.end.line === b.end.line &&
        a.end.col === b.end.col;
}
