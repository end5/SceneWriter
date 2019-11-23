import { loadTagsTab } from './ParserTagList';
import { TabMenu } from '../../TabMenu';
import { loadCodeMirror } from './CodeMirror';
import { loadSaveLoad } from './SaveLoad';
import { IGroupedParserTag } from '../../../State/ParserTagList';

// Returns a function to get the text
export function loadEditorTab(editorContent: HTMLElement, parserTags: IGroupedParserTag[]) {
    editorContent.id = 'editor-content';
    editorContent.classList.replace('dark', 'light');

    const codeMirror = loadCodeMirror(editorContent);

    const saveLoadBar = loadSaveLoad(editorContent);

    const outputMenu = new TabMenu({ tabsPos: 'top', inactiveStyle: 'light', activeStyle: 'dark' });
    outputMenu.element.id = 'editor-content-output';
    const previewTab = outputMenu.createTab('Interactive');
    previewTab.content.id = 'editor-preview-content';
    const gameRawTab = outputMenu.createTab('Game Raw');
    gameRawTab.content.id = 'editor-game-raw-content';
    const tagsTab = outputMenu.createTab('Parser Tags', () => {
        loadTagsTab(tagsTab.content, parserTags, codeMirror);
    });

    editorContent.appendChild(outputMenu.element);
    previewTab.button.click();

    return Object.assign({ codeMirror, previewContent: previewTab.content, gameRawContent: gameRawTab.content }, saveLoadBar);
}
