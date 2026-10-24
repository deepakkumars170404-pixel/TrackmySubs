import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  login,
  signup,
  sendSignupOtp,
  verifySignupOtp,
  autoConfirm,
  forgotPassword,
  verifyOtpOnly,
  resetPasswordWithOtp,
  getMyLoginHistory,
  googleVerify
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();
const forgotPasswordLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: {
    success: false,
    message: "Too many reset requests. Please wait before trying again."
  }
});

router.post("/login", login);
router.post("/signup", signup);
router.post("/send-signup-otp", sendSignupOtp);
router.post("/verify-signup-otp", verifySignupOtp);
router.post("/auto-confirm", autoConfirm);
router.post("/forgot-password", forgotPasswordLimit, forgotPassword);
router.post("/verify-otp", verifyOtpOnly);
router.post("/reset-password", resetPasswordWithOtp);
router.post("/google-verify", googleVerify);
router.get("/login-history", requireAuth, getMyLoginHistory);

export default router;
