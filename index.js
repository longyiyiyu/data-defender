var fs = require('fs');

var _ = require('lodash');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var esquery = require('esquery');
var Syntax = estraverse.Syntax;
var VisitorKeys = estraverse.VisitorKeys;

var defaults = {
    ignores: ['document', 'window', 'location', 'localStorage', 'console',
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

function checkMemberExpressionNode(node, parent, all) {
    var item = '';
    var arr = [];

    estraverse.traverse(node, {
        enter: function(cnode, cparent) {
            // console.log('>>>', item, cnode, cparent);
            if (cnode.type === Syntax.MemberExpression) {
                // node.hasTraversed = true;
                if (cparent && cnode === cparent['property']) {
                    if (item) arr.push(item);
                    item = '';
                }

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

    if (item) arr.push(item);

    if (all) {
        return arr;
    } else {
        return item;
    }
}

function hasInserted(rkey, item) {
    var o;

    // console.log('hasInserted:', rkey, item, stack.length);
    // if (stack.length < 2) {
    //     return false;
    // }

    for (var i = stack.length - 1; i >= 0; --i) {
        o = stack[i];
        if (o.vars[rkey] && (o.vars[rkey].items.indexOf(item) > -1)) {
            return true;
        }
    }

    return false;
}

function getInsertorByKey(key, item) {
    var funObj;
    var ret;
    var matchObj;

    for (var i = stack.length - 1; i >= 0; --i) {
        funObj = stack[i];
        // console.log('getInsertorByKey', key, item, funObj.ignores);
        // console.log('\n');
        // ignore
        if (funObj.ignores.indexOf(item) > -1) {
            return null;
        }

        // 先找loop里面的
        for (var j = funObj.loopStack.length - 1; j >= 0; --j) {
            if ((matchObj = funObj.loopStack[j].assignmentVars[key])) {
                break;
            }
        }

        if (!matchObj) {
            // 先找赋值变量
            matchObj = funObj.assignmentVars[key];
            if (!matchObj) {
                // 再找局部变量
                matchObj = searchKey(funObj.localVars, key);
                if (!matchObj) {
                    // 再找参数
                    matchObj = searchKey(funObj.params, key);
                }
            }
        }

        if (matchObj) {
            // 找到了
            break;
        }
    }

    if (matchObj) {
        return {
            matchObj: funObj,
            insertor: matchObj.insertor
        };
    } else {
        // 所有函数的局部变量和参数都没有找到
        // 那应该是全局变量
        // 全局变量只需要在当前函数插入即可
        return {
            matchObj: stack[stack.length - 1],
            insertor: stack[stack.length - 1].insertor
        };
    }
}

function processVals(str, opt) {
    var vars;
    var funObj = stack[stack.length - 1];
    var varObj;
    var item;
    var list = [];
    var match;
    var insertAST;
    var key;

    if (!str.length || str[0] === '.') {
        return;
    }

    vars = str.split('.');
    key = vars[0];
    // 全局ignore
    if (defaults.ignores.indexOf(key) > -1 || opt && opt.ignores && opt.ignores.indexOf(key) > -1) {
        return;
    }

    // 找出所有的插入item
    item = '';
    for (var i = 0, l = vars.length - 1; i < l; ++i) {
        item = item + (i === 0 ? '' : '.') + vars[i];
        if (!hasInserted(key, item)) {
            // console.log('push item:', item);
            list.push(item);
        }
    }

    // insert code
    for (i = list.length - 1; i >= 0; --i) {
        item = list[i];
        match = getInsertorByKey(key, item);
        // console.log('>>>', item, match.insertor);
        if (match) {
            // str = item + ' = ' + item + ' || {};';
            str = item + ' = typeof ' + item + ' === undefined || ' + item + ' === null ? {} : ' + item;
            insertAST = esprima.parse(str).body;
            match.insertor(insertAST);
        }
    }

    // 保存已经insert的item，避免重复
    varObj = funObj.vars[key];
    if (!varObj) {
        varObj = funObj.vars[key] = {
            items: []
        };
    }

    varObj.items = varObj.items.concat(list);

    // item = '';
    // for (var i = 0, l = vars.length - 1; i < l; ++i) {
    //     item = item + (i === 0 ? '' : '.') + vars[i];
    //     if (varObj.items.indexOf(item) < 0 &&
    //         !hasInserted(vars[0], item)) {
    //         // console.log('push item:', item);
    //         varObj.items.push(item);
    //     }
    // }
}

function searchKey(arr, key) {
    for (var i = 0, l = arr.length; i < l; ++i) {
        if (arr[i].name === key) return arr[i];
    }

    return null;
}

function insertorFactory(node, getQueryFun, funObj) {
    return function(ast) {
        var astItem;
        var matches;

        for (var i = 0, l = funObj.body.body.length; i < l; ++i) {
            astItem = funObj.body.body[i];
            matches = esquery(astItem, getQueryFun());
        }
    };
}

function processAssignment(item, node, parent) {
    var funObj = stack[stack.length - 1];
    var astItem;
    var matches;

    if (item.split('.').length > 1) {
        return;
    }

    ignoreItem(item);

    if (funObj.loopStack.length > 0) {
        funObj = funObj.loopStack[funObj.loopStack.length - 1];
    }

    funObj.assignmentVars[item] = {
        name: item,
        insertor: function(ast) {
            for (var i = 0, l = funObj.body.body.length; i < l; ++i) {
                astItem = funObj.body.body[i];
                matches = esquery(astItem, 'AssignmentExpression[operator="="]');
                if (matches && matches.indexOf(node) > -1) {
                    break;
                }
            }

            // console.log('>><<', i, l, funObj.body.body);
            if (i >= l) {
                // 到了这里应该有问题
                return;
            }

            if (_.isArray(ast)) {
                ast.unshift(i + 1, 0);
                pSplice.apply(funObj.body.body, ast);
            } else {
                funObj.body.body.splice(i + 1, 0, ast);
            }
        }
    };
}

// test //
// function test() {
//     var str = 'a = 2';
//     // var str = 'a.b.c[0].d.e = 2';
//     var ast = esprima.parse(str);
//     console.log(ast.body[0].expression.left);
//     var ret = checkMemberExpressionNode(ast.body[0].expression.left);
//     console.log(ret);
// }
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
            var loopObj;
            var loopBeginningInsertor;
            var paramObj;

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
                    loopStack: [],
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
                node.kind === 'var' && !node.hasTraversed) {
                estraverse.traverse(node, {
                    enter: function(cnode, cparent) {
                        if (cnode.type === Syntax.VariableDeclarator &&
                            cnode.id && cnode.id.name && !cnode.hasTraversed) {
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
                node.operator === '=' && !node.hasTraversed) {
                str = checkMemberExpressionNode(node.left);
                if (str) {
                    processAssignment(str, node, parent);
                }
            }

            // 循环的处理与函数比较像
            if (node.type === Syntax.ForStatement) {
                funObj = stack[stack.length - 1];
                loopBeginningInsertor = function(ast) {
                    // console.log('insert code into loop beginning\n');
                    if (_.isArray(ast)) {
                        pUnshift.apply(node.body.body, ast);
                    } else {
                        node.body.body.unshift(ast);
                    }
                };

                loopObj = {
                    body: node.body,
                    assignmentVars: {},
                    insertor: loopBeginningInsertor
                };

                paramObj = {
                    enter: function(cnode, cparent) {
                        if (cnode.type === Syntax.VariableDeclarator &&
                            cnode.id && cnode.id.name) {
                            cnode.hasTraversed = true;
                            loopObj.assignmentVars[cnode.id.name] = {
                                name: cnode.id.name,
                                insertor: loopBeginningInsertor
                            };
                        }

                        if (cnode.type === Syntax.AssignmentExpression &&
                            cnode.operator === '=') {
                            cnode.hasTraversed = true;
                            str = checkMemberExpressionNode(cnode.left);
                            if (str && str.split('.').length === 1) {
                                loopObj.assignmentVars[str] = {
                                    name: str,
                                    insertor: loopBeginningInsertor
                                };
                                ignoreItem(str);
                            }
                        }
                    }
                };
                node.init && estraverse.traverse(node.init, paramObj);
                node.test && estraverse.traverse(node.test, paramObj);
                node.update && estraverse.traverse(node.update, paramObj);

                funObj.loopStack.push(loopObj);
                // console.log('loop obj push', funObj.loopStack[0].assignmentVars);
            }

            // ignores //
            if (node.type === Syntax.LogicalExpression || node.type === Syntax.UnaryExpression || node.type === Syntax.BinaryExpression || node.type === Syntax.IfStatement) {
                checkIgnore(node);
            }
            // ignores //

            if (node.type === Syntax.MemberExpression &&
                node.property && node.property.name) {
                funObj = stack[stack.length - 1];
                // 遇到对象取值
                str = checkMemberExpressionNode(node, parent, true);
                // console.log('>>>', funObj.name, node, str);
                if (str.length) {
                    str.forEach(function(item) {
                        processVals(item, opt);
                    });
                    
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
                // funObj = stack[stack.length - 1];
                // for (var key in funObj.vars) {
                //     if (funObj.vars.hasOwnProperty(key)) {
                //         for (var i = funObj.vars[key].items.length - 1; i >= 0; --i) {
                //             item = funObj.vars[key].items[i];
                //             // console.log('>>>', item);
                //             match = getInsertorByKey(key, item);
                //             if (match) {
                //                 str = item + ' = ' + item + ' || {};';
                //                 insertAST = esprima.parse(str).body;
                //                 match.insertor(insertAST);
                //             }
                //         }

                //         // match = getInsertorByKey(key);
                //         // str = getInsertCodeStringByKey(key, match.matchObj);
                //         // if (str) {
                //         //     // console.log('insert code:', str);
                //         //     insertAST = esprima.parse(str).body;
                //         //     match.insertor(insertAST);
                //         // }
                //     }
                // }
                // 退栈
                stack.pop();
            }

            // 循环的处理与函数比较像
            if (node.type === Syntax.ForStatement) {
                funObj = stack[stack.length - 1];

                funObj.loopStack.pop();
            }
        }
    });

    var codeStr = escodegen.generate(ret);

    return codeStr;
}

module.exports = defend;
