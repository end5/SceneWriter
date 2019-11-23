export type EventFunc<T> = (element: T) => () => void;

export function createTextInput(initialValue: string, className: string, changeFunc: EventFunc<HTMLInputElement>) {
    const textAreaEl = document.createElement('input');
    textAreaEl.type = 'text';
    textAreaEl.className = className;
    textAreaEl.value = initialValue;
    if (changeFunc)
        textAreaEl.addEventListener('change', changeFunc(textAreaEl));
    return textAreaEl;
}

export function createCheckBox(checked: boolean, className: string, changeFunc: EventFunc<HTMLInputElement>) {
    const checkBoxEl = document.createElement('input');
    checkBoxEl.className = className;
    checkBoxEl.checked = checked;
    checkBoxEl.type = 'checkbox';
    if (changeFunc)
        checkBoxEl.addEventListener('change', changeFunc(checkBoxEl));
    return checkBoxEl;
}

/**
 * Creates a html element
 * @param type HTML element tag name
 * @param options Either the textContent or an object of options
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(type: K, options: string | { text?: string, className?: string, title?: string }) {
    const el = document.createElement(type);
    if (typeof options === 'string')
        el.textContent = options;
    else {
        if (options.className)
            el.className = options.className;
        if (options.text)
            el.textContent = options.text;
        if (options.title)
            el.title = options.title;
    }
    return el;
}

export function createFilterBar() {
    const el = document.createElement('input');
    el.className = 'filter-bar';
    el.type = 'text';
    el.placeholder = 'Filter...';
    return el;
}
