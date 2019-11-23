import { charMap } from '../../../State/CharMap';
import { generateMappedFields, generateInfo } from './CharFieldGenerator';
import { TabMenu } from '../../TabMenu';
import { GameInfo } from '../../../State/GameInfo';
import { EditorState } from '../../../State/EditorState';

export function loadCharTab(charContent: HTMLElement, state: EditorState) {
    while (charContent.firstChild)
        charContent.removeChild(charContent.firstChild);

    generateCharList(charContent, state.saveObj.chars);
}

function generateCharList(el: HTMLElement, charObj: any) {
    const menu = new TabMenu({ tabsPos: 'left', inactiveStyle: 'light', activeStyle: 'dark' });

    const charKeys = Object.keys(GameInfo.CHARS);

    let firstTab;
    let name;
    for (const charKey of charKeys) {
        charObj[charKey] = GameInfo.CHARS[charKey].serialize();

        name = charKey;
        if (charObj[charKey].name)
            name = charObj[charKey].name;

        if (!firstTab)
            firstTab = menu.createTab(name, generateCharInfo(charObj[charKey]));
        else
            menu.createTab(name, generateCharInfo(charObj[charKey]));
    }

    el.appendChild(menu.element);

    if (firstTab)
        firstTab.button.click();
}

function generateCharInfo(char: any) {
    return (charsContentEl: HTMLElement) => {
        while (charsContentEl.firstChild)
            charsContentEl.removeChild(charsContentEl.firstChild);

        const infoMenu = new TabMenu({ tabsPos: 'top', inactiveStyle: 'dark', activeStyle: 'light' });

        const starterTags = ['Info', 'Stats', 'Effects', 'Inventory', 'Body'];
        for (const starterTag of starterTags) {
            infoMenu.createTab(starterTag, (charContentEl) => {
                while (charContentEl.firstChild)
                    charContentEl.removeChild(charContentEl.firstChild);

                generateMappedFields(
                    { [starterTag]: { button: undefined, content: charContentEl } },
                    Object.keys(charMap).reverse()
                        // Filter out tags not in this group
                        .filter((key) => charMap[key].groupTag && charMap[key].groupTag!.startsWith(starterTag))
                        .map((key) => generateInfo(char, key, charContentEl, charMap[key]))
                );
            });
        }
        const infoButton = infoMenu.getTab('Info');
        if (infoButton)
            infoButton.button.click();

        charsContentEl.appendChild(infoMenu.element);
    };
}
