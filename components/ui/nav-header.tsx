"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";

export interface NavHeaderItem {
  key: string;
  label: string;
}

interface NavHeaderProps {
  items: NavHeaderItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onLogout?: () => void;
}

function NavHeader({ items, activeKey, onSelect, onLogout }: NavHeaderProps) {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  return (
    <ul className="hub-nav-header" onMouseLeave={() => setPosition(pv => ({ ...pv, opacity: 0 }))}>
      {items.map(item => (
        <Tab
          key={item.key}
          isActive={activeKey === item.key}
          setPosition={setPosition}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </Tab>
      ))}
      <li className="hub-nav-item">
        <button type="button" className="hub-nav-pill hub-nav-pill-logout" onClick={onLogout}>
          Logout
        </button>
      </li>
      <Cursor position={position} />
    </ul>
  );
}

const Tab = ({
  children,
  setPosition,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  setPosition: (position: { left: number; width: number; opacity: number }) => void;
  isActive: boolean;
  onClick: () => void;
}) => {
  const ref = useRef<HTMLLIElement>(null);
  return (
    <li
      ref={ref}
      className="hub-nav-item"
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({
          width,
          opacity: 1,
          left: ref.current.offsetLeft,
        });
      }}
      onClick={onClick}
    >
      <button
        type="button"
        className={`hub-nav-pill ${
        isActive ? "hub-nav-pill-active" : ""
      }`}
      >
        {children}
      </button>
    </li>
  );
};

const Cursor = ({ position }: { position: { left: number; width: number; opacity: number } }) => {
  return (
    <motion.li
      animate={position}
      className="hub-nav-cursor absolute z-0 h-9 rounded-full bg-gradient-to-r from-[#8f0f0f] to-[#e10600] md:h-10"
    />
  );
};

export default NavHeader;
