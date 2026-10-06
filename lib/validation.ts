// Validadores puros (sin red) compartidos por Auth, /bienvenida y /perfil.
// Devuelven el mensaje de error en español, o null si el valor es válido.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 10;
export const PASSWORD_MIN = 8;

const USERNAME_CHARS = /^[A-Z0-9_]*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeUsername = (value: string) => value.trim().toUpperCase();

export function validateUsername(value: string): string | null {
  const v = normalizeUsername(value);
  if (!v) return "Elige un nombre de usuario.";
  if (!USERNAME_CHARS.test(v)) return "Solo letras, números y _.";
  if (v.length < USERNAME_MIN) return `Muy corto: mínimo ${USERNAME_MIN} caracteres.`;
  if (v.length > USERNAME_MAX) return `Muy largo: máximo ${USERNAME_MAX} caracteres.`;
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Ingresa tu correo electrónico.";
  if (!EMAIL_RE.test(v)) return "Correo electrónico no válido.";
  return null;
}

// En login solo se exige que no esté vacía; en registro, el largo mínimo.
export function validatePassword(value: string, mode: "login" | "register"): string | null {
  if (!value) return "Ingresa tu contraseña.";
  if (mode === "register" && value.length < PASSWORD_MIN) {
    return `Muy corta: mínimo ${PASSWORD_MIN} caracteres.`;
  }
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) return "Repite la contraseña.";
  if (confirm !== password) return "Las contraseñas no coinciden.";
  return null;
}
