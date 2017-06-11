const UnitTest = require('../lib/unit-test');
const path     = require('path');
const fs       = require('fs');
const async    = require('async');


for (var i = 0; i < 1; ++i) {
    const testRunner = new UnitTest.TestRunner(console.log);
    testRunner.run("F:\\lua\\power_manage");
}
console.log("I am here")

var luacov = path.resolve("F:\\lua\\power_manage", ".luacov");
if (fs.existsSync(luacov)) {
    console.log(fs.readFileSync(luacov).toString());
}

const fileName = 'external';
const LUACOV_LINE_REGEX = /(.+)\s+(\d+)\s+(\d+)\s+(\d+\.\d+\%)/g;
const content = fs.readFileSync('F:\\lua\\power_manage\\luacov.report.out').toString();
var matches = content.match(LUACOV_LINE_REGEX);
var rate  = 0;

for (var i = 0; i < matches.length; ++i) {
    if (matches[i].includes(fileName)) {
        rate = matches[i].match(/(\d+.\d+)\%$/g)[0];
        break;
    }
}

console.log(rate);

var x = [1,2,3,4,5,6,7,8,9];
var y = [];
async.map(x, (item, callback) => {
    y.push(item * 9);
});

console.log(y)

out = "luac: power_base.lua:427: '<eof>' expected near 'end'"

regex = /^luac:\s+.+\:(\d+)\:\s+(.+)$/;

console.log(regex.exec(out))