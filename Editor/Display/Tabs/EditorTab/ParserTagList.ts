import { createFilterBar, createElement } from '../../Create';
import { IGroupedParserTag, createStringFromTag } from '../../../State/ParserTagList';
import { GameInfo } from '../../../State/GameInfo';

let parserTagsTabLoaded = false;

export function loadTagsTab(parent: HTMLElement, parserTags: IGroupedParserTag[], editor: CodeMirror.Editor) {
    if (!parserTagsTabLoaded) {
        parent.id = 'parser-tags';

        if (!editor) throw new Error('CodeMirror not loaded');
        loadParserTagList(parent, parserTags, editor);
        parserTagsTabLoaded = true;
    }
}

function loadParserTagList(parent: HTMLElement, parserTags: IGroupedParserTag[], editor: CodeMirror.Editor) {

    const info = new RenderInfo(parserTags);

    const filterBar = createTagFilterBar(info);

    const tagGroupList = new ParserTagGroupList();

    const content = document.createElement('div');
    content.id = 'parser-tag-content';
    content.className = 'content light';

    // UL for parser tag buttons
    const listEl = document.createElement('ul');
    listEl.id = 'parser-tag-list';
    listEl.className = 'dark';
    content.appendChild(listEl);

    // Parser Tag Description
    const desc = new ParserTagDesc();
    content.appendChild(desc.element);

    // Page buttons
    const pageButtons = createPageButtons(info);
    content.appendChild(pageButtons);

    const uniqueTagGroups = [...new Set(parserTags.map((tag) => tag.group))];
    if (uniqueTagGroups.length === 0) throw new Error('No keys in groupKeys');

    const tabs = uniqueTagGroups.map((tag) => tagGroupList.createItem(tag, () => {
        info.pageNum = 0;
        info.activeGroupKey = tag;
        info.filterTags();
        info.updateTagButtons();
    }));

    tabs[0].click();

    parent.appendChild(filterBar);
    parent.appendChild(tagGroupList.element);
    parent.appendChild(content);

    // Render parser tag buttons and add it for a resize
    renderTagButtons(info, listEl, desc, editor);
    window.addEventListener('resize', () => {
        renderTagButtons(info, listEl, desc, editor);
    });
}

class RenderInfo {
    public filter = '';
    public parserTags: IGroupedParserTag[];
    public filteredTags: IGroupedParserTag[];
    public activeGroupKey = '';
    public pageNum = 0;
    public parserTagButtons: ParserTagButton[] = [];
    public constructor(parserTags: IGroupedParserTag[]) {
        this.parserTags = parserTags;
        this.filteredTags = parserTags;
    }

    public filterTags() {
        this.filteredTags = this.parserTags.filter((tag) => tag.group === this.activeGroupKey && (tag.postDot ? tag.postDot : tag.preDot).toLocaleLowerCase().includes(this.filter.toLocaleLowerCase()));
    }

    public updateTagButtons() {
        let index = this.parserTagButtons.length * this.pageNum;

        for (const tagButton of this.parserTagButtons) {
            if (index < this.filteredTags.length) {
                tagButton.setParserTag(this.filteredTags[index]);
                tagButton.show();
            }
            else {
                tagButton.hide();
            }
            index++;
        }
    }
}

function createTagFilterBar(info: RenderInfo) {
    const filterDiv = document.createElement('div');
    filterDiv.className = 'filter-div light';
    const filterBar = createFilterBar();

    filterBar.addEventListener('keyup', () => {
        info.pageNum = 0;
        info.filter = filterBar.value;
        info.filterTags();
        info.updateTagButtons();
    });

    filterDiv.appendChild(filterBar);
    return filterDiv;
}

class ParserTagGroupList {
    protected listEl: HTMLUListElement;

    private inactiveStyle = 'dark';
    private activeStyle = 'light';

    private buttons: HTMLButtonElement[] = [];

    public constructor() {
        this.listEl = document.createElement('ul');
        this.listEl.id = 'parser-group-list';
        this.listEl.className = 'tabs vertical ' + this.inactiveStyle;
    }

    public get element() { return this.listEl; }

    public createItem(name: string, redraw: () => void) {
        const li = document.createElement('li');

        const button = document.createElement('button');
        button.textContent = name;
        button.className = 'tab ' + this.inactiveStyle;

        button.addEventListener('click', () => {
            for (const aButton of this.buttons)
                aButton.classList.replace(this.activeStyle, this.inactiveStyle);

            button.classList.replace(this.inactiveStyle, this.activeStyle);

            redraw();
        });

        this.buttons.push(button);
        li.appendChild(button);
        this.listEl.appendChild(li);
        return button;
    }
}

class ParserTagButton {
    public readonly element: HTMLLIElement;
    private helpButton: HTMLButtonElement;
    private tagButton: HTMLButtonElement;
    private tag?: IGroupedParserTag;
    public constructor(
        public editor: CodeMirror.Editor,
        public desc: ParserTagDesc
    ) {
        this.element = document.createElement('li');
        this.element.className = 'parser-tag';

        this.helpButton = document.createElement('button');
        this.helpButton.textContent = '?';
        this.helpButton.className = 'parser-tag-help dark';
        this.helpButton.addEventListener('click', () => {
            while (this.desc.textEl.firstChild)
                this.desc.textEl.removeChild(this.desc.textEl.firstChild);

            if (!this.tag) throw new Error('No parser tag');

            if (this.tag.descCode) {
                this.desc.textEl.appendChild(createElement('div', 'Code'));
                this.desc.textEl.appendChild(createElement('span', this.tag.descCode));
            }
            if (this.tag.desc) {
                this.desc.textEl.appendChild(createElement('div', 'Description'));
                this.desc.textEl.appendChild(createElement('span', this.tag.desc));
            }
            if (this.tag.example) {
                this.desc.textEl.appendChild(createElement('div', 'Example'));
                this.desc.textEl.appendChild(createElement('span', this.tag.example));
                this.desc.textEl.appendChild(createElement('div', 'Example Result'));
                this.desc.textEl.appendChild(createElement('span', GameInfo.Parser.parse(this.tag.example)));
            }

            this.desc.show();
        });

        this.tagButton = document.createElement('button');
        this.tagButton.className = 'parser-tag-name dark';
        this.tagButton.addEventListener('click', () => {
            if (!this.tag) throw new Error('No parser tag');
            this.editor.getDoc().replaceRange(createStringFromTag(this.tag), this.editor.getDoc().getCursor());
        });

        this.element.appendChild(this.helpButton);
        this.element.appendChild(this.tagButton);
    }

    public getParserTag() {
        return this.tag;
    }

    public setParserTag(tag: IGroupedParserTag) {
        this.tag = tag;
        if (this.tag.postDot)
            this.tagButton.textContent = this.tag.postDot;
        else
            this.tagButton.textContent = this.tag.preDot;
    }

    public hide() {
        this.element.classList.add('collapsed');
    }

    public show() {
        this.element.classList.remove('collapsed');
    }
}

function createPageButtons(info: RenderInfo) {
    const pageButtons = document.createElement('div');
    pageButtons.className = 'page-buttons light';

    const prevButton = document.createElement('button');
    prevButton.className = 'button-pair dark';
    prevButton.textContent = 'Previous';
    prevButton.addEventListener('click', () => {
        info.pageNum--;
        if (info.pageNum < 0)
            info.pageNum = 0;
        info.updateTagButtons();
    });

    const nextButton = document.createElement('button');
    nextButton.className = 'button-pair dark';
    nextButton.textContent = 'Next';
    nextButton.addEventListener('click', () => {
        info.pageNum++;
        if (info.parserTagButtons.length === 0) throw new Error('No parser tag buttons');
        if (info.pageNum * info.parserTagButtons.length >= info.filteredTags.length)
            info.pageNum = Math.floor(info.filteredTags.length / info.parserTagButtons.length);
        info.updateTagButtons();
    });

    pageButtons.appendChild(prevButton);
    pageButtons.appendChild(nextButton);
    return pageButtons;
}

class ParserTagDesc {
    public readonly element: HTMLDivElement;
    public readonly textEl: HTMLDivElement;
    public constructor() {
        this.element = document.createElement('div');
        this.element.id = 'parser-tag-desc';
        this.element.className = 'dark collapsed';

        const closeButton = document.createElement('button');
        closeButton.className = 'dark';
        closeButton.textContent = '✖';
        closeButton.id = 'parser-tag-desc-close';
        this.element.appendChild(closeButton);

        const title = document.createElement('div');
        title.className = 'dark';
        title.textContent = 'Description';
        title.id = 'parser-tag-desc-title';
        this.element.appendChild(title);

        this.textEl = document.createElement('div');
        this.textEl.className = 'dark';
        this.textEl.id = 'parser-tag-desc-content';
        this.element.appendChild(this.textEl);

        closeButton.addEventListener('click', () => {
            this.element.className += ' collapsed';
        });
    }

    public show() {
        this.element.classList.remove('collapsed');
    }

    public hide() {
        this.element.className += ' collapsed';
    }
}

function renderTagButtons(info: RenderInfo, listEl: HTMLUListElement, desc: ParserTagDesc, editor: CodeMirror.Editor) {
    if (info.parserTagButtons.length <= 0) {
        const parserTagButton = new ParserTagButton(editor, desc);
        info.parserTagButtons.push(parserTagButton);
        listEl.appendChild(parserTagButton.element);
    }

    let totalButtonHeight = info.parserTagButtons.reduce((value, button) => value + button.element.offsetHeight, 0);

    if (totalButtonHeight === 0) throw new Error('Cannot get ParserTagButton element offset height');

    // Add buttons
    while (totalButtonHeight < listEl.offsetHeight && info.parserTagButtons.length > 0) {
        const parserTagButton = new ParserTagButton(editor, desc);
        listEl.appendChild(parserTagButton.element);
        info.parserTagButtons.push(parserTagButton);
        totalButtonHeight += parserTagButton.element.offsetHeight;
    }

    // Remove buttons
    while (totalButtonHeight > listEl.offsetHeight && info.parserTagButtons.length > 0) {
        const parserButton = info.parserTagButtons.pop()!;
        totalButtonHeight -= parserButton.element.offsetHeight;
        listEl.removeChild(parserButton.element);
    }

    info.updateTagButtons();
}
