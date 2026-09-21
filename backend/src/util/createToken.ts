import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET

export function createToken(user: { user_id: string, role: string }): string {
    const secret = JWT_SECRET;

    return jwt.sign(
        {
            sub: user.user_id,
            role: user.role,
        },
        secret!,
        { expiresIn: "2h" }
    );
}