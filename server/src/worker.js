/**
 * Piscina worker.
 */
function countVowelsASCII(str) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    // Force ASCII letters to lowercase via bitwise OR with 32.
    // Works for A-Z. Safe for non-letters (won't match vowel codes).
    switch (str.charCodeAt(i) | 32) {
      case 97: // a
      case 101: // e
      case 105: // i
      case 111: // o
      case 117: // u
        count++;
        break;
      default:
        break;
    }
  }
  return count;
}

module.exports = ({ op, text }) => {
  if (typeof text !== "string") throw new Error("text must be a string");

  if (op === "length") return text.length;
  if (op === "vowels") return countVowelsASCII(text);

  throw new Error(`unknown op: ${op}`);
};
