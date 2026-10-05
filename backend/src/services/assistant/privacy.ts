// What never reaches Gemini.
//
// The assistant sends the model the site's public FAQ entries and the
// visitor's latest message — nothing else: no name, no e-mail, no earlier
// messages, no page history. Even that one message is cleaned first:
//
//   - a card number, an IBAN or a Turkish ID number stops the assistant
//     altogether: the visitor is told not to share them in chat and is
//     handed to a person (nothing is sent);
//   - e-mail addresses, phone numbers and other long digit runs (order or
//     tracking numbers) are replaced by placeholders before sending.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const IBAN = /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i;
const CARD_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g;
const TCKN = /\b[1-9]\d{10}\b/g;
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g;
const LONG_NUMBER = /\b\d{6,}\b/g;

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** The Turkish ID number checksum (T.C. kimlik no). */
function tcknValid(value: string): boolean {
  const d = value.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  return (odd * 7 - even) % 10 === d[9] && d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/** True when the text carries a card number, an IBAN or a Turkish ID number. */
export function carriesSensitiveData(text: string): boolean {
  if (IBAN.test(text)) return true;
  for (const match of text.match(CARD_CANDIDATE) ?? []) {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return true;
  }
  for (const match of text.match(TCKN) ?? []) {
    if (tcknValid(match)) return true;
  }
  return false;
}

/** The message with contact details and long numbers replaced. */
export function redact(text: string): string {
  return text
    .replace(EMAIL, '[e-posta]')
    .replace(PHONE, '[telefon]')
    .replace(LONG_NUMBER, '[numara]');
}
