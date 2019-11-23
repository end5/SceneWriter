import { GameInfo } from './GameInfo';

function getGlobalsByPrefix(prefix: string) {
    return Object.keys(GameInfo.GLOBALS)
        .filter((key) => key.startsWith(prefix))
        .sort((key) => GameInfo.GLOBALS[key])
        .map((key) => key
            .slice(prefix.length)
            .split('_')
            .map((str) => str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase()).join(' '));
}

function getItemsByType(type: string) {
    return Object.keys(GameInfo.ITEMS)
        .map((key) => [key, new GameInfo.ITEMS[key]()])
        .filter((item) => item[1].type === type)
        .map((item) => item[0] as string);
}

const globalKeys = {
    Race: Object.keys(GameInfo.RACES),
    Taxon: getGlobalsByPrefix('TAXA_'),
    Class: getGlobalsByPrefix('CLASS_'),
    Background: getGlobalsByPrefix('BG_'),
    Affinity: GameInfo.GLOBALS.AFFINITY as string[],
    TFType: Object.keys(GameInfo.GLOBALS.TF_TYPE_PARTS).sort((key) => +key).map((key) => GameInfo.GLOBALS.TF_TYPE_PARTS[key] as string),
    BodyType: getGlobalsByPrefix('BODY_TYPE_'),
    BodyTag: getGlobalsByPrefix('BODY_TAG_'),
    FluidType: getGlobalsByPrefix('FLUID_TYPE_'),
    SkinType: getGlobalsByPrefix('SKIN_TYPE_'),
    NippleType: getGlobalsByPrefix('NIPPLE_TYPE_'),
    HairType: getGlobalsByPrefix('HAIR_TYPE_'),
    Weapons: getItemsByType(GameInfo.GLOBALS.ITEM_PRIMARY),
    ArmorSet: getItemsByType(GameInfo.GLOBALS.ITEM_ARMORSET),
    ItemHead: getItemsByType(GameInfo.GLOBALS.ITEM_HEAD),
    ItemNeck: getItemsByType(GameInfo.GLOBALS.ITEM_NECK),
    ItemShoulders: getItemsByType(GameInfo.GLOBALS.ITEM_SHOULDERS),
    ItemHands: getItemsByType(GameInfo.GLOBALS.ITEM_HANDS),
    ItemWaist: getItemsByType(GameInfo.GLOBALS.ITEM_WAIST),
    ItemFeet: getItemsByType(GameInfo.GLOBALS.ITEM_FEET),
    Rings: getItemsByType(GameInfo.GLOBALS.ITEM_RING),
    TopGarb: getItemsByType(GameInfo.GLOBALS.ITEM_TOPGARB),
    BottomGarb: getItemsByType(GameInfo.GLOBALS.ITEM_BOTGARB),
    Offhand: getItemsByType(GameInfo.GLOBALS.ITEM_OFFHAND),
    TFs: getItemsByType(GameInfo.GLOBALS.ITEM_TF),
    Misc: getItemsByType(GameInfo.GLOBALS.ITEM_MISC),
    Consumable: getItemsByType(GameInfo.GLOBALS.ITEM_CONSUMABLE),
    Set: getItemsByType(GameInfo.GLOBALS.ITEM_SET),
    KeyItems: Object.keys(GameInfo.KEYITEMS),
    Boon: Object.keys(GameInfo.BOONS),
    StatusEffect: Object.keys(GameInfo.SEFFECTS),
    CombatEffect: Object.keys(GameInfo.CEFFECTS),
    Powers: Object.keys(GameInfo.POWERS),
    Perks: Object.keys(GameInfo.PERKS).filter((key) => key !== 'default'),
    Items: [] as string[],
};

interface SaveLoadOverrides {
    toSave?: (n: number) => number;
    fromSave?: (n: number) => number;
}

const overrides = {
    Taxon: {
        toSave: (n) => n + 1,
        fromSave: (n) => n - 1,
    },
    // None = -1
    BodyType: {
        toSave: (n) => n - 1,
        fromSave: (n) => n + 1,
    },
    // None = -1
    FluidType: {
        toSave: (n) => n - 1,
        fromSave: (n) => n + 1,
    },
    // None = -1
    SkinType: {
        toSave: (n) => n - 1,
        fromSave: (n) => n + 1,
    },
    // None = -1
    NippleType: {
        toSave: (n) => n - 1,
        fromSave: (n) => n + 1,
    },
    // None = -1
    HairType: {
        toSave: (n) => n - 1,
        fromSave: (n) => n + 1,
    },
} as Record<keyof typeof globalKeys, SaveLoadOverrides>;

export interface GlobalOptions extends SaveLoadOverrides {
    list: string[];
}

export const globals = genMappedGlobals();

function genMappedGlobals() {
    const obj = {} as Record<keyof typeof globalKeys, GlobalOptions>;
    for (const key of Object.keys(globalKeys) as (keyof typeof globalKeys)[]) {
        if (!obj[key])
            obj[key] = { list: [] };
        obj[key].list = globalKeys[key];
    }

    obj.Items = {
        list: ([] as string[]).concat(
            globalKeys.Weapons,
            globalKeys.ArmorSet,
            globalKeys.ItemHead,
            globalKeys.ItemNeck,
            globalKeys.ItemShoulders,
            globalKeys.ItemHands,
            globalKeys.ItemWaist,
            globalKeys.ItemFeet,
            globalKeys.Rings,
            globalKeys.TopGarb,
            globalKeys.BottomGarb,
            globalKeys.Offhand,
            globalKeys.TFs,
            globalKeys.Misc,
            globalKeys.Set
        )
    };

    for (const key of Object.keys(overrides) as (keyof typeof overrides)[]) {
        if (overrides[key].toSave)
            obj[key].toSave = overrides[key].toSave;
        if (overrides[key].fromSave)
            obj[key].fromSave = overrides[key].fromSave;
    }

    return obj;
}
