import { IGroupedParserTag } from './ParserTagList';

export class EditorState {
    // Edited save obj
    public saveObj: any;
    // Parser tags
    public parserTags: IGroupedParserTag[] = [];
    // CodeMirror
    public codeMirror?: CodeMirror.Editor;
    // Element to put result from editor parser
    public previewContent?: HTMLDivElement;
    // Element to put result from game parser
    public gameRawContent?: HTMLDivElement;
}
