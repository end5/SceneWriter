import chalk = require("chalk");
import { LexerState, lex } from "../Lexer";
import { TextRange } from "../TextRange";
import { Parser, ParserResult } from "../Parser";

export function test(name: string, text: string, obj: Record<string, any>, result: string) {

    const lexResult = lex(text, true);

    const parser = new Parser(lexResult.map((state) => state.token), text, obj);
    const parserResult = parser.parse();
    const parserText = parserResult.node.map(n => n.value).join();

    if (parserText === result)
        console.log('-- ' + name + ' ... Success');
    else {
        console.log('-- ' + name + ' ... Failed');
        print(lexResult, parserResult);
    }
}

function print(lex: LexerState[], parse: ParserResult) {
    console.log('| -- Lexer');
    for (const state of lex)
        console.log('| ' +
            chalk.magenta(`[${state.lineNum}:${state.offset}]`) +
            chalk.magenta(new TextRange(state.token.range.start, state.token.range.end) + '') + ' ' +
            chalk.cyan(state.token.type) + ' ' +
            chalk.yellow(`<${state.codeStack.reverse()}>`) + ' ' +
            state.text
        );

    console.log('| -- Parser');
    console.log('| ' + parse.node.map(n => n.value).join());

    console.log('| -- Errors');
    for (const error of parse.errors)
        console.log('| ' + chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg));

}
