type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  user?: {
    email?: string;
  };
  token?: string;
  message?: string;
};

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as LoginResponse & { message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? "Identifiants invalides.");
  }

  return data;
}
