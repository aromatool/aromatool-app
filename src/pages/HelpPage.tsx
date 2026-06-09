import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// ── BLOSSOM SAGE ───────────────────────────────────────────
const T = {
  sage: "#5C7A5C",
  sageDark: "#4A6A4A",
  sageLight: "#E8F0E8",
  sageMid: "#C8D8C8",
  cream: "#FAFAF7",
  linen: "#F5EEE8",
  espresso: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  border: "#EDE8E0",
  white: "#FFFFFF",
};

interface HelpItem {
  q: string;
  a: string; // text simplu, \n = paragraf nou
}

interface HelpCategory {
  icon: string;
  title: string;
  items: HelpItem[];
}

// ── CONȚINUT AJUTOR ────────────────────────────────────────
// Întrebări reale despre fluxurile aplicației. Ușor de extins:
// adaugi un obiect în array, fără alte modificări.
const HELP: HelpCategory[] = [
  {
    icon: "ti-sparkles",
    title: "Început rapid",
    items: [
      {
        q: "Cu ce încep prima dată?",
        a: "Începe din Setări: completează-ți numele, telefonul, emailul de contact și semnătura de email. Acestea apar automat în ofertele și mesajele pe care le trimiți.\nApoi adaugă primele contacte în CRM și construiește prima ofertă din „Construiește oferta”.",
      },
      {
        q: "Cum funcționează aplicația, pe scurt?",
        a: "AromaTool te ajută să gestionezi clienții (CRM), să construiești oferte de produse cu prețuri corecte, să le trimiți pe email și să revii la momentul potrivit cu mesaje de follow-up. Aplicația îți sugerează ce ai de făcut — tu decizi când trimiți.",
      },
    ],
  },
  {
    icon: "ti-calculator",
    title: "Construiește oferta",
    items: [
      {
        q: "Cum construiesc o ofertă?",
        a: "Intră în „Construiește oferta”, adaugă produsele în coș, setează cantitatea și, dacă vrei, un discount per produs. Alege moneda și cursul de schimb, adaugă transportul și o notă dacă e cazul. La final previzualizezi și trimiți oferta pe email contactului ales.",
      },
      {
        q: "Cum sunt calculate prețurile și cursul valutar?",
        a: "Prețurile de bază sunt în EUR. Când alegi altă monedă, totul se convertește la cursul de schimb pe care îl setezi tu, ca să-i arăți clientului suma în moneda lui. Cursul folosit rămâne salvat pe ofertă, ca să poți reconstrui mai târziu calculul exact.",
      },
      {
        q: "Pot atașa materiale (PDF-uri, imagini) la ofertă?",
        a: "Da. Materialele nu se trimit ca atașamente grele, ci ca linkuri securizate către fișierele tale din Resurse. Astfel emailul rămâne ușor, iar tu poți vedea dacă au fost accesate.",
      },
    ],
  },
  {
    icon: "ti-file-text",
    title: "Oferte trimise",
    items: [
      {
        q: "Unde văd ofertele trimise?",
        a: "În pagina „Oferte”. Ofertele sunt grupate pe client — apeși pe un client ca să vezi toate ofertele lui, iar pe fiecare ofertă ca să vezi produsele și detaliile.",
      },
      {
        q: "Am dat click pe o ofertă din Dashboard/CRM. De ce apare filtrată?",
        a: "Când deschizi o ofertă dintr-un alt loc, pagina „Oferte” o aduce sus, filtrată pe clientul respectiv, cu oferta deschisă și evidențiată. Ca să revii la lista completă, apeși „Vezi toate ofertele” din bannerul de sus.",
      },
      {
        q: "Cum caut o ofertă anume?",
        a: "Folosește bara de căutare din pagina „Oferte”: poți căuta după numele clientului, email sau după numele unui produs din ofertă.",
      },
    ],
  },
  {
    icon: "ti-users",
    title: "CRM & contacte",
    items: [
      {
        q: "Ce înseamnă statusurile contactelor?",
        a: "Prospect = persoană interesată, fără ofertă încă. Client nou / Client fidel = a cumpărat. Follow-up = i-ai trimis ofertă și aștepți răspuns. Inactiv = nu a mai fost activitate de mult. Statusul ajută aplicația să-ți sugereze următoarea acțiune potrivită.",
      },
      {
        q: "Ce sunt acțiunile recomandate?",
        a: "Pentru fiecare contact, aplicația îți sugerează ce are sens să faci acum: trimite prima ofertă, revino cu un follow-up, reactivează un contact adormit etc. Sunt sugestii — tu alegi dacă și când acționezi.",
      },
      {
        q: "Cum contactez rapid un client?",
        a: "Din CRM sau Dashboard ai acțiuni rapide: WhatsApp, email și ofertă nouă. Mesajul de WhatsApp e pregătit automat în funcție de starea contactului și se deschide în WhatsApp ca să îl poți ajusta înainte de trimitere.",
      },
    ],
  },
  {
    icon: "ti-template",
    title: "Mesaje & follow-up",
    items: [
      {
        q: "Cum trimit un mesaj de follow-up?",
        a: "Din CRM/Dashboard alegi contactul și deschizi fereastra de mesaj. Aplicația îți arată mesajele recomandate pentru situația lui; poți apăsa „Vezi toate” ca să alegi orice alt mesaj. Editezi dacă vrei și trimiți.",
      },
      {
        q: "Care e diferența dintre mesajele de sistem și cele personale?",
        a: "Mesajele de sistem sunt șabloane gata făcute, oferite de aplicație. Le poți „Personaliza” ca să-ți creezi propria variantă, pe care apoi o poți edita liber în pagina „Mesaje”.",
      },
      {
        q: "Pot atașa materiale implicite la un mesaj?",
        a: "Da. La un mesaj personal poți seta materiale implicite (din Resurse). Ele apar bifate automat când trimiți acel mesaj, iar tu le poți ajusta la momentul trimiterii.",
      },
      {
        q: "Ce conține semnătura din emailuri?",
        a: "La finalul emailurilor apare o secțiune discretă de contact: numărul tău de telefon, un buton de WhatsApp și unul de email, plus semnătura ta. Toate sunt luate din Setări.",
      },
      {
        q: "Ce se întâmplă cu mesajele de WhatsApp?",
        a: "Sunt sugestii generate automat în funcție de starea contactului, personalizate cu prenumele lui și semnătura ta. Se deschid pre-completate în WhatsApp — le poți edita oricât înainte să le trimiți.",
      },
    ],
  },
  {
    icon: "ti-folder",
    title: "Resurse",
    items: [
      {
        q: "Ce pot încărca în Resurse?",
        a: "Fișiere utile pentru clienți: PDF-uri (broșuri, protocoale) și imagini (JPG, PNG). Le folosești apoi în oferte și în mesaje.",
      },
      {
        q: "Cum sunt trimise fișierele către clienți?",
        a: "Nu ca atașamente, ci ca linkuri securizate, unice per trimitere. Astfel emailul rămâne ușor și poți urmări dacă linkul a fost accesat.",
      },
    ],
  },
  {
    icon: "ti-credit-card",
    title: "Abonament & perioadă gratuită",
    items: [
      {
        q: "Cât durează perioada gratuită (trial)?",
        a: "La crearea contului primești o perioadă gratuită în care ai acces la toate funcțiile, fără să introduci un card. Numărul exact de zile rămase îl vezi oricând în Setări, în cardul „Abonament”.",
      },
      {
        q: "Am nevoie de card ca să încep?",
        a: "Nu. Perioada gratuită pornește automat, fără card de credit. Introduci o metodă de plată doar atunci când decizi să te abonezi.",
      },
      {
        q: "Ce se întâmplă când expiră perioada gratuită?",
        a: "Poți în continuare să te autentifici, să-ți vezi datele și să le exporți. Acțiunile de scriere (adăugare contacte, trimitere mesaje și oferte, încărcare resurse) se deblochează după ce te abonezi.",
      },
      {
        q: "Cum mă abonez?",
        a: "Din Setări → cardul „Abonament” apeși „Abonează-te”. Te ducem la pagina de plată securizată, unde alegi metoda de plată și, dacă ai, introduci codul de lansare. După confirmare, contul tău se deblochează automat.",
      },
      {
        q: "Am un cod de lansare / reducere. Unde îl introduc?",
        a: "La pasul de plată, după ce apeși „Abonează-te”, există un câmp pentru codul promoțional. Îl introduci acolo și reducerea se aplică automat.",
      },
      {
        q: "Cum îmi gestionez abonamentul sau factura?",
        a: "Din Setări → cardul „Abonament” → „Gestionează abonamentul”. Acolo poți schimba metoda de plată, vedea facturile sau anula abonamentul, oricând.",
      },
    ],
  },
  {
    icon: "ti-settings",
    title: "Setări & cont",
    items: [
      {
        q: "Unde îmi setez semnătura de email?",
        a: "În Setări, la câmpul „Semnătură email”. Textul de acolo apare automat în footerul tuturor emailurilor (ofertă, follow-up, mesaj personalizat).",
      },
      {
        q: "Cum apar datele mele de contact în emailuri?",
        a: "Telefonul și emailul de contact din Setări alimentează butoanele de WhatsApp și email din footerul mesajelor. Actualizezi într-un singur loc și se reflectă peste tot.",
      },
    ],
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const q = search.trim().toLowerCase();

  // Filtrare: păstrăm categoriile, dar arătăm doar item-urile care se potrivesc.
  const results = useMemo(() => {
    if (!q) return HELP;
    return HELP.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) =>
          it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [q]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalMatches = results.reduce((s, c) => s + c.items.length, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "22px", fontWeight: 500, color: T.espresso }}>
          Ghid & ajutor
        </div>
        <div style={{ fontSize: "13px", color: T.muted, marginTop: "4px" }}>
          Caută răspunsuri sau răsfoiește pe categorii. Nu găsești ce cauți?
          Întreabă-ne oricând.
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "20px" }}>
        <i
          className="ti ti-search"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "16px",
            color: T.muted,
          }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută în ghid... (ex: ofertă, follow-up, semnătură)"
          style={{
            width: "100%",
            padding: "11px 12px 11px 38px",
            background: T.white,
            border: `0.5px solid ${T.border}`,
            borderRadius: "10px",
            fontSize: "14px",
            color: T.espresso,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Rezultate goale */}
      {q && totalMatches === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            border: `1.5px dashed ${T.border}`,
            borderRadius: "16px",
            background: T.white,
          }}
        >
          <i
            className="ti ti-help-circle"
            style={{
              fontSize: "40px",
              color: T.muted,
              display: "block",
              marginBottom: "12px",
            }}
          />
          <div
            style={{
              fontSize: "18px",
              fontWeight: 500,
              color: T.espresso,
              marginBottom: "6px",
            }}
          >
            Niciun rezultat pentru „{search}”
          </div>
          <div style={{ fontSize: "13px", color: T.muted }}>
            Încearcă alte cuvinte, sau răsfoiește categoriile.
          </div>
        </div>
      ) : (
        results.map((cat) => (
          <div key={cat.title} style={{ marginBottom: "22px" }}>
            {/* Titlu categorie */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                  background: T.sageLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i
                  className={`ti ${cat.icon}`}
                  style={{ fontSize: "16px", color: T.sage }}
                />
              </div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: T.espresso,
                }}
              >
                {cat.title}
              </div>
            </div>

            {/* Item-uri (accordion) */}
            <div
              style={{
                background: T.white,
                border: `0.5px solid ${T.border}`,
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              {cat.items.map((it, i) => {
                const id = `${cat.title}-${i}`;
                const isOpen = open.has(id) || !!q; // la căutare, deschidem direct
                return (
                  <div
                    key={id}
                    style={{
                      borderTop: i > 0 ? `0.5px solid ${T.border}` : "none",
                    }}
                  >
                    <div
                      onClick={() => toggle(id)}
                      style={{
                        padding: "14px 16px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: "14px",
                          fontWeight: 500,
                          color: T.espresso,
                        }}
                      >
                        {it.q}
                      </span>
                      <i
                        className={`ti ti-chevron-${isOpen ? "up" : "down"}`}
                        style={{
                          fontSize: "16px",
                          color: T.muted,
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    {isOpen && (
                      <div
                        style={{
                          padding: "0 16px 16px",
                        }}
                      >
                        {it.a.split("\n").map((p, j) => (
                          <p
                            key={j}
                            style={{
                              margin: j === 0 ? "0" : "8px 0 0",
                              fontSize: "13px",
                              lineHeight: 1.7,
                              color: T.warm,
                            }}
                          >
                            {p}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Footer contact */}
      <div
        style={{
          marginTop: "28px",
          background: T.sageLight,
          border: `0.5px solid ${T.sageMid}`,
          borderRadius: "14px",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: T.sageDark,
            marginBottom: "4px",
          }}
        >
          Tot nu ai găsit răspunsul?
        </div>
        <div
          style={{
            fontSize: "13px",
            color: T.warm,
            marginBottom: "14px",
          }}
        >
          Verifică-ți setările contului sau scrie-ne — îți răspundem cu drag.
        </div>
        <button
          onClick={() => navigate("/app/settings")}
          style={{
            padding: "9px 18px",
            fontSize: "13px",
            fontFamily: "inherit",
            fontWeight: 500,
            background: T.white,
            border: `0.5px solid ${T.sageMid}`,
            borderRadius: "10px",
            color: T.sageDark,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <i className="ti ti-settings" style={{ fontSize: "15px" }} />
          Deschide Setări
        </button>
      </div>
    </div>
  );
}
