var fs = require('fs');

var _ = require('lodash');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var esquery = require('esquery');
var Syntax = estraverse.Syntax;

var defaults = {
    ignores: ['document', 'window', 'location', 'localStorage',
        'require', 'module', '$', 'that', 'this', 'self', '_this', 'Math',
        'hasOwnProperty'
    ]
};
var str = fs.readFileSync('./test.js');
var ast = esprima.parse(str);

// estraverse.traverse(node, {
//     enter: function(node, parent) {},
//     leave: function(node, parent) {}
// });

// console.log(esprima.parse('data = data || {};data.result = data.result || {};'));

function test() {
    var matches;
    var str = 'mask && mask.hide();'+
    '!obj || obj.show();if(abc){abc.aaa();}'+
    'T.mobile = {test:function(){}};'+
    'if (abc) {abc=aa;aaa=function() { abc=ddd; }}';
    var ast = esprima.parse(str);

    matches = esquery(ast, 'AssignmentExpression[operator="="]');
    console.log('matches1:', matches);
    console.log('\n');
    matches = esquery(ast, ':statement');
    console.log('matches2:', matches);
}

test();

function hasInserted(rkey, item) {
    var o;

    // console.log('hasInserted:', rkey, item, stack.length);
    if (stack.length < 2) {
        return false;
    }

    for (var i = stack.length - 2; i >= 0; --i) {
        o = stack[i];
        if (o.vars[rkey] && (o.vars[rkey].items.indexOf(item) > -1)) {
            return true;
        }
    }

    return false;
}

function processVals(str) {
    var vars;
    var funObj = stack[stack.length - 1];
    var varObj;
    var item;

    if (!str.length || str[0] === '.') {
        return;
    }

    vars = str.split('.');

    if (defaults.ignores.indexOf(vars[0]) > -1) {
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

function searchKey(arr, key) {
    for (var i = 0, l = arr.length; i < l; ++i) {
        if (arr[i].name === key) return arr[i];
    }

    return null;
}

function searchAssignmentKey(arr, item) {
    console.log('searchAssignmentKey', arr, item);
    console.log('\n');
    for (var i = arr.length - 1; i >= 0; --i) {
        // if (arr[i].name === item) { // 已经赋值，不用insert
        //     return -1;
        // }

        if (item.indexOf(arr[i].name) === 0) {
            return arr[i];
        }

    }

    return 0;
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

        // 先找赋值变量
        if (funObj.assignmentVars[key]) {
            matchObj = searchAssignmentKey(funObj.assignmentVars[key].items, item);
        }
        console.log('getInsertorByKey2', funObj.assignmentVars[key], matchObj);

        // if (matchObj === -1) {
        //     return null;
        // }

        if (!matchObj) {
            // 再找局部变量
            matchObj = searchKey(funObj.localVars, key);
            if (!matchObj) {
                // 再找参数
                matchObj = searchKey(funObj.params, key);
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

function getIgnoreArr(insertObj) {
    var funObj;
    var ret = [];

    for (var i = stack.length - 1; i >= 0; --i) {
        funObj = stack[i];
        ret = ret.concat(funObj.ignores);
        if (funObj === insertObj) {
            break;
        }
    }

    return ret;
}

function getInsertCodeStringByKey(key, insertObj) {
    var ret = '';
    var item;
    var funObj = stack[stack.length - 1];
    var ignoreArr = getIgnoreArr(insertObj);

    if (!funObj || !funObj.vars || !funObj.vars[key]) {
        return;
    }

    for (var i = 0, l = funObj.vars[key].items.length; i < l; ++i) {
        item = funObj.vars[key].items[i];
        if (ignoreArr.indexOf(item) < 0) {
            ret += item + ' = ' + item + ' || {};';
        }
    }

    return ret;
}

function checkMemberExpressionNode(node, parent) {
    var item = '';

    estraverse.traverse(node, {
        enter: function(cnode, cparent) {
            if (cnode.type === Syntax.MemberExpression) {
                node.hasTraversed = true;
                if (cnode.computed) {
                    item = '';
                    this.break();
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

            item = '';
            this.break();
        },
        leave: function(cnode, cparent) {}
    });

    return item;
}

function ignoreItem(item) {
    var funObj = stack[stack.length - 1];

    if (funObj.ignores.indexOf(item) < 0) {
        // console.log('ignore:', funObj.name, item);
        funObj.ignores.push(item);
    }
}

function pushAssignmentVar(key, item, confObj) {
    var funObj = stack[stack.length - 1];
    var obj = funObj.assignmentVars[key];
    var o;
    var hasPush = false;

    if (!obj) {
        obj = funObj.assignmentVars[key] = {
            items: []
        };
    }

    // console.log('pushAssignmentVar', key, item, obj);

    for (var i = 0, l = obj.items.length; i < l; ++i) {
        o = obj.items[i];
        if (o.name === str) {
            break;
        }

        if (o.level > confObj.level) {
            obj.items.splice(i, 0, confObj);
            hasPush = true;
            break;
        }
    }

    if (!hasPush) {
        obj.items.push(confObj);
    }
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

var pUnshift = Array.prototype.unshift;
var pSplice = Array.prototype.splice;
var stack = [];
var globalId = 1;
var ret = estraverse.replace(ast, {
    enter: function(node, parent) {
        var funObj;
        var str;
        var arr;
        var key;

        if ((node.type === Syntax.FunctionDeclaration ||
            node.type === Syntax.FunctionExpression ||
            node.type === Syntax.CatchClause) &&
            node.body && node.body.type === Syntax.BlockStatement) {
            // 遇到函数，先把函数信息压栈
            funObj = {
                name: node.id && node.id.name || globalId++,
                params: [],
                localVars: [],
                globalVars: [],
                vars: {},
                assignmentVars: {},
                ignores: [],
                body: node.body,
                insertor: function(ast) {
                    // console.log('insert code into global vars');
                    if (_.isArray(ast)) {
                        pUnshift.apply(node.body.body, ast);
                    } else {
                        node.body.body.unshift(ast);
                    }
                }
            };

            // 记录函数参数
            if (node.param) {
                node.params = [node.param];
            }

            for (var i = 0, l = node.params.length; i < l; ++i) {
                if (node.params[i].type === Syntax.Identifier) {
                    funObj.params.push({
                        name: node.params[i].name,
                        insertor: function(ast) {
                            // console.log('insert code into params vars');
                            if (_.isArray(ast)) {
                                pUnshift.apply(node.body.body, ast);
                            } else {
                                node.body.body.unshift(ast);
                            }
                        }
                    });
                }
            }

            stack.push(funObj);
            return;
        }

        if (!stack.length) {
            return;
        }

        if (node.type === Syntax.VariableDeclaration &&
            node.kind === 'var') {
            estraverse.traverse(node, {
                enter: function(cnode, cparent) {
                    if (cnode.type === Syntax.VariableDeclarator &&
                        cnode.id && cnode.id.name && stack.length) {
                        // 记录局部变量
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

                        if (cnode.init) {
                            // 已经初始化
                            ignoreItem(cnode.id.name);
                        }
                    }

                    if (cnode.type === Syntax.FunctionExpression) {
                        return estraverse.VisitorOption.Skip;
                    }
                },
                leave: function(cnode, cparent) {}
            });

            return;
            // return estraverse.VisitorOption.Skip;
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

        // 这部分的代码有点相似 //
        if (node.type === Syntax.LogicalExpression) {
            str = checkMemberExpressionNode(node.left, node);
            if (str) {
                ignoreItem(str);
            }
            str = checkMemberExpressionNode(node.right, node);
            if (str) {
                ignoreItem(str);
            }
        }

        if (node.type === Syntax.UnaryExpression) {
            str = checkMemberExpressionNode(node.argument, node);
            if (str) {
                ignoreItem(str);
            }
        }

        if (node.type === Syntax.IfStatement) {
            str = checkMemberExpressionNode(node.test, node);
            if (str) {
                ignoreItem(str);
            }
        }
        // 这部分的代码有点相似 //

        if (node.type === Syntax.MemberExpression &&
            node.property && node.property.name &&
            !node.hasTraversed) {
            funObj = stack[stack.length - 1];
            // 遇到对象取值
            str = checkMemberExpressionNode(node, parent);
            console.log('>>>', funObj.name, node, str);
            if (str) {
                processVals(str);
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

// console.log(ret);

var codeStr = escodegen.generate(ret);
fs.writeFileSync('./test.out.js', codeStr);
