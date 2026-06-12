import "./globals.css";

export const metadata = {
  title: "Room3D Viewer",
  description: "AI-powered hybrid 2D + selective 3D room visualization with Tencent Hunyuan3D",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-surface-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
