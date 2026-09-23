type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  user?: {
    name?: string | null;
    username?: string | null;
    email?: string;
  };
  token?: string;
  message?: string;
};

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {

  console.log("loginUser payload:", payload);

  const response = await fetch("http://localhost:1919/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  const data = (await response.json()) as LoginResponse & { message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? "Identifiants invalides.");
  }

  localStorage.setItem("token", data.token ?? "");
  localStorage.setItem("user", JSON.stringify(data.user ?? { email: payload.email }));

  return data;
}

export async function logoutUser() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
