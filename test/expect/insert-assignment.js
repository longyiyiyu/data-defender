function test(obj) {
    var T;
    T = require('tools');
    T.cookie = T.cookie || T.cookie === '' ? T.cookie : {};
    var name = T.cookie.get('name');
    if (!obj) {
        obj = { count: { count: 5 } };
    }
    obj.count = obj.count || obj.count === '' ? obj.count : {};
    obj.count.count = 6;
}