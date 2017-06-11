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
//     scope: the symbol effective scope
// }
'use strict';

const parser = require('luaparse');
const fs     = require('fs');
const Uri    = require('vscode-uri').default;

(function(SymbolParser) {

    function NewSymbolInfo(name) {
        return {
            name:      name,  //symbol name
            base:      null,  //base(module/class) of the symbol
            kind:      6,     //symbol kind
            isLocal:   true,  //local symbol or global
            uri:       null,  //document of the symbol
            range:     null,  //range of the symbol
            scope:     null,  //the effective scope of the symbol (for definition)
            container: null,  //the symbol contains this symbol 
            doc:       null,  //the symbol documentation
        }
    }

    function NewSymbolCollection(uri) {
        return {
            uri:         uri,
            definitions: [],
            references:  [],
            dependences: [],
            moduleName:  null
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

    function getVariable(ast, container, scope) {
        switch (ast.type) {
            case "Identifier":
                var symbol = NewSymbolInfo(ast.name);
                symbol.kind      = convertSymbolKind("Variable");
                symbol.isLocal   = ast.isLocal;
                symbol.range     = getRange(ast);
                symbol.scope     = scope;
                symbol.container = container;

                return symbol;

            case "MemberExpression":
                var symbol = NewSymbolInfo(ast.identifier.name);
                symbol.kind      = convertSymbolKind("Variable");
                symbol.isLocal   = ast.base.isLocal;
                symbol.range     = getRange(ast.identifier);
                symbol.scope     = scope;
                symbol.container = container;

                return symbol;

            default:
                return {};
        }
    }

    function parseFunctionBody(body, container, scope, symbolCollection) {
        for (var i = 0; i < body.length; i++) {
            parse2(body[i], container, scope, symbolCollection);
        }
    }

    function parseFunctionParams(params, container, scope, symbolCollection) {
        for (var i = 0; i < params.length; i++) {
            var symbol = NewSymbolInfo(params[i].name || params[i].value);
            symbol.kind      = convertSymbolKind("Variable");
            symbol.isLocal   = true;
            symbol.range     = getRange(params[i]);
            symbol.scope     = scope;
            symbol.container = container;

            symbolCollection.definitions.push(symbol);
        }
    }

    function parseFunctionDeclaration(ast, container, scope, symbolCollection) {
        var functionSymbol = NewSymbolInfo();
        functionSymbol.kind      = convertSymbolKind("Function");
        functionSymbol.container = container;
        functionSymbol.scope     = scope;

        if (ast.identifier != null) {
            if (ast.identifier.type == "Identifier") {
                functionSymbol.name    = ast.identifier.name;
                functionSymbol.isLocal = ast.identifier.isLocal;
                functionSymbol.base    = null;
            } else if (ast.identifier.type == "MemberExpression") {
                functionSymbol.name    = ast.identifier.identifier.name;
                functionSymbol.base    = ast.identifier.base.name;
                functionSymbol.isLocal = ast.identifier.base.isLocal;
            }

            functionSymbol.range = getRange(ast);
            functionSymbol.uri   = symbolCollection.uri;

            symbolCollection.definitions.push(functionSymbol);
        }

        var functionScope = null;
        if (ast.parameters != null) {
            functionScope = getRange(ast);
            parseFunctionParams(ast.parameters, functionSymbol, functionScope, symbolCollection);
        }

        if (ast.body != null ) {
            functionScope = functionScope || getRange(ast);
            parseFunctionBody(ast.body, functionSymbol, functionScope, symbolCollection);
        }
    }

    function parseCallExpression(ast, container, scope, symbolCollection) {
        if (ast.base.type == "Identifier") {
            switch (ast.base.name) {
                case "module":
                    var moduleName = ast.arguments[0].value;
                    symbolCollection.moduleName = moduleName;

                    break;
                case "require":
                    var depSymbol = {
                        name: ast.arguments[0].value,
                        moduleName: null,
                        uri: null,
                    };

                    symbolCollection.dependences.push(depSymbol);
                    break;
                default:
                    parseIdentifier(ast.base, container, scope, symbolCollection);
                    break;
            }
        } else if (ast.base.type == "MemberExpression") {

            var refSymbol = NewSymbolInfo(ast.base.identifier.name);
            refSymbol.base    = ast.base.base.name;
            refSymbol.kind    = convertSymbolKind("Reference");
            refSymbol.isLocal = ast.base.base.isLocal;
            refSymbol.range   = getRange(ast.base.identifier);

            //for xxx.yy:zz()
            if (ast.base.base.type == "MemberExpression") {
                refSymbol.isLocal = ast.base.base.base.isLocal;
                refSymbol.base    = ast.base.base.base.name;
            }

            symbolCollection.references.push(refSymbol);

        } else {
            parse2(ast.base, container, scope, symbolCollection);
        }

        //parse the arguments
        for (var i = 0; i < ast.arguments.length; ++i) {
            parse2(ast.arguments[i], container, scope, symbolCollection);
        }
        
    }

    function parseCallStatement(ast, container, scope, symbolCollection) {
        parseCallExpression(ast.expression, container, scope, symbolCollection);
    }

    function parseAssignmentStatement(ast, container, scope, symbolCollection) {
        if (ast.variables != null) {
            for (var i = 0; i < ast.variables.length; i++) {
                var variable = getVariable(ast.variables[i], container, scope);
                if (ast.init && ast.init[i]) {
                    switch (ast.init[i].type) {
                        case "Identifier":
                        case "MemberExpression":
                        case "CallExpression":
                            parse2(container, scope, ast.variables[i], symbolCollection);
                            break;
                        case "TableConstructorExpression":
                            variable.kind = convertSymbolKind("Class");
                            parse2(variable, scope, ast.init[i], symbolCollection);
                            break;
                        default:
                            break;
                    }
                }

                if (variable.name == null) {
                    parse2(ast.variables[i], container, scope, symbolCollection);
                    continue;
                }

                //local assignment is not definition but for local statement
                if (!variable.isLocal || ast.type == "LocalStatement") {
                    variable.uri = symbolCollection.uri;
                    symbolCollection.definitions.push(variable);
                }
            }
        }

        if (ast.init) {
            for (var i = 0; i < ast.init.length; ++i) {
                parse2(ast.init[i], container, scope, symbolCollection);
            }
        }
    }

    function parseTableConstructorExpression(ast, container, scope, symbolCollection) {
        for (var j = 0; j < ast.fields.length; j++) {
            parse2(ast.fields[j], container, scope, symbolCollection);
        }
    }


    function parseReturnStatement(ast, container, scope, symbolCollection) {
        if (ast.arguments != null) {
            for (var i = 0; i < ast.arguments.length; i++) {
                parse2(ast.arguments[i], container, scope, symbolCollection);
            }
        }
    }

    function parseIndexExpression(ast, container, scope, symbolCollection) {
        if (ast.base != null) {
            parse2(ast.base, container, scope, symbolCollection);
        }
        if (ast.index != null) {
            parse2(ast.index, container, scope, symbolCollection);
        }
    }

    function parseIdentifier(ast, container, scope, symbolCollection, type = "Reference") {
        var isLocal = ast.isLocal;
        if (isLocal == null) {
            isLocal = container.isLocal || false;
        }
        
        var symbol = NewSymbolInfo(ast.name);
        symbol.kind      = convertSymbolKind(type);
        symbol.isLocal   = isLocal;
        symbol.container = container;
        symbol.range     = getRange(ast);

        if (type == "Reference") {
            symbolCollection.references.push(symbol);
        } else if (type == "Variable") {
            symbol.scope = scope;
            symbol.uri   = symbolCollection.uri;
            symbolCollection.definitions.push(symbol);
        }
        
    }

    function parseMemberExpression(ast, container, scope, symbolCollection) {
        parse2(ast.base, container, scope, symbolCollection);
        parse2(ast.identifier, container, scope, symbolCollection);
    }

    function parseForNumericStatement(ast, container, scope, symbolCollection) {
        //parse loop variable
        if (ast.variable.type == "Identifier") {
            parseIdentifier(ast.variable, container, scope, symbolCollection, "Variable");
        }

        //parse loop start variable
        if (ast.start != null) {
            parse2(ast.start, container, scope, symbolCollection);
        }

        //parse loop end variable
        if (ast.end != null) {
            parse2(ast.end, container, scope, symbolCollection);
        }

        //parse loop step variable
        if (ast.step != null) {
            parse2(ast.step, container, scope, symbolCollection);
        }

        //parse loop body
        if (ast.body != null) {
            for (var i = 0; i < ast.body.length; ++i) {
                parse2(ast.body[i], container, scope, symbolCollection);
            }
        }
    }

    function parseForGenericStatement(ast, container, scope, symbolCollection) {
        //parse loop variables
        if (ast.variables != null) {
            for (var index = 0; index < ast.variables.length; index++) {
                parseIdentifier(ast.variables[index], container, scope, symbolCollection, "Variable");
            }
        }

        //parse loop iterators
        if (ast.iterators != null) {
            for (var i = 0; i < ast.iterators.length; ++i) {
                parse2(ast.iterators[i], container, scope, symbolCollection);
            }
        }

        //parse loop body
        if (ast.body != null) {
            for (var i = 0; i < ast.body.length; ++i) {
                parse2(ast.body[i], container, scope, symbolCollection);
            }
        }
    }

    function parseBinaryExpression(ast, container, scope, symbolCollection) {
        if (ast.left != null) {
            parse2(ast.left, container, scope, symbolCollection);
        }
        if (ast.right != null) {
            parse2(ast.right, container, scope, symbolCollection);
        }
    }

    function parseUnaryExpression(ast, container, scope, symbolCollection) {
        if (ast.argument != null) {
            parse2(ast.argument, container, scope, symbolCollection);
        }
    }

    function parseIfStatement(ast, container, scope, symbolCollection) {
        if (ast.clauses != null) {
            for (var i = 0; i < ast.clauses.length; i++) {
                parse2(ast.clauses[i], container, scope, symbolCollection);
            }
        }
    }


    function parse2(ast, container, scope, symbolCollection) {
        switch (ast.type) {
            case "Identifier":
                parseIdentifier(ast, container, scope, symbolCollection);
                break;
            case "IndexExpression":
                parseIndexExpression(ast, container, scope, symbolCollection);
                break;
            case "MemberExpression":
                parseMemberExpression(ast, container, scope, symbolCollection);
                break;
            case "LocalStatement":
            case "AssignmentStatement":
                parseAssignmentStatement(ast, container, scope, symbolCollection);
                break;
            case "TableConstructorExpression":
                parseTableConstructorExpression(ast, container, scope, symbolCollection);
                break;
            case "TableKeyString":
            //TODO: diff from TableKey
            case "TableKey":
                if (ast.key != null) {
                    parse2(ast.key, container, scope, symbolCollection);
                }
            case "TableValue":
                if (ast.value != null) {
                    parse2(ast.value, container, scope, symbolCollection);
                }
                break;
            case "IfStatement":
                parseIfStatement(ast, container, getRange(ast), symbolCollection);
                break;
            case "ForNumericStatement":
                parseForNumericStatement(ast, container, getRange(ast), symbolCollection);
                break;
            case "ForGenericStatement":
                parseForGenericStatement(ast, container, getRange(ast), symbolCollection);
                break;
            case "ReturnStatement":
                parseReturnStatement(ast, container, scope, symbolCollection);
                break;
            case "CallStatement":
                parseCallStatement(ast, container, scope, symbolCollection);
                break;
            case "CallExpression":
                parseCallExpression(ast, container, scope, symbolCollection);
                break;
            case "BinaryExpression":
            case "LogicalExpression":
                parseBinaryExpression(ast, container, scope, symbolCollection);
                break;
            case "UnaryExpression":
                parseUnaryExpression(ast, container, scope, symbolCollection);
                break;
            case "FunctionDeclaration":
                parseFunctionDeclaration(ast, container, getRange(ast), symbolCollection);
                break;
            case "DoStatement":
            case "RepeatStatement":
            case "WhileStatement":
            case "IfClause":
            case "ElseifClause":
                if (ast.condition != null) {
                    parse2(ast.condition, container, getRange(ast), symbolCollection);
                }
            case "ElseClause":
            case "Chunk":
            default:
                if (ast.body != null) {
                    for (var i = 0; i < ast.body.length; i++) {
                        parse2(ast.body[i], container, getRange(ast), symbolCollection);
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

        var GLOBAL_ENV = [
            {
                name: "_G",
                kind: convertSymbolKind("Module"),
                base: null,
                range: null,
                isLocal: false
            }
        ];

        parse2(ast, GLOBAL_ENV, null, symbolCollection);

        return symbolCollection;
    }

    // SymbolParser.newSymbolCollection = NewSymbolCollection;
    SymbolParser.parse = parseDocumentSymbols;

})(exports.SymbolParser || (exports.SymbolParser = {}));

