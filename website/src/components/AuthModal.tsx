import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { X, Mail, Lock, User, ArrowRight, Loader2, KeyRound, ArrowLeft, UserRound } from "lucide-react";

const GuestContinueButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    id="continue-as-guest-btn"
    onClick={onClick}
    className="w-full flex items-center justify-center gap-2 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold bg-white/5 text-white hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
  >
    <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
    <span>Continue as Guest</span>
  </button>
);

const AuthDivider: React.FC = () => (
  <div className="flex items-center gap-3 my-4">
    <div className="h-px flex-1 bg-neutral-800" />
    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">or</span>
    <div className="h-px flex-1 bg-neutral-800" />
  </div>
);


interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "signin" | "signup";
  initialStep?: "signin" | "signup" | "forgot";
  initialEmail?: string;
}

type AuthView = "signin" | "signup" | "forgot";
type SignInStep = "email" | "password" | "otp";
type ForgotStep = "email" | "reset";
type SignupStep = "form" | "verify";

const inputClass =
  "w-full surface-input rounded-xl pl-11 pr-4 py-3 text-sm placeholder:text-neutral-500 transition-colors focus:outline-none";
const labelClass = "text-[10px] font-bold uppercase tracking-wider text-neutral-400";

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = "signin",
  initialStep = "signin",
  initialEmail,
}) => {
  const {
    signIn,
    verifySignup,
    requestSignupVerification,
    checkEmailForReset,
    requestPasswordReset,
    resetPassword,
    getLoginMethod,
    requestOtp,
    verifyOtp,
    enterAsGuest,
    authModalError,
    siteConfig,
  } = useApp();

  const [authView, setAuthView] = useState<AuthView>("signin");
  const [signInStep, setSignInStep] = useState<SignInStep>("email");
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const view: AuthView =
      initialStep === "forgot" ? "forgot" : defaultMode === "signup" ? "signup" : "signin";
    setAuthView(view);
    setSignInStep("email");
    setSignupStep("form");
    setForgotStep("email");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setError(authModalError || "");
    setInfo("");
    if (initialEmail) {
      setEmail(initialEmail);
      // Skip straight past the "enter your email" step — whether that lands
      // on a password field or an emailed one-time code still depends on
      // what the account is configured for server-side.
      void continueWithEmail(initialEmail);
    } else {
      setEmail("");
    }
  }, [isOpen, defaultMode, initialStep, initialEmail]);

  useEffect(() => {
    if (signInStep === "otp") otpInputRef.current?.focus();
  }, [signInStep]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isStrongPassword = (value: string) =>
    value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);

  const goToSignIn = () => {
    setAuthView("signin");
    setSignInStep("email");
    setForgotStep("email");
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  const goToForgot = () => {
    setAuthView("forgot");
    setForgotStep("email");
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  const continueWithEmail = async (candidateEmail: string) => {
    setError("");
    setInfo("");
    if (!candidateEmail || !isValidEmail(candidateEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    const methodResult = await getLoginMethod(candidateEmail);
    if (!methodResult.ok) {
      setSubmitting(false);
      setError(methodResult.error || "Something went wrong.");
      return;
    }
    if (methodResult.method === "otp") {
      const otpResult = await requestOtp(candidateEmail);
      setSubmitting(false);
      if (!otpResult.ok) {
        setError(otpResult.error || "Couldn't send the code.");
        return;
      }
      setInfo(`We sent a 6-digit code to ${candidateEmail}.`);
      setResendCooldown(60);
      setSignInStep("otp");
    } else {
      setSubmitting(false);
      setSignInStep("password");
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    await continueWithEmail(email);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || password.length < 6) {
      setError("Please enter your password.");
      return;
    }
    setSubmitting(true);
    
    // Show circular spinner for exactly 2 seconds before actual login
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = await signIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Invalid email or password.");
      return;
    }
    // Check if user needs onboarding (first-time login)
    // This will be handled by the context's needsOnboarding state
    onClose();
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    const result = await verifyOtp(email, otp);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Incorrect code.");
      return;
    }
    onClose();
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !name || !password) {
      setError("Please fill out all required fields.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    // Validate the password that was actually typed into the form — this
    // used to be skipped here and an empty string was sent to the server
    // instead, which made the server reject every sign-up with a "must
    // contain uppercase/lowercase/number" error regardless of what the
    // person entered.
    if (!isStrongPassword(password)) {
      setError("Password must be 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const result = await requestSignupVerification(email, password, name);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Couldn't send a verification code. Please try again.");
      return;
    }
    // Nothing is saved yet — the account is only created once the OTP below
    // is confirmed. The password already entered on this form is what gets
    // saved at that point, so there's no need to ask for it again.
    setInfo(`We've sent a 6-digit code to ${email}. Enter it below to verify your email.`);
    setSignupStep("verify");
    setOtp("");
  };

  const handleSignupVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp || otp.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    const result = await verifySignup(email, otp);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Verification failed.");
      return;
    }
    // Account is now saved in the database. Per the intended flow, land the
    // person on Sign In (with their email pre-filled) rather than signing
    // them in automatically.
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setAuthView("signin");
    setSignInStep("email");
    setInfo("Account created! Please sign in.");
  };

  /** Step 1 of forgot flow — an existing account gets an emailed OTP; an
   *  unrecognized email is routed to sign-up instead of shown an error
   *  (the check-email lookup drives this routing decision; it never powers
   *  the actual reset, which is handled by the always-generic
   *  /forgot-password endpoint below). */
  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email || !isValidEmail(email)) {
      setError("Please enter the email address you used to register.");
      return;
    }
    setSubmitting(true);
    console.log("Checking email for password reset:", email);
    const check = await checkEmailForReset(email);
    setSubmitting(false);
    console.log("Email check result:", check);
    if (!check.ok) {
      setError(check.error || "Something went wrong. Please try again.");
      return;
    }
    if (!check.found) {
      setAuthView("signup");
      setSignupStep("form");
      setInfo("We couldn't find an account with that email — let's get you signed up.");
      return;
    }
    setSubmitting(true);
    console.log("Requesting password reset for:", email);
    const reset = await requestPasswordReset(email);
    setSubmitting(false);
    console.log("Password reset request result:", reset);
    if (!reset.ok) {
      setError(reset.error || "Couldn't send reset instructions. Please try again.");
      return;
    }
    setInfo(`We've sent a 6-digit code to ${email}. Enter it below along with your new password.`);
    setForgotStep("reset");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
  };

  /** Step 2 — the emailed OTP code + new password */
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!otp.trim()) {
      setError("Enter the code sent to your email.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password must be 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    console.log("Submitting password reset for:", email, "with OTP:", otp.trim());
    const result = await resetPassword(email, otp.trim(), password);
    setSubmitting(false);
    console.log("Password reset result:", result);
    if (!result.ok) {
      setError(result.error || "Password reset failed. Please check the code and try again.");
      return;
    }
    setInfo("Password updated successfully! Redirecting to sign in...");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setTimeout(() => {
      goToSignIn();
      setSignInStep("password");
      setEmail(email); // Pre-fill email for convenience
      setInfo("");
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setSubmitting(true);
    const otpResult = await requestOtp(email);
    setSubmitting(false);
    if (!otpResult.ok) {
      setError(otpResult.error || "Couldn't resend code.");
      return;
    }
    setInfo(`A new code was sent to ${email}.`);
    setResendCooldown(60);
  };

  const title =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Forgot Password"
        : "Create New Password"
      : authView === "signup"
      ? "Create Your Account"
      : signInStep === "otp"
      ? "Enter Login Code"
      : signInStep === "password"
      ? "Enter Password"
      : "Welcome Back";

  const subtitle =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Enter the email address you used to register"
        : "Enter the code from your email and choose a new password"
      : authView === "signup"
      ? signupStep === "verify"
        ? "Enter the 6-digit code sent to your email"
        : "Sign up to save your watchlist and preferences"
      : signInStep === "otp"
      ? "Check your inbox for a 6-digit code"
      : signInStep === "password"
      ? `Signing in as ${email}`
      : "Sign in with your Cinemax account";

  const onSubmit =
    authView === "forgot"
      ? forgotStep === "email"
        ? handleForgotEmailSubmit
        : handleForgotResetSubmit
      : authView === "signup"
      ? signupStep === "verify"
        ? handleSignupVerifySubmit
        : handleSignUpSubmit
      : signInStep === "email"
      ? handleContinue
      : signInStep === "password"
      ? handlePasswordSubmit
      : handleOtpSubmit;

  const submitLabel =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Verify Email"
        : "Save New Password"
      : authView === "signup"
      ? signupStep === "verify"
        ? "Verify Email"
        : "Create Account"
      : signInStep === "email"
      ? "Continue"
      : signInStep === "otp"
      ? "Verify & Sign In"
      : "Sign In";

  return (
    <div id="auth-modal-backdrop" className="fixed inset-0 z-60 flex items-center justify-center p-4 animate-fade-in">
      <div id="auth-modal" className="relative w-full max-w-md rounded-2xl border surface-panel p-6 md:p-8">

        <button
          id="close-auth-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {(authView === "forgot" || signInStep !== "email") && (
          <button
            id="auth-back-btn"
            onClick={authView === "forgot" ? (forgotStep === "reset" ? () => setForgotStep("email") : goToSignIn) : () => setSignInStep("email")}
            className="absolute left-4 top-4 flex items-center gap-1 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <div className="text-center mb-6 space-y-2 pt-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl logo-mark font-black text-2xl mx-auto">
            C
          </div>
          <h2 className="font-sans text-xl font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>

        {error && <div className="alert-error rounded-xl p-3 text-xs font-semibold mb-4 text-center">{error}</div>}
        {!error && info && <div className="alert-success rounded-xl p-3 text-xs font-semibold mb-4 text-center">{info}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          {authView === "signup" && signupStep === "form" && (
            <div className="space-y-1">
              <label className={labelClass}>Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
              </div>
            </div>
          )}

          {(authView === "signup" && signupStep === "form") ||
          (authView === "signin" && signInStep === "email") ||
          (authView === "forgot" && forgotStep === "email") ? (
            <div className="space-y-1">
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                  autoFocus
                />
              </div>
            </div>
          ) : null}

          {authView === "signin" && signInStep !== "email" && (
            <div className="space-y-1">
              <label className={labelClass}>Email Address</label>
              <div className="relative flex items-center gap-2 rounded-xl surface-input px-4 py-3">
                <Mail className="h-4 w-4 text-neutral-500 shrink-0" />
                <span className="text-xs text-neutral-300 truncate">{email}</span>
              </div>
            </div>
          )}

          {authView === "forgot" && forgotStep === "reset" && (
            <div className="space-y-1">
              <label className={labelClass}>Registered Email</label>
              <div className="relative flex items-center gap-2 rounded-xl surface-input px-4 py-3">
                <Mail className="h-4 w-4 text-neutral-500 shrink-0" />
                <span className="text-xs text-neutral-300 truncate">{email}</span>
              </div>
            </div>
          )}

          {((authView === "signup" && signupStep === "form") ||
            (authView === "signin" && signInStep === "password") ||
            (authView === "forgot" && forgotStep === "reset")) && (
            <div className="space-y-1">
              <label className={labelClass}>{authView === "forgot" ? "New Password" : "Password"}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  placeholder="8+ chars, upper, lower, number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                  autoFocus={authView !== "signup"}
                />
              </div>
            </div>
          )}

          {authView === "signup" && signupStep === "form" && (
            <div className="space-y-1">
              <label className={labelClass}>Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {authView === "forgot" && forgotStep === "reset" && (
            <div className="space-y-1">
              <label className={labelClass}>Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {((authView === "signup" && signupStep === "verify") ||
            (authView === "signin" && signInStep === "otp") ||
            (authView === "forgot" && forgotStep === "reset")) && (
            <div className="space-y-1">
              <label className={labelClass}>
                {authView === "forgot" ? "Reset Code" : "6-Digit Code"}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode={authView === "forgot" ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  placeholder={authView === "forgot" ? "Paste code from email" : "123456"}
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      authView === "forgot"
                        ? e.target.value.trim()
                        : e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  className={`${inputClass} tracking-widest`}
                  required
                />
              </div>
              {authView === "signin" && signInStep === "otp" && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || submitting}
                    className="text-[10px] font-bold text-[#39FF14] hover:underline disabled:text-neutral-600 cursor-pointer disabled:cursor-default"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={submitting}
            className="w-full neon-btn flex items-center justify-center gap-2 font-extrabold py-2 sm:py-3 rounded-xl text-[10px] sm:text-xs cursor-pointer mt-2 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : (
              <>
                <span>{submitLabel}</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3px]" />
              </>
            )}
          </button>

        </form>

        {/* Guest access — offered on Sign In (email step) and Sign Up (form step),
           in the spot Continue with Google used to occupy. */}
        {((authView === "signin" && signInStep === "email") ||
          (authView === "signup" && signupStep === "form")) && (
            <>
              <AuthDivider />
              <GuestContinueButton onClick={() => { enterAsGuest(); onClose(); }} />
            </>
        )}

        {authView === "signin" && signInStep === "email" && (
          <>
            <button
              id="auth-forgot-password-btn"
              type="button"
              onClick={goToForgot}
              className="w-full btn-forgot mt-3 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs uppercase tracking-wide cursor-pointer"
            >
              Forgot Password
            </button>
            <div className="text-center mt-5 border-t border-neutral-800 pt-4 text-xs">
              <span className="text-neutral-500">New to Cinemax?</span>
              <button
                id="auth-toggle-view"
                onClick={() => { setError(""); setInfo(""); setAuthView("signup"); setSignupStep("form"); }}
                className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </>
        )}

        {authView === "signup" && (
          <div className="text-center mt-5 border-t border-neutral-800 pt-4 text-xs text-neutral-500">
            <span>Already have an account?</span>
            <button
              type="button"
              onClick={goToSignIn}
              className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer"
            >
              Sign In
            </button>
          </div>
        )}

        {authView === "forgot" && forgotStep === "email" && (
          <div className="text-center mt-5 border-t border-neutral-800 pt-4 text-xs">
            <span className="text-neutral-500">Remember your password?</span>
            <button type="button" onClick={goToSignIn} className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer">
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
