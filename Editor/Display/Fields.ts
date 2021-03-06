import { createTextInput, EventFunc, createCheckBox } from './Create';
import { MultiOptionProp } from '../State/MapProps';
import { GlobalOptions } from '../State/Globals';

export interface IDictionary<T> { [x: string]: T; }

export function fieldTitle(key: string) {
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = key;
    return title;
}

function fieldLabel(key: string) {
    const entry = document.createElement('label');
    entry.className = 'field dark';
    const title = fieldTitle(key);
    entry.appendChild(title);
    return entry;
}

export function objectField(text: string) {
    const button = document.createElement('button');
    button.className = 'collapsing-button title dark';
    button.textContent = '⬥';
    if (text)
        button.textContent += ' ' + text;

    const content = document.createElement('div');
    content.className = 'field-content collapsed light';

    button.addEventListener('click', () => {
        if (content.classList.contains('collapsed')) {
            button.classList.replace('dark', 'light');
            content.classList.remove('collapsed');
            button.textContent = '⬦';
        }
        else {
            button.classList.replace('light', 'dark');
            content.classList.add('collapsed');
            button.textContent = '⬥';
        }

        if (text)
            button.textContent += ' ' + text;
    });
    return { button, content };
}

export function stringField(name: string, initialValue: string, changeFunc: EventFunc<HTMLInputElement>) {
    const div = fieldLabel(name);
    const input = createTextInput(initialValue, 'value', changeFunc);
    div.appendChild(input);
    return div;
}

export function booleanField(name: string, initialValue: boolean, changeFunc: EventFunc<HTMLInputElement>) {
    const div = fieldLabel(name);
    const input = createCheckBox(initialValue, 'value', changeFunc);
    div.appendChild(input);
    return div;
}

export function selectField(name: string, initialValue: string | number, options: GlobalOptions, changeFunc: EventFunc<HTMLSelectElement>) {
    const div = fieldLabel(name);
    const selector = document.createElement('select');
    selector.className = 'value';
    options.list.forEach((value, index) => {
        const option = document.createElement('option');
        option.value = index + '';
        option.textContent = value;
        if (options.fromSave && !isNaN(options.fromSave(+initialValue)))
            option.selected = options.fromSave(+initialValue) === index;
        else
            option.selected = initialValue === index || initialValue === value;
        selector.appendChild(option);
    });
    selector.addEventListener('change', changeFunc(selector));
    div.appendChild(selector);
    return div;
}

export function multiOptionField(label: string, obj: IDictionary<any>, objKey: string, mapValue: MultiOptionProp) {
    // Taken directly from fieldLabel
    const div = document.createElement('label');
    div.className = 'field dark';
    const title = fieldTitle(label);
    div.appendChild(title);

    // Counter on max number of selections
    if (mapValue.max)
        title.textContent += ' (0/' + mapValue.max + ')';

    const listEl = document.createElement('ul');
    listEl.className = 'multioption-list';

    const options = mapValue.options.list.map((key, index) => ({
        key,
        index,
        // Check to see if the obj already has this value
        selected: obj[objKey].find((objValue: any) => key === objValue || index === objValue)
    }));

    // Add a counter on max number of selections
    if (mapValue.max) {
        const selectCount = options.filter((item) => item.selected).length;
        title.textContent = label + ' (' + selectCount + '/' + mapValue.max + ')';
    }

    for (const option of options) {
        const listItem = document.createElement('li');
        listItem.className = 'multioption';
        listItem.textContent = option.key;

        if (option.selected)
            listItem.className += ' selected';

        listItem.addEventListener('click', () => {
            let selectedList = options.filter((item) => item.selected);

            // On
            if (!option.selected && (!mapValue.max || (mapValue.max && selectedList.length < mapValue.max))) {
                listItem.classList.add('selected');
                option.selected = true;
            }
            // Off
            else if (option.selected) {
                listItem.classList.remove('selected');
                option.selected = false;
            }

            // Filter again to have the correct items in a sorted order
            selectedList = options.filter((item) => item.selected);

            // Redraw the counter if there is a max
            if (mapValue.max) {
                title.textContent = label + ' (' + selectedList.length + '/' + mapValue.max + ')';
            }

            // If there is a transform func, use the keys of the selected options
            // Else use the indexes of the selected options
            if (mapValue.transform)
                obj[objKey] = mapValue.transform(selectedList.map((item) => item.key));
            else {
                obj[objKey] = selectedList.map((item) => item.index);
            }
        });

        listEl.appendChild(listItem);
    }

    div.appendChild(listEl);

    return div;
}

export function setNumberCallback(obj: IDictionary<any>, key: string, modFunc?: (num: number) => number) {
    return (element: HTMLInputElement | HTMLSelectElement) => () => {
        if (modFunc && !isNaN(+element.value))
            obj[key] = modFunc(+element.value);
        else
            obj[key] = +element.value;
    };
}

export function setStringCallback(obj: IDictionary<any>, key: string) {
    return (inputElement: HTMLInputElement) => () => {
        obj[key] = inputElement.value;
    };
}

export function setSelectorStringCallback(obj: IDictionary<any>, key: string) {
    return (inputElement: HTMLSelectElement) => () => {
        if (inputElement[+inputElement.value].textContent !== 'None')
            obj[key] = inputElement[+inputElement.value].textContent;
    };
}

export function setBooleanCallback(obj: IDictionary<any>, key: string) {
    return (inputElement: HTMLInputElement) => () => {
        obj[key] = inputElement.checked;
    };
}
