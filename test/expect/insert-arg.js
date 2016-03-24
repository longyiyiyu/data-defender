function test(obj) {
    obj = obj || obj === '' ? obj : {};
    obj.a = obj.a || obj.a === '' ? obj.a : {};
    obj.a.b = obj.a.b || obj.a.b === '' ? obj.a.b : {};
    obj.a.b.c = 1;
}