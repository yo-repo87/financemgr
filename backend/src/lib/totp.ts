import { authenticator } from "otplib";
import QRCode from "qrcode";
import { env } from "./env";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export async function buildTotpQrCode(secret: string, userEmail: string): Promise<string> {
  const otpauthUrl = authenticator.keyuri(userEmail, env.webauthnRpName, secret);
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
