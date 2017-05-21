/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
const langserver     = require('vscode-languageserver');
const path           = require('path');
const fs             = require('fs');
const {SymbolParser} = require('./lib/SymbolParser');
const {FileSearcher} = require('./lib/util');
const Uri            = require('vscode-uri').default;

const connection = langserver.createConnection(new langserver.IPCMessageReader(process),
                                             new langserver.IPCMessageWriter(process));
const console = connection.console;

var documents  = new langserver.TextDocuments();
var workspaceRoot;
var luaFiles    = {};
var searchOptions = { filters: [], followLinks: false, externalPaths: [] };
var parseOptions  = { luaversion: 5.1 };
var showGlobalsOnly = true;
var workSpaceSymbols = {};

function printSymbols(fileSymbols, depth) {
    for (var key in fileSymbols) {
        var element = fileSymbols[key];
        if (typeof element != typeof {} || element == null) {
            debug("\t".repeat(depth) + key + ": " + element + "\n");
        } else {
            debug("\t".repeat(depth) + key + ": {\n");
            printSymbols(element, depth + 1);
            debug("\t".repeat(depth) + "}\n");
        }

    }
}

function debug(msg) {
    console.log(msg);
}

function findSymbol(position, fileSymbols) {
    var line      = position.line;
    var character = position.character;
    var reference = fileSymbols.reference;
    var symbol    = null;

    for (var i = 0; i < reference.length; i++) {
        var ref = reference[i];
        if (ref.range.start.line <= line && line <= ref.range.end.line) {
            if (ref.range.start.character <= character && character <= ref.range.end.character) {
                symbol = ref;
                break;
            }
        }
    }

    return symbol;
}

function reparse(uri, isSave) {
    var fileSymbols = workSpaceSymbols[uri];
    if (isSave || (fileSymbols && fileSymbols.ischanged)) {
        var content = documents.get(uri).getText();
        var newfileSymbols = SymbolParser.parse(uri, content);
        if (newfileSymbols) {
            newfileSymbols.ischanged = false;
            workSpaceSymbols[uri] = newfileSymbols;
            fileSymbols = newfileSymbols;
        }
    }

    return fileSymbols;
}

function searchLuaFile(dir) {
    console.log(`searching lua files in ${dir}.`);
    FileSearcher.search(dir, searchOptions, function (root, name) {
        if (path.extname(name) == '.lua') {
            var moduleName  = path.basename(name, '.lua');
            var moduleFiles = luaFiles[moduleName] || [];
            moduleFiles.push(path.resolve(root, name));
            luaFiles[moduleName] = moduleFiles;
        }
    }, function () {
        console.log(`${dir} search finished.`);
    });
}

function parseDependency(base, dependency) {
    var moduleName = null;
    for (var i = 0; i < dependency.length; i++) {
        if (dependency[i].name == base) {
            moduleName = base;
        }
    }

    //没有找到依赖的模块，可能缺少依赖或者文件名与模块名不一样
    //TODO: 先解析出所有依赖的模块，然后找到模块名=base的模块
    if (!moduleName) {
        return [];
    }

    //从已搜索到的文件列表中取出模块对应的文件列表
    var fileNames = luaFiles[moduleName] || [];
    var depSymbols = [];
    for (var i = 0; i < fileNames.length; ++i) {
        var uri = Uri.file(fileNames[i]).toString();
        var moduleSym = workSpaceSymbols[uri];
        if (!moduleSym) {
            moduleSym = SymbolParser.parse(uri, fs.readFileSync(fileNames[i]));
            if (moduleSym) {
                workSpaceSymbols[uri] = moduleSym;
            }
        }

        if (moduleSym) {
            depSymbols = depSymbols.concat(moduleSym.symbols);
        }

    }
    return depSymbols;
}

function findDefinition(symbol, definitions, defList) {
    for (var i = 0; i < definitions.length; ++i) {
        if (definitions[i].name == symbol.name) {
            console.log(`find symbol: ${symbol.name},${symbol.base}`);
            defList.push({
                uri: definitions[i].uri,
                range: definitions[i].range,
                type: definitions[i].type,
                name: symbol.name
            });
        }
    }
}

function onDefinition(params) {
    var fileSymbols = reparse(params.textDocument.uri);

    if (!fileSymbols)
        return [];
    
    //根据位置信息获得符号信息
    var symbol = findSymbol(params.position, fileSymbols);
    if (!symbol) {
        return [];
    }

    var symbols = fileSymbols.symbols;

    //先查找模块内部的变量.
    var list = [];
    findDefinition(symbol, symbols, list);

    //符号是模块局部变量，不查找外部依赖模块.
    if (symbol.isLocal || !symbol.base) {
        return list;
    }

    //查找依赖模块内部的公共变量.
    var depSymbols = parseDependency(symbol.base, fileSymbols.dependency);
    findDefinition(symbol, depSymbols, list);

    return list;
}

connection.onInitialize((params) => {
    workspaceRoot = params.rootPath;

    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
            // Tell the client that the server support code complete
            documentSymbolProvider: true,
            definitionProvider: true,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [".", ":"]
            },
            // hoverProvider: true
        }
    };
});

documents.onDidChangeContent((change) => {
    console.log('We recevied an DidChangeContent event: ' + change.document.uri);
    var uri = change.document.uri;

    var fileSymbols = workSpaceSymbols[uri];
    
    if (!fileSymbols) {
        fileSymbols = SymbolParser.parse(uri, change.document.getText());
        if (fileSymbols) {
            fileSymbols.ischanged = false;
            workSpaceSymbols[uri] = fileSymbols;
        }
    } else {
        fileSymbols.ischanged = true;
    }
});

documents.onDidSave((params) => {
    console.log("we receive an onDidSave event: " + params.document.uri);
    var documentSymbols = workSpaceSymbols[params.document.uri];
    documentSymbols ? documentSymbols.ischanged = true : null;
    reparse(params.document.uri, true);
});

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
    console.log('We recevied an DidChangeConfiguration event');
    let settings = change.settings.intelliLua;
    
    searchOptions.filters = settings.searchOptions.filters;
    searchOptions.followLinks = settings.searchOptions.followLinks;
    searchOptions.externalPaths = settings.searchOptions.externalPaths;

    parseOptions.luaversion = settings.parseOptions.luaversion;

    showGlobalsOnly = settings.documentSymbols.showGlobalsOnly;

    luaFiles = {}; //reset the filelist
    workSpaceSymbols = {}; //reset the symbolList
    [workspaceRoot].concat(searchOptions.externalPaths).forEach(searchLuaFile);

});

connection.onDidChangeWatchedFiles((change) => {
    // Monitored files have change in VSCode
    console.log('We recevied an file change event');
});

connection.onDocumentSymbol((params) => {
    console.log('We recevied an documentSymbol event');
    var fileSymbols = reparse(params.textDocument.uri);

    var symbolsList = [];
    if (fileSymbols)
        symbolsList = fileSymbols.symbols;

    return symbolsList.filter((symbol) => {
        return (!showGlobalsOnly) || (showGlobalsOnly && !symbol.isLocal);
    }).map((symbol) => {
        return langserver.SymbolInformation.create(symbol.name, symbol.kind, 
                                                   symbol.range, symbol.uri, 
                                                   symbol.base);
    });
});

connection.onDefinition((params) => {
    console.log('We recevied an definition event');
    return onDefinition(params);
});

connection.onCompletion((params) => {
    var document = documents.get(params.textDocument.uri);
    if (params.position.character == 0)
        return null;

    var offset_end = document.offsetAt(params.position);
    params.position.character = 0; //rewind to line begin
    var offset_beg = document.offsetAt(params.position);
    var lineContent = document.getText().substring(offset_beg, offset_end);
    var toggleChar = lineContent.charAt(lineContent.length-1);

    var bases = null;
    // if ((toggleChar == ".") || (toggleChar == ":")) 
    {
        var regexp = /((\w+\.)?(\w+:)?)$/g;
        bases = lineContent.match(regexp)[0].split(/[.:]/g);
        // console.log(bases);
    }

    bases = bases || [];

    var moduleName  = null;
    var className   = null;

    console.log(bases);
    //devmi.symb
    //class:symb
    //devmi.class:symb
    switch (toggleChar) {
        case ":":
            if (bases.length > 2) {
                moduleName  = bases[0];
                className   = bases[1];
            } else {
                className   = bases[0];
            }
            break;
        case ".": //TODO: 后续支持模块内部的表索引自动补全
            moduleName = bases[0];
            className  = bases[0];
            break;
        default:
            break;
    }

    var proposeSymbols = [];
    
    // console.log("bases.length: " + bases.length);
    // console.log("className: " + className);
    // console.log("moduleName: " + moduleName);

    var documentSymbols = workSpaceSymbols[params.textDocument.uri];
    if (documentSymbols)
    {
        proposeSymbols = proposeSymbols.concat(documentSymbols.symbols.filter((symbol) => {
            return !className || (className == symbol.base);
        }));
    }

    var depSymbols = [];
    if (moduleName) {
        depSymbols = parseDependency(moduleName, documentSymbols.dependency);
    }
    
    proposeSymbols = proposeSymbols.concat(depSymbols.filter((symbol) => {
        return !symbol.isLocal && ((className == moduleName && !symbol.base) || symbol.base == className);
    }));

    return proposeSymbols.map((symbol) => {
        var completeItem = langserver.CompletionItem.create(symbol.name);
        completeItem.kind = symbol.kind;
        completeItem.detail = symbol.base ? "scope: " + symbol.base : null;
        completeItem.data = {uri:symbol.uri, range:symbol.range};
        return completeItem;
    });
    
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    var uri = item.data.uri;
    var range = item.data.range;
    var document = documents.get(uri);
    if (!document) {
        return item;
    }

    var offset_s = document.offsetAt(range.start);
    var offset_e = document.offsetAt(range.end);

    item.documentation = document.getText().substring(offset_s, offset_e);

	return item;
});

// connection.onHover((params) => {
//     console.log("We receive a hover event");
//     return onDefinition(params).map((symbol) => {
//         console.log(`${symbol.name}/${symbol.range}`);
//         return {
//             contents: langserver.MarkedString.fromPlainText(symbol.name),
//             // range: langserver.Range.create(symbol.range.start.line, symbol.range.start.column, 
//             //                                symbol.end.line, symbol.end.column),
//         };
//     });
// });


documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map