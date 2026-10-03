// Join code generation and validation

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // A-Z + 2-9, no O I L 0 1

export function generateJoinCode(): string {
  let code = '';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[array[i] % CODE_CHARS.length];
  }
  return code;
}

export function isValidJoinCode(code: string): boolean {
  if (code.length !== 6) return false;
  for (const ch of code) {
    if (!CODE_CHARS.includes(ch)) return false;
  }
  return true;
}
