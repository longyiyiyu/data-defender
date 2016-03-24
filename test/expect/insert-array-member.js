function test(categories, opt, opt1, opt2, opt3, opt4) {
    opt4 = opt4 || opt4 === '' ? opt4 : {};
    opt3 = opt3 || opt3 === '' ? opt3 : {};
    opt2 = opt2 || opt2 === '' ? opt2 : {};
    opt1 = opt1 || opt1 === '' ? opt1 : {};
    opt = opt || opt === '' ? opt : {};
    var a = categories[opt.mt].s[opt.st].t[opt.tt];
    var b = categories[opt1.mt].s[opt2.st].t[opt3.tt];
    var c = categories[opt4.abc].s[opt.st].cc[opt3];
}