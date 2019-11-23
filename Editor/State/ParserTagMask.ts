import { ParserTags, ParserTagComponent, isParserTagGroup } from '../../src/ParserList';
import { ICodeMask, ICodeGroup, ICodeComponents } from '../Parser/CodeMask';

export const ParserTagMask = genParserTagMask(ParserTags);

function genParserTagMask(tagList: typeof ParserTags): ICodeMask {
    const dict: ICodeMask = {};

    // Load Tags
    for (const tag of tagList) {
        if (isParserTagGroup(tag)) {
            const groupNameList = Array.isArray(tag.groupName) ? tag.groupName : [tag.groupName];
            for (const groupName of groupNameList) {
                if (dict[groupName] === undefined)
                    dict[groupName] = { nested: {} };

                for (const comp of tag.group) {
                    // Can assert here because dict type = tag type
                    setComponents(comp, (dict[groupName] as ICodeGroup).nested);
                }
            }
        }
        else {
            // Can assert here because dict type = tag type
            setComponents(tag, dict as ICodeComponents);
        }

    }
    return dict;
}

function setComponents(tag: ParserTagComponent, dict: ICodeComponents) {
    const nameList = Array.isArray(tag.name) ? tag.name : [tag.name];
    for (const name of nameList) {
        if (!(name in dict)) {
            dict[name] = {
                innerArgs: tag.args ? tag.args[0] : 0,
                outerArgs: tag.args ? tag.args[1] : 0,
            };
            if (tag.description)
                dict[name].description = tag.description;
            if (tag.example)
                dict[name].example = tag.example;
        }
    }
}
