import { initializer } from '../src/Initializer';
import { initEngine } from '../src/InitEngine';

initializer.run = initEngine;
initEngine();

import { loadEditorTab } from './Display/Tabs/EditorTab/EditorTab';
import { loadCharTab } from './Display/Tabs/CharacterTab/CharacterTab';
import { loadFlagTab } from './Display/Tabs/Flags';
import { loadHelpTab } from './Display/Tabs/Help';
import { TabMenu } from './Display/TabMenu';
import { EditorState } from './State/EditorState';
import { GameInfo } from './State/GameInfo';
import { getParserTagList } from './State/ParserTagList';
import { lex } from './Parser/Lexer';
import { parse } from './Parser/Parser';
import { interpret } from './Parser/Interpreter';
import { ParserTagMask } from './State/ParserTagMask';
import { refreshOutput, refreshEngine, refreshCodeMirror } from './State/StateChangeHandler';
import { saveAs } from 'file-saver';
import { loadPartyTab } from './Display/Tabs/Party';

// Game breaks if there is no pc in the party
GameInfo.PlayerParty.addPartyMember(GameInfo.pc);

const state = new EditorState();

// Init all the things
state.saveObj = GameInfo.SaveLoad.getSaveObject();
state.parserTags = getParserTagList();

// Put it in window so we can access it
if (window) {
    const windowEditor: any = (window as any).editor = state;
    windowEditor.lex = () => {
        if (!state.codeMirror) throw new Error('CodeMirror not loaded');
        return lex(state.codeMirror.getValue());
    };
    windowEditor.parse = () => {
        if (!state.codeMirror) throw new Error('CodeMirror not loaded');
        const editorText = state.codeMirror.getValue();
        return parse(lex(editorText), editorText);
    };
    windowEditor.interpret = () => {
        if (!state.codeMirror) throw new Error('CodeMirror not loaded');
        const editorText = state.codeMirror.getValue();
        const result = parse(lex(editorText), editorText);
        return interpret(result.node, ParserTagMask, GameInfo);
    };
}

const mainScreen = new TabMenu({ tabsPos: 'top', inactiveStyle: 'dark', activeStyle: 'light' });
mainScreen.element.id = 'main';

// The element to contain CodeMirror must be added to the document and
// visible before CodeMirror is loaded or CodeMirror CSS barf
document.body.appendChild(mainScreen.element);

// No redraw
const editor = mainScreen.createTab('Editor');
// Click to make visible
editor.button.click();

// Don't redraw
const elements = loadEditorTab(editor.content, state.parserTags);

// Init more things
state.codeMirror = elements.codeMirror;
state.previewContent = elements.previewContent;
state.gameRawContent = elements.gameRawContent;

// These redraw everytime the tab button is clicked
mainScreen.createTab('Characters', (content) => loadCharTab(content, state));

mainScreen.createTab('Flags', loadFlagTab);

mainScreen.createTab('Party', (content) => loadPartyTab(content, state));

mainScreen.createTab('Help', loadHelpTab);

// Check for things that did not initialize that should have
if (!state.saveObj) throw new Error('Save object not loaded');
if (!state.codeMirror) throw new Error('CodeMirror not loaded');
if (!state.previewContent) throw new Error('Preview tab not loaded');
if (!state.gameRawContent) throw new Error('Game Raw tab not loaded');

// Events that change the state

// Click on Editor tab button
editor.button.addEventListener('click', () => {
    refreshEngine(state as Required<EditorState>);
    refreshOutput(state as Required<EditorState>);
});

// Changing anything in CodeMirror
elements.codeMirror.on('change', () => refreshOutput(state as Required<EditorState>));

// Getting the text from CodeMirror and adding it to the save
elements.saveButton.addEventListener('click', () => {
    const saveObj = state.saveObj;
    if (state.codeMirror)
        saveObj.editorText = state.codeMirror.getDoc().getValue();
    const blob = new Blob([JSON.stringify(saveObj)], { type: 'text/json' });
    saveAs(blob, (elements.saveInput.value || elements.saveInput.placeholder) + '.coc2');
});

// Getting the text from the save, refreshing the engine and adding it to CodeMirror
elements.loadButton.addEventListener('click', () => {
    const input = document.createElement('input');
    input.id = 'load';
    input.type = 'file';
    input.accept = '.coc2';
    input.style.display = 'none';
    input.addEventListener('change', (event: Event) => {
        if (!event.target)
            throw new Error('No event target in file loading');
        const target = event.target as HTMLInputElement;
        if (!target.files || target.files.length === 0)
            throw new Error('No files found');

        elements.saveInput.placeholder = target.files[0].name;
        const file = target.files[0];
        const fileReader = new FileReader();
        fileReader.readAsText(file);
        fileReader.addEventListener('loadend', () => {
            let saveObj: any;
            try {
                if (fileReader.result && typeof fileReader.result === 'string')
                    saveObj = JSON.parse(fileReader.result);
            }
            catch (e) {
                console.error(e);
                alert('Error parsing file');
            }
            if (saveObj) {
                state.saveObj = saveObj;
                refreshEngine(state as Required<EditorState>);
                refreshCodeMirror(state as Required<EditorState>);
                alert('Load Complete');
            }
        });
        fileReader.addEventListener('error', () => {
            alert('Error reading file');
        });
    });
    input.click();
});
