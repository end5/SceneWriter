export class ConditionBuilder {
    private iflist: [string, string][] = [];
    private elseResult?: string;

    public if(condition: string, result: string) {
        this.iflist.push([condition, result])
        return this;
    }

    public elseif(condition: string, result: string) {
        this.iflist.push([condition, result])
        return this;
    }

    public else(result: string) {
        this.elseResult = result;
        return this;
    }

    public build() {
        let str = '';
        for (const entry of this.iflist) {
            str += '(' + entry[0] + ' ? ' + entry[1] + ' : ';
        }
        str += (this.elseResult || '""') + ')';
        return str;
    }
}
