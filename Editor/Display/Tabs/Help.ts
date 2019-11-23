export function loadHelpTab(helpContent: HTMLElement) {
    while (helpContent.firstChild)
        helpContent.removeChild(helpContent.firstChild);

    const content = document.createElement('div');
    content.id = 'help-tab';
    content.className = 'content dark';

    const infoContent = document.createElement('pre');
    const linkHeader = document.createTextNode(`
    Parser Documentation: `);
    const parserDocLink = document.createElement('a');
    parserDocLink.href = 'https://docs.google.com/document/d/194vIJIJUqK5iud4mGVrNYfi9s6eia9U8cNqY-qx4t7g/edit';
    parserDocLink.textContent = 'Link';

    const info = document.createTextNode(`

    Using quotes does not automagically italicize.

    All html purposefully does not work here.
    <i>...</i>
    <b>...</b>

    These parser tags are included for completeness and must be set using the console.
        char, attacker, target
        eParty, targetParty, attackerParty, sexParty
        lastStanding

    If \\ is placed before an opening bracket '[', it won't be recognized as code.
        \\[a] -> [a]

    `);

    infoContent.appendChild(linkHeader);
    infoContent.appendChild(parserDocLink);
    infoContent.appendChild(info);
    content.appendChild(infoContent);
    helpContent.appendChild(content);
}
