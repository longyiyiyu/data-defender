# data-member-defender
prevent badjs of read an attribute of null object

## Install

```sh
npm install data-member-defender
```

## Test

```sh
mocha
```

## Usage

```javascript
var defend = require('data-defender');

var newContent = defend(content, {
    ignores: ['T']
});
```

## reference
[数据字段防卫探索](http://imweb.io/topic/56f3892f14ea0f7263803d46)
