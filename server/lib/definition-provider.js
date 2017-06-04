"use strict";

const Util       = require('./util');
const Langserver = require('vscode-languageserver');
const Uri        = require('vscode-uri').default;

class DefinitionProvider {
    constructor(intelliLua) {
        this._intelliLua = intelliLua;
    }

    provideDefinition(params) {
        var uri = params.textDocument.uri;
        var iLua = this._intelliLua;
        if (!iLua.symbolProvider.isParsed(uri)) {
            if (!iLua.symbolProvider.parseFile(uri, iLua.documents.get(uri).getText(), false)) {
                return [];
            }
        }
        
        //根据位置信息获得符号信息
        var symbol = iLua.symbolProvider.findReference(uri, params.position);
        if (!symbol) {
            return [];
        }

        //先查找模块内部定义的变量.
        var list = [];
        this.findDefinitions(symbol, uri, list);

        //符号是模块局部变量，不查找外部依赖模块.
        if (symbol.isLocal || !symbol.base) {
            return list;
        }

        //查找依赖模块内部的公共变量.
        this.findDefinitionsInDepndences(symbol, uri, list);

        return list;
    }

    findDefinitionsInDepndences(symbol, uri, defList) {
        var iLua = this._intelliLua;
        iLua.symbolProvider.getDependences(uri).filter((dependence) => {
            return symbol.base == dependence.name;
        }).forEach((dependence) => {
            iLua.fileManager.getFiles(dependence.name).forEach((fileName) => {
                const uri_d = Uri.file(fileName).toString();
                this.findDefinitions(symbol, uri_d, defList);
            });
        });
    }

    findDefinitions(symbol, uri, defList) {
        var iLua = this._intelliLua;
        if (!Util.parseFile(iLua.symbolProvider, iLua.documents.get(uri), uri, false)) {
            return ;
        }

        iLua.symbolProvider.getDefinitions(uri).filter((definition) => {
            return definition.name == symbol.name;
        }).forEach((definition) => {
            defList.push({
                uri:   definition.uri,
                range: definition.range,
                name:  definition.name
            });
        });
    }
};

exports.DefinitionProvider = DefinitionProvider;