import express from "express";
import { syncInboxSubscriptions, getLastSyncStatus } from "../services/imapService.js";

const router = express.Router();

/**
 * GET /api/inbox/status
 * Returns current status of IMAP Gmail connection
 */
router.get("/status", (_req, res) => {
  try {
    const status = getLastSyncStatus();
    return res.json({
      success: true,
      ...status
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/inbox/sync
 * Manually or programmatically triggers an immediate live Gmail scan
 * Supports historical deepScan across entire mailbox
 */
router.post("/sync", async (req, res) => {
  try {
    const { maxEmails, email, deepScan } = req.body || {};
    const result = await syncInboxSubscriptions({
      maxEmails: typeof maxEmails === "number" ? maxEmails : 200,
      userEmail: email || null,
      deepScan: deepScan !== false
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("[Inbox Routes] Error during sync:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
