/** Format known Korean numbers without truncating unfamiliar or international numbers. */
export function formatPhoneNumber(value: string): string {
  const text = value.trim();
  const digits = text.replace(/\D/g, "");
  if (!digits) return text.startsWith("+") ? "+" : "";
  if (text.startsWith("+")) {
    // Keep the country code; do not silently turn foreign contacts into Korean ones.
    if (digits.startsWith("82")) {
      const subscriber = digits.slice(2);
      if (!subscriber) return "+82";
      const national = subscriber.startsWith("0") ? subscriber : `0${subscriber}`;
      const formatted = formatDomestic(national);
      if (formatted !== null) return `+82 ${formatted.slice(1)}`;
    }
    return `+${digits}`;
  }
  return formatDomestic(digits) ?? digits;
}

function formatDomestic(digits: string): string | null {
  const seoul = digits.startsWith("02");
  const mobile = /^01\d/.test(digits);
  const area = /^0(?:[3-6]\d|70|80)/.test(digits);
  if (!seoul && !mobile && !area) return null;
  const prefixLength = seoul ? 2 : 3;
  const maxLength = seoul ? 10 : 11;
  if (digits.length > maxLength) return null;
  const prefix = digits.slice(0, prefixLength), rest = digits.slice(prefixLength);
  if (!rest) return prefix;
  // 010 is always 3-4-4; landlines can have either a 3- or 4-digit exchange.
  const exchangeLength = digits.startsWith("010") || digits.length === maxLength ? 4 : 3;
  if (rest.length <= exchangeLength) return `${prefix}-${rest}`;
  return `${prefix}-${rest.slice(0, exchangeLength)}-${rest.slice(exchangeLength)}`;
}
