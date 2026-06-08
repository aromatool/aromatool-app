// ============================================================
// PAGINI LEGALE — Privacy Policy, Terms of Service, Cookie Policy.
// Pagini publice (nu necesită login). Conținut practic pentru un
// SaaS la început, în RO/UE.
//
// ⚠️ DRAFT — textul de mai jos e un punct de plecare solid, dar
// trebuie completat cu datele firmei (vezi COMPANY) și validat
// scurt de un jurist înainte de lansarea publică.
// ============================================================

import { Link } from "react-router-dom";
import type { ReactNode } from "react";

// ── COMPLETEAZĂ DATELE FIRMEI AICI ─────────────────────────
// Acestea apar în toate documentele legale.
export const COMPANY = {
  legalName: "[DENUMIRE FIRMĂ SRL]",
  cui: "[CUI / J__/____/____]",
  address: "[Adresă sediu social, România]",
  contactEmail: "[contact@aromatool.com]",
  privacyEmail: "[privacy@aromatool.com]",
  appName: "AromaTool",
  appUrl: "aromatool.com",
  lastUpdated: "8 iunie 2026",
};

const T = {
  sage: "#5C7A5C",
  cream: "#FAFAF7",
  espresso: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  border: "#EDE8E0",
  white: "#FFFFFF",
  amberLight: "#FDF5EE",
  amber: "#C4906A",
};

// ── LAYOUT COMUN ───────────────────────────────────────────
function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.cream,
        fontFamily: "'DM Sans', sans-serif",
        color: T.espresso,
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <Link
          to="/auth"
          style={{
            fontSize: "13px",
            color: T.sage,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Înapoi
        </Link>

        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "28px",
            color: T.espresso,
            marginTop: "20px",
            marginBottom: "4px",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "12px", color: T.muted, marginBottom: "8px" }}>
          {COMPANY.appName} · Ultima actualizare: {COMPANY.lastUpdated}
        </div>

        {/* Banner draft — de eliminat după validarea juridică */}
        <div
          style={{
            background: T.amberLight,
            border: `1px solid ${T.amber}33`,
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "12px",
            color: T.warm,
            marginBottom: "24px",
            lineHeight: 1.6,
          }}
        >
          ⚠️ Document în lucru — completează datele firmei și validează cu un
          jurist înainte de lansare.
        </div>

        {intro && (
          <p style={{ fontSize: "15px", lineHeight: 1.7, color: T.warm }}>
            {intro}
          </p>
        )}

        <div style={{ marginTop: "12px" }}>{children}</div>

        <div
          style={{
            marginTop: "48px",
            paddingTop: "20px",
            borderTop: `1px solid ${T.border}`,
            fontSize: "13px",
            color: T.muted,
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <Link to="/legal/privacy" style={{ color: T.sage }}>
            Confidențialitate
          </Link>
          <Link to="/legal/terms" style={{ color: T.sage }}>
            Termeni
          </Link>
          <Link to="/legal/cookies" style={{ color: T.sage }}>
            Cookie-uri
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: "28px" }}>
      <h2
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: T.espresso,
          marginBottom: "10px",
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: "14px", lineHeight: 1.75, color: T.warm }}>
        {children}
      </div>
    </section>
  );
}

const ul: React.CSSProperties = {
  margin: "8px 0",
  paddingLeft: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

// ════════════════════════════════════════════════════════════
// 1. PRIVACY POLICY
// ════════════════════════════════════════════════════════════
export function PrivacyPage() {
  return (
    <LegalLayout
      title="Politica de confidențialitate"
      intro={`Această politică explică ce date personale prelucrează ${COMPANY.appName} și cum. Te rugăm să o citești cu atenție.`}
    >
      <Section title="1. Cine suntem (operatorul)">
        {COMPANY.legalName}, {COMPANY.cui}, cu sediul în {COMPANY.address},
        operează aplicația {COMPANY.appName} ({COMPANY.appUrl}). Pentru orice
        întrebare legată de date personale, ne poți scrie la{" "}
        <strong>{COMPANY.privacyEmail}</strong>.
      </Section>

      <Section title="2. Rolurile noastre">
        <ul style={ul}>
          <li>
            Pentru <strong>datele contului tău</strong> (nume, email, telefon)
            suntem <strong>operator</strong>.
          </li>
          <li>
            Pentru <strong>datele contactelor pe care le introduci</strong> în
            aplicație, tu ești <strong>operatorul</strong>, iar noi suntem{" "}
            <strong>persoană împuternicită (procesor)</strong> și prelucrăm
            aceste date doar pentru a-ți furniza serviciul, conform
            instrucțiunilor tale și Termenilor.
          </li>
        </ul>
      </Section>

      <Section title="3. Ce date colectăm">
        <ul style={ul}>
          <li>
            <strong>Date cont:</strong> nume, email, telefon, semnătură email,
            preferințe (țară, limbă, oră Daily Focus).
          </li>
          <li>
            <strong>Date introduse de tine despre contacte:</strong> nume,
            email, telefon, notițe, sursă, istoric activități, oferte.
          </li>
          <li>
            <strong>Date de utilizare email:</strong> trimiteri, deschideri și
            click-uri (email tracking), pentru a-ți arăta statusul mesajelor.
          </li>
          <li>
            <strong>Date de plată:</strong> procesate de Stripe; noi nu stocăm
            datele cardului.
          </li>
          <li>
            <strong>Date tehnice strict necesare:</strong> cookie de sesiune
            pentru autentificare.
          </li>
        </ul>
      </Section>

      <Section title="4. Temeiul legal și scopurile">
        <ul style={ul}>
          <li>
            <strong>Executarea contractului</strong> — furnizarea aplicației și
            a contului tău.
          </li>
          <li>
            <strong>Interes legitim</strong> — funcționarea CRM-ului, securitate,
            prevenirea abuzului.
          </li>
          <li>
            <strong>Obligație legală</strong> — păstrarea facturilor (legislația
            contabilă).
          </li>
        </ul>
      </Section>

      <Section title="5. Furnizori (sub-procesori)">
        Folosim furnizori de încredere pentru a opera serviciul:
        <ul style={ul}>
          <li>
            <strong>Supabase</strong> — bază de date, autentificare, stocare
            fișiere.
          </li>
          <li>
            <strong>Vercel</strong> — găzduire aplicație web.
          </li>
          <li>
            <strong>Resend</strong> — trimitere emailuri (SUA, cu clauze
            contractuale standard pentru transfer internațional).
          </li>
          <li>
            <strong>Stripe</strong> — procesare plăți (SUA, cu clauze
            contractuale standard).
          </li>
        </ul>
      </Section>

      <Section title="6. Cât păstrăm datele (retenție)">
        <ul style={ul}>
          <li>
            <strong>Cont șters:</strong> ștergem datele în maximum 30 de zile;
            copiile de siguranță expiră în maximum 90 de zile.
          </li>
          <li>
            <strong>Contact șters:</strong> ștergere imediată.
          </li>
          <li>
            <strong>Resurse (fișiere) șterse:</strong> ștergere imediată din
            stocare.
          </li>
          <li>
            <strong>Loguri email:</strong> păstrate maximum 12 luni.
          </li>
          <li>
            <strong>Facturi:</strong> păstrate conform legii contabile (până la
            10 ani) — această obligație legală prevalează asupra cererii de
            ștergere.
          </li>
        </ul>
      </Section>

      <Section title="7. Drepturile tale">
        Ai dreptul de acces, rectificare, ștergere, restricționare,
        portabilitate și opoziție. Le poți exercita direct din aplicație
        (export, ștergere cont, ștergere contact) sau scriindu-ne la{" "}
        <strong>{COMPANY.privacyEmail}</strong>. Răspundem în maximum 30 de zile.
        Ai și dreptul de a depune o plângere la{" "}
        <strong>ANSPDCP</strong> (Autoritatea Națională de Supraveghere a
        Prelucrării Datelor cu Caracter Personal).
      </Section>

      <Section title="8. Email tracking">
        Pentru emailurile trimise prin aplicație putem înregistra dacă au fost
        livrate, deschise sau dacă s-a dat click pe linkuri, ca să-ți arătăm
        statusul. Destinatarii se pot dezabona oricând prin linkul din email.
      </Section>

      <Section title="9. Securitate">
        Folosim izolarea datelor pe utilizator (Row Level Security), stocare
        privată cu acces restricționat, conexiuni criptate și acces minim
        necesar. Niciun sistem nu e 100% sigur, dar tratăm securitatea cu
        prioritate.
      </Section>

      <Section title="10. Modificări">
        Putem actualiza această politică. Te anunțăm la schimbări semnificative,
        iar data ultimei actualizări apare în antet.
      </Section>
    </LegalLayout>
  );
}

// ════════════════════════════════════════════════════════════
// 2. TERMS OF SERVICE
// ════════════════════════════════════════════════════════════
export function TermsPage() {
  return (
    <LegalLayout
      title="Termeni și condiții"
      intro={`Prin crearea unui cont și utilizarea ${COMPANY.appName} ești de acord cu acești termeni.`}
    >
      <Section title="1. Serviciul">
        {COMPANY.appName} este o aplicație de tip CRM pentru distribuitori
        independenți (calculator de oferte, gestionare contacte, follow-up,
        resurse). Putem îmbunătăți sau modifica funcționalitățile în timp.
      </Section>

      <Section title="2. Contul tău">
        Ești responsabil pentru păstrarea în siguranță a datelor de
        autentificare și pentru activitatea din contul tău. Trebuie să ai cel
        puțin 18 ani și să furnizezi informații corecte.
      </Section>

      <Section title="3. Abonament și plăți">
        Anumite funcționalități necesită abonament plătit, procesat prin Stripe.
        Prețurile și planurile sunt afișate în aplicație. Poți anula oricând;
        accesul continuă până la finalul perioadei plătite. Facturile se emit
        conform legislației aplicabile.
      </Section>

      <Section title="4. Responsabilitatea ta privind datele contactelor (important)">
        Tu introduci datele contactelor tale și ești <strong>operatorul</strong>{" "}
        acestor date. Garantezi că:
        <ul style={ul}>
          <li>
            ai dreptul legal și, unde e cazul, consimțământul de a prelucra
            datele persoanelor pe care le adaugi;
          </li>
          <li>
            informezi acele persoane despre prelucrare și le respecți
            drepturile (acces, ștergere, dezabonare);
          </li>
          <li>
            nu introduci <strong>date sensibile</strong> (de exemplu informații
            despre sănătate, diagnostice sau tratamente) în notițe sau alte
            câmpuri.
          </li>
        </ul>
        Tu ești responsabil pentru legalitatea datelor introduse. Noi îți
        punem la dispoziție uneltele necesare (ștergere contact, dezactivare
        email, blocare comunicare).
      </Section>

      <Section title="5. Prelucrarea datelor în numele tău (clauză de procesor / DPA)">
        Când prelucrăm datele contactelor tale, acționăm ca persoană
        împuternicită. Ne angajăm să:
        <ul style={ul}>
          <li>
            prelucrăm aceste date doar pentru a-ți furniza serviciul și conform
            instrucțiunilor tale;
          </li>
          <li>aplicăm măsuri de securitate adecvate;</li>
          <li>
            folosim sub-procesori (Supabase, Vercel, Resend, Stripe) sub
            obligații echivalente de protecție;
          </li>
          <li>
            te informăm fără întârziere nejustificată în caz de incident de
            securitate ce afectează datele tale;
          </li>
          <li>
            ștergem sau returnăm datele la încetarea contului, sub rezerva
            obligațiilor legale de păstrare.
          </li>
        </ul>
      </Section>

      <Section title="6. Utilizare acceptabilă">
        Nu ai voie să folosești {COMPANY.appName} pentru:
        <ul style={ul}>
          <li>spam sau mesaje nesolicitate în masă;</li>
          <li>liste de contacte cumpărate sau obținute fără temei legal;</li>
          <li>conținut ilegal, înșelător sau care încalcă drepturi terțe;</li>
          <li>încercări de a accesa date ale altor utilizatori.</li>
        </ul>
      </Section>

      <Section title="7. Fără garanție de venit">
        {COMPANY.appName} este o unealtă de organizare și comunicare. Nu
        garantăm vânzări, venituri sau rezultate de business. Succesul depinde
        de activitatea ta.
      </Section>

      <Section title="8. Limitarea răspunderii">
        Serviciul este oferit „ca atare". În limita permisă de lege, nu suntem
        răspunzători pentru pierderi indirecte sau de profit. Răspunderea
        noastră totală este limitată la suma plătită de tine în ultimele 12
        luni.
      </Section>

      <Section title="9. Încetare">
        Poți șterge contul oricând din Setări. Putem suspenda sau închide
        conturi care încalcă acești termeni.
      </Section>

      <Section title="10. Legea aplicabilă">
        Acești termeni sunt guvernați de legea română, iar eventualele litigii
        sunt de competența instanțelor din România. Pentru întrebări:{" "}
        <strong>{COMPANY.contactEmail}</strong>.
      </Section>
    </LegalLayout>
  );
}

// ════════════════════════════════════════════════════════════
// 3. COOKIE POLICY
// ════════════════════════════════════════════════════════════
export function CookiePage() {
  return (
    <LegalLayout
      title="Politica de cookie-uri"
      intro={`${COMPANY.appName} folosește un set minim de cookie-uri, strict necesare funcționării.`}
    >
      <Section title="1. Ce cookie-uri folosim">
        <ul style={ul}>
          <li>
            <strong>Cookie de sesiune (autentificare):</strong> ne permite să te
            menținem conectat în siguranță. Strict necesar — fără el aplicația
            nu funcționează.
          </li>
          <li>
            <strong>Stripe (la plată):</strong> Stripe poate seta cookie-uri
            pentru procesarea sigură a plăților și prevenirea fraudei, doar în
            timpul checkout-ului.
          </li>
        </ul>
      </Section>

      <Section title="2. Ce NU folosim">
        Nu folosim cookie-uri de marketing, publicitate sau urmărire între
        site-uri. Din acest motiv, nu îți cerem consimțământ printr-un banner —
        toate cookie-urile sunt strict necesare.
      </Section>

      <Section title="3. Controlul cookie-urilor">
        Poți șterge sau bloca cookie-urile din setările browserului. Reține că
        blocarea cookie-ului de sesiune te va împiedica să te autentifici.
      </Section>

      <Section title="4. Modificări">
        Dacă vom adăuga în viitor instrumente care folosesc cookie-uri
        neesențiale (de exemplu analytics), vom actualiza această politică și,
        dacă e necesar, vom afișa un banner de consimțământ.
      </Section>
    </LegalLayout>
  );
}
