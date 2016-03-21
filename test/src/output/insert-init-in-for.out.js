function test($el) {
    var el;
    var el2;
    for (var i = 0; el = $el[i++];) {
        el.childNodes = typeof el.childNodes === undefined || el.childNodes === null ? {} : el.childNodes;
        console.log(el.childNodes.length);
    }
    for (; el; el = $el[i++]) {
        el.childNodes2222 = typeof el.childNodes2222 === undefined || el.childNodes2222 === null ? {} : el.childNodes2222;
        console.log(el.childNodes2222.length);
    }
    for (; el = $el[i++], el2 = $el[i++];) {
        el2.childNodes222 = typeof el2.childNodes222 === undefined || el2.childNodes222 === null ? {} : el2.childNodes222;
        console.log(el.childNodes.length);
        for (; el = $el[i++];) {
            el.childNodes2 = typeof el.childNodes2 === undefined || el.childNodes2 === null ? {} : el.childNodes2;
            console.log(el.childNodes2.length);
            console.log(el2.childNodes222.length);
        }
    }
}