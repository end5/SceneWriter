import chalk = require("chalk");
import { lex, LexerState } from "../Lexer";
import { Parser, ParserResult } from "../Parser";
import { Symbols } from "../Symbol";
import { TextRange } from "../TextRange";

export function test(name: string, text: string, obj: Record<string, Symbols>, result: string, codeResult: string) {

    const lexResult = lex(text, true);

    const parser = new Parser(lexResult.map((state) => state.token), text, obj);
    const parserResult = parser.parse();
    const parserText = parserResult.root.result.map((n) => n.result).join('');
    const codeText = parserResult.root.toCode();

    if (parserText === result && codeText === codeResult)
        console.log('-- ' + name + ' ... Success');
    else {
        if (parserText !== result)
            console.log('-- ' + name + ' ... Failed: Result did not match');
        else
            console.log('-- ' + name + ' ... Failed: Code did not match');
        console.log('| -- Lexer');
        for (const state of lexResult)
            console.log('| ' +
                chalk.magenta(`[${state.lineNum}:${state.offset}]`) +
                chalk.magenta(new TextRange(state.token.range.start, state.token.range.end) + '') + ' ' +
                chalk.cyan(state.token.type) + ' ' +
                chalk.yellow(`<${state.codeStack.reverse()}>`) + ' ' +
                state.text
            );

        console.log('| -- Parser');
        console.log('| ' + parserText);
        console.log('| -- Code');
        console.log('| ' + codeText);

        console.log('| -- Errors');
        for (const error of parserResult.errors)
            console.log('| ' + chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg));
    }
}
