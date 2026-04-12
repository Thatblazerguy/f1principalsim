import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";

export interface SlideTabItem {
  key: string;
  label: string;
}

interface SlideTabsProps {
  items: SlideTabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onLogout?: () => void;
}

export const SlideTabs = ({ items, activeKey, onSelect, onLogout }: SlideTabsProps) => {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const tabsRef = useRef<Array<HTMLLIElement | null>>([]);

  const selected = Math.max(
    0,
    items.findIndex(item => item.key === activeKey)
  );

  useEffect(() => {
    const selectedTab = tabsRef.current[selected];
    if (selectedTab) {
      const { width } = selectedTab.getBoundingClientRect();
      setPosition({
        left: selectedTab.offsetLeft,
        width,
        opacity: 1,
      });
    }
  }, [selected, items.length]);

  return (
    <ul
      onMouseLeave={() => {
        const selectedTab = tabsRef.current[selected];
        if (selectedTab) {
          const { width } = selectedTab.getBoundingClientRect();
          setPosition({
            left: selectedTab.offsetLeft,
            width,
            opacity: 1,
          });
        }
      }}
      className="hub-slide-tabs"
    >
      {items.map((tab, i) => (
        <Tab
          key={tab.key}
          ref={el => {
            tabsRef.current[i] = el;
          }}
          setPosition={setPosition}
          onClick={() => onSelect(tab.key)}
          isActive={activeKey === tab.key}
        >
          {tab.label}
        </Tab>
      ))}

      <Cursor position={position} />
      <li className="hub-slide-tab-item">
        <button type="button" className="hub-slide-tab hub-slide-tab-logout" onClick={onLogout}>
          Logout
        </button>
      </li>
    </ul>
  );
};

const Tab = React.forwardRef<
  HTMLLIElement,
  {
    children: React.ReactNode;
    setPosition: (position: { left: number; width: number; opacity: number }) => void;
    onClick: () => void;
    isActive: boolean;
  }
>(({ children, setPosition, onClick, isActive }, ref) => {
  const localRef = useRef<HTMLLIElement | null>(null);

  React.useImperativeHandle(ref, () => localRef.current as HTMLLIElement, []);

  return (
    <li
      ref={localRef}
      onClick={onClick}
      onMouseEnter={() => {
        if (!localRef.current) return;
        const { width } = localRef.current.getBoundingClientRect();
        setPosition({
          left: localRef.current.offsetLeft,
          width,
          opacity: 1,
        });
      }}
      className="hub-slide-tab-item"
    >
      <button type="button" className={`hub-slide-tab ${isActive ? "hub-slide-tab-active" : ""}`}>
        {children}
      </button>
    </li>
  );
});

Tab.displayName = "Tab";

const Cursor = ({ position }: { position: { left: number; width: number; opacity: number } }) => {
  return (
    <motion.li
      animate={{
        ...position,
      }}
      className="hub-slide-cursor"
    />
  );
};
