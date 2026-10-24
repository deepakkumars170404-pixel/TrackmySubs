import { Router } from "express";
import {
  createHousehold,
  joinHousehold,
  getMyHousehold,
  getSubscriptions,
  getRenewals,
  addSubscription,
  updateSubscription,
  deleteSubscription
} from "../controllers/householdController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/households/me", getMyHousehold);
router.post("/households", createHousehold);
router.post("/households/join", joinHousehold);
router.get("/households/:householdId/subscriptions", getSubscriptions);
router.post("/households/:householdId/subscriptions", addSubscription);
router.get("/households/:householdId/renewals", getRenewals);
router.patch("/subscriptions/:subscriptionId", updateSubscription);
router.delete("/subscriptions/:subscriptionId", deleteSubscription);

export default router;
