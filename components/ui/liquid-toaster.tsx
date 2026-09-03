"use client"

import { Toaster } from "react-hot-toast"

export function LiquidToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={12}
      containerClassName="liquid-toast-container"
      toastOptions={{
        duration: 4200,
        className: "liquid-toast",
        style: {
          background: "transparent",
          boxShadow: "none",
          padding: 0,
        },
        success: {
          duration: 3600,
          className: "liquid-toast liquid-toast-success",
          iconTheme: {
            primary: "#16a34a",
            secondary: "rgba(255,255,255,0.95)",
          },
        },
        error: {
          duration: 4800,
          className: "liquid-toast liquid-toast-error",
          iconTheme: {
            primary: "#dc2626",
            secondary: "rgba(255,255,255,0.95)",
          },
        },
        loading: {
          className: "liquid-toast liquid-toast-loading",
          iconTheme: {
            primary: "#2563eb",
            secondary: "rgba(255,255,255,0.9)",
          },
        },
        blank: {
          className: "liquid-toast",
        },
      }}
    />
  )
}
