var fs = require('fs');

var _ = require('lodash');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var esquery = require('esquery');
var Syntax = estraverse.Syntax;
var VisitorKeys = estraverse.VisitorKeys;

var defaults = {
    ignores: ['document', 'window', 'location', 'localStorage',
        'require', 'module', 'Math',
        'hasOwnProperty',
        '$',
        'that', 'this', 'self', '_this'
    ]
};
var pUnshift = Array.prototype.unshift;
var pSplice = Array.prototype.splice;
var stack = [];
var globalId = 1;

function ignoreItem(item) {
    var funObj = stack[stack.length - 1];

    if (funObj.ignores.indexOf(item) < 0) {
        // console.log('ignore:', funObj.name, item);
        funObj.ignores.push(item);
    }
}

function checkIgnore(node) {
    var keys = VisitorKeys[node.type];

    if (keys && keys.length) {
        keys.forEach(function(key) {
            var str = checkMemberExpressionNode(node[key], node);

            if (str) {
                ignoreItem(str);
            }
        });
    }
}

function checkMemberExpressionNode(node, parent) {
    var item = '';

    estraverse.traverse(node, {
        enter: function(cnode, cparent) {
            if (cnode.type === Syntax.MemberExpression) {
                // node.hasTraversed = true;
                if (cnode.computed) {
                    item = '';
                    // this.break();
                } else {
                    item = '.' + cnode.property.name + item;
                }

                return;
            }

            if (!cparent) {
                if (cnode.type === Syntax.Identifier) {
                    item = cnode.name;
                }

                this.break();
                return;
            }

            if (cnode.type === Syntax.Identifier &&
                cnode === cparent['object']) {
                item = cnode.name + item;
                return;
            }

            if (cnode.type === Syntax.Identifier &&
                cnode === cparent['property']) {
                return;
            }

            // 出现其他任何节点都忽略这个 memberExpression node
            item = '';
            this.break();
        },
        leave: function(cnode, cparent) {}
    });

    return item;
}

function processVals(str, opt) {
    var vars;
    var funObj = stack[stack.length - 1];
    var varObj;
    var item;

    if (!str.length || str[0] === '.') {
        return;
    }

    vars = str.split('.');

    if (defaults.ignores.indexOf(vars[0]) > -1 || opt && opt.ignores && opt.ignores.indexOf(vars[0]) > -1) {
        return;
    }

    varObj = funObj.vars[vars[0]];

    if (!varObj) {
        varObj = funObj.vars[vars[0]] = {
            items: []
        };
    }

    item = '';
    for (var i = 0, l = vars.length - 1; i < l; ++i) {
        item = item + (i === 0 ? '' : '.') + vars[i];
        if (varObj.items.indexOf(item) < 0 &&
            !hasInserted(vars[0], item)
            /* &&
                        funObj.ignores.indexOf(item) < 0*/
        ) {
            console.log('push item:', item);
            varObj.items.push(item);
        }
    }
}

// test //
function test() {
    var str = 'a = 2';
    // var str = 'a.b.c[0].d.e = 2';
    var ast = esprima.parse(str);
    console.log(ast.body[0].expression.left);
    var ret = checkMemberExpressionNode(ast.body[0].expression.left);
    console.log(ret);
}
// test();
// test //

function defend(str, opt) {
    var ast = esprima.parse(str);
    var ret = estraverse.replace(ast, {
        enter: function(node, parent) {
            var funObj;
            var str;
            var arr;
            var key;
            var beginningInsertor;

            if ((node.type === Syntax.FunctionDeclaration || node.type === Syntax.FunctionExpression || node.type === Syntax.CatchClause) && node.body && node.body.type === Syntax.BlockStatement) {
                beginningInsertor = function(ast) {
                    // console.log('insert code into beginning');
                    if (_.isArray(ast)) {
                        pUnshift.apply(node.body.body, ast);
                    } else {
                        node.body.body.unshift(ast);
                    }
                };

                // 遇到函数，先把函数信息压栈
                funObj = {
                    name: node.id && node.id.name || globalId++,
                    params: [],
                    localVars: [],
                    // globalVars: [],
                    vars: {},
                    assignmentVars: {},
                    ignores: [],
                    body: node.body,
                    insertor: beginningInsertor
                };

                // 记录函数参数 //
                if (node.param) {
                    node.params = [node.param];
                }

                for (var i = 0, l = node.params.length; i < l; ++i) {
                    if (node.params[i].type === Syntax.Identifier) {
                        funObj.params.push({
                            name: node.params[i].name,
                            insertor: beginningInsertor
                        });
                    }
                }
                // 记录函数参数 //

                stack.push(funObj);
                return;
            }

            if (!stack.length) {
                // 忽略全局语句
                return;
            }

            if (node.type === Syntax.VariableDeclaration &&
                node.kind === 'var') {
                estraverse.traverse(node, {
                    enter: function(cnode, cparent) {
                        if (cnode.type === Syntax.VariableDeclarator &&
                            cnode.id && cnode.id.name) {
                            // 记录局部变量 //
                            funObj = stack[stack.length - 1];
                            funObj.localVars.push({
                                name: cnode.id.name,
                                insertor: function(ast) {
                                    // console.log('insert code into local vars:', cnode.id.name);
                                    var index;

                                    if (parent.body && parent.body.length) {
                                        index = parent.body.indexOf(node);
                                        // console.log('>>>>', index, parent.body, node);
                                        // console.log('<<<', _.isArray(ast), ast);
                                        if (index > -1) {
                                            if (_.isArray(ast)) {
                                                ast.unshift(index + 1, 0);
                                                // console.log('>>>>', ast);
                                                pSplice.apply(parent.body, ast);
                                            } else {
                                                parent.body.splice(index + 1, 0, ast);
                                            }
                                        }
                                    }
                                }
                            });
                            // 记录局部变量 //

                            if (cnode.init) {
                                // 已经初始化
                                ignoreItem(cnode.id.name);
                            }
                        }

                        // 要忽略掉初始化时的嵌套内容
                        if (cnode.type === Syntax.FunctionExpression || cnode.type === Syntax.BlockStatement) {
                            return estraverse.VisitorOption.Skip;
                        }
                    }
                });

                return;
            }

            if (node.type === Syntax.AssignmentExpression &&
                node.operator === '=') {
                str = checkMemberExpressionNode(node.left);
                if (str) {
                    ignoreItem(str);
                    // funObj = stack[stack.length - 1];
                    arr = str.split('.');
                    key = arr[0];
                    pushAssignmentVar(key, str, {
                        name: str,
                        level: arr.length,
                        insertor: function(ast) {
                            console.log('insert code into assignment vars:', str, parent
                                /*,
                                                            parent.body, parent.body.length, parent.body.indexOf(node)*/
                            );
                            var index;

                            if (parent.body && parent.body.length) {
                                index = parent.body.indexOf(node);
                                console.log('>>>>', index, parent.body, node);
                                // console.log('<<<', _.isArray(ast), ast);
                                if (index > -1) {
                                    if (_.isArray(ast)) {
                                        ast.unshift(index + 1, 0);
                                        // console.log('>>>>', ast);
                                        pSplice.apply(parent.body, ast);
                                    } else {
                                        parent.body.splice(index + 1, 0, ast);
                                    }
                                }
                            }
                        }
                    });
                }
            }

            // ignores //
            if (node.type === Syntax.LogicalExpression || node.type === Syntax.UnaryExpression || node.type === Syntax.IfStatement) {
                checkIgnore(node);
            }
            // ignores //

            if (node.type === Syntax.MemberExpression &&
                node.property && node.property.name) {
                funObj = stack[stack.length - 1];
                // 遇到对象取值
                str = checkMemberExpressionNode(node, parent);
                // console.log('>>>', funObj.name, node, str);
                if (str) {
                    processVals(str, opt);
                    // console.log('<<<', funObj.vars);
                    return estraverse.VisitorOption.Skip;
                }
            }
        },
        leave: function(node, parent) {
            var funObj;
            var item;
            var str;
            // var insertor;
            var insertAST;
            var match;

            if (node.type === Syntax.FunctionDeclaration ||
                node.type === Syntax.FunctionExpression ||
                node.type === Syntax.CatchClause) {
                // console.log('leave fun:', stack);
                funObj = stack[stack.length - 1];
                for (var key in funObj.vars) {
                    if (funObj.vars.hasOwnProperty(key)) {
                        for (var i = 0, l = funObj.vars[key].items.length; i < l; ++i) {
                            item = funObj.vars[key].items[i];
                            console.log('>>>', item);
                            match = getInsertorByKey(key, item);
                            if (match) {
                                str = item + ' = ' + item + ' || {};';
                                insertAST = esprima.parse(str).body;
                                match.insertor(insertAST);
                            }
                        }

                        // match = getInsertorByKey(key);
                        // str = getInsertCodeStringByKey(key, match.matchObj);
                        // if (str) {
                        //     // console.log('insert code:', str);
                        //     insertAST = esprima.parse(str).body;
                        //     match.insertor(insertAST);
                        // }
                    }
                }
                // 退栈
                stack.pop();
            }
        }
    });

    var codeStr = escodegen.generate(ret);

    return codeStr;
}

module.exports = defend;
