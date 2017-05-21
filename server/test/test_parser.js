var { Uri }   = require('../lib/util');
var { SymbolParser } = require('../lib/SymbolParser');
var VscodeUri = require('vscode-uri');

function test(){
    var fileName = "F:\\JavaScript\\lua-test-project\\drv_base.lua";
    var fileUri = Uri.toUri(fileName);
    var symbolCollection = SymbolParser.parse(fileUri, {});
    if (!symbolCollection) {
        console.log("parse is failed.\n");
        return;
    }

    function printSymbols(symbolCollection, depth) {
        for (var key in symbolCollection) {
            var element = symbolCollection[key];
            if (typeof element != typeof {} || element == null) {
                console.log("\t".repeat(depth) + key + ": " + element + "\n");
            } else {
                console.log("\t".repeat(depth) + key + ": {\n");
                printSymbols(element, depth + 1);
                console.log("\t".repeat(depth) + "}\n");
            }

        }
    }

    printSymbols(symbolCollection, 0);

}

//test();

console.log([].concat([{"q":1, "b":2},]));


function getWordBackward(str, lastIdx)
{
    if (lastIdx <= 1)
        return null;
    
    
}

var regexp = /(\w+\.(\w+:)?)$/g;

console.log(" ddd.xxx  devmi.fcnd:".match(regexp)[0].split(/[.:]/g))

var empty = [];
console.log(empty[0])

var moduleName = null;
console.log("moduleName" + moduleName);