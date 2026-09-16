import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticateToken(req: any, res: any, next: any) {

    const authHeader = req.headers.authorization;
    console.log('Received auth header:', authHeader, req.headers);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Token missing or invalid format' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const secret = JWT_SECRET;
        const decoded = jwt.verify(token, secret!);
        req.user = decoded;
        next();
    } catch (error) {

        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
}