import { TextRange } from '../../../Parser/TextRange';

export class TextMarkerHandler implements EventListenerObject {
    private textMarker: CodeMirror.TextMarker | undefined;
    public constructor(
        public readonly instance: CodeMirror.Editor,
        public readonly range: TextRange
    ) { }

    public handleEvent(event: Event) {
        if (event.type === 'mouseenter') {
            this.textMarker = this.instance.getDoc().markText(
                {
                    line: this.range.start.line,
                    ch: this.range.start.col
                },
                {
                    line: this.range.end.line,
                    ch: this.range.end.col
                },
                {
                    className: 'select-original-value'
                });
        }
        else if (event.type === 'mouseout' && this.textMarker) {
            this.textMarker.clear();
        }
    }
}
