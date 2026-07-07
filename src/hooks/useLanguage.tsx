import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type Language = "en" | "hi";

interface LanguageValue {
  lang: Language;
  setLang: (l: Language) => void;
  toggleLang: () => void;
  t: (key: string) => string;
}

const Ctx = createContext<LanguageValue | undefined>(undefined);
const STORAGE_KEY = "tradeledger-lang";

// English strings are used as keys. Only Hindi overrides are listed here;
// anything missing falls back to the English key itself.
const hi: Record<string, string> = {
  // Roles
  Administrator: "प्रशासक",
  "Field Employee": "क्षेत्रीय कर्मचारी",
  "Client Portal": "ग्राहक पोर्टल",
  Admin: "प्रशासक",
  Employee: "कर्मचारी",
  Client: "ग्राहक",
  // Shell / common
  "Credit Management": "क्रेडिट प्रबंधन",
  "Sign out": "साइन आउट",
  Notifications: "सूचनाएं",
  "No notifications": "कोई सूचना नहीं",
  "WhatsApp + in-app": "व्हाट्सएप + इन-ऐप",
  Language: "भाषा",
  Theme: "थीम",
  "Dark mode": "डार्क मोड",
  "Light mode": "लाइट मोड",
  // Nav items
  Overview: "अवलोकन",
  Orders: "ऑर्डर",
  Invoices: "इनवॉइस",
  "Ledger (Hisab)": "बही (हिसाब)",
  Ledger: "बही",
  Credit: "क्रेडिट",
  "Credit Purse": "क्रेडिट पर्स",
  KYC: "केवाईसी",
  Clients: "ग्राहक",
  Tasks: "कार्य",
  Reports: "रिपोर्ट",
  "Audit Log": "ऑडिट लॉग",
  Dashboard: "डैशबोर्ड",
  Employees: "कर्मचारी",
  // Auth page
  "Choose a demo role": "एक डेमो भूमिका चुनें",
  "One-click sign in — no credentials needed for the demo.":
    "एक-क्लिक साइन इन — डेमो के लिए किसी क्रेडेंशियल की आवश्यकता नहीं।",
  "Log in as": "इस रूप में लॉग इन करें",
  "Verify OTP": "ओटीपी सत्यापित करें",
  "Verify & continue": "सत्यापित करें और जारी रखें",
  "Autofill demo code": "डेमो कोड स्वतः भरें",
  Back: "वापस",
  "One platform for orders, credit & collections.":
    "ऑर्डर, क्रेडिट और वसूली के लिए एक मंच।",
  "Demo build · sample data · no real integrations":
    "डेमो बिल्ड · नमूना डेटा · कोई वास्तविक एकीकरण नहीं",
};

const dictionaries: Record<Language, Record<string, string>> = { en: {}, hi };

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored === "en" || stored === "hi") setLangState(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Language) => setLangState(l), []);
  const toggleLang = useCallback(
    () => setLangState((l) => (l === "en" ? "hi" : "en")),
    [],
  );
  const t = useCallback(
    (key: string) => dictionaries[lang][key] ?? key,
    [lang],
  );

  return (
    <Ctx.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
