import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticateToken(req: any, res: any, next: any) {
  const cookieToken = req.cookies?.token;

  const authHeader = req.headers.authorization;
  const headerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  const token = cookieToken || headerToken;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Jeton manquant ou au mauvais format." });
  }

  try {
    const secret = JWT_SECRET;
    const decoded = jwt.verify(token, secret!);
    req.user = decoded;
    next();
  } catch (error) {
    return res
      .status(403)
      .json({ success: false, message: "Jeton invalide ou expiré." });
  }
}
