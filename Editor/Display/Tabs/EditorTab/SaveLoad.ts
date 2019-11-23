export function loadSaveLoad(parent: HTMLElement) {
    const background = document.createElement('div');
    background.className = 'content dark';
    background.id = 'save-load-bar';

    const loadButton = document.createElement('button');
    loadButton.textContent = 'Load';
    loadButton.className = 'tab dark';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'tab dark';

    const saveInput = document.createElement('input');
    saveInput.type = 'text';
    saveInput.placeholder = 'filename.coc2';

    background.appendChild(loadButton);
    background.appendChild(saveButton);
    background.appendChild(saveInput);
    parent.appendChild(background);

    return { saveButton, loadButton, saveInput };
}
