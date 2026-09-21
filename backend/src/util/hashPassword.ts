import bcrypt from "bcryptjs";
import dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
    const pepper = process.env.PEPPER;

    try {
        const passwordWithPepper = password + pepper;
        const hashedPassword = await bcrypt.hash(passwordWithPepper, SALT_ROUNDS);
        return hashedPassword;

    } catch (error) {
        console.error("Error hashing password:", error);
        throw new Error("Failed to hash password");
    }
}