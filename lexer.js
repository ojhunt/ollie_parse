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
  get position() {
    return this.source.position(this.offset);
  }
}
class LexerCompiler {

  constructor({ name, unicode = true }) {
    this.name = name;
    this.$rules = [];
    this.$unicode = unicode;
  }
  addRule(name, rule, callback = (text, ruleName) => text) {
    this.$rules.push({ name, rule, callback, shouldIgnore: false, isLiteral: undefined });
  }
  addIgnoreRule(name, rule) {
    this.$rules.push({ name, rule, callback: null, shouldIgnore: true, isLiteral: undefined });
  }
  compile() {
    function fixupRule({ name, rule, callback, shouldIgnore, isLiteral }) {
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
        ruleSource = ruleSource.replace(/[\.\*\!\(\)\+\{\}\?\\\[\]]/g, x => `\\${x}`);
        isLiteral = true;
      }
      return { name, regexp: new RegExp(`^(?:${ruleSource})`, flags), callback, shouldIgnore, isLiteral };
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
    this.$currentToken = null;
    this.$eofTag = Object.freeze({});
    this.next();
  }
  get currentToken() { return this.$currentToken; }
  $next(shouldEvaluate) {
    if (this.$offset == this.$input.length) {
      this.$currentToken = this.$eofTag;
      return;
    }
    let currentRule = null;
    let currentMaxLength = 0;
    let currentText = null;
    // This relies on the engine being smart enough to use slices/ropes
    // for substringing.
    let currentString = this.$input.substring(this.$offset);

    for (let rule of this.$rules) {
      let matches = rule.regexp.exec(currentString);
      if (!matches)
        continue;
      let thisText = matches[0];
      if (thisText.length > currentMaxLength) {
        currentText = thisText;
        currentRule = rule;
        currentMaxLength = thisText.length;
      } else if (thisText.length == currentMaxLength) {
        if (rule.isLiteral) {
          if (currentRule.isLiteral)
            throw "Duplicate rule";
          currentRule = rule;
        }
      }
    }
    if (!currentRule) {
      throw `Invalid token '${this.$input[this.$offset]}' at ${this.$source.position(this.$offset).join(":")}`;
    }
    let currentOffset = this.$offset;
    this.$offset += currentMaxLength;
    if (currentRule.shouldIgnore) {
      this.$next(shouldEvaluate);
      return;
    }
    let value = shouldEvaluate ? currentRule.callback(currentText, currentRule.name) : null;

    let token = new Token(
      { source: this.$source, rule: currentRule.name, offset: currentOffset, text: currentText, value }
    );
    Object.freeze(token);
    this.$currentToken = token;
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
    let trueToken = this.$currentToken;
    const trueOffset = this.$offset;
    for (let i = 0; i < count; i++) {
      this.$next(shouldEvaluate);
    }
    let result = this.$currentToken;
    this.$currentToken = trueToken;
    this.$offset = trueOffset;

    if (result === this.$eofTag) {
      return null;
    }
    return result;
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
}
