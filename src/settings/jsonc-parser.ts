/*
MIT License

Copyright (c) 2022-2026 Mickaël Blet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

interface Range {
    start: number;
    end: number;
}

export default class JsoncSettingParser {
    text: string;
    index: number;
    ranges: Record<string, Range>;
    dict: any;

    constructor(text: string) {
        this.text = text;
        this.index = 0;
        this.ranges = {};
        this.load();
    }

    load(): void {
        this.spaceJump();
        switch (this.text[this.index]) {
            case '{':
                this.dict = this.loadObject('');
                this.spaceJump();
                break;
            case '[':
                this.dict = this.loadArray('');
                this.spaceJump();
                break;
            case '\0':
                break;
            default:
                throw "Not a valid start character";
        }
        if (this.index != this.text.length) {
            throw "Not a valid end character";
        }
    }

    loadObject(path: string): Record<string, any> {
        let obj: Record<string, any> = {};
        let next = true;
        this.ranges[path] = {
            start: this.index,
            end: this.index
        }
        this.index++; // jump '{'
        this.spaceJump();
        while (this.text[this.index] != '}' && next) {
            if (this.text[this.index] == '\0') {
                throw "End of object not found";
            }
            else if (this.text[this.index] == '"') {
                // search array, object, string, number, bool or null
                let key = this.getKey(obj);
                let element = this.loadType(`${path}/${key}`);
                if (element === undefined) {
                    throw "Bad element in the key";
                }
                obj[key] = element;
            }
            else {
                throw "Key of object not found";
            }
            this.spaceJump();
            // next
            if (this.text[this.index] == ',') {
                this.index++; // jump ','
                next = true;
                this.spaceJump();
            }
            else {
                next = false;
            }
        }
        this.index++; // jump '}'
        this.ranges[path].end = this.index;
        return obj;
    }

    loadArray(path: string): any[] {
        let array: any[] = [];
        let next = true;
        this.ranges[path] = {
            start: this.index,
            end: this.index
        }
        this.index++; // jump '['
        this.spaceJump();
        while (this.text[this.index] != ']' && next) {
            if (this.text[this.index] == '\0') {
                throw "End of array not found";
            }
            // search array, object, string, number, bool or null
            let element = this.loadType(`${path}/[${array.length}]`);
            if (element === undefined) {
                throw "Bad element of array";
            }
            array.push(element);
            this.spaceJump();
            // next
            if (this.text[this.index] == ',') {
                this.index++; // jump ','
                next = true;
                this.spaceJump();
            }
            else {
                next = false;
            }
        }
        this.index++; // jump ']'
        this.ranges[path].end = this.index;
        return array;
    }

    getKey(obj: Record<string, any>): string {
        // parser key
        this.index++; // jump '"'
        let start = this.index;
        // search end quote
        while (this.text[this.index] != '"') {
            if (this.text[this.index] == '\\' && (this.text[this.index + 1] == '"' || this.text[this.index + 1] == '\\')) {
                this.index++;
            }
            else if (this.text[this.index] == '\0') {
                throw "End of key";
            }
            else if (this.text[this.index] == '\n') {
                throw "New line in key";
            }
            this.index++;
        }
        // get key
        let key = this.text.substring(start, this.index);
        if (obj && key in obj) {
            throw "Key already exist";
        }
        this.index++; // jump '"'
        this.spaceJump();
        if (this.text[this.index] != ':') {
            throw "Need definition of object";
        }
        this.index++; // jump ':'
        this.spaceJump();
        return key;
    }

    loadType(path: string): any {
        let element: any = undefined;
        switch (this.text[this.index]) {
            case '[':
                element = this.loadArray(path);
                break;
            case '{':
                element = this.loadObject(path);
                break;
            case '"':
                element = this.loadString(path);
                break;
            case '-':
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                element = this.loadNumber(path);
                break;
            case 't':
                if (this.text[this.index] == 't' &&
                    this.text[this.index + 1] == 'r' &&
                    this.text[this.index + 2] == 'u' &&
                    this.text[this.index + 3] == 'e') {
                    element = this.loadBool(path, true);
                }
                else {
                    return undefined;
                }
                break;
            case 'f':
                if (this.text[this.index] == 'f' &&
                    this.text[this.index + 1] == 'a' &&
                    this.text[this.index + 2] == 'l' &&
                    this.text[this.index + 3] == 's' &&
                    this.text[this.index + 4] == 'e') {
                    element = this.loadBool(path, false);
                }
                else {
                    return undefined;
                }
                break;
            case 'n':
                if (this.text[this.index] == 'n' &&
                    this.text[this.index + 1] == 'u' &&
                    this.text[this.index + 2] == 'l' &&
                    this.text[this.index + 3] == 'l') {
                    element = this.loadNull(path);
                }
                else {
                    return undefined;
                }
                break;
            default:
                return undefined;
        }
        return element;
    }

    loadNull(path: string): null {
        this.ranges[path] = {
            start: this.index,
            end: this.index
        }
        this.index += 4;
        this.ranges[path].end = this.index;
        return null;
    }

    loadBool(path: string, boolean: boolean): boolean {
        this.ranges[path] = {
            start: this.index,
            end: this.index
        }
        if (boolean) {
            this.index += 4;
        }
        else {
            this.index += 5;
        }
        this.ranges[path].end = this.index;
        return boolean;
    }

    loadNumber(path: string): number {
        this.ranges[path] = {
            start: this.index,
            end: this.index
        }
        if (this.text[this.index] == '0' && this.text[this.index + 1] >= '0' && this.text[this.index + 1] <= '9') {
            throw "Octal number not allowed";
        }
        let startsWith = (text: string, reg: string, offset: number): string => {
            let regex = new RegExp(`^.{${offset}}(${reg})`, 's');
            let found = text.match(regex);
            if (found) {
                return found[1];
            }
            else {
                throw "Bad number format";
            }
        }
        let number = startsWith(this.text, '[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?', this.index);
        this.index += number.length;
        this.ranges[path].end = this.index;
        return parseFloat(number);
    }

    loadString(path: string): string {
        this.index++; // jump '"'
        this.ranges[path] = {
            start: this.index,
            end: this.index
        }
        let start = this.index;
        // search end quote
        while (this.text[this.index] != '"') {
            if (this.text[this.index] == '\\' && (this.text[this.index + 1] == '"' || this.text[this.index + 1] == '\\')) {
                this.index++;
            }
            if (this.text[this.index] == '\0') {
                throw "End of string";
            }
            if (this.text[this.index] == '\n') {
                throw "New line in string";
            }
            this.index++;
        }
        let str = this.text.substring(start, this.index);
        this.ranges[path].end = this.index;
        this.index++; // jump '"'
        return str;
    }

    spaceJump(): void {
        this.commentJump();
        // isspace
        while ((this.text[this.index] >= '\t' && this.text[this.index] <= '\r') || this.text[this.index] == ' ') {
            this.index++;
            this.commentJump();
        }
    }

    commentJump(): void {
        if (this.text[this.index] == '/' && this.text[this.index + 1] == '*') {
            this.index += 2; // jump "/*"
            while (this.text[this.index] != '\0' && (this.text[this.index] != '*' || this.text[this.index + 1] != '/')) {
                this.index++; // jump character
            }
            if (this.text[this.index] != '\0') {
                this.index += 2; // jump "*/"
            }
        }
        else if (this.text[this.index] == '/' && this.text[this.index + 1] == '/') {
            while (this.text[this.index] != '\0' && this.text[this.index] != '\n') {
                this.index++; // jump character
            }
            if (this.text[this.index] != '\0') {
                this.index++; // jump '\n'
            }
        }
    }
}
