import { ParserError } from '../../../Parser/Parser';
import { InterpretErrorNode } from '../../../Parser/Interpreter';
import { createElement } from '../../Create';
import { TextMarkerHandler } from './TextMarkerHandler';
import { ResultNode } from '../../../Parser/InterpretNode';

const lineWidgets: CodeMirror.LineWidget[] = [];
const textMarkers: CodeMirror.TextMarker[] = [];

export function clearErrors() {
    while (lineWidgets.length > 0)
        lineWidgets.pop()!.clear();
    while (textMarkers.length > 0)
        textMarkers.pop()!.clear();
}

export function renderParserErrors(instance: CodeMirror.Editor, errors: ParserError[]) {
    if (errors.length > 0) {
        for (const error of errors) {
            lineWidgets.push(
                instance.addLineWidget(
                    error.range.end.line,
                    createElement('span', {
                        className: 'editor-error',
                        text: `[${error.range.start.col}:${error.range.end.col}] ` + error.msg
                    })
                )
            );
            textMarkers.push(instance.getDoc().markText(
                { line: error.range.start.line, ch: error.range.start.col },
                { line: error.range.end.line, ch: error.range.end.col },
                { className: 'cm-error' }
            ));
        }
    }
}

export function renderPreviewInterpretResult(instance: CodeMirror.Editor, content: HTMLElement, results: ResultNode[]) {
    let newEl;
    for (const node of results) {
        if (node.value instanceof HTMLElement)
            newEl = node.value;
        else
            newEl = createElement('span', node.value);

        const eventHandler = new TextMarkerHandler(instance, node.range);
        newEl.addEventListener('mouseenter', eventHandler, true);
        newEl.addEventListener('mouseout', eventHandler, true);

        content.appendChild(newEl);

        instance.getDoc().markText(
            {
                line: node.range.start.line,
                ch: node.range.start.col
            },
            {
                line: node.range.end.line,
                ch: node.range.end.col
            },
            {
                className: 'yes-display'
            });
    }
}

export function renderInterpretErrors(instance: CodeMirror.Editor, errors: InterpretErrorNode[]) {
    if (errors.length > 0) {
        for (const error of errors) {
            lineWidgets.push(
                instance.addLineWidget(
                    error.node.range.end.line,
                    createElement('span', {
                        className: 'editor-error',
                        text: `[${error.node.range.start.col}:${error.node.range.end.col}] ` + error.msg
                    })
                )
            );
            textMarkers.push(instance.getDoc().markText(
                { line: error.node.range.start.line, ch: error.node.range.start.col },
                { line: error.node.range.end.line, ch: error.node.range.end.col },
                { className: 'cm-error' }
            ));
        }
    }
}
