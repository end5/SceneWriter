import { TextRange } from "./TextRange";

export class Product<V> {
    public constructor(
        public readonly range: TextRange | TextRange[],
        public value: V,
        public code: string,
    ) { }
}
