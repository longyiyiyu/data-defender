function test(obj) {
    var T;

    T = require('tools');

    var name = T.cookie.get('name');

    if (!obj) {
        obj = {
            count: {
                count: 5
            }
        };
    }

    // obj.count
}
