"use strict";

var kindNameMap = {};
kindNameMap[kindNameMap["Function"]  = 3 ]  = "function";
kindNameMap[kindNameMap["Variable"]  = 6 ]  = "var";
kindNameMap[kindNameMap["Class"]     = 7 ]  = "class";
kindNameMap[kindNameMap["Reference"] = 18]  = "reference";

(function (exports) {
    function symbolTypeInfo(symbol, document) {
        var isLocal = symbol.isLocal;

        if (isLocal) {
            return '(local '  + (kindNameMap[symbol.kind] || 'var') + ')';
        } else {
            return '(global ' + (kindNameMap[symbol.kind] || 'var') + ')';
        }
    }
    
    function symbolCodePeak(symbol, document) {
        var uri   = symbol.uri;
        var range = symbol.range;
        if (!document) {
            return null;
        }

        var startPos = {line: range.start.line, character: 0};
        var endPos   = {line: range.end.line+1, character: 0};

        var offset_s = document.offsetAt(startPos);
        var offset_e = document.offsetAt(endPos);

        return document.getText().substring(offset_s, offset_e);
    }

    exports.symbolTypeInfo = symbolTypeInfo;
    exports.symbolCodePeak = symbolCodePeak;

})(exports);