import { createUserClient } from "../config/supabase.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return res.status(401).json({ success: false, message: "Create or provide an anonymous session first." });
  }

  const supabase = createUserClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ success: false, message: "Session is invalid or expired." });
  }

  req.user = data.user;
  req.accessToken = token;
  next();
}
