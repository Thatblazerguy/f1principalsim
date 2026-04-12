import NavHeader from "@/components/ui/nav-header";

function HomeDemo() {
  return (
    <header className="flex h-screen items-center justify-center p-10">
      <NavHeader
        items={[
          { key: "home", label: "Home" },
          { key: "pricing", label: "Pricing" },
          { key: "about", label: "About" },
          { key: "services", label: "Services" },
          { key: "contact", label: "Contact" },
        ]}
        activeKey="home"
        onSelect={() => {}}
      />
    </header>
  );
}

export { HomeDemo };
