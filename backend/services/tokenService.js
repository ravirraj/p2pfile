import { SignJWT, jwtVerify } from "jose";
import env from "../config/env.js";

const SECRET = new TextEncoder().encode(env.jwtSecret || "peerflow-dev-secret-change-in-production");

export async function createTransferToken(roomId, password) {
  const payload = { roomId };
  if (password) payload.pwd = true;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.transferTokenTTL || "1h")
    .sign(SECRET);
}

export async function verifyTransferToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}
