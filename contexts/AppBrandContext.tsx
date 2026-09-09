'use client'

import { createContext, useContext } from 'react'

type AppBrand = {
  name: string
  tagline: string
}

const defaultBrand: AppBrand = {
  name: 'Link System',
  tagline: 'Software House',
}

const AppBrandContext = createContext<AppBrand>(defaultBrand)

export function AppBrandProvider({
  name,
  tagline,
  children,
}: {
  name?: string
  tagline?: string
  children: React.ReactNode
}) {
  const value: AppBrand = {
    name: name?.trim() || defaultBrand.name,
    tagline: tagline?.trim() || defaultBrand.tagline,
  }
  return <AppBrandContext.Provider value={value}>{children}</AppBrandContext.Provider>
}

export function useAppBrand() {
  return useContext(AppBrandContext)
}
