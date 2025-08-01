import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon using frame_00002.png */}
        <link rel="icon" type="image/png" href="/johngettingpunched/frame_00002.png" />
        <link rel="shortcut icon" type="image/png" href="/johngettingpunched/frame_00002.png" />
        <link rel="apple-touch-icon" href="/johngettingpunched/frame_00002.png" />
        
        {/* Meta tags */}
        <meta name="description" content="JohnWRizzKid - Ultimate punch animation with blockchain transactions!" />
        <meta name="keywords" content="punch, animation, blockchain, MON, Monad" />
        <meta name="author" content="JohnWRizzKid" />
        
        {/* Open Graph tags */}
        <meta property="og:title" content="JohnWRizzKid - Punch Animation Game" />
        <meta property="og:description" content="Experience the ultimate punch animation with blockchain transactions!" />
        <meta property="og:image" content="/johngettingpunched/frame_00002.png" />
        <meta property="og:type" content="website" />
        
        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="JohnWRizzKid - Punch Animation Game" />
        <meta name="twitter:description" content="Experience the ultimate punch animation with blockchain transactions!" />
        <meta name="twitter:image" content="/johngettingpunched/frame_00002.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
