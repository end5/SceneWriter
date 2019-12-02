export type ExternalFunc = (args: (string | number)[], results: string[]) => number | string

export type ParserObjDict = Record<string, ParserObject>;
export type ParserObjValue = boolean | string | number | ExternalFunc;
interface ParserObjBase {
    // info: ObjectInfo;
}
export interface ParserObjWithValue extends ParserObjBase {
    value: ParserObjValue;
}
export interface ParserObjWithChildren extends ParserObjBase {
    children: Record<string, ParserObject>;
}

export type ParserObject = ParserObjWithValue | ParserObjWithChildren;

export interface ObjectInfo {
    description: string;
    innerArgs?: number;
    outerArgs?: number;
    example?: string;
}
