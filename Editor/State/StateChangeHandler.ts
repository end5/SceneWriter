import { GameInfo } from './GameInfo';
import { EditorState } from './EditorState';
import { clearErrors, renderParserErrors, renderInterpretErrors, renderPreviewInterpretResult } from '../Display/Tabs/EditorTab/Preview';
import { lex } from '../Parser/Lexer';
import { parse } from '../Parser/Parser';
import { interpret } from '../Parser/Interpreter';
import { ParserTagMask } from './ParserTagMask';
import { createElement } from '../Display/Create';
import { signal } from 'codemirror';

function clear(el: HTMLElement) {
    while (el.lastChild)
        el.removeChild(el.lastChild);
}

// Called on dirty game state
export function refreshEngine(state: Required<EditorState>) {
    GameInfo.SaveLoad.loadSaveObject(state.saveObj);
    [GameInfo.comp] = [GameInfo.comp1, GameInfo.comp2] = GameInfo.PlayerParty.actualCompanions();
}

// Called on dirty game state
// Called on CodeMirror change
export function refreshOutput(state: Required<EditorState>) {
    const text = state.codeMirror.getValue();

    clearErrors();

    const tokens = lex(text);
    const parseResult = parse(tokens, text);
    renderParserErrors(state.codeMirror, parseResult.errors);
    const interpretResult = interpret(parseResult.node, ParserTagMask, GameInfo);
    renderInterpretErrors(state.codeMirror, interpretResult.errors);
    clear(state.previewContent);
    renderPreviewInterpretResult(state.codeMirror, state.previewContent, interpretResult.result);
    clear(state.gameRawContent);
    state.gameRawContent.appendChild(createElement('span', GameInfo.Parser.parse(GameInfo.textify`${text}`)));
}

// Called when load save
export function refreshCodeMirror(state: Required<EditorState>) {
    if (state.saveObj.editorText && typeof state.saveObj.editorText === 'string') {
        state.codeMirror.setValue(state.saveObj.editorText);
        signal(state.codeMirror, 'change', state.codeMirror);
        state.codeMirror.refresh();
    }
}
