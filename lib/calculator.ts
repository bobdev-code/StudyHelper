class ExpressionParser {
  private position = 0;

  constructor(private readonly input: string) {}

  parse() {
    const value = this.expression();
    this.skipWhitespace();
    if (this.position !== this.input.length || !Number.isFinite(value)) {
      throw new Error("Ungültiger Ausdruck");
    }
    return value;
  }

  private expression(): number {
    let value = this.term();
    while (true) {
      this.skipWhitespace();
      if (this.take("+")) value += this.term();
      else if (this.take("-")) value -= this.term();
      else return value;
    }
  }

  private term(): number {
    let value = this.power();
    while (true) {
      this.skipWhitespace();
      if (this.take("*")) value *= this.power();
      else if (this.take("/")) {
        const divisor = this.power();
        if (divisor === 0) throw new Error("Division durch null");
        value /= divisor;
      } else return value;
    }
  }

  private power(): number {
    const base = this.unary();
    this.skipWhitespace();
    return this.take("^") ? base ** this.power() : base;
  }

  private unary(): number {
    this.skipWhitespace();
    if (this.take("+")) return this.unary();
    if (this.take("-")) return -this.unary();
    if (this.takeWord("sqrt")) {
      const value = this.unary();
      if (value < 0) throw new Error("Wurzel aus negativer Zahl");
      return Math.sqrt(value);
    }
    return this.postfix();
  }

  private postfix(): number {
    let value = this.primary();
    this.skipWhitespace();
    while (this.take("%")) {
      value /= 100;
      this.skipWhitespace();
    }
    return value;
  }

  private primary(): number {
    this.skipWhitespace();
    if (this.take("(")) {
      const value = this.expression();
      this.skipWhitespace();
      if (!this.take(")")) throw new Error("Schließende Klammer fehlt");
      return value;
    }
    const match = this.input.slice(this.position).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error("Zahl erwartet");
    this.position += match[0].length;
    return Number(match[0]);
  }

  private skipWhitespace() {
    while (/\s/.test(this.input[this.position] ?? "")) this.position += 1;
  }

  private take(value: string) {
    if (!this.input.startsWith(value, this.position)) return false;
    this.position += value.length;
    return true;
  }

  private takeWord(value: string) {
    if (!this.input.startsWith(value, this.position)) return false;
    this.position += value.length;
    return true;
  }
}

export function calculateExpression(expression: string) {
  const normalized = expression
    .replaceAll(",", ".")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("√", "sqrt");
  return new ExpressionParser(normalized).parse();
}

export function formatCalculatorResult(value: number) {
  if (!Number.isFinite(value)) return "Fehler";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 10,
    useGrouping: false,
  }).format(Math.abs(value) < 1e-12 ? 0 : value);
}
