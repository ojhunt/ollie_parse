if (this.load) load("lexer.js")

let generatorLexerBuilder = new LexerCompiler("OPLexer")
generatorLexerBuilder.addIgnoreRule(/\/\*(.*?\*\/)/)
generatorLexerBuilder.addIgnoreRule(/\/\/(^[\\n]*)/)
