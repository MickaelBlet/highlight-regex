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

import { registerCacheCommands } from './cache';
import { registerRefreshCommands } from './refresh';
import { registerQuickPickCommands } from './quickpick';
import { registerToggleCommands } from './toggle';
import { registerGlobalHeaderCommands } from './global-header';
import { registerWorkspaceHeaderCommands } from './workspace-header';
import { registerVisibleCommands } from './visible';
import { registerCustomCommands } from './custom';
import { registerGlobalItemCommands } from './global-item';
import { registerWorkspaceItemCommands } from './workspace-item';

export function registerAllCommands(): void {
    registerCacheCommands();
    registerRefreshCommands();
    registerQuickPickCommands();
    registerToggleCommands();
    registerGlobalHeaderCommands();
    registerWorkspaceHeaderCommands();
    registerVisibleCommands();
    registerCustomCommands();
    registerGlobalItemCommands();
    registerWorkspaceItemCommands();
}
