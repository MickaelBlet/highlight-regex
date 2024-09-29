/*
MIT License

Copyright (c) 2022-2024 Mickaël Blet

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
const vscode = require('vscode');

class Parser {

	constructor(name, logger, configuration, regexesConfiguration) {
		this.name = name;
		this.active = true;
		this.cacheEditorLimit = 0;
		this.logger = logger;
		this.regexes = [];
		this.decorations = [];
		this.cacheEditors = [];
		this.cacheEditorList = [];
		this.loadConfigurations(configuration, regexesConfiguration);
	}

	//
	// PUBLIC
	//

	// load configuration from contributions
	loadConfigurations(configuration, regexesConfiguration) {
		let loadRegexes = (configuration, regex, regexLevel = 0) => {
			// transform 'a(?: )bc(def(ghi)xyz)' to '(a)((?: ))(bc)((def)(ghi)(xyz))'
			let addHiddenMatchGroups = (sRegex) => {
				let jumpToEndOfBrace = (text, index) => {
					let level = 1;
					while (level > 0) {
						index++;
						if (index == text.length) {
							break;
						}
						switch (text[index]) {
							case '}':
								if ('\\' !== text[index - 1]) {
									level--;
									if ('?' === text[index + 1]) {
										index++; // jump '}'
									}
								}
								break;
							default:
								break;
						}
					}
					return index;
				}

				let jumpToEndOfBracket = (text, index) => {
					let level = 1;
					while (level > 0) {
						index++;
						if (index == text.length) {
							break;
						}
						switch (text[index]) {
							case ']':
								if ('\\' !== text[index - 1]) {
									level--;
									if ('*' === text[index + 1]) {
										index++; // jump ']'
										if ('?' === text[index + 1]) {
											index++; // jump '*'
										}
									}
									else if ('+' === text[index + 1]) {
										index++; // jump ']'
										if ('?' === text[index + 1]) {
											index++; // jump '+'
										}
									}
									else if ('?' === text[index + 1]) {
										index++; // jump ']'
										if ('?' === text[index + 1]) {
											index++; // jump '?'
										}
									}
									else if ('{' === text[index + 1]) {
										index++; // jump ']'
										index = jumpToEndOfBrace(text, index);
									}
								}
								break;
							default:
								break;
						}
					}
					return index;
				}

				let jumpToEndOfParenthesis = (text, index) => {
					let level = 1;
					while (level > 0) {
						index++;
						if (index == text.length) {
							break;
						}
						switch (text[index]) {
							case '(':
								if ('\\' !== text[index - 1]) {
									level++;
								}
								break;
							case ')':
								if ('\\' !== text[index - 1]) {
									level--;
									if ('*' === text[index + 1]) {
										index++; // jump ')'
										if ('?' === text[index + 1]) {
											index++; // jump '*'
										}
									}
									else if ('+' === text[index + 1]) {
										index++; // jump ')'
										if ('?' === text[index + 1]) {
											index++; // jump '+'
										}
									}
									else if ('?' === text[index + 1]) {
										index++; // jump ')'
										if ('?' === text[index + 1]) {
											index++; // jump '?'
										}
									}
									else if ('{' === text[index + 1]) {
										index++; // jump ')'
										index = jumpToEndOfBrace(text, index);
									}
								}
								break;
							case '[':
								if ('\\' !== text[index - 1]) {
									index = jumpToEndOfBracket(text, index);
								}
								break;
							default:
								break;
						}
					}
					return index;
				}

				let splitOrRegex = (text) => {
					let ret = [];
					let start = 0;
					let end = 0;
					for (let i = 0; i < text.length; i++) {
						// is bracket
						if ('[' === text[i] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
							i = jumpToEndOfBracket(text, i);
						}
						// is real match group
						if ('(' === text[i] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
							i = jumpToEndOfParenthesis(text, i);
						}
						// is or
						if ('|' === text[i]) {
							end = i;
							ret.push(text.substr(start, end - start));
							start = i + 1;
						}
					}
					if (start > 0) {
						ret.push(text.substr(start, text.length - start));
					}
					else {
						ret.push(text);
					}
					return ret;
				}
				function hasMatchGroup(str) {
					let hasGroup = false;
					// check if match group exists
					for (let i = 0; i < str.length; i++) {
						if ('[' === str[i] && (i == 0 || i > 0 && '\\' !== str[i - 1])) {
							i = jumpToEndOfBracket(str, i);
						}
						if ('(' === str[i] && (i == 0 || i > 0 && '\\' !== str[i - 1])) {
							hasGroup = true;
							break;
						}
					}
					return hasGroup;
				}

				function convertBackSlash(str, offset, input) {
					return '####B4CKSL4SHB4CKSL4SH####';
				}
				function reloadBackSlash(str, offset, input) {
					return '\\\\';
				}

				// replace all '\\'
				let sRegexConverted = sRegex.replace(/\\\\/gm, convertBackSlash);

				let matchIndexToReal = { 0: 0 };
				let matchNamedToReal = {};
				let matchDependIndexes = { 0: [] };

				// not match group found
				if (!hasMatchGroup(sRegexConverted)) {
					// default return
					return {
						sRegex,
						matchIndexToReal,
						matchNamedToReal,
						matchDependIndexes
					};
				}

				// -------------------------------------------------------------------------
				// create a newRegex

				let newStrRegex = '';

				let index = 1;
				let realIndex = 1;

				let findGroups = (text, parentIndexes = [], dependIndexes = []) => {
					let addSimpleGroup = (str, prefix = '(', sufix = ')') => {
						// update newRegex
						newStrRegex += prefix + str + sufix;

						// add depend
						dependIndexes.push(index);

						index++;
					}
					let getEndOfGroup = (str, i) => {
						while (i > 0 && ')' !== str[i]) {
							i--;
						}
						return i;
					}

					let start = 0;
					let end = 0;

					for (let i = 0; i < text.length; i++) {
						// is not capture group
						if ('(' === text[i] && '?' === text[i + 1] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
							// set cursor before found
							end = i;
							if (end - start > 0) {
								// before
								addSimpleGroup(text.substr(start, end - start));
							}

							// check type of not capture group

							i++; // jump '('
							i++; // jump '?'

							// is assert
							if ('<' === text[i] && ('=' === text[i + 1] || '!' === text[i + 1])) {
								newStrRegex += '((?<' + text[i + 1];
								i++; // jump '<'
								start = i + 1;
								i = jumpToEndOfParenthesis(text, i);
								end = i;
							}
							// is assert
							else if ('=' === text[i] || '!' === text[i]) {
								newStrRegex += '((?' + text[i];
								start = i + 1;
								i = jumpToEndOfParenthesis(text, i);
								end = i;
							}
							// is named
							else if ('<' === text[i]) {
								newStrRegex += '((?:';
								start = i + 1;
								for (let j = i; j < text.length; j++) {
									i++;
									if (text[j] === '>') {
										break;
									}
								}

								matchNamedToReal[text.substr(start, i - start - 1)] = index;

								// add index in real
								matchIndexToReal[realIndex] = index;
								matchDependIndexes[index] = dependIndexes.filter(item => !parentIndexes.includes(item));

								realIndex++;

								start = i;
								i = jumpToEndOfParenthesis(text, i);
								end = i;
							}
							// is non capture group
							else if (':' === text[i]) {
								newStrRegex += '((?:';
								start = i + 1;
								i = jumpToEndOfParenthesis(text, i);
								end = i;
							}
							else {
								console.error('bad pattern ?');
							}

							// get the end of group ')[...]'
							let endGroup = getEndOfGroup(text, end);
							// get content of group
							let sGroup = text.substr(start, endGroup - start);

							// add in depend
							dependIndexes.push(index);
							parentIndexes.push(index);

							index++;

							let splitRegex = splitOrRegex(sGroup);
							for (let j = 0; j < splitRegex.length; j++) {
								if (j > 0) {
									newStrRegex += '|';
								}
								findGroups(splitRegex[j], parentIndexes.slice(), dependIndexes.slice());
							}

							parentIndexes.pop();

							newStrRegex += ')' + text.substr(endGroup + 1, end - endGroup) + ')';

							start = i + 1; // jump ')'
						}
						// is bracket
						if ('[' === text[i] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
							i = jumpToEndOfBracket(text, i);
						}
						// is real match group
						if ('(' === text[i] && '?' !== text[i + 1] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
							// set cursor before found
							end = i;
							if (end - start > 0) {
								// before
								addSimpleGroup(text.substr(start, end - start));
							}

							start = i + 1;
							i = jumpToEndOfParenthesis(text, i);
							end = i;

							// get the end of group ')[...]'
							let endGroup = getEndOfGroup(text, end);
							// get content of group
							let sGroup = text.substr(start, endGroup - start);

							// add index in real
							matchIndexToReal[realIndex] = index;
							matchDependIndexes[index] = dependIndexes.filter(item => !parentIndexes.includes(item));

							dependIndexes.push(index);
							parentIndexes.push(index);

							index++;
							realIndex++;

							newStrRegex += '(';

							if (end !== endGroup) {
								newStrRegex += '(?:';
							}

							let splitRegex = splitOrRegex(sGroup);
							for (let j = 0; j < splitRegex.length; j++) {
								if (j > 0) {
									newStrRegex += '|';
								}
								findGroups(splitRegex[j], parentIndexes.slice(), dependIndexes.slice());
							}

							parentIndexes.pop();

							if (end !== endGroup) {
								newStrRegex += ')' + text.substr(endGroup + 1, end - endGroup);
							}

							newStrRegex += ')';

							start = i + 1;
						}
					}
					if (start > 0 && text.length > (end + 1) && text.length - start > 0) {
						addSimpleGroup(text.substr(start, text.length - start));
					}
					else if (start == 0) {
						newStrRegex += text;
					}
				}
				let splitRegex = splitOrRegex(sRegexConverted);
				for (let i = 0; i < splitRegex.length; i++) {
					if (i > 0) {
						newStrRegex += '|';
					}
					findGroups(splitRegex[i]);
				}

				// rollback replace all '\\'
				newStrRegex = newStrRegex.replace(/####B4CKSL4SHB4CKSL4SH####/gm, reloadBackSlash);
				return {
					sRegex: newStrRegex,
					matchIndexToReal,
					matchNamedToReal,
					matchDependIndexes
				};
			}
			if (regex.regex === undefined) {
				throw 'regex not found';
			}
			if (typeof regex.regex !== 'string') {
				regex.regex = regex.regex.join('');
			}
			let regexRegExp = new RegExp(regex.regex, (regex.regexFlag) ? regex.regexFlag : configuration.defaultRegexFlag);
			regexRegExp.test();
			// add hide groups
			let { sRegex, matchIndexToReal, matchNamedToReal, matchDependIndexes } = addHiddenMatchGroups(regex.regex);
			regexRegExp = new RegExp(sRegex, (regex.regexFlag) ? regex.regexFlag : configuration.defaultRegexFlag);
			regexRegExp.test();
			let decorationList = [];
			let regexList = [];
			if (regex.regexes?.length > 0) {
				for (let regexes of regex.regexes) {
					regexList.push(loadRegexes(configuration, regexes, regexLevel + 1));
				}
			}
			if (regex.decorations?.length > 0) {
				regex.decorations.sort((a, b) => {
					let keyA = (a.index) ? a.index : 0;
					let keyB = (b.index) ? b.index : 0;
					if (keyA < keyB) return 1;
					if (keyA > keyB) return -1;
					return 0;
				});
				for (let decoration of regex.decorations) {
					// force copy
					let decorationCopy = JSON.parse(JSON.stringify(decoration));
					let index = (decorationCopy.index) ? decorationCopy.index : 0;
					let hoverMessage = (decorationCopy.hoverMessage) ? decorationCopy.hoverMessage : undefined;
					if (hoverMessage && typeof hoverMessage !== 'string') {
						hoverMessage = hoverMessage.join('');
					}
					// z-index for background level
					if (decorationCopy.backgroundColor) {
						decorationCopy.backgroundColor += '; z-index: ' + ((-100 * (10 - regexLevel)) + index)
					}
					else {
						decorationCopy.backgroundColor = 'transparent; z-index: ' + ((-100 * (10 - regexLevel)) + index)
					}
					delete decorationCopy.index;
					delete decorationCopy.hoverMessage;
					decorationList.push({
						index: index,
						hoverMessage: hoverMessage,
						decoration: this.decorations.length,
					});
					this.decorations.push(vscode.window.createTextEditorDecorationType(decorationCopy));
				}
			}
			return {
				index: (regex.index) ? regex.index : 0,
				regexRegExp: regexRegExp,
				matchIndexToReal: matchIndexToReal,
				matchNamedToReal: matchNamedToReal,
				matchDependIndexes: matchDependIndexes,
				regexCount: 0,
				regexLimit: (regex.regexLimit) ? regex.regexLimit : configuration.defaultRegexLimit,
				regexes: regexList,
				decorations: decorationList
			};
		}
		// reset regex
		this.regexes = [];
		this.decorations = []
		this.cacheEditors = [];
		this.cacheEditorList = [];
		this.cacheEditorLimit = configuration.cacheLimit;
		// load regexes configuration
		for (let regexList of regexesConfiguration) {
			// compile regex
			try {
				let active = (regexList.active === undefined) ? true : regexList.active;
				// stock languages
				let languages = (regexList.languageIds) ? regexList.languageIds : undefined;
				let languageRegex = new RegExp((regexList.languageRegex) ? regexList.languageRegex : '.*', '');
				languageRegex.test();
				let filenameRegex = new RegExp((regexList.filenameRegex) ? regexList.filenameRegex : '.*', '');
				filenameRegex.test();
				let regexes = [];
				if (regexList.regexes?.length > 0) {
					for (let regex of regexList.regexes) {
						regexes.push(loadRegexes(configuration, regex));
					}
				}
				this.regexes.push({
					active: active,
					languages: languages,
					languageRegex: languageRegex,
					filenameRegex: filenameRegex,
					regexes: regexes
				});
			}
			catch (error) {
				console.error(this.name + ': ' + error);
				this.logger.error(this.name + ': ' + error.toString());
				vscode.window.showErrorMessage(error.toString(), 'Close');
			}
		}
	}

	resetDecorations(editor) {
		if (!editor) {
			return;
		}
		try {
			for (let decoration of this.decorations) {
				// disable old decoration
				editor.setDecorations(decoration, []);
			}
			this.logger.info(this.name + ': Reset decorations at \'' + editor.document.fileName + '\'');
		}
		catch (error) {
			console.error(this.name + ': ' + error);
			this.logger.error(this.name + ': ' + error.toString());
		}
	}

	updateDecorations(editor) {
		if (!editor) {
			return;
		}
		let key = editor.document.uri.toString(true);
		if (!this.active) {
			if (key in this.cacheEditors) {
				delete this.cacheEditors[key];
				// remove element on cache editor list
				this.cacheEditorList.splice(this.cacheEditorList.indexOf(key), 1);
			}
			return;
		}
		if (!(key in this.cacheEditors)) {
			if (this.cacheEditorList.length > this.cacheEditorLimit) {
				let firstCacheEditor = this.cacheEditorList.shift();
				if (firstCacheEditor) {
					delete this.cacheEditors[firstCacheEditor];
				}
			}
			this.cacheEditorList.push(key);
		}
		this.cacheEditors[key] = [];
		let cacheRanges = [];
		for (const _ in this.decorations) {
			cacheRanges.push([]);
		}
		var recurseSearchDecorations = (regex, text, index = 0) => {
			let search;
			regex.regexCount = 0;
			regex.regexRegExp.lastIndex = 0;
			while (search = regex.regexRegExp.exec(text)) {
				regex.regexCount++;
				if (regex.regexCount > regex.regexLimit) {
					console.warn(this.name + ': Count overload pattern: ' + regex.regexRegExp.source + ' > ' + regex.regexLimit);
					this.logger.warn(this.name + ': Count overload pattern ' + regex.regexRegExp.source + ' > ' + regex.regexLimit);
					break;
				}
				if (search[0].length == 0) {
					console.error(this.name + ': Bad pattern: ' + regex.regexRegExp.source);
					this.logger.error(this.name + ': Bad pattern ' + regex.regexRegExp.source);
					break;
				}
				if (regex.decorations && regex.decorations.length > 0) {
					for (let decoration of regex.decorations) {
						if (decoration.decoration === undefined) {
							continue;
						}
						let decorationRealIndex;
						if (typeof decoration.index === 'number') {
							decorationRealIndex = regex.matchIndexToReal[decoration.index];
						}
						else {
							decorationRealIndex = regex.matchNamedToReal[decoration.index];
						}
						if (decorationRealIndex < search.length && search[decorationRealIndex] && search[decorationRealIndex].length > 0) {
							let decorationIndex = search.index;
							for (let j = 0; j < regex.matchDependIndexes[decorationRealIndex].length; j++) {
								if (search[regex.matchDependIndexes[decorationRealIndex][j]]) {
									decorationIndex += search[regex.matchDependIndexes[decorationRealIndex][j]].length;
								}
							}
							let vsRange = new vscode.Range(
								editor.document.positionAt(index + decorationIndex),
								editor.document.positionAt(index + decorationIndex + search[decorationRealIndex].length)
							);
							if (decoration.hoverMessage) {
								let htmlHovermessage = new vscode.MarkdownString();
								htmlHovermessage.supportHtml = true;
								htmlHovermessage.isTrusted = true;
								htmlHovermessage.appendMarkdown(decoration.hoverMessage);
								cacheRanges[decoration.decoration].push({
									range: vsRange,
									hoverMessage: htmlHovermessage
								});
							}
							else {
								cacheRanges[decoration.decoration].push({
									range: vsRange
								});
							}
						}
					}
				}
				if (regex.regexes && regex.regexes.length > 0) {
					for (let insideRegex of regex.regexes) {
						let insideRegexRealIndex;
						if (typeof insideRegex.index === 'number') {
							insideRegexRealIndex = regex.matchIndexToReal[insideRegex.index];
						}
						else {
							insideRegexRealIndex = regex.matchNamedToReal[insideRegex.index];
						}
						if (insideRegexRealIndex < search.length && search[insideRegexRealIndex] && search[insideRegexRealIndex].length > 0) {
							let regexIndex = search.index;
							for (let j = 0; j < regex.matchDependIndexes[insideRegexRealIndex].length; j++) {
								if (search[regex.matchDependIndexes[insideRegexRealIndex][j]]) {
									regexIndex += search[regex.matchDependIndexes[insideRegexRealIndex][j]].length;
								}
							}
							recurseSearchDecorations(insideRegex, search[insideRegexRealIndex], index + regexIndex);
						}
					}
				}
			}
		}
		let useWithRegexes = false;
		let startTime = Date.now();
		let text = editor.document.getText();
		try {
			// search all regexes
			for (let regexes of this.regexes) {
				// has regex
				if (regexes.regexes === undefined) {
					continue;
				}
				// isActive
				if (regexes.active === false) {
					continue;
				}
				// check language
				if (regexes.languages != undefined) {
					this.logger.debug(this.name + ': Test list [' + regexes.languages + '] with \'' + editor.document.languageId + '\' at \'' + editor.document.fileName + '\'');
					if (regexes.languages.indexOf(editor.document.languageId) < 0) {
						continue;
					}
				}
				else {
					this.logger.debug(this.name + ': Test regex \'' + regexes.languageRegex + '\' with \'' + editor.document.languageId + '\' at \'' + editor.document.fileName + '\'');
					if (!regexes.languageRegex.test(editor.document.languageId)) {
						continue;
					}
				}
				this.logger.debug(this.name + ': Test regex \'' + regexes.filenameRegex + '\' with \'' + editor.document.fileName + '\' at \'' + editor.document.fileName + '\'');
				if (!regexes.filenameRegex.test(editor.document.fileName)) {
					continue;
				}
				useWithRegexes = true;
				// foreach regexes
				for (let regex of regexes.regexes) {
					recurseSearchDecorations(regex, text);
				}
			}

		}
		catch (error) {
			console.error(this.name + ': ' + error);
			this.logger.error(this.name + ': ' + error.toString());
		}

		if (useWithRegexes === false) {
			return;
		}

		try {
			let countDecoration = 0;
			for (const decorationIndex in cacheRanges) {
				countDecoration += cacheRanges[decorationIndex].length;
				editor.setDecorations(
					this.decorations[decorationIndex],
					cacheRanges[decorationIndex]
				);
			}
			if (countDecoration > 0) {
				this.logger.debug(this.name + ': Update decorations at \'' + editor.document.fileName + '\' in ' + (Date.now() - startTime) + ' millisecond(s) with ' + (countDecoration) + ' occurence(s)');
				this.logger.info(this.name + ': Update decorations at \'' + editor.document.fileName + '\' with ' + (countDecoration) + ' occurence(s)');
			}
			this.cacheEditors[key] = cacheRanges;
		}
		catch (error) {
			console.error(this.name + ': ' + error);
			this.logger.error(this.name + ': ' + error.toString());
		}
	}

	cacheDecorations(editor) {
		if (!editor || !this.active) {
			return;
		}
		try {
			let startTime = Date.now();
			let key = editor.document.uri.toString(true);
			if (key in this.cacheEditors && this.cacheEditors[key]) {
				// move key to the end of cached list
				this.cacheEditorList.splice(this.cacheEditorList.indexOf(key), 1);
				this.cacheEditorList.push(key);

				let countDecoration = 0;
				const cacheRanges = this.cacheEditors[key];
				for (const decorationIndex in cacheRanges) {
					countDecoration += cacheRanges[decorationIndex].length;
					editor.setDecorations(
						this.decorations[decorationIndex],
						cacheRanges[decorationIndex]
					);
				}
				if (countDecoration > 0) {
					this.logger.debug(this.name + ': Cached decorations at \'' + editor.document.fileName + '\' in ' + (Date.now() - startTime) + ' millisecond(s) with ' + (countDecoration) + ' occurence(s)');
					this.logger.info(this.name + ': Cached decorations at \'' + editor.document.fileName + '\' with ' + (countDecoration) + ' occurence(s)');
				}
			}
			else {
				this.logger.debug(this.name + ': Cached decorations not exists at \'' + editor.document.fileName + '\'');
				this.updateDecorations(editor);
			}
		}
		catch (error) {
			console.error(this.name + ': ' + error);
			this.logger.error(this.name + ': ' + error.toString());
		}
	}

	toggle(visibleTextEditors) {
		this.active = !this.active;
		if (this.active) {
			for (let i = 0; i < visibleTextEditors.length; i++) {
				this.cacheDecorations(visibleTextEditors[i]);
			}
		}
		else {
			for (let i = 0; i < visibleTextEditors.length; i++) {
				this.resetDecorations(visibleTextEditors[i]);
			}
		}
	}

}; // class Parser

function activate(context) {
	const nameOfProperties = 'highlight.regex';
	const configuration = vscode.workspace.getConfiguration(nameOfProperties);
	let logger = vscode.window.createOutputChannel('Highlight regex', { 'log': true });

	let parserGlobalObj = new Parser('global', logger, configuration, configuration.regexes);
	let parserMachineObj = new Parser('machine', logger, configuration, configuration.machine.regexes);
	let parserWorkspaceObj = new Parser('workspace', logger, configuration, configuration.workspace.regexes);

	let regexesConfigurations = [
		{
			scope: 'global',
			propertyName: nameOfProperties + '.regexes',
			regexes: vscode.workspace.getConfiguration(nameOfProperties).regexes,
			changed: false,
			parser: parserGlobalObj
		},
		{
			scope: 'machine',
			propertyName: nameOfProperties + '.machine.regexes',
			regexes: vscode.workspace.getConfiguration(nameOfProperties).machine.regexes,
			changed: false,
			parser: parserMachineObj
		},
		{
			scope: 'workspace',
			propertyName: nameOfProperties + '.workspace.regexes',
			regexes: vscode.workspace.getConfiguration(nameOfProperties).workspace.regexes,
			changed: false,
			parser: parserWorkspaceObj
		}
	]

	// quickpick
	let quickpick = vscode.window.createQuickPick();
	quickpick.placeholder = 'Name of regex';
	quickpick.title = 'Choose your regexes';
	quickpick.canSelectMany = true;

	// quickpick actions
	quickpick.onDidAccept(() => {
		logger.debug('quickpick: onDidAccept');
		quickpick.hide();
	});
	quickpick.onDidHide(() => {
		logger.debug('quickpick: onDidHide');
		logger.debug('quickpick: updateSettings');
		for (let regexesConfiguration of regexesConfigurations) {
			if (regexesConfiguration.changed) {
				vscode.workspace.getConfiguration().update(
					regexesConfiguration.propertyName,
					regexesConfiguration.regexes,
					vscode.ConfigurationTarget.Workspace
				);
			}
		}
	});
	quickpick.onDidChangeSelection((selectedItems) => {
		logger.debug('quickpick: onDidChangeSelection');
		if (selectedItems) {
			for (let regexesConfiguration of regexesConfigurations) {
				for (let i = 0; i < regexesConfiguration.regexes?.length; i++) {
					let index = 0;
					for (const result of selectedItems) {
						if (result.scope == regexesConfiguration.scope && result.index == i) {
							break;
						}
						index++;
					}
					if (index === selectedItems.length) {
						if (regexesConfiguration.regexes[i].active) {
							regexesConfiguration.changed = true;
							regexesConfiguration.regexes[i].active = false;
						}
					}
					else {
						if (regexesConfiguration.regexes[i].active == undefined || regexesConfiguration.regexes[i].active == false) {
							regexesConfiguration.changed = true;
							regexesConfiguration.regexes[i].active = true;
						}
					}
				}
			}
			let visibleTextEditors = vscode.window.visibleTextEditors;
			for (let regexConfiguration of regexesConfigurations) {
				if (regexConfiguration.changed) {
					for (let textEditor of visibleTextEditors) {
						regexConfiguration.parser.resetDecorations(textEditor);
					}
					regexConfiguration.parser.loadConfigurations(configuration, regexConfiguration.regexes);
					for (let textEditor of visibleTextEditors) {
						triggerUpdate(textEditor);
					}
				}
			}
		}
	});

	// commands subscriptions
	context.subscriptions.push(
		vscode.commands
			.registerCommand('highlight.regex.choose.names', () => {
				logger.debug('command: highlight.regex.choose.names');
				let quickpickItems = [];
				let quickpickSelectItems = [];
				for (let regexesConfiguration of regexesConfigurations) {
					regexesConfiguration.changed = false;
					quickpickItems.push({
						label: regexesConfiguration.scope,
						kind: -1
					});
					for (let i = 0; i < regexesConfiguration.regexes?.length; i++) {
						const regexes = regexesConfiguration.regexes[i];
						try {
							let item = {
								// take the first regex if name not exissts
								label: regexes.name === undefined ? regexes.regexes[0].regex : regexes.name,
								description: regexes.description,
								scope: regexesConfiguration.scope,
								index: i,
								picked: regexes.active === undefined ? true : regexes.active
							};
							quickpickItems.push(item);
							if (item.picked) {
								quickpickSelectItems.push(item);
							}
						}
						catch (error) {
							console.error('quickpick: ' + error);
							logger.error('quickpick: ' + error.toString());
						}
					}
				}
				quickpick.items = quickpickItems;
				quickpick.selectedItems = quickpickSelectItems;
				logger.debug('quickpick: show');
				quickpick.show();
			})
	);
	context.subscriptions.push(
		vscode.commands
			.registerCommand('highlight.regex.toggle', () => {
				logger.debug('command: highlight.regex.toggle');
				parserGlobalObj.toggle(vscode.window.visibleTextEditors);
				parserMachineObj.toggle(vscode.window.visibleTextEditors);
				parserWorkspaceObj.toggle(vscode.window.visibleTextEditors);
			})
	);
	context.subscriptions.push(
		vscode.commands
			.registerCommand('highlight.regex.global.toggle', () => {
				logger.debug('command: highlight.regex.global.toggle');
				parserGlobalObj.toggle(vscode.window.visibleTextEditors);
			})
	);
	context.subscriptions.push(
		vscode.commands
			.registerCommand('highlight.regex.machine.toggle', () => {
				logger.debug('command: highlight.regex.machine.toggle');
				parserMachineObj.toggle(vscode.window.visibleTextEditors);
			})
	);
	context.subscriptions.push(
		vscode.commands
		.registerCommand('highlight.regex.workspace.toggle', () => {
				logger.debug('command: highlight.regex.workspace.toggle');
				parserWorkspaceObj.toggle(vscode.window.visibleTextEditors);
			})
	);

	let lastVisibleEditors = [];
	let timeoutTimer = [];

	// first launch
	let visibleTextEditors = vscode.window.visibleTextEditors;
	for (let i = 0; i < visibleTextEditors.length; i++) {
		triggerUpdate(visibleTextEditors[i]);
	}

	// event configuration change
	vscode.workspace.onDidChangeConfiguration(event => {
		logger.debug('event: onDidChangeConfiguration');
		const affectedGlobal = event.affectsConfiguration(nameOfProperties + '.regexes');
		const affectedMachine = event.affectsConfiguration(nameOfProperties + '.machine.regexes');
		const affectedWorkspace = event.affectsConfiguration(nameOfProperties + '.workspace.regexes');
		const configuration = vscode.workspace.getConfiguration(nameOfProperties);
		let visibleTextEditors = vscode.window.visibleTextEditors;
		for (let i = 0; i < visibleTextEditors.length; i++) {
			if (affectedGlobal) {
				parserGlobalObj.resetDecorations(visibleTextEditors[i]);
			}
			if (affectedMachine) {
				parserMachineObj.resetDecorations(visibleTextEditors[i]);
			}
			if (affectedWorkspace) {
				parserWorkspaceObj.resetDecorations(visibleTextEditors[i]);
			}
		}
		if (affectedGlobal) {
			regexesConfigurations[0].regexes = vscode.workspace.getConfiguration(nameOfProperties).regexes;
			parserGlobalObj.loadConfigurations(configuration, configuration.regexes);
		}
		if (affectedMachine) {
			regexesConfigurations[1].regexes = vscode.workspace.getConfiguration(nameOfProperties).machine.regexes;
			parserMachineObj.loadConfigurations(configuration, configuration.machine.regexes);
		}
		if (affectedWorkspace) {
			regexesConfigurations[2].regexes = vscode.workspace.getConfiguration(nameOfProperties).workspace.regexes;
			parserWorkspaceObj.loadConfigurations(configuration, configuration.workspace.regexes);
		}
		for (let i = 0; i < visibleTextEditors.length; i++) {
			triggerUpdate(visibleTextEditors[i]);
		}
	});

	// event change all text editor
	vscode.window.onDidChangeVisibleTextEditors(visibleTextEditors => {
		if (visibleTextEditors.length > 0) {
			logger.debug('event: onDidChangeVisibleTextEditors: ' + visibleTextEditors.length + ' editor(s):');
			for (const uriEditor of visibleTextEditors.map((editor) => editor.document.uri.toString(true))) {
				logger.debug('- ' + uriEditor);
			}
		}
		let newVisibleEditors = [];
		for (let i = 0; i < visibleTextEditors.length; i++) {
			let key = visibleTextEditors[i].document.uri.toString(true) + visibleTextEditors[i].viewColumn;
			newVisibleEditors[key] = true;
			if (!(key in lastVisibleEditors)) {
				triggerUpdate(visibleTextEditors[i], false);
			}
		}
		lastVisibleEditors = newVisibleEditors;
	});

	// event change text content
	vscode.workspace.onDidChangeTextDocument(event => {
		let openEditors = vscode.window.visibleTextEditors.filter(
			(editor) => editor.document.uri === event.document.uri
		);
		let isNotLogOuput = false;
		for (let i = 0; i < openEditors.length; i++) {
			if ('output' != openEditors[i].document.uri.scheme || !openEditors[i].document.uri.toString(true).includes('Highlight regex')) {
				isNotLogOuput = true;
				triggerUpdate(openEditors[i]);
			}
		}
		if (isNotLogOuput && openEditors.length > 0) {
			logger.debug('event: onDidChangeTextDocument: ' + openEditors.length + ' editor(s):')
			for (const uriEditor of openEditors.map((editor) => editor.document.uri.toString(true))) {
				logger.debug('- ' + uriEditor);
			}
		}
	});

	// trigger call update decoration
	function triggerUpdate(editor, update = true) {
		let key = editor.document.uri.toString(true) + editor.viewColumn;
		if (key in timeoutTimer && timeoutTimer[key]) {
			clearTimeout(timeoutTimer[key]);
		}
		if (update) {
			timeoutTimer[key] = setTimeout(() => {
				parserGlobalObj.updateDecorations(editor);
				parserMachineObj.updateDecorations(editor);
				parserWorkspaceObj.updateDecorations(editor);
			}, configuration.delay);
		}
		else {
			timeoutTimer[key] = setTimeout(() => {
				parserGlobalObj.cacheDecorations(editor);
				parserMachineObj.cacheDecorations(editor);
				parserWorkspaceObj.cacheDecorations(editor);
			}, 0);
		}
	}
}

function desactivate() { }

module.exports = { activate, desactivate }