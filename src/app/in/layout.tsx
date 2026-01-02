import Navbar from "../components/navbar";

export default function InLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      <main className="pt-18">{children}</main>
    </>
  );
}
