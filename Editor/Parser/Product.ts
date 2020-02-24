import { TextRange } from "./TextRange";

export class Product<V, R extends TextRange | TextRange[]> {
    public constructor(
        public readonly range: R,
        public value: V,
        public code: string,
    ) { }
}
