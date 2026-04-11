/**
 * Global site footer — fixed copy; year updates at build/runtime via `Date`.
 * Lives inside `RootLayout` so every route shares the same legal/branding strip without duplicating markup.
 */
export function Footer() {
  return (
    <footer className="relative z-10 mt-auto w-full shrink-0 py-4 text-center text-sm text-white/70">
      <p>© {new Date().getFullYear()}. All rights reserved.</p>
    </footer>
  );
}
