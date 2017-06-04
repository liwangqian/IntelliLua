'use strict';

const walk       = require('walk');
const fs         = require('fs');
const langserver = require('vscode-languageserver');
const Uri        = require('vscode-uri').default;

(function (exports) {
    function searchFile(startpath, options, onFile, onEnd) {
        var emitter = walk.walk(startpath, options);

        emitter.on('file', function (dir, stat, next) {
            onFile(dir, stat.name);
            next();
        });

        emitter.on('end', onEnd);
    }

    exports.searchFile = searchFile;

    function parseFile(symbolProvider, document, uri, force) {
        if (force || !symbolProvider.isParsed(uri)) {
            var fileName = Uri.parse(uri).fsPath;
            var content  = (document && document.getText()) || fs.readFileSync(fileName);
            return symbolProvider.parseFile(uri, content, force);
        }

        return true;
    }

    exports.parseFile = parseFile;

    function getLineContent(document, position) {
        var offsetEnd   = document.offsetAt(position);
        var offsetStart = document.offsetAt(new langserver.Position.create(position.line, 0));
        return document.getText().substring(offsetStart, offsetEnd);
    }

    exports.getLineContent = getLineContent;

})(exports);
