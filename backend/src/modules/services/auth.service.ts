import { db } from "../../prisma/db.ts";

export async function getUserByEmail(email: string) {
  try {
    const user = await db.orm.public.User.where((u) =>
      u.email.eq(email),
    ).first();
    return user
      ? { id: user.id, role: user.role, hashedPassword: user.passwordHash }
      : null;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    throw new Error("Failed to fetch user");
  }
}
