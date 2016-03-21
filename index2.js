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
        this.varMap[key] = opt;
    },
    ignoreItem: function(key) {
        if (!this.varMap[key]) {
            this.varMap[key] = {};
        }

        this.varMap[key].hasValue = true;
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
