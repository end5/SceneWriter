import { lex } from './Lexer';
import { parse } from './Parser';
import { interpret } from './Interpreter';
import { ValueNode, SyntaxNode } from './SyntaxNode';
import { TextRange } from './TextRange';
import chalk from 'chalk';
import { ParserTagMask } from '../State/ParserTagMask';

const globals = {
    pc: {
        weapon: "shortsword",
        himHer: "her",
        tagTest: (...tags: any[]) => {
            return tags.some((tag) => tag === 'hit');
        },
        // getDescription: (attr: any, args: any[] = []) => {
        //     const upper = attr.charCodeAt(0) <= 90;
        //     attr = attr.charAt(0).toLowerCase() + attr.slice(1);

        //     args = args.map((arg) => {
        //         if (!isNaN(parseInt(arg, 10))) return parseInt(arg, 10);
        //         if (arg === 'true') return true;
        //         if (arg === 'false') return false;

        //         return arg;
        //     });

        //     // let desc = this.simpleParse(attr, args, upper);
        //     let desc = attr + ' ' + args + ' ' + upper + '';

        //     // Handle Upper
        //     if (upper && desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);

        //     return desc;
        // },
    },
    party: { solo: (noParty: string, hasParty: string) => hasParty },
    flags: {
        ARONA_SUBMISSION: 35,
        ARONA_WON_LAST: true
    },
    i: (args: any[]) => `<i>${args && args.length === 1 ? args[0] : ''}</i>`,
    rand: (args: any[]) => args ? args[Math.floor(Math.random() * args.length)] : '',
};

// const testText = `        Once more, you hear the echoing horn-blast of an orcish war-party carrying through the pathway. You have just enough time to grab your [pc.weapon] before a group of towering greenskins show themselves, looming down over you from the rocky rises all around you[party.solo||r party]. This time, Arona the amazon war-captain is at the head of the group again, carrying her mighty hammer on her shoulders and locking eyes with you, her gaze full of [flags.ARONA_SUBMISSION -100 -50 1 26 76
//     |cool, easy confidence. She knows she's going to win, that she might as well just walk up, yank the weapon from your hand, and push you into the dirt. At this point, you're not even sure you'd resist...
//     |the same unbridled battle-lust you remember from last time.
//     |the haughty confidence befitting a proud amazonian warrior... and a hint of anger, too, like she's ready to make you pay for your previous defiance.
//     |desperate willfulness, trying to stay calm in the face of you... yet you can see her knuckles whitening around her hammer, barely restrained from launching herself at you with a berzerker frenzy. You must really be getting under her skin!
//     |unabashed, shameless lust. You can see her breathing harder the closer she comes, and her black nipples are already tenting her hide bustier... not to mention the blatant bulge in her breeches. She knows how this is going to end... and yet she's not turning away. Either she's starting to love getting beat down by you, or she's just that desperate to turn things around...]

//     <i>"You again..."</i> she growls, planting the head of her hammer in the dusty earth between you. <i>"[flags.ARONA_WON_LAST|You just keep coming back for more, huh? Well, who am I to deny such a willing fuck-toy, huh? C'mon, girls, let's get some battle practice in before I ream [pc.himHer] into the dirt!|If you think I'm going to let you go after last time... think again! Gonna kick your ass this time... and then fuck it hard! C'mon, girls!]"</i>

//     The other orcs laugh and advance in behind their leader, clearly eager to get a taste of you -- in the fight and afterwards.
// `;
// const testText = `

// [attacker.CombatName] lashes out at [target.combatName] with its jaws open, slobbering mouth and terrifying fangs on display at it lunges at [target.combatName], attempting to get its maw around [target.combatHisHer] limbs. [
//     hitMiss
//     |[target.CombatName] fail[tps|s] to avoid the attack, and [target.combatHeShe] soon feel[tps|s] the feral wolf's teeth digging painfully into [target.combatHisHer] flesh, ripping and tearing before [target.combatName] manage[tps|s] to shake the vicious beast off, leaving it reeling back and barking angrily... and [target.combatName] with a nasty wound.
//     |Despite the vicious beast's speed, [target.combatName] manage[tps|s] to avoid the wolf's attack, sidestepping the snarling canine as it pounces and leaving it to land behind you, seeming all the more angry after a missed strike.
// ]`;
const testText = `[pc.cockRange 12|leaning your cock forward in her grasp so that it nestles between your bodies, getting massaged with every slight shift and press of her wiggling body.|aiming your prick forward and nestling it between her pussylips, using them to stroke you faster and faster, humping her entire body against you.]`;
// const testText = `This [pc.weapon] is great for you[party.solo||r party].`;
// const testText = `"Look! [A] orange" ball."`;
// const testText = `You [pc.tagTest clear no false hit|tag [pc.himHer]|didn't tag [pc.himHer]] with [a] ball.`;
// const testText = `[pc.range 0.5 1.0 |0.5|1.0|no]`;
// const testText = `[a] ball`;
// const testText = `[
//     pc
//     |asdf
//     |qwer
//     |zxcv
// ]`;

// const tokens = lex(testText);
const states = lex(testText, true);
// console.log(testText.split('\n')
//     .reduce((list: number[], line) => {
//         list.push(line.length + (list.length > 0 ? list[list.length - 1] + 1 : 0));
//         return list;
//     }, []));

console.log('----------- Lexer');
// for (const token of tokens)
//     console.log(chalk.magenta(token.range) + ' ' + chalk.cyan(token.type));
console.log('-----------------------');
for (const state of states)
    console.log(
        chalk.magenta(`[${state.lineNum}:${state.offset}]`) +
        chalk.magenta(new TextRange(state.token.range.start, state.token.range.end) + '') + ' ' +
        chalk.cyan(state.token.type) + ' ' +
        chalk.yellow(`<${state.codeStack.reverse()}>`) + ' ' +
        state.text
    );
console.log('-----------------------');

const ast = parse(states.map((state) => state.token), testText);
// const ast = parse(tokens, testText);
// const astFromStates = parse(states.map((state) => state.token), testText);
console.log('----------- Parser');
console.log('----------- Errors');
for (const error of ast.errors)
    console.log(chalk.magenta(error.range + '') + ' ' + chalk.red(error.msg));
console.log('-----------------------');
// for (const error of astFromStates.errors)
//     console.log(chalk.magenta(error.range) + ' ' + chalk.red(error.msg));
console.log('-----------------------');
printTree(ast.node as SyntaxNode, (depth, node) =>
    '  '.repeat(depth) +
    chalk.magenta(node.range + '') + ' ' +
    chalk.cyan(node.type) + ' ' +
    (node instanceof ValueNode ? node.value : '')
);
console.log('-----------------------');
// printTree(astFromStates.node, (depth, node) =>
//     '  '.repeat(depth) +
//     chalk.magenta(new TextRange(node.range.start, node.range.end)) + ' ' +
//     chalk.cyan(node.type) + ' ' +
//     (node instanceof ValueNode ? node.value : '')
// );
console.log('-----------------------');

const result = interpret(ast.node, ParserTagMask, globals, true);
console.log('----------- Interpreter');
console.log('----------- Errors');
for (const error of result.errors)
    console.log(chalk.magenta(error.node.range + '') + ' ' + chalk.red(error.msg));
console.log('-----------------------');
console.log(result.result.reduce((prev, value) => prev + value.value, ''));
console.log('-----------------------');
// for (const node of result.result)
//     console.log(node);
console.log('-----------------------');
// printTree(result.tree, (depth, node) =>
//     '  '.repeat(depth) +
//     chalk.magenta(node.syntax.range + '') + ' ' +
//     chalk.cyan(node.syntax.type) + ' ' +
//     node.result
// );
console.log('-----------------------');

function printTree<T extends { children: T[] }>(root: T, format: (depth: number, data: T) => string) {
    const nodeStack = [{ depth: 0, node: root }];
    let cur: { depth: number, node: T } | undefined;
    while (nodeStack.length > 0) {
        cur = nodeStack.shift();
        if (cur) {
            console.log(format(cur.depth, cur.node));

            if (cur.node.children.length > 0) {
                nodeStack.unshift(...cur.node.children.map((child) => ({ depth: cur!.depth + 1, node: child })));
            }
        }
    }
}
