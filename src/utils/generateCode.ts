// src/utils/generateCode.ts

/**
 * Generates a random 6-character short code consisting of 2 numbers and 4 uppercase letters.
 */
export function generateShortCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  let code = '';
  
  // Choose 2 random numbers
  for (let i = 0; i < 2; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  // Choose 4 random letters
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  // Shuffle the string to mix numbers and letters
  return code.split('').sort(() => 0.5 - Math.random()).join('');
}
