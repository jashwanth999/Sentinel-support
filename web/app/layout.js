import './globals.css';
import ThemeShell from './theme-shell';

export const metadata = {
  title: 'Sentinel Support',
  description: 'Fraud case triage console'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeShell>{children}</ThemeShell>
      </body>
    </html>
  );
}
