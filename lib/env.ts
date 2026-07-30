// Fail loudly at the point of use, not with a silent `undefined` that
// surfaces as a confusing bug three function calls later.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}