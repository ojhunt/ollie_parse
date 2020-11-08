if (this.console) {
  log = (...msg) => console.log(...msg);
} else {
  log = print;
}
class Source {
  constructor(trueSource) {
    this.$trueSource = trueSource;
    this.$lineInfo = null;
  }
  substring(start, end) {
    return this.$trueSource.substring(start, end);
  }
  get(offset) { return this.$trueSource[offset]; }
  get text() { return this.$trueSource; }
  position(offset) {
    if (!this.$lineInfo) {
      let lineInfo = [0];
      for (let i = 1; i < this.$trueSource.length; i++) {
        if (this.$trueSource[i - 1] == '\n') lineInfo.push(i);
      }
      this.$lineInfo = lineInfo;
    }
    let line = this.$lineInfo.length - 1;
    for (let i = 1; i < this.$lineInfo.length; i++) {
      if (this.$lineInfo[i] > offset) {
        line = i - 1;
        break;
      }
    }
    let column = offset - this.$lineInfo[line];
    return [line + 1, column + 1];
  }
}
class Token {
  constructor({ source, rule, offset, text, value }) {
    this.source = source;
    this.offset = offset;
    this.text = text;
    this.value = value;
    this.rule = rule;
    Object.freeze(this);
  }
  get length() {
    return this.text.length;
  }
  get position() {
    return this.source.position(this.offset);
  }
}
if (typeof assert)
  assert = (c, m) => { if (!c) throw new Error(m); };
class LexerCompiler {

  constructor({ name, unicode = true }) {
    this.name = name;
    this.$rules = [];
    this.$unicode = unicode;
  }
  addRule({ name, rule, callback = (text, ruleName) => text, mode = "default", shouldIgnore = false }) {
    this.$rules.push({ name, rule, callback, shouldIgnore, isLiteral: undefined, mode });
  }
  compile() {
    function fixupRule({ name, rule, callback, shouldIgnore, isLiteral, mode }) {
      let ruleSource;
      let flags = "";
      if (rule instanceof RegExp) {
        ruleSource = rule.source;
        isLiteral = isLiteral || false;
        if (rule.flags.indexOf("m") >= 0)
          flags = "m";
      } else {
        // "escape" control characters
        ruleSource = "" + rule;
        ruleSource = ruleSource.replace(/[\.\*\!\(\)\+\{\}\?\\\|\[\]]/g, x => `\\${x}`);
        isLiteral = true;
      }
      return { name, regexp: new RegExp(`^(?:${ruleSource})`, flags), callback, shouldIgnore, isLiteral, mode };
    }
    this.$rules = this.$rules.map(rule => Object.freeze(fixupRule(rule)));
    Object.freeze(this);
    Object.freeze(this.$rules);
  }
  createLexer(input) {
    return new Lexer({
      name: this.name,
      rules: this.$rules,
      input
    });
  }

}

class Lexer {
  constructor({ name, rules, input }) {
    this.name = name;
    this.$rules = rules;
    this.$input = input;
    this.$source = new Source(input);
    this.$offset = 0;
    this.$currentToken = [];
    this.$eofTag = Object.freeze({});
    this.$modestack = ["default"];
    this.next();
  }
  pushMode(mode) {
    this.$modestack.push(mode);
  }
  popMode() {
    this.$modestack.pop();
  }
  get mode() { return this.$modestack[this.$modestack.length - 1]; }
  getSubstring(start, end) {
    return this.$source.substring(start, end);
  }
  get currentTokens() { return this.$currentTokens; }
  $next(shouldEvaluate, ignoreInvalidTokenForPeek = false) {
    if (this.$offset == this.$input.length) {
      this.$currentTokens = [this.$eofTag];
      return;
    }
    let currentMaxLength = 0;
    let currentText = null;
    // This relies on the engine being smart enough to use slices/ropes
    // for substringing.
    let currentString = this.$input.substring(this.$offset);
    let matchingRules = [];
    for (let rule of this.$rules) {
      if (rule.mode != this.mode)
        continue;
      let matches = rule.regexp.exec(currentString);
      if (!matches)
        continue;
      let thisText = matches[0];
      if (thisText.length > currentMaxLength) {
        currentText = thisText;
        matchingRules = [rule];
        currentMaxLength = thisText.length;
      } else if (thisText.length == currentMaxLength) {
        matchingRules.push(rule);
      }
    }
    if (!matchingRules.length && !ignoreInvalidTokenForPeek) {
      throw `Invalid token '${this.$input[this.$offset]}' at ${this.$source.position(this.$offset).join(":")}`;
    }
    let currentOffset = this.$offset;
    this.$offset += currentMaxLength;
    let ignoreCount = 0;
    for (let rule of matchingRules) {
      if (rule.shouldIgnore)
        ignoreCount++;
    }
    if (ignoreCount != 0 && ignoreCount != matchingRules.length) {
      throw "Ambiguous ignore vs !ignore tokens";
    }
    if (ignoreCount != 0) {
      this.$next(shouldEvaluate);
      return;
    }
    let tokens = [];
    for (let currentRule of matchingRules) {
      let value = shouldEvaluate ? currentRule.callback(currentText, currentRule.name) : null;
      let token = new Token({
        source: this.$source,
        rule: currentRule.name,
        offset: currentOffset,
        text: currentText,
        value
      });
      Object.freeze(token);
      tokens.push(token);
    }
    this.$currentTokens = tokens;
  }
  next() {
    return this.$next(true);
  }
  hasNext() {
    if (this.$currentToken === this.$eofTag)
      return false;
    return this.$peek(1) !== null;
  }
  $peek(count, shouldEvaluate) {
    "use strict";
    if (count === 0) throw "peek lookahead must be greater than 0";
    let trueTokens = this.$currentTokens;
    const trueOffset = this.$offset;
    for (let i = 0; i < count; i++) {
      this.$next(shouldEvaluate, true);
    }
    let results = this.$currentTokens;
    this.$currentTokens = trueTokens;
    this.$offset = trueOffset;

    if (results === this.$eofTag) {
      return null;
    }
    return results;
  }
  peek(count) {
    return this.$peek(count, true);
  }
  get token() {
    if (this.$currentToken == this.$eofTag)
      return null;
    return this.$currentToken;
  }
  *tokens() {
    while (this.currentToken !== this.$eofTag) {
      yield this.currentToken;
      this.next();
    }
  }

  match(rule) {
    if (!Array.isArray(rule)) {
      for (let token of this.$currentTokens) {
        if (token.rule == rule)
          return token;
      }
      return null;
    }
    let lookahead = [this.$currentTokens];
    if (rule.length > 1) {
      for (let i = 1; i < rule.length; i++) {
        lookahead.push(lexer.peek(i));
      }
    }
    let match = null;
    // we now have an array of possible tokens
    // at each point
    for (let i = 0; i < lookahead.length; i++) {
      let result = lookahead[i].find(t => t.rule === rule[i]);
      if (!result)
        return null;
      if (i == 0) match = result;
    }
    return match;
  }
  matchAnyOf(terms) {
    assert(Array.isArray(terms), "must be array");
    for (let term of terms) {
      if (this.match(term))
        return true;
    }
    return false;
  }
  $unexpectedToken(expected) {
    throw (`Unexpected token@${lexer.currentTokens[0].position}. `
      + `Expected '${expected}' found: '${lexer.currentTokens[0].text}'`);
  }
  consume(rule) {
    let result = this.tryConsume(rule);
    if (result)
      return result;
    this.$unexpectedToken(rule);
  }

  tryConsumeAnyOf(rules) {
    assert(Array.isArray(rules), "must be array");
    let alternatives = [];
    for (let rule of rules) {
      for (let token of this.$currentTokens) {
        if (token.rule == rule) {
          alternatives.push(token);
        }
      }
    }
    if (alternatives.length == 0)
      return null;
    if (alternatives.length != 1) {
      throw `ambiguous token '${alternatives[0].text}'`;
    }
    this.next();
    return alternatives[0];
  }
  consumeAnyOf(rules) {
    assert(Array.isArray(rules), "must be array");
    let result = this.tryConsumeAnyOf(rules);
    if (result) return result;
    this.$unexpectedToken(rules);
  }

  tryConsume(rule) {
    return this.tryConsumeAnyOf([rule]);
  }
};
