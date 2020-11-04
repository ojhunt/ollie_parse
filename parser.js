if (this.load) load("lexer.js");



/*
  The grammar

  ident : [a-zA-Z_][a-zA-Z0-9_]*
  number : [0-9]+
  string : "..."
  comment : // .*?\n
  comment : /* .*? * /

  or : "|"
  colon : ":"
  dblquote : "\""
  singlequote : "'"
  star : "*"
  plus : "+"
 
  grammar : "grammar" ident "{" grammar_definitions "}"
  grammar_definitions : (production)*
  production : ident ":" rule_list
  rule_list : rule ("|" rule)*
  rule : component*
  component : (element element_suffix*)?
  element_suffix: "*" | "?" | "{" number ("," number)? "}"
  element : terminal | "(" rule_list ")"
  terminal : ident | number | string | set
  set : "[" "^"? set_element+ "]" 
  set_element : [\S\s]+ | ([\S\s] "-" [\S\s])
*/

let bootstrapParser = function () {
  let lexerBuilder = new LexerCompiler("OPLexer");
  let rules = [
    ["comment", /\/\*([\s\S]*?\*\/)/m, null], // /*..*/ are multiline
    ["comment", /\/\/.*/, null], // not multiline regexp so this automatically works
    ["whitespace", /[\t\n\r ]/, null], // whitespace
    ["string", /""|"[\S\s]*?[^\\]"/, text => JSON.parse(text)], // decodes the string literal *and* kills lexing if wrong. smooth.
    ["number", /[0-9]+(?![a-zA-Z_])/],
    ["ident", /[a-zA-Z_][a-zA-Z_0-9]*/],
    ["action", /{{{.*?}}}/m],
    `"`,
    `'`,
    `"`,
    `;`,
    `{`,
    `}`,
    `:`,
    "grammar",
  ];
  for (rule of rules) {
    if (typeof rule == "string") {
      lexerBuilder.addRule(rule, rule);
      continue;
    }
    if (rule[2] !== null)
      lexerBuilder.addRule(...rule);
    else
      lexerBuilder.addIgnoreRule(...rule);
  }
  lexerBuilder.compile();
  lexer = lexerBuilder.createLexer(
    `
    grammar LanguageGrammar {
    gramma_head: "grammar" ident "{" grammar_definitions "}"
    grammar_definitions: (production)*
    production: ident ":" rule_list
    }
    `
  );
  function match(rule) {
    return lexer.currentToken.rule == rule;
  }
  function expect(rule) {
    if (!consume(rule))
      throw `Unexpected token. Expected ${rule}, found ${lexer.currentToken.rule}: '${lexer.currentToken.text}'`;
  }
  function consume(rule) {
    if (!match(rule))
      return false;
    lexer.next();
    return true;
  }

  // grammar: "grammar" ident "{" grammar_definitions "}";
  function parseGrammar() {
    expect("grammar");
    let grammarName = consume("ident").value;
    expect("{");
    let grammarBody = parseGrammarDefinitions();
    expect("}");
    return new Grammar({ name: grammarName, productions: grammarBody });
  }

  // grammar_definitions: (production) *
  function parseGrammarDefinitions() {
    let rules = [];
    while (lexer.hasNext()) {
      rules.push(parseProduction());
    }
    return rules;
  }

  // production : ident ":" rule_list;
  function parseProduction() {
    let productionName = consume("ident");
    expect(":");
    let rules = parseRuleList();
    expect(";");
    return new Production({ name: productionName, rules });
  }

  // rule_list: rule("|" rule) * ";"
  function parseRuleList() {
    let rules = [parseRule()];
    while (match("|"))
      rules.push(parseRule());
    return rules;
  }

  // rule : component *
  function parseRule() {
    let components = [];
    // Followset is | and ;
    while (!match("|") && !match(";")) {
      components.push(parseComponent());
    }
    return components;
  }

  // component : (element element_suffix *)?
  function parseComponent() {
    // Followset is | and ;
    if (match("|") || match(";"))
      return null;
    let element = parseElement();
    let suffixes = [];
    while (!match("|") && !match(";")) {
      suffixes.push(parseElementSuffix());
    }
    return new Component({ element, suffixes });
  }

  // element: terminal | "(" rule_list ")";
  function parseElement() {

  }
  // element_suffix: "*" | "?" | "{" number("," number) ? "}"
  // terminal: ident | number | string | set;
  // set: "[" "^" ? set_element + "]" 
  // set_element: [\S\s] + | ([\S\s] "-"[\S\s])
  let grammar = parseGrammar();
}();
