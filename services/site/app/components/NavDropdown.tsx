"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

export interface NavDropdownItem {
  label: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
}

export interface NavDropdownProps {
  label: string;
  items: NavDropdownItem[];
  alignment?: "left" | "right";
}

export function NavDropdown({ label, items, alignment = "left" }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const menuId = `nav-dropdown-${label.toLowerCase()}-menu`;
  const alignmentClass = alignment === "right" ? "right-0" : "left-0";

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors duration-300"
        style={{ color: open ? "#FAFAFA" : "#A1A1AA" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#FAFAFA"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.color = "#A1A1AA"; }}
      >
        <span>{label}</span>
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <path
            d="M5.72274 7.36241L9.57246 11.2121L10.4273 11.2121L14.277 7.36242L15.2849 8.37031L11.0177 12.6376L8.98206 12.6376L4.71484 8.37031L5.72274 7.36241Z"
            fill="currentColor"
          />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key={menuId}
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={`absolute mt-3 w-52 rounded-2xl p-2 z-50 ${alignmentClass}`}
            style={{
              background: "#111113",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 8px 20px rgba(0, 0, 0, 0.3)",
            }}
          >
            {items.map((item) => {
              const isDisabled = item.disabled || !item.href;

              const baseStyle = {
                display: "block",
                width: "100%",
                padding: "0.5rem 0.75rem",
                fontSize: "0.875rem",
                borderRadius: "0.75rem",
                transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                color: isDisabled ? "#52525B" : "#A1A1AA",
                cursor: isDisabled ? "default" : "pointer",
              };

              if (isDisabled) {
                return (
                  <div
                    key={item.label}
                    role="menuitem"
                    aria-disabled="true"
                    style={baseStyle}
                  >
                    {item.label}
                  </div>
                );
              }

              const hoverHandlers = {
                onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.color = "#FAFAFA";
                },
                onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#A1A1AA";
                },
              };

              if (item.external) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    style={baseStyle}
                    onClick={() => setOpen(false)}
                    {...hoverHandlers}
                  >
                    {item.label}
                  </a>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href!}
                  role="menuitem"
                  style={baseStyle}
                  onClick={() => setOpen(false)}
                  {...hoverHandlers}
                >
                  {item.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
