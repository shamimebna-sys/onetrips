export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  requireJwtSecret,
  type AccessTokenPayload,
} from "./tokens";

export { hasPermission, hasAnyPermission, assertPermission, loadPermissions } from "./rbac";

export {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  MFA_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  mfaCookieOptions,
} from "./cookies";

export {
  registerCustomer,
  registerB2b,
  login,
  logout,
  refresh,
  requestOtp,
  verifyOtp,
  me,
  resolveSession,
  getAccessPayload,
  type SessionTokens,
  type ResolvedSession,
  issueOtp,
  consumeOtp,
  changePassword,
  forgotPassword,
  resetPassword,
  resetPassword as resetPasswordWithOtp,
  type AuthHttpResult,
  type CookieSet,
} from "./service";

export { AuthError } from "./errors";
export { hashPassword, verifyPassword } from "./passwords";
export {
  createPlatformUser,
  listPlatformUsers,
  setPlatformUserRole,
  setPlatformUserStatus,
} from "./admin";
