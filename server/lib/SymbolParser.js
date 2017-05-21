// class SymbolKind{
// var Text = 1;
// var Method = 2;
// var Function = 3;
// var Constructor = 4;
// var Field = 5;
// var Variable = 6;
// var Class = 7;
// var Interface = 8;
// var Module = 9;
// var Property = 10;
// var Unit = 11;
// var Value = 12;
// var Enum = 13;
// var Keyword = 14;
// var Snippet = 15;
// var Color = 16;
// var File = 17;
// var Reference = 18;
// }

// class interfacse Symbol {
//     name: symbol name,
//     kind: symbol kind,
//     range: symbol range,
//     base: symbol base name,
//     isLocal: symbol in local scope ?
//     parent: the parent scope
// }
'use strict';

// const langserver = require('vscode-languageserver');
const parser     = require('luaparse');
const fs         = require('fs');
const Uri        = require('vscode-uri').default;

(function(SymbolParser) {
    function NewSymbolCollection(uri) {
        return {
            symbols: [],
            reference: [],
            dependency: [],
            uri: uri,
        };
    }

    function convertSymbolKind(typeString) {
        switch (typeString) {
            case "Function":
                return 3;
            case "Variable":
                return 6;
            case "Class":
                return 7;
            case "Reference":
                return 18;
            default:
                return 6;
        }
    }

    function getRange(ast) {
        return {
            start: { line: ast.loc.start.line - 1, character: ast.loc.start.column },
            end: { line: ast.loc.end.line - 1, character: ast.loc.end.column }
        };
    }

    function findParent(parent) {
        for (var i = 0; i < parent.length; i++) {
            if (parent[i] != null && parent[i].identifier != null) {
                return parent[i];
            }
        }
    }

    function getVariable(ast) {
        switch (ast.type) {
            case "Identifier":
                return {
                    base: null,
                    name: ast.name,
                    range: getRange(ast),
                    kind: convertSymbolKind("Variable"),
                    isLocal: ast.isLocal,
                    uri: null,
                };
            case "MemberExpression":
                return {
                    base: ast.base.name,
                    name: ast.identifier.name,
                    range: getRange(ast.identifier),
                    kind: convertSymbolKind("Variable"),
                    isLocal: ast.base.isLocal,
                    uri: null,
                };
            default:
                return {};
        }
    }

    function parseDependency(uris, symbolCollection) {
        
    }

    function parseFunctionBody(stack, body, symbolCollection) {
        for (var i = 0; i < body.length; i++) {
            parse2(stack, body[i], symbolCollection);
        }
    }

    function parseFunctionDeclaration(parentStack, ast, symbolCollection) {
        var functionSymbol = {};
        functionSymbol.kind = convertSymbolKind("Function");

        if (ast.identifier != null) {
            if (ast.identifier.type == "Identifier") {
                functionSymbol.name = ast.identifier.name;
                functionSymbol.isLocal = ast.identifier.isLocal;
                functionSymbol.base = null;
            } else if (ast.identifier.type == "MemberExpression") {
                functionSymbol.name = ast.identifier.identifier.name;
                functionSymbol.base = ast.identifier.base.name;
                functionSymbol.isLocal = ast.identifier.base.isLocal;
            }
            functionSymbol.range = getRange(ast);
            
            functionSymbol.uri = symbolCollection.uri;

            symbolCollection.symbols.push(functionSymbol);
        }

        parentStack.push(functionSymbol);
        if (ast.parameters != null) {
            for (var i = 0; i < ast.parameters.length; i++) {
                parse2(parentStack, ast.parameters[i], symbolCollection);
            }
            
        }

        if (ast.body != null ) {
            parseFunctionBody(parentStack, ast.body, symbolCollection);
        }
        parentStack.pop();
    }

    function parseCallExpression(parentStack, ast, symbolCollection) {
        if (ast.base.type == "Identifier") {
            switch (ast.base.name) {
                case "module":
                    var moduleName = ast.arguments[0].value;
                    symbolCollection.moduleName = moduleName;

                    //construct the module stack
                    parentStack.push({
                        name: moduleName,
                        kind: convertSymbolKind("Module"),
                        base: parentStack[0],
                        //range in whole file
                        range: {start: {line: 0, column: 0}, end: {line: Infinity, column: Infinity}},
                        isLocal: false
                    });
                    break;
                case "require":
                    var depSymbol = {
                        name: ast.arguments[0].value,
                    };
                    symbolCollection.dependency.push(depSymbol);
                    break;
                default:
                    parseIdentifier(parentStack, ast.base, symbolCollection);
                    break;
            }
        } else if (ast.base.type == "MemberExpression") {
            var refSymbol = {
                name: ast.base.identifier.name,
                kind: convertSymbolKind("Reference"),
                range: getRange(ast.base.identifier),
                isLocal: ast.base.base.isLocal,
                base: ast.base.base.name,
            };

            //for xxx.yy:zz()
            if (ast.base.base.type == "MemberExpression") {
                refSymbol.isLocal = ast.base.base.base.isLocal;
                refSymbol.base    = ast.base.base.base.name;
            }

            symbolCollection.reference.push(refSymbol);
        } else {
            parse2(parentStack, ast.base, symbolCollection);
        }

        //parse the arguments
        for (var i = 0; i < ast.arguments.length; ++i) {
            parse2(parentStack, ast.arguments[i], symbolCollection);
        }
        
    }

    function parseCallStatement(parentStack, ast, symbolCollection) {
        parseCallExpression(parentStack, ast.expression, symbolCollection);
    }

    function parseAssignmentStatement(parentStack, ast, symbolCollection) {
        if (ast.variables != null) {
            for (var i = 0; i < ast.variables.length; i++) {
                var variable = getVariable(ast.variables[i]);
                if (ast.init && ast.init[i]) {
                    switch (ast.init[i].type) {
                        case "Identifier":
                        case "MemberExpression":
                        case "CallExpression":
                            parse2(parentStack, ast.variables[i], symbolCollection);
                            break;
                        case "TableConstructorExpression":
                            variable.kind = convertSymbolKind("Class");
                            parentStack.push(variable);
                            parse2(parentStack, ast.init[i], symbolCollection);
                            parentStack.pop();
                            break;
                        default:
                            break;
                    }
                }

                if (variable.name == null) {
                    parse2(parentStack, ast.variables[i], symbolCollection);
                    continue;
                }

                //local assignment is not definition but for local statement
                if (!variable.isLocal || ast.type == "LocalStatement") {
                    variable.uri = symbolCollection.uri;
                    symbolCollection.symbols.push(variable);
                }
            }
        }

        if (ast.init) {
            for (var i = 0; i < ast.init.length; ++i) {
                parse2(parentStack, ast.init[i], symbolCollection);
            }
        }
    }

    function parseTableConstructorExpression(parentStack, ast, symbolCollection) {
        for (var j = 0; j < ast.fields.length; j++) {
            var element = ast.fields[j];
            parse2(parentStack, ast.fields[j], symbolCollection);
        }
    }


    function parseReturnStatement(parentStack, ast, symbolCollection) {
        if (ast.arguments != null) {
            for (var i = 0; i < ast.arguments.length; i++) {
                parse2(parentStack, ast.arguments[i], symbolCollection);
            }
        }
    }

    function parseIndexExpression(parentStack, ast, symbolCollection) {
        if (ast.base != null) {
            parse2(parentStack, ast.base, symbolCollection);
        }
        if (ast.index != null) {
            parse2(parentStack, ast.index, symbolCollection);
        }
    }

    function parseIdentifier(parentStack, ast, symbolCollection, type = "Reference") {
        var parent = parentStack[parentStack.length - 1] || {};
        var isLocal = ast.isLocal;
        if (isLocal == null) {
            isLocal = parent.isLocal || false;
        }
        
        var symbol = {
            name: ast.name,
            kind: convertSymbolKind(type),
            base: parent.name,
            range: getRange(ast),
            isLocal: isLocal
        };

        if (type == "Reference") {
            symbolCollection.reference.push(symbol);
        } else if (type == "Variable") {
            symbol.uri = symbolCollection.uri;
            symbolCollection.symbols.push(symbol);
        }
        
    }

    function parseMemberExpression(parentStack, ast, symbolCollection) {
        if (ast.base != null) {
            parse2(parentStack, ast.base, symbolCollection);
        }

        parentStack.push(ast.base);
        parse2(parentStack, ast.identifier, symbolCollection);
        parentStack.pop();
    }

    function parseForNumericStatement(parentStack, ast, symbolCollection) {
        //parse loop variable
        if (ast.variable.type == "Identifier") {
            parseIdentifier(parentStack, ast.variable, symbolCollection, "Variable");
        }

        //parse loop start variable
        if (ast.start != null) {
            parse2(parentStack, ast.start, symbolCollection);
        }

        //parse loop end variable
        if (ast.end != null) {
            parse2(parentStack, ast.end, symbolCollection);
        }

        //parse loop step variable
        if (ast.step != null) {
            parse2(parentStack, ast.step, symbolCollection);
        }

        //parse loop body
        if (ast.body != null) {
            for (var i = 0; i < ast.body.length; ++i) {
                parse2(parentStack, ast.body[i], symbolCollection);
            }
        }
    }

    function parseForGenericStatement(parentStack, ast, symbolCollection) {
        //parse loop variables
        if (ast.variables != null) {
            for (var index = 0; index < ast.variables.length; index++) {
                parseIdentifier(parentStack, ast.variables[index], symbolCollection, "Variable");
            }
        }

        //parse loop iterators
        if (ast.iterators != null) {
            for (var i = 0; i < ast.iterators.length; ++i) {
                parse2(parentStack, ast.iterators[i], symbolCollection);
            }
        }

        //parse loop body
        if (ast.body != null) {
            for (var i = 0; i < ast.body.length; ++i) {
                parse2(parentStack, ast.body[i], symbolCollection);
            }
        }
    }

    function parseBinaryExpression(parentStack, ast, symbolCollection) {
        if (ast.left != null) {
            parse2(parentStack, ast.left, symbolCollection);
        }
        if (ast.right != null) {
            parse2(parentStack, ast.right, symbolCollection);
        }
    }

    function parseUnaryExpression(parentStack, ast, symbolCollection) {
        if (ast.argument != null) {
            parse2(parentStack, ast.argument, symbolCollection);
        }
    }

    function parseIfStatement(parentStack, ast, symbolCollection) {
        if (ast.clauses != null) {
            for (var i = 0; i < ast.clauses.length; i++) {
                parse2(parentStack, ast.clauses[i], symbolCollection);
            }
        }
    }


    function parse2(parentStack, ast, symbolCollection) {
        switch (ast.type) {
            case "Identifier":
                parseIdentifier(parentStack, ast, symbolCollection);
                break;
            case "IndexExpression":
                parseIndexExpression(parentStack, ast, symbolCollection);
                break;
            case "MemberExpression":
                parseMemberExpression(parentStack, ast, symbolCollection);
                break;
            case "LocalStatement":
            case "AssignmentStatement":
                parseAssignmentStatement(parentStack, ast, symbolCollection);
                break;
            case "TableConstructorExpression":
                parseTableConstructorExpression(parentStack, ast, symbolCollection);
                break;
            case "TableKeyString":
            case "TableKey":
                if (ast.key != null) {
                    parse2(parentStack, ast.key, symbolCollection);
                }
            case "TableValue":
                if (ast.value != null) {
                    parse2(parentStack, ast.value, symbolCollection);
                }
                break;
            case "IfStatement":
                parseIfStatement(parentStack, ast, symbolCollection);
                break;
            case "ForNumericStatement":
                parseForNumericStatement(parentStack, ast, symbolCollection);
                break;
            case "ForGenericStatement":
                parseForGenericStatement(parentStack, ast, symbolCollection);
                break;
            case "ReturnStatement":
                parseReturnStatement(parentStack, ast, symbolCollection);
                break;
            case "CallStatement":
                parseCallStatement(parentStack, ast, symbolCollection);
                break;
            case "CallExpression":
                parseCallExpression(parentStack, ast, symbolCollection);
                break;
            case "BinaryExpression":
            case "LogicalExpression":
                parseBinaryExpression(parentStack, ast, symbolCollection);
                break;
            case "UnaryExpression":
                parseUnaryExpression(parentStack, ast, symbolCollection);
                break;
            case "FunctionDeclaration":
                parseFunctionDeclaration(parentStack, ast, symbolCollection);
                break;
            case "DoStatement":
            case "RepeatStatement":
            case "WhileStatement":
            case "IfClause":
            case "ElseifClause":
                if (ast.condition != null) {
                    parse2(parentStack, ast.condition, symbolCollection);
                }
            case "ElseClause":
            case "Chunk":
            default:
                if (ast.body != null) {
                    for (var i = 0; i < ast.body.length; i++) {
                        parse2(parentStack, ast.body[i], symbolCollection);
                    }
                }
                break;
        }
    }

    function parseDocumentSymbols(uri, content, options) {
        var symbolCollection = NewSymbolCollection(uri);
        var ast;

        var parseOptions = {
            comments: false, 
            locations: true, 
            scope: true, 
            luaversion: (options && options.luaversion) || 5.1 
        };

        try {
            ast = parser.parse(content.toString(), parseOptions);
        } catch (e) {
            return null;
        }

        var stack = [
            {
                name: "_G",
                kind: convertSymbolKind("Module"),
                base: null,
                range: null,
                isLocal: false
            }
        ];

        parse2(stack, ast, symbolCollection);

        return symbolCollection;
    }

    // SymbolParser.newSymbolCollection = NewSymbolCollection;
    SymbolParser.parse = parseDocumentSymbols;

})(exports.SymbolParser || (exports.SymbolParser = {}));

