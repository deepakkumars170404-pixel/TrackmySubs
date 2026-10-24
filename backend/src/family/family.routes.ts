import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FamilyService } from './family.service.js';
import { validateBody, validateQuery, optionalAuthenticate } from './middleware.js';
import { getSupabaseAdminClient } from './config.js';

// ==============================================================================
// 1. ZOD INPUT VALIDATION SCHEMAS
// ==============================================================================

export const inviteMemberSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  email: z
    .string({ required_error: 'Email address is compulsory for sending the confirmation request' })
    .trim()
    .email({ message: 'Invalid email address' }),
  role: z
    .enum(['member', 'owner', 'Member', 'Owner'], {
      errorMap: () => ({ message: "Role must be either 'member' or 'owner'" })
    })
    .default('member')
    .transform((val) => val.toLowerCase() as 'member' | 'owner'),
  householdId: z
    .string()
    .uuid({ message: 'Invalid household ID format' })
    .optional()
});

export const householdQuerySchema = z.object({
  householdId: z
    .string()
    .uuid({ message: 'Invalid household ID format' })
    .optional()
});

// ==============================================================================
// 2. EXPRESS ROUTER & HANDLERS
// ==============================================================================

const router = Router();

/**
 * @route   GET /api/family/members
 * @desc    Fetch household members for FamilyView
 */
router.get(
  '/members',
  validateQuery(householdQuerySchema),
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = req.supabaseClient || getSupabaseAdminClient();
      const householdId = (req.query.householdId as string) || undefined;
      const members = await FamilyService.getHouseholdMembers(client, householdId);

      res.status(200).json({
        success: true,
        data: members,
        meta: {
          count: members.length,
          householdId: FamilyService.resolveHouseholdId(householdId)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/family/shared-plans
 * @desc    Fetch shared plans for FamilyView
 */
router.get(
  '/shared-plans',
  validateQuery(householdQuerySchema),
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = req.supabaseClient || getSupabaseAdminClient();
      const householdId = (req.query.householdId as string) || undefined;
      const plans = await FamilyService.getSharedPlans(client, householdId);

      res.status(200).json({
        success: true,
        data: plans,
        meta: {
          count: plans.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/family/invite
 * @desc    Invite a family member: compulsorily sends confirmation request email without delay
 */
router.post(
  '/invite',
  validateBody(inviteMemberSchema),
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = req.supabaseClient || getSupabaseAdminClient();
      const { fullName, email, role, householdId } = req.body;

      const result = await FamilyService.inviteMember(client, {
        fullName,
        email,
        role: role || 'member',
        householdId
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: result.member,
        delivered: result.delivered,
        inviteUrl: result.inviteUrl
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/family/accept-invite
 * @desc    Accept connection request: activates member, scans previous mailbox emails, and adds subscriptions with renewal dates
 */
router.post(
  '/accept-invite',
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = req.supabaseClient || getSupabaseAdminClient();
      const { memberId, email, provider, name } = req.body || {};
      if (!memberId) {
        res.status(400).json({ success: false, message: 'memberId is required.' });
        return;
      }
      const result = await FamilyService.acceptInvitation(client, memberId, email, provider || 'Gmail', name);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.member,
        member: result.member,
        scannedSubscriptions: result.scannedSubscriptions
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/family/direct-approve
 * @desc    Direct 1-tap browser click approval from email (renders mobile-friendly success landing page)
 */
router.get(
  '/direct-approve',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = getSupabaseAdminClient();
      const memberId = (req.query.memberId as string) || `mem-${Date.now()}`;
      const email = (req.query.email as string) || '';
      const name = (req.query.name as string) || (email ? email.split('@')[0] : 'Family Member');

      const result = await FamilyService.acceptInvitation(client, memberId, email, 'Gmail', name);
      const frontendUrl =
        (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('cloudflare') && !process.env.FRONTEND_URL.includes('trycloudflare'))
          ? process.env.FRONTEND_URL.replace(/\/$/, '')
          : 'https://trackmysubs-pro.vercel.app';

      const subsCount = result.scannedSubscriptions?.length || 0;
      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Subscription Sharing Approved! · TrackmySubs</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
            .card { max-width: 480px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 36px 28px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
            .icon-badge { width: 64px; height: 64px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 20px; }
            h1 { font-size: 22px; margin: 0 0 10px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
            p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px; }
            .scan-box { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 14px; padding: 16px; margin-bottom: 28px; text-align: left; }
            .scan-title { font-size: 12px; font-weight: 800; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
            .scan-item { font-size: 13px; color: #e2e8f0; display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
            .btn { display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; width: 100%; box-sizing: border-box; transition: background 0.2s; }
            .btn:hover { background: #4338ca; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-badge">✅</div>
            <h1>Subscription Sharing Approved!</h1>
            <p>Welcome, <strong>${name}</strong>! Your email address (<strong>${email}</strong>) has been verified. Your mailbox connection is now active.</p>
            
            <div class="scan-box">
              <div class="scan-title">📬 Mailbox Receipt Scan Completed</div>
              <div class="scan-item"><span>Scanned Subscriptions Added:</span> <strong style="color: #10b981;">${subsCount} Plans</strong></div>
              <div class="scan-item"><span>Upcoming Renewal Dates:</span> <strong style="color: #f59e0b;">Synced to Hub</strong></div>
              <div class="scan-item"><span>Status:</span> <strong style="color: #10b981;">Connected &amp; Verified</strong></div>
            </div>

            <a href="${frontendUrl}/family" class="btn">Open TrackmySubs Hub</a>
          </div>
        </body>
        </html>
      `;
      res.status(200).send(htmlResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/family/resend-invite
 * @desc    Resend invitation confirmation email via Gmail SMTP
 */
router.post(
  '/resend-invite',
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { memberId, email, fullName } = req.body || {};
      if (!email || !email.includes('@')) {
        res.status(400).json({ success: false, message: 'Valid email is required to resend invite.' });
        return;
      }
      const result = await FamilyService.resendInvite(memberId || `mem-${Date.now()}`, email, fullName || 'Family Member');
      res.status(200).json({
        success: result.success,
        message: result.message,
        inviteUrl: result.inviteUrl
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/family/members/:id
 * @desc    Remove a family member from the household
 */
router.delete(
  '/members/:id',
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = req.supabaseClient || getSupabaseAdminClient();
      const memberId = req.params.id;
      if (!memberId) {
        res.status(400).json({ success: false, message: 'memberId is required.' });
        return;
      }
      const result = await FamilyService.removeMember(client, memberId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/family/remove-member
 * @desc    Remove a family member (POST alternative)
 */
router.post(
  '/remove-member',
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = req.supabaseClient || getSupabaseAdminClient();
      const { memberId } = req.body || {};
      if (!memberId) {
        res.status(400).json({ success: false, message: 'memberId is required.' });
        return;
      }
      const result = await FamilyService.removeMember(client, memberId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/family/overview
 * @desc    Fetch combined household members and shared plans
 */
router.get(
  '/overview',
  validateQuery(householdQuerySchema),
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = req.supabaseClient || getSupabaseAdminClient();
      const householdId = (req.query.householdId as string) || undefined;
      const overview = await FamilyService.getHouseholdOverview(client, householdId);

      res.status(200).json({
        success: true,
        data: overview
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/family/scan-member
 * @desc    Scans a member's previous emails, extracts subscriptions with purchase and renewal dates, and adds them to the page
 */
router.post(
  '/scan-member',
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = req.supabaseClient || getSupabaseAdminClient();
      const { memberId, email, name } = req.body || {};
      if (!memberId) {
        res.status(400).json({ success: false, message: 'memberId is required.' });
        return;
      }
      const result = await FamilyService.scanMemberMailbox(client, memberId, email, name);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.member,
        member: result.member,
        scannedSubscriptions: result.scannedSubscriptions
      });
    } catch (error) {
      next(error);
    }
  }
);

export const familyRoutes = router;
