
const Util       = require('./util');
const Doc        = require('./doc-generator');
const Langserver = require('vscode-languageserver');
const Uri        = require('vscode-uri').default;

class CompletionProvider {
    constructor(intelliLua) {
        this._intelliLua  = intelliLua;
    }

    provideCompletions(params) {
        var uri      = params.textDocument.uri;
        var iLua     = this._intelliLua;
        var document = iLua.documents.get(uri);
        if (params.position.character == 0)
            return null;

        var lineContent = Util.getLineContent(document, params.position);
        var toggleChar  = lineContent.charAt(lineContent.length-1);

        var bases = null;
        {
            var regexp = /((\w+\.)?(\w+:)?)$/g;
            bases = lineContent.match(regexp)[0].split(/[.:]/g);
        }

        bases = bases || [];

        var moduleName  = null;
        var className   = null;

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

        var symbolProvider = iLua.symbolProvider;
        var fileManager    = iLua.fileManager;
        var proposeSymbols = [];
        if (symbolProvider.isParsed(uri)) {
            proposeSymbols = proposeSymbols.concat(symbolProvider.getDefinitions(uri).filter((symbol) => {
                return !className || (className == symbol.base);
            }));
        }

        var depSymbols = [];
        if (moduleName) {
            symbolProvider.getDependences(uri).filter((dependence) => {
                return dependence.name == moduleName;
            }).forEach((dependence) => {
                fileManager.getFiles(dependence.name).forEach((fileName) => {
                    var uri = Uri.file(fileName).toString();
                    if (Util.parseFile(symbolProvider, iLua.documents.get(uri), uri, false)) {
                        depSymbols = depSymbols.concat(symbolProvider.getDefinitions(uri));
                    }
                });
            });
        }
        
        proposeSymbols = proposeSymbols.concat(depSymbols.filter((symbol) => {
            return !symbol.isLocal && ((className == moduleName && !symbol.base) || symbol.base == className);
        }));

        return proposeSymbols.map((symbol) => {
            var completeItem = Langserver.CompletionItem.create(symbol.name);
            completeItem.kind = symbol.kind;
            completeItem.data = symbol;
            return completeItem;
        });
    }

    resolveCompletion(item) {
        var document = this._intelliLua.documents.get(item.data.uri);
        item.detail  = Doc.symbolTypeInfo(item.data, document);
        
        var uri = item.data.uri;
        var range = item.data.range;
        if (!document) {
            return item;
        }

        //提取符号所在行信息作为document
        var linePos  = {line: range.start.line, character: 0}
        var offset_s = document.offsetAt(linePos);
        linePos.line += 1;
        var offset_e = document.offsetAt(linePos);

        item.documentation = document.getText().substring(offset_s, offset_e);
        
        return item;
    }
};

exports.CompletionProvider = CompletionProvider;