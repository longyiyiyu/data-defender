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

function Scope(opts) {
    var self = this;

    this.name = opts.name || globalId++;
    this.params = opts.params || [];
    this.localVars = opts.localVars || [];

    this.body = opts.body;
    this.loopStack = [];
    this.vars = [];
    this.varMap = {};

    this.insertor = function(ast) {
        // console.log('insert code into beginning');
        if (_.isArray(ast)) {
            pUnshift.apply(self.body.body, ast);
        } else {
            self.body.body.unshift(ast);
        }
    };
}

Scope.prototype = {
    constructor: Scope,
    addParam: function(param) {
        this.params.push(param);
        this.addVarMap(param, {
            insertor: this.insertor
        });
    },
    addLocalVar: function(v, opt) {
        this.localVars.push(v);
        this.addVarMap(v, opt);
    },
    addVarMap: function(key, opt) {
        var hasValue = this.varMap[key] && this.varMap[key].hasValue;

        this.varMap[key] = opt;
        this.varMap[key].hasValue = hasValue;
    },
    getVarMap: function(key) {
        return this.varMap[key];
    },
    ignoreItem: function(key) {
        if (!this.varMap[key]) {
            this.varMap[key] = {};
        }

        this.varMap[key].hasValue = true;
    },
    isIgnore: function(key) {
        return this.varMap[key] && this.varMap[key].hasValue;
    },
    insertItems: function(array) {
        this.vars = this.vars.concat(array);
    },
    hasInserted: function(key) {
        return this.vars.indexOf(key) > -1;
    }
};

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

function processIgnore(item, node, parent, qs) {
    var funObj = stack[stack.length - 1];
    var astItem;
    var matches;

    if (item.split('.').length > 1) {
        return;
    }

    funObj.ignoreItem(item);

    if (funObj.loopStack.length > 0) {
        funObj = funObj.loopStack[funObj.loopStack.length - 1];
    }

    funObj.addVarMap(item, {
        insertor: function(ast) {
            for (var i = 0, l = funObj.body.body.length; i < l; ++i) {
                astItem = funObj.body.body[i];
                matches = esquery(astItem, qs);
                if (matches && matches.indexOf(node) > -1) {
                    break;
                }
            }

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
    });
}

function checkIgnore(node, parent) {
    var keys = VisitorKeys[node.type];
    var funObj = stack[stack.length - 1];

    if (keys && keys.length) {
        keys.forEach(function(key) {
            var str = checkMemberExpressionNode(node[key], node);

            if (str && str.split('.').length === 1) {
                // funObj.ignoreItem(str);
                processIgnore(str, node, parent, node.type);
            } else if (str) {
                funObj.ignoreItem(str);
            }
        });
    }
}

function hasInserted(rkey, item) {
    var funObj = stack[stack.length - 1];

    return funObj.hasInserted(item);
}

function getInsertorByKey(key, item) {
    var funObj = stack[stack.length - 1];
    var ret;
    var matchObj;

    if (funObj.isIgnore(item)) {
        return null;
    }

    // 先找loop里面的
    for (var j = funObj.loopStack.length - 1; j >= 0; --j) {
        if ((matchObj = funObj.loopStack[j].getVarMap(key))) {
            break;
        }
    }

    if (!matchObj) {
        matchObj = funObj.getVarMap(key);
    }

    // for (var i = stack.length - 1; i >= 0; --i) {
    //     funObj = stack[i];
    //     // console.log('getInsertorByKey', key, item, funObj.ignores);
    //     // console.log('\n');
    //     // ignore
    //     if (funObj.ignores.indexOf(item) > -1) {
    //         return null;
    //     }

    // // 先找loop里面的
    // for (var j = funObj.loopStack.length - 1; j >= 0; --j) {
    //     if ((matchObj = funObj.loopStack[j].assignmentVars[key])) {
    //         break;
    //     }
    // }

    //     if (!matchObj) {
    //         // 先找赋值变量
    //         matchObj = funObj.assignmentVars[key];
    //         if (!matchObj) {
    //             // 再找局部变量
    //             matchObj = searchKey(funObj.localVars, key);
    //             if (!matchObj) {
    //                 // 再找参数
    //                 matchObj = searchKey(funObj.params, key);
    //             }
    //         }
    //     }

    //     if (matchObj) {
    //         // 找到了
    //         break;
    //     }
    // }

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
            str = item + ' = ' + item + ' || ' + item + ' === "" ? ' + item + ' : {}';
            // str = item + ' = ' + item + ' === undefined || ' + item + ' === null ? {} : ' + item;
            insertAST = esprima.parse(str).body;
            match.insertor(insertAST);
        }
    }

    // 保存已经insert的item，避免重复
    funObj.insertItems(list);
}

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
                // 遇到函数，先把函数信息压栈
                funObj = new Scope({
                    name: node.id && node.id.name,
                    body: node.body
                });

                // 记录函数参数 //
                if (node.param) {
                    node.params = [node.param];
                }

                for (var i = 0, l = node.params.length; i < l; ++i) {
                    if (node.params[i].type === Syntax.Identifier) {
                        funObj.addParam(node.params[i].name);
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
                            funObj.addLocalVar(cnode.id.name, {
                                insertor: function(ast) {
                                    var index;

                                    if (parent.body && parent.body.length) {
                                        index = parent.body.indexOf(node);
                                        if (index > -1) {
                                            if (_.isArray(ast)) {
                                                ast.unshift(index + 1, 0);
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
                                funObj.ignoreItem(cnode.id.name);
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
                    processIgnore(str, node, parent, 'AssignmentExpression[operator="="]');
                }
            }

            // 循环的处理与函数比较像
            if (node.type === Syntax.ForStatement) {
                funObj = stack[stack.length - 1];
                loopObj = new Scope({
                    body: node.body
                });

                paramObj = {
                    enter: function(cnode, cparent) {
                        if (cnode.type === Syntax.VariableDeclarator &&
                            cnode.id && cnode.id.name) {
                            cnode.hasTraversed = true;
                            loopObj.addVarMap(cnode.id.name, {
                                insertor: loopObj.insertor
                            });
                        }

                        if (cnode.type === Syntax.AssignmentExpression &&
                            cnode.operator === '=') {
                            cnode.hasTraversed = true;
                            str = checkMemberExpressionNode(cnode.left);
                            if (str && str.split('.').length === 1) {
                                loopObj.addVarMap(str, {
                                    insertor: loopObj.insertor
                                });
                                funObj.ignoreItem(str);
                            }
                        }
                    }
                };
                node.init && estraverse.traverse(node.init, paramObj);
                node.test && estraverse.traverse(node.test, paramObj);
                node.update && estraverse.traverse(node.update, paramObj);

                funObj.loopStack.push(loopObj);
            }

            // ignores //
            if (node.type === Syntax.LogicalExpression || node.type === Syntax.UnaryExpression || node.type === Syntax.BinaryExpression || node.type === Syntax.IfStatement || 
                node.type === Syntax.ConditionalExpression) {
                checkIgnore(node, parent);
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
