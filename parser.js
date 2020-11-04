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

class ASTNode {
  constructor() {
    this.nodeName = this.constructor.name;
  }
}
class StringTerminal extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
  }

}
class IdentTerminal extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
  }

}
class SetTerminal extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
  }
}

class Component extends ASTNode {
  constructor({ element, suffixes }) {
    super();
    this.element = element;
    this.suffixes = suffixes;
  }
}
class Production extends ASTNode {
  constructor({ name, rules }) {
    super();
    this.name = name;
    this.rules = rules;
  }
}
class CompoundElement extends ASTNode {
  constructor(rules) {
    super();
    this.rules = rules;
  }
}

class StarSuffix extends ASTNode {

}
class Grammar extends ASTNode {
  constructor({ name, productions }) {
    super();
    this.name = name;
    this.productions = productions;
  }
}

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
    ["set", /\[[\^]?[\S\s]+?\]/],
    `"`,
    `'`,
    `"`,
    `;`,
    `{`,
    `}`,
    `(`,
    `)`,
    `:`,
    `*`,
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
    `grammar LanguageGrammar {
    gramma_head: "grammar" ident "{" grammar_definitions "}";
    grammar_definitions: (production)*;
    production: ident ":" rule_list;
    }
    `
  );
  function match(rule) {
    return lexer.currentToken.rule == rule;
  }
  function consume(rule) {
    let result = tryConsume(rule);
    if (!result)
      throw `Unexpected token@${lexer.currentToken.position}. Expected '${rule}', found ${lexer.currentToken.rule}: '${lexer.currentToken.text}'`;
    return result;
  }
  function tryConsume(rule) {
    if (!match(rule))
      return null;
    let result = lexer.currentToken;
    log([result.rule, result.text]);
    lexer.next();
    return result;
  }

  // grammar: "grammar" ident "{" grammar_definitions "}";
  function parseGrammar() {
    consume("grammar");
    let grammarName = consume("ident").value;
    consume("{");
    let grammarBody = parseGrammarDefinitions();
    consume("}");
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
    consume(":");
    let rules = parseRuleList();
    consume(";");
    return new Production({ name: productionName, rules });
  }

  // rule_list: rule("|" rule) *
  function parseRuleList() {
    let rules = [parseRule()];
    while (match("|"))
      rules.push(parseRule());
    return rules;
  }

  // rule : component *
  function parseRule() {
    let components = [];
    // Followset is |, ), and ;
    while (!match("|") && !match(";") && !match(")")) {
      components.push(parseComponent());
    }
    return components;
  }

  // component : (element element_suffix *)?
  function parseComponent() {
    // Followset is | and ;
    if (match("|") || match(";") || match(")"))
      return null;
    let element = parseElement();
    let suffixes = [];
    let suffix;
    while (suffix = parseElementSuffix()) {
      suffixes.push(suffix);
    }
    return new Component({ element, suffixes });
  }

  // element: terminal | "(" rule_list ")";
  function parseElement() {
    if (tryConsume("(")) {
      let result = new CompoundElement(parseRuleList());
      consume(")");
      return result;
    }
    return parseTerminal();
  }
  // element_suffix: "*" | "?" | "{" number("," number?) ? "}"
  function parseElementSuffix() {
    if (tryConsume("*")) return new StarSuffix();
    if (tryConsume("?")) return new OptionalSuffix();
    if (tryConsume("{")) {
      let lowerBound = consume("number");
      let isRange = false;
      if (tryConsume(",")) {
        range = true;
        let upperBound = consume(number);
      }
      if (!lowerBound && !upperBound)
        throw "Invalid matching range";
      consume("}");
      return new RangeSuffix({ lowerBound, upperBound, isRange });
    }
  }
  // terminal: ident | number | string | set;
  function parseTerminal() {
    switch (lexer.currentToken.rule) {
      case "ident": return new IdentTerminal(consume("ident").value);
      case "number": return new NumberTerminal(consume("number").value);
      case "string": return new StringTerminal(consume("string").value);
    }
    return new SetTerminal(consume("set").value);
  }
  let grammarAST = parseGrammar();
  log(JSON.stringify(grammarAST, null, "  "));
}();
