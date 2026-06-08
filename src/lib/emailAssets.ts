// ============================================================
// EMAIL ASSETS — URL-uri pentru imaginile din emailuri (PNG).
// Clienții de email (Gmail în special) elimină SVG inline, așa că
// logo-ul și iconițele de contact sunt PNG-uri găzduite într-un
// bucket public Supabase ("email-assets").
//
// UPLOAD (o singură dată): urci cele 4 fișiere din folderul local
// `email-assets/` în bucket-ul public `email-assets` din Supabase
// Storage (vezi instrucțiunile din chat). Numele fișierelor trebuie
// păstrate exact: email-logo.png, email-wa.png, email-mail.png,
// email-phone.png.
//
// CÂND IEI DOMENIU: poți seta VITE_EMAIL_ASSET_BASE = "https://app.aromatool.com/email"
//   și gata — un singur env var, fără refactor.
// ============================================================

const ENV_BASE = import.meta.env.VITE_EMAIL_ASSET_BASE as string | undefined
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const BUCKET = 'email-assets'

function assetBase(): string {
  if (ENV_BASE && ENV_BASE.trim()) return ENV_BASE.trim().replace(/\/$/, '')
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}`
}

export function emailAssetUrl(file: string): string {
  return `${assetBase()}/${file}`
}

export const EMAIL_ASSET = {
  logo: emailAssetUrl('email-logo.png'),
  wa: emailAssetUrl('email-wa.png'),
  mail: emailAssetUrl('email-mail.png'),
  phone: emailAssetUrl('email-phone.png'),
}
