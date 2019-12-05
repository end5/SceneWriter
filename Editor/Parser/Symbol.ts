export type SymbolType = 'number' | 'string' | 'boolean' | 'function' | 'object';

interface Symbol<T extends SymbolType> {
    type: T;
}

export type Symbols = NumberSymbol | StringSymbol | BooleanSymbol | FuncSymbol | ObjectSymbol;

export interface NumberSymbol extends Symbol<'number'> {
    value: number;
}
export interface StringSymbol extends Symbol<'string'> {
    value: string;
}
export interface BooleanSymbol extends Symbol<'boolean'> {
    value: boolean;
}

export type ExternalFunc = (args: (string | number)[], results: string[]) => number | string;
export interface FuncSymbol extends Symbol<'function'> {
    value: ExternalFunc;
    argCount?: number;
    resultCount?: number;
    toCode?: (identity: string, args: string[], results: string[]) => string;
}

export interface ObjectSymbol extends Symbol<'object'> {
    children: Record<string, Symbols>;
}
