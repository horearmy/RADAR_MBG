export type OtpauthParsed = {
  secret: string;
  issuer?: string;
  label?: string;
  period: number;
  digits: number;
  algorithm: string;
};

export function parseOtpauth(uri: string): OtpauthParsed {
  try {
    const url = new URL(uri.trim());
    if (url.protocol !== "otpauth:") {
      throw new Error("INVALID_PROTOCOL");
    }
    if (url.hostname !== "totp") {
      throw new Error("INVALID_TYPE");
    }
    
    const secret = url.searchParams.get("secret");
    if (!secret) {
      throw new Error("MISSING_SECRET");
    }
    
    const issuer = url.searchParams.get("issuer") || undefined;
    const period = parseInt(url.searchParams.get("period") || "30", 10);
    const digits = parseInt(url.searchParams.get("digits") || "6", 10);
    const algorithm = url.searchParams.get("algorithm") || "SHA1";
    
    // Try to extract label from pathname
    let label: string | undefined;
    try {
      const pathname = url.pathname.replace(/^\//, "");
      if (pathname.includes(":")) {
        const parts = pathname.split(":");
        label = decodeURIComponent(parts.slice(1).join(":"));
      } else if (pathname) {
        label = decodeURIComponent(pathname);
      }
    } catch {
      // ignore
    }
    
    return {
      secret: secret.replace(/\s/g, "").toUpperCase(),
      issuer,
      label,
      period: isNaN(period) ? 30 : period,
      digits: isNaN(digits) ? 6 : digits,
      algorithm: algorithm.toUpperCase(),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INVALID_")) {
      throw error;
    }
    throw new Error("INVALID_OTPAUTH");
  }
}
