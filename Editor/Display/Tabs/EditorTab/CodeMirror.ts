import * as CodeMirror from 'codemirror';

import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import { CodeMirrorLexer } from './CodeMirrorLexer';

const cocMode = {
    name: "CoC",
    factoryFunc: (config: CodeMirror.EditorConfiguration, modeOptions?: any) => {
        if (config.mode === "CoC" || (modeOptions && modeOptions.mode === "CoC")) return new CodeMirrorLexer();
        return;
    }
};

export function loadCodeMirror(parent: HTMLElement) {
    const codeMirrorTextArea = document.createElement('textarea');
    // The element to contain CodeMirror must be added to the document and
    // visible before CodeMirror is loaded or CodeMirror CSS barf
    parent.appendChild(codeMirrorTextArea);

    CodeMirror.defineMode(cocMode.name, cocMode.factoryFunc as any);
    const editor = CodeMirror.fromTextArea(codeMirrorTextArea, {
        lineNumbers: true,
        mode: 'CoC',
        theme: 'lesser-dark',
        lineWrapping: true,
    });

    return editor;
}
