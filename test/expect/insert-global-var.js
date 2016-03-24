var gVar;
function test() {
    gVar = gVar || gVar === '' ? gVar : {};
    gVar.a = gVar.a || gVar.a === '' ? gVar.a : {};
    gVar.a.b = gVar.a.b || gVar.a.b === '' ? gVar.a.b : {};
    if (gVar.a.b.c) {
        console.log('yes');
    }
}