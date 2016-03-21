function tttt() {
    var gVar;

    function test() {
        var tmp;

        if (gVar.a.b.c) {
            console.log('yes');
        }

        if (gVar !== tmp) {
            gVar && (gVar.style.marginLeft = '0px');
            gVar = tmp;
        }

        gVar.style['transition'] = 'none';
        var left = -parseInt(gVar.style.marginLeft) || 0;
    }

    function test2() {
        if (!gVar) return;

        var a = gVar.style.marginLeft;
        var left;

        gVar.style['transition'] = 'margin-left 300ms';
        setTimeout(function() {
            gVar.style.marginLeft = -left + 'px';
        }, 0);
    }
}
