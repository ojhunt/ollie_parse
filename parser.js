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
    ["comment", /\/\*([\s\S]*?\*\/)/m, null], // /*..*/ are multiline
    ["comment", /\/\/.*/, null], // not multiline regexp so this automatically works
    ["whitespace", /[\t\n\r ]/, null], // whitespace
    ["string", /""|"[\S\s]*?[^\\]"/, text => JSON.parse(text)], // decodes the string literal *and* kills lexing if wrong. smooth.
    ["number", /[0-9]+(?![a-zA-Z_])/],
    ["ident", /[a-zA-Z_][a-zA-Z_0-9]*/],
    ["action", /{{{.*?}}}/m],
    ["regex", /\[\]|\[[\S\s]*?[^\\]\]/],
    `"`,
    `'`,
    `"`,
    `;`,
    `{`,
    `}`,
    `{{`,
    `}}`,
    `(`,
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
    `=`,
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
  lexer = lexerBuilder.createLexer(read("parser.ogrammar"));
  function match(rule) {
    if (!Array.isArray(rule))
      return lexer.currentToken.rule == rule;
    log(lexer.currentToken.rule);
    log(rule[0]);
    if (lexer.currentToken.rule != rule[0])
      return false;
    log("here: " + JSON.stringify(rule));
    for (let i = 1; i < rule.length; i++) {
      log(i);
      let peeked = lexer.peek(i);
      log("peeked: ", peeked);
      log(JSON.stringify(peeked, null, "  "));
      log("peeked: ", peeked);
      if (peeked.rule != rule[i]) {
        return false;
      }
    }
    return true;
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
    if (match("{{")) {
      prefixCodeBlock = parseCodesegment();
      if (tryConsume("?")) {
        predicate = prefixCodeBlock;
        prefixCodeBlock = null;
        if (match("{{"))
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
    if (match("{"))
      postfixCodeblock = parseCodesegment();
    return new ComponentNode({ label, predicate, prefixCodeBlock, postfixCodeblock, element, suffixes });
  }

  // element: "~"? (terminal | "(" rule_list ")");
  function parseElement() {
    let wrapper = _ => _;
    if (tryConsume("~"))
      wrapper = n => new NegateElementNode(n);
    if (tryConsume("(")) {
      let result = new CompoundElementNode(parseRuleList());
      consume(")");
      if (!wrapper(result)) throw "";
      return wrapper(result);
    }
    let terminal = parseTerminal();
    if (!wrapper(terminal)) throw "";
    return wrapper(terminal);
  }

  // element_suffix: "*" | "?" | "{" number("," number?) ? "}"
  function parseElementSuffix() {
    if (tryConsume("*")) return new ZeroOrMoreSuffixNode();
    if (tryConsume("+")) return new OneOrMoreSuffixNode();
    if (tryConsume("?")) return new OptionalSuffixNode();
    if (tryConsume("{")) {
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
  // terminal: ident | number | string | set;
  function parseTerminal() {
    switch (lexer.currentToken.rule) {
      case "ident": return cachedTerminal(IdentTerminalNode, consume("ident").value);
      case "number": return cachedTerminal(NumberTerminalNode, consume("number").value);
      case "string": return cachedTerminal(StringTerminalNode, consume("string").value);
    }
    return cachedTerminal(SetTerminalNode, consume("regex").value);
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
