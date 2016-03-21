var gVar;
function test() {
    gVar = typeof gVar === undefined || gVar === null ? {} : gVar;
    gVar.a = typeof gVar.a === undefined || gVar.a === null ? {} : gVar.a;
    gVar.a.b = typeof gVar.a.b === undefined || gVar.a.b === null ? {} : gVar.a.b;
    if (gVar.a.b.c) {
        console.log('yes');
    }
}