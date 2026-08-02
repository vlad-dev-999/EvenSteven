import { Router, type IRouter } from "express";
import { validateHostPassword, getHostToken } from "../lib/host-auth";

const router: IRouter = Router();

/** POST /host/auth — exchange password for a host token */
router.post("/host/auth", (req, res): void => {
  const { password } = req.body ?? {};

  if (typeof password !== "string" || !validateHostPassword(password)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  res.json({ token: getHostToken() });
});

/** GET /host/auth/check — verify an existing host token */
router.get("/host/auth/check", (req, res): void => {
  const token = req.headers["x-host-token"];
  const { validateHostToken } = require("../lib/host-auth");

  if (typeof token !== "string" || !validateHostToken(token)) {
    res.status(401).json({ valid: false });
    return;
  }

  res.json({ valid: true });
});

export default router;
