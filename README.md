# d-tpl
a tpl engine for html template with directives attributes

## Install

```sh
npm install d-tpl
```

## Test

```sh
mocha test/test.js
```

## Example

if we have a HTML fragment with directives like this:

```html
<div q-cname="test">
    <div q-repeat="list | getList">
        <div q-text="name" q-show="isShow" q-class="red: isRed, bold: size | isBold"></div>
        <input type="text" q-value="pwd" />
        <input type="checkbox" q-value="isCheck" />
        <img src="" alt="" q-src="imgSrc" />
        <img src="" alt="" q-attr="src: imgSrc, attrs"/>
        <div q-text="list | insert 234 | length"></div>
    </div>
</div>
```
we can compile it to a tpl fun with filters:

```javascript
var tpl = require('d-tpl');
var src = getSrc(); // get the HTML fragment
var tplFun = tpl.compile({
    raw: src
});

```

then, we can use this tpl function to output the HTML by datas and filters:

```
var data = getData(); // get the data
var filters = require('./filters');
var output = tplFun(data, {
    filters: filters
});
```

if the data like this:

```javascript
// data.json
/*
 * format:
 * {
 *      componentName: {
 *          key: value,
 *          subComponentName: {
 *              key: value
 *          }
 *      }
 * }
 * 
 * this data structure use nesting to represent the relationship between components
 * 
 */
{
    "test": {
        "list": [{
            "name": "Jack",
            "isShow": true,
            "isRed": true,
            "size": 12,
            "pwd": "123456",
            "isCheck": true,
            "imgSrc": "http://www.baidu.com/logo1.png",
            "attrs": {
                "width": 30,
                "height": 30
            },
            "list": [1, 2, 3]
        }, {
            "name": "John",
            "isShow": true,
            "isRed": false,
            "size": 12,
            "pwd": "123451231236",
            "isCheck": false,
            "imgSrc": "http://www.baidu.com/logo2.png",
            "attrs": {
                "width": 300,
                "height": 300
            },
            "list": [1, 2]
        }, {
            "name": "Anne",
            "isShow": false,
            "isRed": false,
            "size": 7,
            "pwd": "123412312356",
            "isCheck": false,
            "imgSrc": "http://www.baidu.com/logo3.png",
            "attrs": {
                "width": 300,
                "height": 300
            },
            "list": [1, 2, 3, 222]
        }]
    }
}

```

and the filters resource like this:

``` javascript
// filters.js
/*
 * format:
 * module.exports = {
 *      componentName: {
 *          filterName: filterFun
 *      }
 * }
 * 
 * this data structure will not be nested
 * that is, this data structure does not contain the relationship between components
 * 
 */
module.exports = {
    test: {
        getList: function(list) {
            list.forEach(function(item) {
                item.name += '_long';
            });
            return list;
        },
        isBold: function(size) {
            return size > 10;
        },
        insert: function(list, item) {
            list.push(item);
            return list;
        },
        length: function(list) {
            return list.length;
        }
    }
};
```

we will get the HTML like this:

```html
<div q-cname="test">
    <div>
        <div q-text="name" q-show="isShow" q-class="red: isRed, bold: size | isBold" style="display: block;" class="red bold">Jack_long</div>
        <input type="text" q-value="pwd" value="123456">
        <input type="checkbox" q-value="isCheck" checked>
        <img src="http://www.baidu.com/logo1.png" alt="" q-src="imgSrc">
        <img src="http://www.baidu.com/logo1.png" alt="" q-attr="src: imgSrc, attrs" width="30" height="30" >
        <div q-text="list | insert 234 | length">4</div>
    </div><div>
        <div q-text="name" q-show="isShow" q-class="red: isRed, bold: size | isBold" style="display: block;" class=" bold">John_long</div>
        <input type="text" q-value="pwd" value="123451231236">
        <input type="checkbox" q-value="isCheck" >
        <img src="http://www.baidu.com/logo2.png" alt="" q-src="imgSrc">
        <img src="http://www.baidu.com/logo2.png" alt="" q-attr="src: imgSrc, attrs" width="300" height="300" >
        <div q-text="list | insert 234 | length">3</div>
    </div><div>
        <div q-text="name" q-show="isShow" q-class="red: isRed, bold: size | isBold" style="display: none;" class=" ">Anne_long</div>
        <input type="text" q-value="pwd" value="123412312356">
        <input type="checkbox" q-value="isCheck" >
        <img src="http://www.baidu.com/logo3.png" alt="" q-src="imgSrc">
        <img src="http://www.baidu.com/logo3.png" alt="" q-attr="src: imgSrc, attrs" width="300" height="300" >
        <div q-text="list | insert 234 | length">5</div>
    </div>
</div>
```

for performance, the engine will set a function value named `funSerializationStr` into the tpl function, this value is the serialization of tpl function, you can save it in file as a node module<br>
for example, like this:

```javascript
var fs = require('fs');
fs.writeFileSync('./tplFun.js', tplFun.funSerializationStr);

// other modules can use it
var tplFun2 = require('./tplFun');
var data = getData(); // get the data
var filters = require('./filters');

var output = tplFun2(data, {
    filters: filters
});

```

> note: this tpl function module depends on `lodash` module

## Reference
- [Q.js](https://github.com/imweb/Q.js) this tpl is implemented to serve the mvvm library, Q.js, in the 0.0.1 version.

## TODO
- 现在的data是以组件名作为key的，如何解决包含重复组件的data？
- 在data格式中，子组件的data是属于父组件data的一个值，同样以组件名为key（会出现上一个问题）；如何解决父组件自身数据与子组件名同名问题？
- 实现通用方案，通过提供扩展点，实现能编译所有directives式语言的模板的能力
