'use strict';

var walk = require('walk');

(function (FileSearcher) {
    function search(startpath, options, onFile, onEnd) {
        var emitter = walk.walk(startpath, options);

        emitter.on('file', function (dir, stat, next) {
            onFile(dir, stat.name);
            next();
        });

        emitter.on('end', onEnd);
    }

    FileSearcher.search = search;

})(exports.FileSearcher || (exports.FileSearcher = {}));

