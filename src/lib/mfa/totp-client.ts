import { TOTP } from "otpauth";

export function generateCurrentCode(
  secret: string,
  period = 30,
  digits = 6,
  algorithm: "SHA1" | "SHA256" | "SHA512" = "SHA1"
): string {
  const totp = new TOTP({
    secret,
    period,
    digits,
    algorithm,
  });
  return totp.generate();
}

export function getSecondsRemaining(period = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}

export function getTimeUntilNext(period = 30): number {
  return getSecondsRemaining(period);
}
