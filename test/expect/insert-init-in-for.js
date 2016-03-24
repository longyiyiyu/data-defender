function test($el) {
    var el;
    var el2;
    for (var i = 0; el = $el[i++];) {
        el.childNodes = el.childNodes || el.childNodes === '' ? el.childNodes : {};
        console.log(el.childNodes.length);
    }
    for (; el; el = $el[i++]) {
        el.childNodes2222 = el.childNodes2222 || el.childNodes2222 === '' ? el.childNodes2222 : {};
        console.log(el.childNodes2222.length);
    }
    for (; el = $el[i++], el2 = $el[i++];) {
        el2.childNodes222 = el2.childNodes222 || el2.childNodes222 === '' ? el2.childNodes222 : {};
        console.log(el.childNodes.length);
        for (; el = $el[i++];) {
            el.childNodes2 = el.childNodes2 || el.childNodes2 === '' ? el.childNodes2 : {};
            console.log(el.childNodes2.length);
            console.log(el2.childNodes222.length);
        }
    }
}