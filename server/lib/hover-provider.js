"use strict";

const Doc        = require('./doc-generator');
const fs         = require('fs');
const Langserver = require('vscode-languageserver');
const Uri        = require('vscode-uri').default;

class HoverProvider {
    constructor(intelliLua) {
        this._intelliLua = intelliLua;
    }

    inScope(ref, def) {
        return ref.range.start.line >= def.range.start.line && ref.range.end.line <= def.range.end.line;
    }

    provideHover(params) {
        var uri = params.textDocument.uri;
        var iLua = this._intelliLua;
        var document = iLua.getDocument(uri);;
        if (!iLua.symbolProvider.isParsed(uri)) {
            if (!iLua.symbolProvider.parseFile(uri, document.getText(), false)) {
                return null;
            }
        }
        
        var ref = iLua.symbolProvider.findReference(uri, params.position);
        if (!ref) {
            return null;
        }

        //先查找模块内部定义的变量.
        var definitions = [];
        iLua.definitionProvider.findDefinitions(ref, uri, definitions);
        iLua.debug('[INFO] provideHover >>> find in self: ' + definitions.length);
        var hoverContents = [];
        for (var i = 0; i < definitions.length; ++i) {
            hoverContents.push({
                language: document.languageId,
                value: Doc.symbolCodePeak(definitions[i], document)
            });
        }
        
        //符号不是本模块变量，查找外部依赖模块.
        var hoverContentsDep = [];
        if (!(ref.isLocal || !ref.base)) {
            definitions = [];
            iLua.definitionProvider.findDefinitionsInDepndences(ref, uri, definitions);
            iLua.debug('[INFO] provideHover >>> find in dependence: ' + definitions.length);
            for (var i = 0; i < definitions.length; ++i) {
                hoverContents.push({
                    language: document.languageId,
                    value: Doc.symbolCodePeak(definitions[i], iLua.getDocument(definitions[i].uri))
                })
            }
        }

        iLua.debug('[INFO] provideHover >>> find total: ' + hoverContents.length);

        return {
            contents: hoverContents,
        }
    }
};

exports.HoverProvider = HoverProvider;