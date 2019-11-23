import { ParserTags, isParserTagGroup, ParserTagComponent } from '../../src/ParserList';

export interface IGroupedParserTag {
    group: string;
    preDot: string;
    postDot?: string;
    inner?: number;
    outer?: number;
    desc?: string;
    descCode?: string;
    example?: string;
    result?: string;
}

export function getParserTagList() {
    return genParserTagList(ParserTags);
}

function genParserTagList(tagList: typeof ParserTags): IGroupedParserTag[] {
    let list: IGroupedParserTag[] = [];

    // Load Tags
    for (const tag of tagList) {
        if (isParserTagGroup(tag)) {
            const groupNameList = Array.isArray(tag.groupName) ? tag.groupName : [tag.groupName];
            for (const groupName of groupNameList)
                for (const comp of tag.group) {
                    list = list.concat(createParserTag(groupName, comp, groupName));
                }
        }
        else {
            list = list.concat(createParserTag('other', tag));
        }
    }
    return list;
}

function createParserTag(group: string, comp: ParserTagComponent, preDot?: string): IGroupedParserTag[] {
    const postDotList = Array.isArray(comp.name) ? comp.name : [comp.name];
    return postDotList.map((postDot) => {
        let tag: IGroupedParserTag;
        if (preDot)
            tag = { group, preDot, postDot, inner: 0, outer: 0 };
        else
            tag = { group, preDot: postDot, inner: 0, outer: 0 };
        if (comp.args) {
            tag.inner = comp.args[0];
            tag.outer = comp.args[1];
        }
        if (comp.description) tag.desc = comp.description;
        if (comp.example) tag.example = comp.example;
        tag.descCode = createDescCode(tag);
        return tag;
    });
}

function repeat(str: string, num: number) {
    let text = '';
    for (let index = 1; index <= num; index++) text += str + index + ' ';
    return text;
}

function createDescCode(tag: IGroupedParserTag) {
    let text = '[';
    text += tag.preDot;
    if (tag.postDot)
        text += '.' + tag.postDot;
    if (tag.inner) {
        if (tag.inner !== 0)
            text += ' ';
        if (tag.inner < 0)
            text += '...args ';
        else if (tag.inner > 0)
            text += repeat('arg', tag.inner);
    }
    if (tag.outer)
        if (tag.outer < 0)
            text += '| ...texts ' + '| no match text '.repeat(-tag.outer - 1);
        else if (tag.outer > 0)
            text += repeat('| text', tag.outer);
    text += ']';
    return text;
}

export function createStringFromTag(tag: IGroupedParserTag) {
    let text = '[';
    text += tag.preDot;
    if (tag.postDot)
        text += '.' + tag.postDot;
    if (tag.inner && tag.inner !== 0)
        text += ' ';
    if (tag.outer)
        if (tag.outer < 0)
            text += '|'.repeat(-tag.outer);
        else if (tag.outer > 0)
            text += '|'.repeat(tag.outer);
    text += ']';
    return text;
}
