"use strict";

const Util = require('./util');
const path = require('path');

class FileManager {
    constructor() {
        this._files = {};
        this._roots = [];
    }

    reset() {
        this._files = {};
        this._roots = [];
    }

    getFiles(moduleName) {
        return this._files[moduleName] || [];
    }

    setRoots(rootPaths) {
        this._roots = rootPaths;
    }

    searchFiles(options, extname) {
        for (var i = 0; i < this._roots.length; i++) {
            Util.searchFile(this._roots[i], options, (root, name) => {
                if (path.extname(name) == extname) {
                    var moduleName  = path.basename(name, extname);
                    this._files[moduleName] = this._files[moduleName] || [];
                    this._files[moduleName].push(path.resolve(root, name));
                }
            }, () => {});
        }
    }
};

exports.FileManager = FileManager;