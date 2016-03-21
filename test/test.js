var defender = require('../');
var fs = require('fs');
var path = require('path');

function compare(caseName) {
    var src = fs.readFileSync(path.join(__dirname, 'src', caseName + '.js'), 'utf-8');
    var expect = fs.readFileSync(path.join(__dirname, 'expect', caseName + '.js'), 'utf-8');
    var out = defender(src);

    fs.writeFileSync(path.join(__dirname, 'src', 'output', caseName + '.out.js'), out, 'utf-8');

    out.should.equal(expect);
}

describe('data defender', function() {
    it('should insert the code into the beginning of scope when the match point is function argument', function() {
        compare('insert-arg');
    });

    it('should insert the code into the beginning of scope when the match point is global var', function() {
        compare('insert-global-var');
    });

    it('should insert the code next to the assignment of vars', function() {
        compare('insert-assignment');
    });

    it('should insert the code into the loop if the data member accessing occured in loop', function() {
        compare('insert-init-in-for');
    });

    it('should insert the right code of member with array', function() {
        compare('insert-array-member');
    });

    it('should insert the right code of local var of closure function', function() {
        compare('insert-closure-fun-var');
    });

    // it('should recognize the data in ', function() {
    //     compare('');
    // });
});

// function output(type, caseName, bySerialization) {
//     var src = fs.readFileSync(path.join(__dirname, 'src', type, caseName + '.html'), 'utf-8');
//     var filters = require(path.join(__dirname, 'src', type, caseName + '.filters.js'));
//     var data = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', type, caseName + '.data.json'), 'utf-8'));
//     var expect = fs.readFileSync(path.join(__dirname, 'expect', type, caseName + '.html'), 'utf-8');
//     var fun2;
//     var fun = tpl.compile({
//         raw: src
//     });



//     // console.log(data, filters);

//     // fs.writeFileSync(path.join(__dirname, 'src', type, caseName + '.out.tpl.html'), fun.vm.tpl, 'utf-8');

//     fs.writeFileSync(path.join(__dirname, 'src', type, caseName + '.fun.js'), fun.funSerializationStr, 'utf-8');

//     // fs.writeFileSync(path.join(__dirname, 'src', type, caseName + '.out.html'), fun(data, {
//     //     filters: filters
//     // }), 'utf-8');

//     if (bySerialization) {
//         fun2 = require(path.join(__dirname, 'src', type, caseName + '.fun.js'));
//         fun2(data, {
//             filters: filters
//         }).should.equal(expect);
//     } else {
//         fun(data, {
//             filters: filters
//         }).should.equal(expect);
//     }
// }

// describe('output:', function() {
//     describe('output the html string by fun', function() {
//         it('should able to output the html string by filters and data', function() {
//             output('output', 'output');
//         });

//         it('should able to output the html string by filters and data when the template has sub mv', function() {
//             output('output', 'atest');
//         });
//     });

//     describe('output the html string by serialization', function() {
//         it('should able to output the html string by filters and data', function() {
//             output('output', 'output', true);
//         });

//         it('should able to output the html string by filters and data when the template has sub mv', function() {
//             output('output', 'atest', true);
//         });
//     });
// });
