import { TextRange } from "./TextRange";

export class LangWarning {
    public readonly level: number = 0;
    public constructor(
        public range: TextRange,
        public msg: string
    ) { }
}

export class LangError {
    public readonly level: number = 1;
    public constructor(
        public range: TextRange,
        public msg: string
    ) { }
}
