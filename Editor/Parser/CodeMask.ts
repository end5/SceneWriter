export interface ICodeComponent {
    innerArgs: number;
    outerArgs: number;
    description?: string;
    example?: string;
    parsedExample?: string;
}

export interface ICodeComponents {
    [postDot: string]: ICodeComponent;
}

export interface ICodeGroup {
    nested: ICodeComponents;
}

export interface ICodeMask {
    [preDot: string]: ICodeGroup | ICodeComponent;
}

export function isCodeMaskGroup(tag: ICodeGroup | ICodeComponent): tag is ICodeGroup {
    return 'nested' in tag;
}
