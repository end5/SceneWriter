import chalk = require("chalk");
import { LexerState, lex } from "../Lexer";
import { TextRange } from "../TextRange";
import { Parser, ParserResult } from "../Parser";
import { ParserObjDict } from "../ParserObject";

export function test(name: string, text: string, obj: ParserObjDict, result: string) {

    const lexResult = lex(text, true);

    const parser = new Parser(lexResult.map((state) => state.token), text, obj);
    const parserResult = parser.parse();
    const parserText = parserResult.root.result.map(n => n.result).join('');

    if (parserText === result)
        console.log('-- ' + name + ' ... Success');
    else {
        console.log('-- ' + name + ' ... Failed');
        print(lexResult, parserResult);
    }
    console.log(' - ' + text);
    console.log(' - ' + parserResult.root.toCode());
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
    console.log('| ' + parse.root.result.map(n => n.result).join());
    // console.log('| -- Code');
    // console.log('| ' + parse.root.toCode());

    console.log('| -- Errors');
    for (const error of parse.errors)
        console.log('| ' + chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg));

}
