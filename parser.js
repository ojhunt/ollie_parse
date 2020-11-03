if (this.load) load("lexer.js");



/*
 The grammar
  
 ident = [a-zA-Z_][a-zA-Z0-9_]*
 number = [0-9]+
 string = "..."
 comment = // .*?\n
 comment = /* .*? * /

 or = "|"
 colon = ":"
 dblquote = "\""
 singlequote = "'"
 star = "*"
 plus = "+"
 
*/

let generatorLexerBuilder = new LexerCompiler("OPLexer");
let rules = [
  ["comment", /\/\*([\s\S]*?\*\/)/m, null], // /*..*/ are multiline
  ["comment", /\/\/.*/, null], // not multiline regexp so this automatically works
  ["whitespace", /[\t\n\r ]/, null], // whitespace
  ["string", /""|"[\S\s]*?[^\\]"/, text => JSON.parse(text)] // decodes the string literal *and* kills lexing if wrong. smooth.
  ["number", /[0-9]+(?![a-zA-Z_])/],
  ["ident", /[a-zA-Z_][a-zA-Z_0-9]*/],
  ["doublequote", `"`],
  ["singlequote", `'`],
  ["quote", `"`],
];
for (rule of rules) {
  if (rule[2] !== null)
    generatorLexerBuilder.addRule(...rule);
  else
    generator.addIgnoreRule(...rule);
}