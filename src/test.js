
if (this.load) load("lexer.js");

compiler = new LexerCompiler({ name: "wut" });
compiler.addRule("number", /[0-9]+(?![a-zA-Z_])/, (value) => Number(value));
compiler.addRule("ident", /[a-zA-Z_][a-zA-Z_0-9]*/);
compiler.addRule("return", "return");
compiler.addRule("comment", /\/\*([\s\S]*?\*\/)/m);
compiler.addRule("comment", /\/\/.*/); // Not a multiline comment
compiler.addRule("string", /""|"[\S\s]*?[^\\]"/);//, text => JSON.parse(text));
compiler.addIgnoreRule("whitespace", /[\n \t]/);
compiler.compile();

function test1() {
    let lexer = compiler.createLexer(" 1 ret return hi");

    for (let i = 1; i < 5; i++) {
        log(JSON.stringify(lexer.peek(i), null, "  "));
    }
}

function test2() {
    let lexer = compiler.createLexer(" 1 ret return hi");
    for (let token of lexer.tokens()) {
        log(JSON.stringify(token, null, "  "));
    }
}

function test3() {
    let lexer = compiler.createLexer("foo /* foo */ bar /* /* */ wibble");
    for (let token of lexer.tokens()) {
        log(`Token[${token.rule}]@${token.position}: ${token.text}`);
    }
}


function test4() {
    let lexer = compiler.createLexer("foo // bar\nwibble");
    for (let token of lexer.tokens()) {
        log(`Token[${token.rule}]@${token.position}: ${token.text}`);
    }
}
function test5() {
    let lexer = compiler.createLexer("foo /* bar\nwibb*/le");
    for (let token of lexer.tokens()) {
        log(`Token[${token.rule}]@${token.position}: ${token.text}`);
    }
}
function test6() {
    let str = '" fooo \\" bar"';
    let lexer = compiler.createLexer(str);
    for (let token of lexer.tokens()) {
        log(`Token[${token.rule}]@${token.position}: ${token.value}`);
    }
}

test1();
test2();
test3();
test4();
test5();
test6();
