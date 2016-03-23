function tttt() {
    var gVar;
    function test() {
        gVar = typeof gVar === undefined || gVar === null ? {} : gVar;
        gVar.a = typeof gVar.a === undefined || gVar.a === null ? {} : gVar.a;
        gVar.a.b = typeof gVar.a.b === undefined || gVar.a.b === null ? {} : gVar.a.b;
        var tmp;
        if (gVar.a.b.c) {
            console.log('yes');
        }
        if (gVar !== tmp) {
            gVar && (gVar.style.marginLeft = '0px');
            gVar = tmp;
        }
        gVar.style = typeof gVar.style === undefined || gVar.style === null ? {} : gVar.style;
        gVar.style['transition'] = 'none';
        var left = -parseInt(gVar.style.marginLeft) || 0;
    }
    function test2() {
        if (!gVar)
            return;
        gVar.style = typeof gVar.style === undefined || gVar.style === null ? {} : gVar.style;
        var a = gVar.style.marginLeft;
        var left;
        gVar.style['transition'] = 'margin-left 300ms';
        setTimeout(function () {
            gVar = typeof gVar === undefined || gVar === null ? {} : gVar;
            gVar.style = typeof gVar.style === undefined || gVar.style === null ? {} : gVar.style;
            gVar.style.marginLeft = -left + 'px';
        }, 0);
    }
}