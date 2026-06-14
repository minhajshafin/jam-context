import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dhaka Traffic — Community Incident Map',
  description:
    'A crowdsourced map of real-time traffic incidents in Dhaka. Report waterlogging, protests, accidents, and road damage so fellow commuters can plan smarter routes.',
  keywords: ['Dhaka traffic', 'Bangladesh road incidents', 'crowdsourced map', 'waterlogging', 'accident report'],
  openGraph: {
    title: 'Dhaka Traffic — Community Incident Map',
    description: 'Real-time, community-reported traffic incidents for Dhaka commuters.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#030712" />
      </head>
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
