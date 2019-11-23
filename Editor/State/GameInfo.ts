type GameInfo = Window & {
    GLOBALS: any,
    RACES: any,
    POWERS: any,
    ITEMS: any,
    KEYITEMS: any,
    PERKS: any,
    CEFFECTS: any,
    SEFFECTS: any,
    BOONS: any,

    PlayerParty: any,

    CHARS: any,
    pc: any,

    comp: any,
    comp1: any,
    comp2: any,

    flags: any,
    Parser: {
        parse(text: string): string
    },
    SaveLoad: {
        getSaveObject(): any
        loadSaveObject(obj: any): any
    },

    textify: any,
};

export const GameInfo = window as GameInfo;
