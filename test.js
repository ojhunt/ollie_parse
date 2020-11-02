
if (this.load) load("lexer.js")

compiler = new LexerCompiler({ name: "wut" });
compiler.addRule("number", /[0-9]+(?![a-zA-Z_])/, (value) => Number(value))
compiler.addRule("ident", /[a-zA-Z_][a-zA-Z_0-9]*/)
compiler.addRule("return", "return")
compiler.addIgnoreRule(" ")
compiler.compile();

function test1() {
    let lexer = compiler.createLexer(" 1 ret return hi");

    for (let i = 1; i < 5; i++) {
        log(JSON.stringify(lexer.peek(i), null, "  "))
    }
}

function test2() {
    let lexer = compiler.createLexer(" 1 ret return hi");
    for (let token of lexer.tokens()) {
        log(JSON.stringify(token, null, "  "))
    }
}

test1();
test2();