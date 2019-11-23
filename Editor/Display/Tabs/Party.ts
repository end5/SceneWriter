import { multiOptionField } from '../Fields';
import { EditorState } from '../../State/EditorState';
import { GameInfo } from '../../State/GameInfo';

const charKeys = Object.keys(GameInfo.CHARS).filter((name) => name !== 'pc' && GameInfo.CHARS[name].canGainExp);

export function loadPartyTab(partyContent: HTMLElement, state: EditorState) {
    while (partyContent.firstChild)
        partyContent.removeChild(partyContent.firstChild);

    const div = document.createElement('div');
    div.className = 'content dark';

    div.appendChild(multiOptionField('Party', state.saveObj.party, 'members', {
        type: 'multioption',
        options: { list: charKeys },
        max: 2,
        transform: (list) => ['pc'].concat(list)
    }));

    partyContent.appendChild(div);
}
