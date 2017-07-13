const {formatText} = require('lua-fmt');
console.log(formatText('local hello = "Hello"; print(hello .. " world!")'))

console.log(formatText('local x = {a = 1,b=2,c = 3, d =1,e=3,\n' + 
'f=4,g=5,h=8,j=10,k=12,l=13}'))