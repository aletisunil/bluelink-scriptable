interface RsaPublicKeyJwk {
  n: string
  e: string
  kid?: string
}

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Map<string, number>(alphabet.split('').map((char, index) => [char, index]))

  const output: number[] = []
  let buffer = 0
  let bits = 0

  for (const char of padded) {
    if (char === '=') break
    const value = lookup.get(char)
    if (typeof value !== 'number') {
      throw new Error(`Invalid base64url character: ${char}`)
    }
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output.push((buffer >> bits) & 0xff)
    }
  }

  return new Uint8Array(output)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  if (bytes.length === 0) return 0n
  return BigInt(`0x${bytesToHex(bytes)}`)
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const output = new Uint8Array(length)
  let remaining = value

  for (let index = length - 1; index >= 0; index--) {
    output[index] = Number(remaining & 0xffn)
    remaining >>= 8n
  }

  if (remaining !== 0n) {
    throw new Error('BigInt does not fit into the requested length')
  }

  return output
}

function bigIntBitLength(value: bigint): number {
  if (value === 0n) return 0
  return value.toString(2).length
}

function randomNonZeroByte(): number {
  let value = 0
  while (value === 0) {
    value = Math.floor(Math.random() * 255) + 1
  }
  return value
}

function pkcs1v15Pad(message: Uint8Array, k: number): Uint8Array {
  if (message.length > k - 11) {
    throw new Error('Message too long for RSA PKCS#1 v1.5 encryption')
  }

  const paddingLength = k - message.length - 3
  const padded = new Uint8Array(k)
  padded[0] = 0x00
  padded[1] = 0x02

  for (let index = 0; index < paddingLength; index++) {
    padded[2 + index] = randomNonZeroByte()
  }

  padded[2 + paddingLength] = 0x00
  padded.set(message, 3 + paddingLength)
  return padded
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus <= 0n) {
    throw new Error('Invalid RSA modulus')
  }
  let result = 1n
  let currentBase = base % modulus
  let currentExponent = exponent

  while (currentExponent > 0n) {
    if ((currentExponent & 1n) === 1n) {
      result = (result * currentBase) % modulus
    }
    currentExponent >>= 1n
    currentBase = (currentBase * currentBase) % modulus
  }

  return result
}

export function encryptPasswordWithRsaJwk(
  password: string,
  jwk: RsaPublicKeyJwk,
): { encryptedPasswordHex: string; kid?: string } {
  if (!jwk.n || !jwk.e) {
    throw new Error('RSA public key is missing modulus or exponent')
  }

  const modulusBytes = base64UrlToBytes(jwk.n)
  const exponentBytes = base64UrlToBytes(jwk.e)
  const modulus = bytesToBigInt(modulusBytes)
  const exponent = bytesToBigInt(exponentBytes)
  const k = Math.ceil(bigIntBitLength(modulus) / 8)
  const paddedMessage = pkcs1v15Pad(utf8ToBytes(password), k)
  const encrypted = modPow(bytesToBigInt(paddedMessage), exponent, modulus)
  const encryptedBytes = bigIntToBytes(encrypted, k)

  return {
    encryptedPasswordHex: bytesToHex(encryptedBytes),
    kid: jwk.kid,
  }
}

function utf8ToBytes(input: string): Uint8Array {
  const bytes: number[] = []
  for (const char of input) {
    const codePoint = char.codePointAt(0)
    if (typeof codePoint !== 'number') continue
    if (codePoint <= 0x7f) {
      bytes.push(codePoint)
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6))
      bytes.push(0x80 | (codePoint & 0x3f))
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12))
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f))
      bytes.push(0x80 | (codePoint & 0x3f))
    } else {
      bytes.push(0xf0 | (codePoint >> 18))
      bytes.push(0x80 | ((codePoint >> 12) & 0x3f))
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f))
      bytes.push(0x80 | (codePoint & 0x3f))
    }
  }
  return new Uint8Array(bytes)
}
