const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

function startsWith(buffer: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte);
}

export function matchesDeclaredFileType(buffer: Buffer, contentType: string): boolean {
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === 'image/png') return buffer.length >= PNG.length && startsWith(buffer, PNG);
  if (contentType === 'application/pdf') {
    return buffer.length >= PDF.length && startsWith(buffer, PDF);
  }
  return false;
}
