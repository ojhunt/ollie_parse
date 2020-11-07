if (this.load) load("lexer.js");
print = null;


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
  terminal : ident | number | (string+) | set
  set : "[" "^"? set_element+ "]" 
  set_element : [\S\s]+ | ([\S\s] "-" [\S\s])
*/

class Visitor {
  visitStringTerminalNode(node) { }
  visitIdentTerminalNode(node) { }
  visitSetTerminalNode(node) { }
  visitGrammarNode(node) {
    for (let production of node.productions)
      production.visit(this);
  }
  visitComponentNode(node) {
    node.element.visit(this);
    for (let suffix of node.suffixes)
      suffix.visit(this);
  }
  visitProductionNode(node) {
    for (let rule of node.rules)
      rule.visit(this);
  }
  visitCompoundElementNode(node) {
    for (let rule of node.rules)
      rule.visit(this);
  }
  visitRuleNode(node) {
    for (let component of node.components)
      component.visit(this);
  }
  visitZeroOrMoreSuffixNode(node) { }
  visitOneOrMoreSuffixNode(node) { }
  visitOptionalSuffixNode(node) { }
  visitRangeSuffixNode(node) { }
  visitNegateElementNode(node) {
    node.node.visit(this);
  }
}

class ASTNode {
  constructor() {
    this.nodeName = this.constructor.name;
  }
  visit(visitor) {
    visitor[`visit${this.nodeName}`](this);
  }
}
class StringTerminalNode extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
  }
}
class IdentTerminalNode extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
  }

}
class SetTerminalNode extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
  }
}

class ComponentNode extends ASTNode {
  constructor({ element, suffixes }) {
    super();
    this.element = element;
    this.suffixes = suffixes;
  }
}
class ProductionNode extends ASTNode {
  constructor({ name, rules }) {
    super();
    this.name = name;
    this.rules = rules;
  }
}
class CompoundElementNode extends ASTNode {
  constructor(rules) {
    super();
    this.rules = rules;
  }
}
class ForwardAssertionNode extends ASTNode {
  constructor(rules) {
    super();
    this.rules = rules;
  }
}
class NegativeAssertionNode extends ASTNode {
  constructor(rules) {
    super();
    this.rules = rules;
  }
}
class NegateElementNode extends ASTNode {
  constructor(node) {
    super();
    this.node = node;
  }
}
class RuleNode extends ASTNode {
  constructor(components) {
    super();
    this.components = components;
  }
}
class CodeSegmentNode extends ASTNode {
  constructor(source) {
    super();
    this.source = source;
  }
}

class RangeSuffixNode extends ASTNode {
  constructor({ lowerCount, upperCount }) {
    super();
    this.lowerCount = lowerCount;
    this.upperCount = upperCount;
  }
}
class ZeroOrMoreSuffixNode extends RangeSuffixNode {
  constructor() {
    super(0, null);
  }
}
class OneOrMoreSuffixNode extends RangeSuffixNode {
  constructor() {
    super(1, null);
  }
}
class OptionalSuffixNode extends RangeSuffixNode {
  constructor() {
    super(0, 1);
  }
}

class GrammarNode extends ASTNode {
  constructor({ name, productions }) {
    super();
    this.name = name;
    this.productions = productions;
  }
}
class ParserGenerator {
  constructor(ast) {
    assert(ast instanceof GrammarNode);
    class TerminalFinder extends Visitor {
      constructor() {
        super();
        this.terminalSet = new Set;
      }
      visitStringTerminalNode(node) {
        this.terminalSet.add(node);
      }
      visitIdentTerminalNode(node) {
        this.terminalSet.add(node);
      }
      visitSetTerminalNode(node) {
        this.terminalSet.add(node);
      }
      get terminals() { return [...this.terminalSet]; }
    }
    let finder = new TerminalFinder;
    ast.visit(finder);
    let terminals = finder.terminals.map(a => a.value);
    log(`Terminals: ${terminals.map(p => `'${p}'`)}`);
    let productions = ast.productions.map(p => p.name);
    log(`Productions: ${productions}`);

  }
}



let bootstrapParser = function () {
  let lexerBuilder = new LexerCompiler("OPLexer");
  let rules = [
    {
      name: "comment",
      rule: /\/\*([\s\S]*?\*\/)/m,
      shouldIgnore: true
    }, // /*..*/ are multiline
    {
      name: "comment",
      rule: /\/\/.*/,
      shouldIgnore: true
    }, // not multiline regexp so this automatically works
    {
      name: "whitespace",
      rule: /[\t\n\r ]/,
      shouldIgnore: true
    }, // whitespace
    {
      name: "string",
      rule: /"(?:[^"\\]|\\[\s\S])*"/,
      callback: text => JSON.parse(text)
    }, // decodes the string literal *and* kills lexing if wrong. smooth.
    {
      name: "number", rule: /[0-9]+(?![a-zA-Z_])/
    },
    {
      name: "ident", rule: /[a-zA-Z_][a-zA-Z_0-9]*/
    },
    `"`,
    `'`,
    `"`,
    `;`,
    `{`,
    `}`,
    `(`,
    "(?!",
    "(?=",
    `)`,
    `<`,
    `>`,
    `:`,
    `*`,
    `|`,
    `,`,
    `?`,
    `+`,
    `~`,
    `/`,
    `=`,
    `?!`,
    "grammar",
  ];
  let regexRules = [
    {
      name: "regex_atom_escape",
      rule: /(?:[0-9]+)|(?:(?:[fnrtv])|(?:c[a-zA-Z])|(?:x[0-9a-fA-F]{2,2})|(?:u[0-9a-fA-F]{4,4})|(?:(?![0-9])[\W]))|(?:[dDsSwW])/,
      mode: "regex"
    },
    {
      name: "regex_class_escape",
      rule: /(?:[0-9]+)|(?:(?:[fnrtv])|(?:c[a-zA-Z])|(?:x[0-9a-fA-F]{2,2})|(?:u[0-9a-fA-F]{4,4})|(?:(?![0-9])[\W]))|(?:[dDsSwW])|b/,
      mode: "regex"
    },
    {
      name: "regex_source_character",
      rule: /[0-9\-\\^$.*+?/(){}\[\]|]/,
      mode: "regex"
    },
    {
      name: "regex_flags",
      rule: /[a-zA-Z]+/,
      mode: "regex"
    },
    {
      name: "regex_pattern_character",
      rule: /(?![-^$\\\.\*+?()\[\]{}|])[\S\s]/,
      mode: "regex"
    },
    //regex_pattern_character: /(?![-^$\\\.\*+?()\[\]{}|])[\S\s]/

    "(",
    "(?!",
    "(?=",
    ")",
    "[",
    "]",
    "-",
    "/",
    "\\"
  ];
  let codeblockRules = [
    {
      name: "comment",
      rule: /\/\*([\s\S]*?\*\/)/m,
      shouldIgnore: true,
      mode: "codeblock"
    }, // /*..*/ are multiline
    {
      name: "comment",
      rule: /\/\/.*/,
      shouldIgnore: true,
      mode: "codeblock"
    }, // not multiline regexp so this automatically works
    {
      name: "whitespace",
      rule: /[\t\n\r ]/,
      shouldIgnore: true,
      mode: "codeblock"
    }, // whitespace
    {
      name: "string",
      rule: /""|"[\S\s]*?[^\\]"/,
      mode: "codeblock"
    },
    {
      name: "string",
      rule: /''|'[\S\s]*?[^\\]'/,
      mode: "codeblock"
    },
    {
      name: "string",
      rule: /``|`[\S\s]*?[^\\]`/,
      mode: "codeblock"
    },
    {
      name: "misc",
      rule: /((?![{}])[\S()])+/,
      mode: "codeblock"
    },
    "{",
    "}"
  ];
  for (let rule of rules) {
    if (typeof rule == "string") {
      lexerBuilder.addRule({ name: rule, rule });
      continue;
    }
    lexerBuilder.addRule(rule);
  }
  for (let rule of regexRules) {
    if (typeof rule == "string") {
      lexerBuilder.addRule({
        name: rule,
        rule,
        mode: "regex"
      });
      continue;
    }
    lexerBuilder.addRule(rule);
  }
  for (let rule of codeblockRules) {
    if (typeof rule == "string") {
      lexerBuilder.addRule({
        name: rule,
        rule,
        mode: "codeblock"
      });
      continue;
    }
    lexerBuilder.addRule(rule);
  }
  lexerBuilder.compile();
  lexer = lexerBuilder.createLexer(read("parser.ogrammar"));
  function match(rule) {
    return lexer.match(rule);
  }
  function matchAnyOf(terms) {
    return lexer.matchAnyOf(terms);
  }
  function peek(lookahead) {
    return lexer.peek(lookahead);
  }
  function consume(rule) {
    return lexer.consume(rule);
  }
  function tryConsume(rule) {
    return lexer.tryConsume(rule);
  }
  function tryConsumeAnyOf(terms) {
    return lexer.tryConsumeAnyOf(terms);
  }
  function consumeAnyOf(terms) {
    return lexer.consumeAnyOf(terms);
  }

  // grammar: "grammar" ident "{" grammar_definitions "}";
  function parseGrammar() {
    consume("grammar");
    let grammarName = consume("ident").value;
    consume("{");
    let grammarBody = parseGrammarDefinitions();
    consume("}");
    return new GrammarNode({ name: grammarName, productions: grammarBody });
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
    let productionName = consume("ident").value;
    consume(":");
    let rules = parseRuleList();
    consume(";");
    return new ProductionNode({ name: productionName, rules });
  }

  // rule_list: rule("|" rule) *
  function parseRuleList() {
    let rules = [parseRule()];
    while (tryConsume("|")) {
      rules.push(parseRule());
    }
    return rules;
  }

  // rule : component *
  function parseRule() {
    let components = [];
    // Followset is |, ), and ;
    while (!match("|") && !match(";") && !match(")")) {
      components.push(parseComponent());
    }
    return new RuleNode(components);
  }
  // component : code_segment ? ("?" code_segment?)? ((ident "=")? element element_suffix*)? code_segment? ;
  function parseComponent() {
    let predicate = null;
    let prefixCodeBlock = null;
    if (match("{") && peek(1).rule != "number") {
      prefixCodeBlock = parseCodesegment();
      if (tryConsume("?")) {
        predicate = prefixCodeBlock;
        prefixCodeBlock = null;
        if (match("{") && peek(1).rule != "number")
          prefixCodeBlock = parseCodesegment();
      }
    }
    // Followset is | and ;
    if (match("|") || match(";") || match(")"))
      return null;
    let label = null;
    if (match(["ident", "="])) {
      label = consume("ident").value;
      consume("=");
    }
    let element = parseElement();
    let suffixes = [];
    let suffix;
    while (suffix = parseElementSuffix()) {
      suffixes.push(suffix);
    }
    let postfixCodeblock;
    if (match("{") && peek(1).rule != "number")
      postfixCodeblock = parseCodesegment();
    return new ComponentNode({ label, predicate, prefixCodeBlock, postfixCodeblock, element, suffixes });
  }

  function parseCodesegment() {
    if (!match("{")) throw "wat";
    let startToken = lexer.currentTokens[0];
    lexer.pushMode("codeblock");
    lexer.next();
    let tokens = [];
    let depth = 1;
    while (lexer.hasNext()) {
      if (tryConsume("{")) {
        depth++;
      } else if (match("}")) {
        depth--;
        if (depth == 0)
          break;
        lexer.next();
      } else {
        lexer.next();
      }
    }
    lexer.popMode();
    let endToken = lexer.currentTokens[0];
    lexer.next();
    let code = lexer.getSubstring(startToken.offset + startToken.length, endToken.offset);
    return new CodeSegmentNode(code);
  }

  // element: "~"? (terminal | "(" rule_list ")");
  function parseElement() {
    let wrapper = _ => _;
    if (tryConsume("~"))
      wrapper = n => new NegateElementNode(n);
    let openCompound = tryConsumeAnyOf(["(", "(?!", "(?="]);
    if (openCompound) {
      let result;
      switch (openCompound.rule) {
        case "(":
          result = new CompoundElementNode(parseRuleList());
          break;
        case "(?=":
          result = new ForwardAssertionNode(parseRuleList());
          break;
        case "(?!":
          result = new NegativeAssertionNode(parseRuleList());
          break;
      }
      consume(")");
      if (!wrapper(result)) lexer.$unexpectedToken("");
      return wrapper(result);
    }
    let terminal = parseTerminal();
    if (!wrapper(terminal)) lexer.$unexpectedToken("");
    return wrapper(terminal);
  }

  // element_suffix: "*" | "?" | "{" number("," number?) ? "}"
  function parseElementSuffix() {
    if (tryConsume("*")) return new ZeroOrMoreSuffixNode();
    if (tryConsume("+")) return new OneOrMoreSuffixNode();
    if (tryConsume("?")) return new OptionalSuffixNode();
    if (match("{") && peek(1).rule == "number") {
      consume("{");
      let lowerCount = consume("number").value;
      let isRange = false;
      let upperCount = null;
      if (tryConsume(",")) {
        range = true;
        let number = tryConsume("number");
        if (number)
          upperCount = number.value;
      } else {
        upperCount = lowerCount;
      }
      consume("}");
      return new RangeSuffixNode({ lowerCount, upperCount });
    }
  }
  // terminal: ident | number | string | regex;
  function parseTerminal() {
    if (!matchAnyOf(["ident", "number", "string"]))
      return parseRegex();
    let token = consumeAnyOf(["ident", "number", "string"]);
    switch (token.rule) {
      case "ident":
        return cachedTerminal(IdentTerminalNode, token.value);
      case "number":
        return cachedTerminal(NumberTerminalNode, token.value);
      case "string":
        return cachedTerminal(StringTerminalNode, token.value);
    }
  }

  // regex: (?= "/")(?!"//") { lexer.pushMode("regex"); } "/"   regex_pattern "/" regex_flags ? { lexer.popMode() };
  function parseRegex() {
    if (match("//")) lexer.$unexpectedToken("a");
    if (!match("/")) lexer.$unexpectedToken("b");
    lexer.pushMode("regex");
    let start = consume("/");
    let end;
    let flags = "";
    parseRegexPattern();
    if (match(["/", "regex_flags"])) {
      end = consume("/");
      // Use a peek to decide when to change mode
      flags = "";
    } else if (!match("/")) {
      lexer.$unexpectedToken();
    } else {
      end = lexer.currentTokens[0];
    }
    lexer.popMode();
    lexer.next();
    let body = lexer.getSubstring(start.offset + 1, end.offset);
    return new RegExp(body, flags ? flags.text : "");
  }

  // regex_pattern: regex_disjunction;
  function parseRegexPattern() {
    return parseRegexDisjunction();
  }

  // regex_disjunction: regex_alternative +;
  function parseRegexDisjunction() {
    while (!matchAnyOf([")", "/"]))
      parseRegexTerm();
  }
  // regex_term: regex_assertion | regex_atom regex_quantifier ?;
  function parseRegexTerm() {
    if (matchAnyOf(["^", "$", "\\b", "\\B", "(?!", "(?="])) {
      parseRegexAssertion();
      return;
    }
    parseRegexAtom();
    if (matchAnyOf(["*", "+", "?", "{"]))
      parseRegexQuantifier();
  }

  // regex_assertion: "^" | "$" | "\\b" | "\\B" | "(?=" regex_disjunction ")" | "(?!" regex_disjunction ")";
  function parseRegexAssertion() {
    if (tryConsumeAnyOf(["^", "$", "\\b", "\\B"])) return;
    consumeAnyOf(["(?!", "(?="]);
    parseRegexDisjunction();
    consume(")");
  }
  // regex_quantifier: ("*" | "+" | "?" | "{" regex_decimal_digits ("," regex_decimal_digits ?) ? "}") "?" ?;
  function parseRegexQuantifier() {
    if (tryConsumeAnyOf(["*", "+", "?"])) return;
    consume("{");
    consume("regex_decimal_digits");
    if (tryConsume(","))
      tryConsume("regex_decimal_digits");
    consume("}");
  }
  // regex_atom: regex_pattern_character
  //           | "."
  //           | "\\" regex_atom_escape
  //           | regex_character_class
  //           | "(" regex_disjunction ")"
  //           | "(?" regex_disjunction ")"
  //           ;
  // First(regex_atom): . \ ( [ 
  function parseRegexAtom() {
    // regex_pattern_character: /(?![-^$\\\.\*+?()\[\]{}|])[\S\s]/;
    if (tryConsume("regex_pattern_character"))
      return;
    if (tryConsume("."))
      return;
    if (tryConsume("\\")) {
      // regex_atom_escape: /(?:[0-9]+)|(?:(?:[fnrtv])|(?:c[a-zA-Z])|(?:x[0-9a-fA-F]{2,2})|(?:u[0-9a-fA-F]{4,4})|(?:(?![0-9])[\W]))|(?:[dDsSwW])/;
      consume("regex_atom_escape");
      return;
    }
    if (match("[")) {
      parseRegexCharacterClass();
      return;
    }
    consumeAnyOf(["(", "(?"]);
    parseRegexDisjunction();
    consume(")");
  }

  // regex_character_class: "[" regex_class_range * "]";
  function parseRegexCharacterClass() {
    consume("[");
    while (!match("]")) {
      parseRegexClassRange();
    }
    consume("]");
  }

  // regex_class_range: regex_class_atom("-" ? regex_class_range) *;
  function parseRegexClassRange() {
    parseRegexClassAtom();
    while (matchAnyOf(["-", "regex_source_character", "\\"]) && !match("]")) {
      tryConsume("-");
      parseRegexClassAtom();
    }
  }

  // regex_class_atom: (?!/[\]\-]/) regex_source_character | "\\" regex_class_escape;
  // regex_class_escape: regex_atom_escape | b;
  function parseRegexClassAtom() {
    if (tryConsume("\\")) {
      consume("regex_class_escape");
      return;
    }
    consume("regex_source_character");
  }


  let terminalCache = new Map;
  function cachedTerminal(nodeConstructor, value) {
    let theCache = terminalCache.get(nodeConstructor);
    if (!theCache) {
      theCache = new Map;
      terminalCache.set(nodeConstructor, theCache);
    }
    let cachedResult = theCache.get(value);
    if (cachedResult)
      return cachedResult;
    let newEntry = new nodeConstructor(value);
    theCache.set(value, newEntry);
    return newEntry;
  }
  let grammarAST = parseGrammar();
  log(JSON.stringify(grammarAST, null, "  "));
  let generator = new ParserGenerator(grammarAST);
}();
function assert(e) {
  if (!e) throw "assertion failed";
}
