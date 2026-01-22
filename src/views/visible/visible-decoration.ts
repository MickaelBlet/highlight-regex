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

import * as vscode from 'vscode';

export default class VisibleFileDecorationProvider implements vscode.FileDecorationProvider {
    provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.FileDecoration | undefined {
        if (uri.scheme === 'highlight.regex.treeview.visible.file.uri') {
            let badge: string | number = parseInt(uri.query);
            let tooltip = `${uri.query} regex${badge > 1 ? 'es' : ''} found`
            if (badge > 99) {
                badge = '++';
            }
            return {
                badge: `${badge}`,
                tooltip: tooltip,
                // color: new vscode.ThemeColor('textLink.activeForeground'),
                propagate: false // don't propagate to children elements
            };
        }
        if (uri.scheme === 'highlight.regex.treeview.visible.uri') {
            let badge: string | number = parseInt(uri.query);
            let tooltip = `${uri.query} occurence${badge > 1 ? 's' : ''} found`
            if (badge > 99) {
                badge = '++';
            }
            return {
                badge: `${badge}`,
                tooltip: tooltip,
                // color: new vscode.ThemeColor('textLink.activeForeground'),
                propagate: false // don't propagate to children elements
            };
        }
        return undefined;
    }
}
