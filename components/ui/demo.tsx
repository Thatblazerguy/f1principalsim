import { SlideTabs } from "./slide-tabs";

export default function DemoOne() {
  return (
    <div className="w-full grid h-screen place-content-center bg-white dark:bg-black">
      <SlideTabs
        items={[
          { key: "home", label: "Home" },
          { key: "pricing", label: "Pricing" },
          { key: "features", label: "Features" },
          { key: "docs", label: "Docs" },
          { key: "blog", label: "Blog" },
        ]}
        activeKey="home"
        onSelect={() => {}}
      />
    </div>
  );
}
