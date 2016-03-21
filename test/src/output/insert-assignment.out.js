function test(obj) {
    var T;
    T = require('tools');
    T.cookie = typeof T.cookie === undefined || T.cookie === null ? {} : T.cookie;
    var name = T.cookie.get('name');
    if (!obj) {
        obj = { count: { count: 5 } };
    }
    obj.count = typeof obj.count === undefined || obj.count === null ? {} : obj.count;
    obj.count.count = 6;
}