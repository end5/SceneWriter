import { ICodeMask, isCodeMaskGroup } from './CodeMask';

export function checkCode(mask: ICodeMask, preDot: string, postDotOrExists: string | true | undefined, innerArgCount: number, outerArgCount: number): string | void {

    if (!(preDot in mask)) {
        return `"${preDot}" does not exist`;
    }

    let parserTag = mask[preDot];

    if (postDotOrExists === true) {
        if (innerArgCount > 0)
            return `Checking existence should not have inner args`;
        if (outerArgCount > 2)
            return `Checking existence should not have more than 2 outer args`;
        return;
    }

    if (isCodeMaskGroup(parserTag)) {
        if (!postDotOrExists)
            return `"${preDot}" needs a "." and a optional value`;

        // postDot can have a capital first letter [pc.hairColor] or [pc.HairColor]
        const postDotNoFirstCap = postDotOrExists.slice(0, 1).toLowerCase() + postDotOrExists.slice(1);
        if (!(postDotOrExists in parserTag.nested) && !(postDotNoFirstCap in parserTag.nested)) {
            return `"${postDotOrExists}" does not exist in "${preDot}"`;
        }

        if (postDotOrExists in parserTag.nested)
            parserTag = parserTag.nested[postDotOrExists];
        else
            parserTag = parserTag.nested[postDotNoFirstCap];
    }
    else {
        if (postDotOrExists)
            return `"${preDot}" cannot accept "${postDotOrExists}"`;
    }

    if (parserTag.innerArgs >= 0 && parserTag.innerArgs < innerArgCount)
        return `"${preDot + (postDotOrExists ? `.${postDotOrExists}` : '')}" expected ${parserTag.innerArgs} inner args, but found ${innerArgCount}`;

    if (parserTag.outerArgs >= 0 && parserTag.outerArgs < outerArgCount)
        return `"${preDot + (postDotOrExists ? `.${postDotOrExists}` : '')}" expected ${parserTag.outerArgs} outer args, but found ${outerArgCount}`;

    if (
        parserTag.innerArgs < 0 && parserTag.outerArgs < 0 &&
        outerArgCount + -(parserTag.outerArgs - parserTag.innerArgs) < (innerArgCount === 0 ? 1 : innerArgCount)
    )
        return `"${preDot + (postDotOrExists ? `.${postDotOrExists}` : '')}" ${outerArgCount - innerArgCount} too many outer args`;
}
