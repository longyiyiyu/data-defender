function test(obj) {
    obj = typeof obj === undefined || obj === null ? {} : obj;
    obj.a = typeof obj.a === undefined || obj.a === null ? {} : obj.a;
    obj.a.b = typeof obj.a.b === undefined || obj.a.b === null ? {} : obj.a.b;
    obj.a.b.c = 1;
}