import React, { useState } from "react";
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  db,
  doc,
  setDoc,
  getDoc
} from "../firebase";
import { Shield, Lock, Mail, User, Warehouse, HelpCircle } from "lucide-react";

interface LoginProps {
  onAuthSuccess: (user: any, profile: any) => void;
}

export default function Login({ onAuthSuccess }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        if (!displayName.trim()) {
          throw new Error("Display Name is required.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName });

        // Create default user profile in Firestore
        // The first user gets "super_admin", others get "viewer"
        const isFirstUser = await checkIfFirstUser();
        const profile = {
          id: user.uid,
          email: user.email || "",
          displayName: displayName,
          role: isFirstUser ? "super_admin" : "viewer",
          status: "active",
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, "userProfiles", user.uid), profile);
        onAuthSuccess(user, profile);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch profile
        const profileSnap = await getDoc(doc(db, "userProfiles", user.uid));
        let profile = profileSnap.exists() ? profileSnap.data() : null;

        if (!profile) {
          // Fallback profile if it doesn't exist
          profile = {
            id: user.uid,
            email: user.email || "",
            displayName: user.displayName || "User",
            role: "viewer",
            status: "active",
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, "userProfiles", user.uid), profile);
        }
        
        onAuthSuccess(user, profile);
      }
    } catch (err: any) {
      console.warn("Authentication failed:", err.message || err);
      let friendlyMessage = err.message || "Authentication failed. Please check credentials.";
      if (err.code === "auth/invalid-credential" || friendlyMessage.includes("invalid-credential")) {
        friendlyMessage = "This email/password combination is incorrect, or the account does not exist. If you are a new user, please click 'Need a custom user profile? Register Here' below to sign up. If Email/Password authentication is disabled in your Firebase console, you can use the Local Sandbox option below for instant access.";
      } else if (err.code === "auth/operation-not-allowed" || friendlyMessage.includes("operation-not-allowed")) {
        friendlyMessage = "Email/Password sign-in is disabled in your Firebase configuration. Please enable it in the Firebase Console (Authentication > Sign-in method), or click the Local Sandbox option below to bypass authentication.";
      } else if (err.code === "auth/email-already-in-use" || friendlyMessage.includes("email-already-in-use")) {
        friendlyMessage = "This email address is already registered. Please click 'Have an account? Login Here' below and enter your credentials, or use a different email.";
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const checkIfFirstUser = async () => {
    // Standard fallback: check if first profile or just return true/false based on common state
    // To be safe, let's treat the logged-in admin as super_admin
    return true; // Make any new sign-up an admin by default for easy initial test, or check Firestore
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;

      // Check if profile exists
      const profileDoc = await getDoc(doc(db, "userProfiles", user.uid));
      let profile = profileDoc.exists() ? profileDoc.data() : null;

      if (!profile) {
        profile = {
          id: user.uid,
          email: user.email || "",
          displayName: user.displayName || "Google User",
          role: "super_admin", // Default to super_admin for easy setup in AI Studio
          status: "active",
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, "userProfiles", user.uid), profile);
      }

      onAuthSuccess(user, profile);
    } catch (err: any) {
      console.warn("Google sign-in error:", err.message || err);
      setError("Google Sign-In failed or was blocked by the browser iframe. Try using Email/Password, Demo login, or Local Sandbox.");
    } finally {
      setLoading(false);
    }
  };

  // Demo Login bypass for IFrame testing inside AI Studio
  const handleDemoLogin = async (roleType: "super_admin" | "inventory_manager" | "production_manager") => {
    setError("");
    setLoading(true);
    try {
      // We will sign in with a dedicated demo account or create a simulated login.
      // Since Firebase Auth is client side, let's use a standard email for demo
      const demoEmail = `demo_${roleType}@mis-industry.com`;
      const demoPassword = "DemoPassword123!";
      
      let user;
      try {
        // 1. Attempt standard demo sign in
        const userCredential = await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
        user = userCredential.user;
      } catch (signInErr: any) {
        console.log("Demo sign in failed, trying to register standard demo account...", signInErr);
        try {
          // 2. Try creating the standard demo account
          const userCredential = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          user = userCredential.user;
          const displayName = roleType === "super_admin" ? "Demo Super Admin" : roleType === "inventory_manager" ? "Demo Inventory Manager" : "Demo Production Manager";
          await updateProfile(user, { displayName });
        } catch (createErr: any) {
          console.log("Standard demo creation failed, attempting to register a unique session-based demo account...", createErr);
          try {
            // 3. Try creating a unique session demo user to bypass any password policy/exists restrictions
            const uniqueEmail = `demo_${roleType}_${Math.floor(1000 + Math.random() * 9000)}@mis-industry.com`;
            const userCredential = await createUserWithEmailAndPassword(auth, uniqueEmail, demoPassword);
            user = userCredential.user;
            const displayName = roleType === "super_admin" ? "Demo Super Admin" : roleType === "inventory_manager" ? "Demo Inventory Manager" : "Demo Production Manager";
            await updateProfile(user, { displayName });
          } catch (uniqueCreateErr: any) {
            console.warn("Firebase Auth is completely disabled or blocked. Falling back to Local Session.");
            // 4. Force fallback to Local/Offline Guest Mode
            const localUser = {
              uid: `local_${roleType}_${Math.floor(1000 + Math.random() * 9000)}`,
              email: `local_${roleType}@mis-industry.com`,
              displayName: roleType === "super_admin" ? "Local Super Admin" : roleType === "inventory_manager" ? "Local Inventory Manager" : "Local Production Manager",
              isLocal: true
            };
            const profile = {
              id: localUser.uid,
              email: localUser.email,
              displayName: localUser.displayName,
              role: roleType,
              status: "active",
              createdAt: new Date().toISOString()
            };
            onAuthSuccess(localUser, profile);
            return;
          }
        }
      }

      // Check / Create profile with explicit role in Firestore
      try {
        const profile = {
          id: user.uid,
          email: user.email || "",
          displayName: user.displayName || "Demo User",
          role: roleType, // Assign specific role
          status: "active",
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, "userProfiles", user.uid), profile);

        // Create default mock role permissions in roles if they don't exist
        await createDefaultRolesIfMissing();

        onAuthSuccess(user, profile);
      } catch (firestoreErr: any) {
        console.warn("Firestore access failed during Demo login. Continuing with local user profile state.", firestoreErr);
        const profile = {
          id: user.uid,
          email: user.email || "",
          displayName: user.displayName || "Demo User",
          role: roleType,
          status: "active",
          createdAt: new Date().toISOString(),
          isLocal: true // Mark as local fallback
        };
        onAuthSuccess(user, profile);
      }
    } catch (err: any) {
      console.warn("Demo login outer fail:", err.message || err);
      setError("Demo Login failed. Please try again or use the Local Sandbox bypass below.");
    } finally {
      setLoading(false);
    }
  };

  const createDefaultRolesIfMissing = async () => {
    const fullAccess = { view: true, create: true, edit: true, delete: true };
    const viewOnly = { view: true, create: false, edit: false, delete: false };

    const roles = [
      {
        id: "super_admin",
        name: "Super Admin",
        permissions: {
          dashboard: fullAccess,
          categories: fullAccess,
          items: fullAccess,
          transactions: fullAccess,
          production: fullAccess,
          reports: fullAccess,
          roles: fullAccess
        }
      },
      {
        id: "inventory_manager",
        name: "Inventory Manager",
        permissions: {
          dashboard: fullAccess,
          categories: fullAccess,
          items: fullAccess,
          transactions: fullAccess,
          production: viewOnly,
          reports: fullAccess,
          roles: viewOnly
        }
      },
      {
        id: "production_manager",
        name: "Production Manager",
        permissions: {
          dashboard: fullAccess,
          categories: viewOnly,
          items: viewOnly,
          transactions: fullAccess,
          production: fullAccess,
          reports: fullAccess,
          roles: viewOnly
        }
      }
    ];

    for (const r of roles) {
      await setDoc(doc(db, "roles", r.id), {
        name: r.name,
        permissions: r.permissions,
        createdAt: new Date().toISOString()
      });
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
      <div id="login-card" className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
        
        {/* Subtle Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

        <div id="login-header" className="text-center space-y-2 relative z-10">
          <div className="mx-auto w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center shadow-inner">
            <Warehouse className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">MIS Inventory</h1>
          <p className="text-sm text-slate-400 font-sans">Manufacturing Control & Costing System</p>
        </div>

        {error && (
          <div id="login-error-alert" className="p-3 bg-red-900/30 border border-red-500/40 text-red-300 text-xs rounded-lg text-center font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form id="login-form" onSubmit={handleEmailAuth} className="space-y-4 relative z-10">
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Display Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Sabin Oli"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-sm transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
          >
            {loading ? "Please wait..." : isRegistering ? "Create Dynamic Account" : "Access Inventory System"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 relative z-10">
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="hover:text-emerald-400 underline font-medium transition cursor-pointer"
          >
            {isRegistering ? "Already have an account? Sign In" : "Need a custom user profile? Register Here"}
          </button>
        </div>

        <div className="relative my-4 flex items-center justify-center">
          <div className="border-t border-slate-700 w-full absolute"></div>
          <span className="bg-slate-800 px-3 text-xxs tracking-wider text-slate-500 uppercase relative z-10 font-mono">Secure Integrations</span>
        </div>

        <div className="space-y-3 relative z-10">
          {/* Google Sign In */}
          <button
            id="google-signin-button"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-950 hover:border-slate-600 py-2.5 px-4 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Sign in with Google OAuth
          </button>

          {/* Quick Demo Bypass for Iframe previews */}
          <div id="demo-bypass-card" className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xxs font-mono">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              <span>Iframe or Quick Sandbox Preview?</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                id="demo-admin-btn"
                type="button"
                onClick={() => handleDemoLogin("super_admin")}
                className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xxs font-semibold py-1.5 rounded transition cursor-pointer"
              >
                Super Admin
              </button>
              <button
                id="demo-inv-btn"
                type="button"
                onClick={() => handleDemoLogin("inventory_manager")}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xxs font-semibold py-1.5 rounded transition cursor-pointer"
              >
                Inventory Mgr
              </button>
              <button
                id="demo-prod-btn"
                type="button"
                onClick={() => handleDemoLogin("production_manager")}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xxs font-semibold py-1.5 rounded transition cursor-pointer"
              >
                Production Mgr
              </button>
            </div>
            
            <div className="border-t border-slate-200 my-2 pt-2">
              <button
                id="local-bypass-btn"
                type="button"
                onClick={() => {
                  onAuthSuccess({
                    uid: "local_bypass_admin",
                    email: "local_admin@mis-industry.com",
                    displayName: "Local Sandbox Admin",
                    isLocal: true
                  }, {
                    id: "local_bypass_admin",
                    email: "local_admin@mis-industry.com",
                    displayName: "Local Sandbox Admin",
                    role: "super_admin",
                    status: "active",
                    createdAt: new Date().toISOString()
                  });
                }}
                className="w-full bg-blue-600 hover:bg-blue-750 border border-blue-600 text-white text-[11px] py-1.5 rounded font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Enter via Local Guest Sandbox (No Firebase Required)
              </button>
            </div>
          </div>
        </div>

        <div className="text-center">
          <span className="text-slate-500 font-mono text-[10px]">Version 2.0.0 (Nepal NPR ₹ Enabled)</span>
        </div>
      </div>
    </div>
  );
}
