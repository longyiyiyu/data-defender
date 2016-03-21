function test($el) {
    var el;
    var el2;

    for (var i = 0; el = $el[i++];) {
        console.log(el.childNodes.length);
    }

    for (; el; el = $el[i++]) {
        console.log(el.childNodes2222.length);
    }

    for (; el = $el[i++], el2 = $el[i++];) {
        console.log(el.childNodes.length);
        for (; el = $el[i++];) {
            console.log(el.childNodes2.length);
            console.log(el2.childNodes222.length);
        }
    }
}
