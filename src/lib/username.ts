import { z } from "zod";

export const USERNAME_RULE = "Username: 3–20 letters, numbers or _";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, USERNAME_RULE);
