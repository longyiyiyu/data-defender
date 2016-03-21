function test(categories, opt, opt1, opt2, opt3, opt4) {
    opt4 = typeof opt4 === undefined || opt4 === null ? {} : opt4;
    opt3 = typeof opt3 === undefined || opt3 === null ? {} : opt3;
    opt2 = typeof opt2 === undefined || opt2 === null ? {} : opt2;
    opt1 = typeof opt1 === undefined || opt1 === null ? {} : opt1;
    opt = typeof opt === undefined || opt === null ? {} : opt;
    var a = categories[opt.mt].s[opt.st].t[opt.tt];
    var b = categories[opt1.mt].s[opt2.st].t[opt3.tt];
    var c = categories[opt4.abc].s[opt.st].cc[opt3];
}