import { stringField, IDictionary } from '../Fields';
import { GameInfo } from '../../State/GameInfo';
import { createFilterBar } from '../Create';
import { FlagsList } from '../../../src/Flags';

export function loadFlagTab(flagContent: HTMLElement) {
    while (flagContent.firstChild)
        flagContent.removeChild(flagContent.firstChild);

    const filterBarDiv = document.createElement('div');
    filterBarDiv.className = 'filter-div dark';
    const filterBar = createFilterBar();

    const ulEl = document.createElement('ul');
    ulEl.className = 'flags';

    // Assume they are all strings or numbers
    const flagNameElPairs = FlagsList.map((flag) => {
        const name = betterDisplayName(flag);
        const el = stringField(name, GameInfo.flags[flag] ? GameInfo.flags[flag] : '', booleanStringOrNumber(GameInfo.flags, flag));
        ulEl.appendChild(el);
        return { name, el };
    });

    filterBar.addEventListener('keyup', () => {
        for (const pair of flagNameElPairs) {
            if (pair.name.toLocaleLowerCase().startsWith(filterBar.value.toLocaleLowerCase())) {
                if (pair.el.classList.contains('collapsed')) {
                    pair.el.classList.toggle('collapsed');
                }
            }
            else if (!pair.el.classList.contains('collapsed')) {
                pair.el.classList.toggle('collapsed');
            }
        }
    });

    filterBarDiv.appendChild(filterBar);
    flagContent.appendChild(filterBarDiv);
    flagContent.appendChild(ulEl);
}

function betterDisplayName(name: string) {
    return name;
    // return !settings.betterFlagNames ? name : name.split('_').map((subStr) => subStr.charAt(0) + subStr.substr(1).toLocaleLowerCase()).join(' ');
}

function booleanStringOrNumber(obj: IDictionary<any>, key: string) {
    return (element: HTMLInputElement | HTMLSelectElement) => () => {
        if (element.value.toLocaleLowerCase() === 'true')
            obj[key] = true;
        else if (element.value.toLocaleLowerCase() === 'false')
            obj[key] = false;
        else if (!isNaN(+element.value))
            obj[key] = +element.value;
        else
            obj[key] = element.value;
    };
}
