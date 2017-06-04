"use strict";

const { SymbolParser } = require('./parser');
const Uri              = require('vscode-uri').default;
const fs               = require('fs');

function findSymbol(position, symbols) {
    var line       = position.line;
    var character  = position.character;
    var symbol     = null;

    for (var i = 0; i < symbols.length; i++) {
        var ref = symbols[i];
        if (ref.range.start.line <= line && line <= ref.range.end.line) {
            if (ref.range.start.character <= character && character <= ref.range.end.character) {
                symbol = ref;
                break;
            }
        }
    }

    return symbol;
}

class SymbolProvider {
    constructor(intelliLua) {
        this._intelliLua  = intelliLua;
        this._fileSymbols = {};
        this._options     = {};
    }

    reset() {
        this._fileSymbols = {};
        this._options     = {};
    }

    setParseOptions(options) {
        this._options = options;
    }

    isParsed(uri) {
        return !!this._fileSymbols[uri];
    }

    markDirty(uri, dirty) {
        this._fileSymbols[uri].isDirty = dirty;
    }

    isDirty(uri) {
        return !isParsed(uri) || this._fileSymbols[uri].isDirty;
    }

    parseFile(uri, content, force) {
        var fileSymbols = this._fileSymbols[uri];
        if (fileSymbols && !force) {
            return true;
        }

        if (!content) {
            return false;
        }

        fileSymbols = SymbolParser.parse(uri, content, this._options);

        if (fileSymbols) {
            fileSymbols.isDirty = false;
            this._fileSymbols[uri] = fileSymbols;
            return true;
        } else {
            return false;
        }  
    }

    getFileSymbols(uri) {
        return this._fileSymbols[uri];
    }

    getDefinitions(uri) {
        var fileSymbols = this._fileSymbols[uri];
        if (!fileSymbols) {
            return [];
        }

        return fileSymbols.definitions;
    }

    getReferences(uri) {
        var fileSymbols = this._fileSymbols[uri];
        if (!fileSymbols) {
            return [];
        }

        return fileSymbols.references;
    }

    getDependences(uri) {
        var fileSymbols = this._fileSymbols[uri];
        if (!fileSymbols) {
            return [];
        }

        return fileSymbols.dependences;
    }

    findReference(uri, position) {
        var fileSymbols = this._fileSymbols[uri];
        if (!fileSymbols) {
            return null;
        }

        return findSymbol(position, fileSymbols.references);
    }

    findDefinition(uri, position) {
        var fileSymbols = this._fileSymbols[uri];
        if (!fileSymbols) {
            return null;
        }

        return findSymbol(position, fileSymbols.definitions);
    }
};

exports.SymbolProvider = SymbolProvider;