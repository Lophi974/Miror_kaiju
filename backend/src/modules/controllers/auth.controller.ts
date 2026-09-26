import dotenv from "dotenv";
import { getUserByEmail } from "../services/auth.service";
import bcrypt from "bcryptjs";
import { createToken } from "../../util/createToken";
dotenv.config();

const PEPPER = process.env.PEPPER;

export async function loginUser(
  req: { body: { email: string; password: string } },
  res: any,
) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "L'email et le mot de passe sont requis." });
  }

  console.log("loginUser email:", email);
  console.log("loginUser password:", password);

  const { id, role, hashedPassword, name, quarterId } =
    (await getUserByEmail(email)) || {};

  // quarterId est légitimement absent pour CD et LC (portée ville entière),
  // donc on ne le vérifie pas ici -- seul un id/role/hashedPassword/name
  // manquant signifie "utilisateur introuvable".
  if (!id || !role || !hashedPassword || !name) {
    return res
      .status(401)
      .json({ success: false, message: "Email ou mot de passe incorrect." });
  }

  const passwordWithPepper = password + PEPPER;

  const isPasswordValid = await bcrypt.compare(
    passwordWithPepper,
    hashedPassword,
  );

  if (!isPasswordValid) {
    return res
      .status(401)
      .json({ success: false, message: "Email ou mot de passe incorrect." });
  }

  const token = createToken({
    user_id: id,
    role: role,
    name: name,
    quarterId: quarterId ?? null,
  });

  return res
    .cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 2 * 24 * 60 * 60 * 1000,
    })
    .status(200)
    .json({ success: true, message: "Connexion réussie.", token });
}

export async function me(req: any, res: any) {
  const userInfo = {
    userId: req.user.sub,
    role: req.user.role,
    name: req.user.name,
    quarterId: req.user.quarterId ?? null,
  };
  console.log(userInfo);
  return res.status(200).json({ success: true, user: userInfo });
}

export async function disconnect(req: any, res: any) {
  return res
    .clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    })
    .status(200)
    .json({ success: true, message: "Déconnexion réussie" });
}