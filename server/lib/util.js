'use strict';

const cp         = require('child_process');
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


(function (exports) {

    //加载lua语法的配置文件，输出json格式
    function loadConfig(fileName, cwd) {
        const program = `local _, config = require("luacov.util").load_config("${fileName}"); \
                         print(require("dkjson").encode(config));`
        const buffer = cp.execFileSync("lua", ["-e", program], {cwd: cwd});
        return JSON.parse(buffer.toString());
    }

    exports.loadConfig = loadConfig;
})(exports);