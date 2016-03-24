function tttt() {
    var gVar;
    function test() {
        gVar = gVar || gVar === '' ? gVar : {};
        gVar.a = gVar.a || gVar.a === '' ? gVar.a : {};
        gVar.a.b = gVar.a.b || gVar.a.b === '' ? gVar.a.b : {};
        var tmp;
        if (gVar.a.b.c) {
            console.log('yes');
        }
        if (gVar !== tmp) {
            gVar && (gVar.style.marginLeft = '0px');
            gVar = tmp;
        }
        gVar.style = gVar.style || gVar.style === '' ? gVar.style : {};
        gVar.style['transition'] = 'none';
        var left = -parseInt(gVar.style.marginLeft) || 0;
    }
    function test2() {
        if (!gVar)
            return;
        gVar.style = gVar.style || gVar.style === '' ? gVar.style : {};
        var a = gVar.style.marginLeft;
        var left;
        gVar.style['transition'] = 'margin-left 300ms';
        setTimeout(function () {
            gVar = gVar || gVar === '' ? gVar : {};
            gVar.style = gVar.style || gVar.style === '' ? gVar.style : {};
            gVar.style.marginLeft = -left + 'px';
        }, 0);
    }
}