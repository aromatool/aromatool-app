import { useState } from "react";

// ============================================================
// UNSUBSCRIBE — pagină publică de dezabonare (conformitate email UE).
//
// De ce există pe domeniul appului și nu direct pe funcția Supabase:
// gateway-ul *.supabase.co rescrie forțat Content-Type → text/plain, deci
// pagina HTML servită de funcție se afișează ca text brut în browser
// (butonul nu e clicabil). Așa că UI-ul stă AICI, iar dezabonarea efectivă
// e făcută de funcția Supabase apelată în mod JSON (?format=json).
//
// Linkul one-click List-Unsubscribe (Gmail/Yahoo) rămâne pe funcție —
// clienții de mail fac POST fără să randeze HTML.
//
// Parametri URL:
//   ?c=<contactId>  → dezabonează un contact (emailuri ofertă/follow-up)
//   ?u=<userId>     → dezabonează un user AromaTool (emailuri de cont)
//   &t=<token>      → HMAC semnat (verificat de funcție)
//   &l=ro|en        → limba textelor
// ============================================================

const T = {
  sage: "#5C7A5C",
  cream: "#FAFAF7",
  espresso: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  border: "#EDE8E0",
};

type Lang = "ro" | "en";
type Branch = "contact" | "user" | "news";

const TEXT: Record<Branch, Record<Lang, {
  confirmTitle: string;
  confirmBody: string;
  confirmBtn: string;
  doneTitle: string;
  doneBody: string;
}>> = {
  contact: {
    ro: {
      confirmTitle: "Vrei să te dezabonezi?",
      confirmBody:
        "Nu vei mai primi emailuri de la acest expeditor. Apasă butonul pentru a confirma.",
      confirmBtn: "Dezabonează-mă",
      doneTitle: "Te-ai dezabonat",
      doneBody:
        "Nu vei mai primi emailuri de la acest expeditor. Dacă a fost o greșeală, contactează direct persoana care ți-a scris.",
    },
    en: {
      confirmTitle: "Unsubscribe?",
      confirmBody:
        "You'll no longer receive emails from this sender. Tap the button to confirm.",
      confirmBtn: "Unsubscribe me",
      doneTitle: "You're unsubscribed",
      doneBody:
        "You'll no longer receive emails from this sender. If this was a mistake, contact the person who wrote to you directly.",
    },
  },
  user: {
    ro: {
      confirmTitle: "Vrei să te dezabonezi?",
      confirmBody:
        "Nu vei mai primi emailuri despre contul și abonamentul tău AromaTool. Vei primi în continuare emailurile esențiale (ex. confirmări de plată).",
      confirmBtn: "Dezabonează-mă",
      doneTitle: "Te-ai dezabonat",
      doneBody:
        "Nu vei mai primi emailuri despre cont și abonament. Poți reactiva oricând din Setări → Cont.",
    },
    en: {
      confirmTitle: "Unsubscribe?",
      confirmBody:
        "You'll no longer receive emails about your AromaTool account and subscription. Essential emails (e.g. payment receipts) will still be sent.",
      confirmBtn: "Unsubscribe me",
      doneTitle: "You're unsubscribed",
      doneBody:
        "You'll no longer receive account and subscription emails. You can re-enable them anytime in Settings → Account.",
    },
  },
  // Newsletter / anunțuri (separat de emailurile de cont — vezi ?s=news).
  news: {
    ro: {
      confirmTitle: "Vrei să te dezabonezi de la newsletter?",
      confirmBody:
        "Nu vei mai primi noutăți și anunțuri despre AromaTool. Vei primi în continuare emailurile esențiale despre contul tău (ex. confirmări de plată).",
      confirmBtn: "Dezabonează-mă",
      doneTitle: "Te-ai dezabonat",
      doneBody:
        "Nu vei mai primi newsletterul AromaTool. Poți reactiva oricând din Setări → Cont.",
    },
    en: {
      confirmTitle: "Unsubscribe from the newsletter?",
      confirmBody:
        "You'll no longer receive AromaTool news and announcements. Essential account emails (e.g. payment receipts) will still be sent.",
      confirmBtn: "Unsubscribe me",
      doneTitle: "You're unsubscribed",
      doneBody:
        "You'll no longer receive the AromaTool newsletter. You can re-enable it anytime in Settings → Account.",
    },
  },
};

const INVALID: Record<Lang, { title: string; body: string }> = {
  ro: {
    title: "Link invalid",
    body: "Linkul de dezabonare nu este valid sau a expirat.",
  },
  en: {
    title: "Invalid link",
    body: "This unsubscribe link is not valid or has expired.",
  },
};

const ERROR_TXT: Record<Lang, string> = {
  ro: "Ceva n-a mers. Te rugăm să încerci din nou mai târziu.",
  en: "Something went wrong. Please try again later.",
};

type Status = "idle" | "sending" | "done" | "invalid" | "error";

export default function UnsubscribePage() {
  const params = new URLSearchParams(window.location.search);
  const contactId = params.get("c") || "";
  const userId = params.get("u") || "";
  const token = params.get("t") || "";
  const stream = params.get("s") || "";
  const lang: Lang = params.get("l") === "en" ? "en" : "ro";
  const branch: Branch = userId
    ? stream === "news"
      ? "news"
      : "user"
    : "contact";
  const id = userId || contactId;

  const [status, setStatus] = useState<Status>(
    id && token ? "idle" : "invalid"
  );

  const tx = TEXT[branch][lang];

  async function handleUnsubscribe() {
    setStatus("sending");
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      // „user" și „news" folosesc amândouă u=<userId>; „news" adaugă &s=news
      // ca funcția să seteze product_emails_opt_out (nu account_emails_opt_out).
      const q = branch === "contact" ? `c=${id}` : `u=${id}`;
      const streamParam = branch === "news" ? "&s=news" : "";
      const res = await fetch(
        `${base}/functions/v1/unsubscribe?${q}&t=${encodeURIComponent(
          token
        )}${streamParam}&l=${lang}&format=json`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => null);
      if (data && data.ok) setStatus("done");
      else setStatus("invalid");
    } catch {
      setStatus("error");
    }
  }

  let title: string;
  let body: string;
  if (status === "invalid") {
    title = INVALID[lang].title;
    body = INVALID[lang].body;
  } else if (status === "done") {
    title = tx.doneTitle;
    body = tx.doneBody;
  } else {
    title = tx.confirmTitle;
    body = tx.confirmBody;
  }

  const showButton = status === "idle" || status === "sending" || status === "error";

  return (
    <div
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: T.cream,
        color: T.espresso,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        margin: 0,
        padding: "20px",
      }}
    >
      <div style={{ maxWidth: "420px", textAlign: "center", padding: "32px" }}>
        <div style={{ fontSize: "42px", marginBottom: "12px" }}>🌿</div>
        <h1 style={{ fontSize: "20px", margin: "0 0 8px", color: T.espresso }}>
          {title}
        </h1>
        <p
          style={{
            color: T.warm,
            lineHeight: 1.6,
            fontSize: "14px",
            margin: "0 0 22px",
          }}
        >
          {body}
        </p>

        {status === "error" && (
          <p style={{ color: "#C94F6A", fontSize: "13px", margin: "0 0 16px" }}>
            {ERROR_TXT[lang]}
          </p>
        )}

        {showButton && (
          <button
            type="button"
            onClick={handleUnsubscribe}
            disabled={status === "sending"}
            style={{
              background: status === "sending" ? T.muted : T.sage,
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "12px 28px",
              fontSize: "15px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: status === "sending" ? "default" : "pointer",
            }}
          >
            {tx.confirmBtn}
          </button>
        )}
      </div>
    </div>
  );
}
