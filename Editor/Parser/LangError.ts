import { TextRange } from "./TextRange";

export class LangError {
    public readonly level: number = 1;
    public constructor(
        public msg: string,
        public range: TextRange
    ) { }
}
