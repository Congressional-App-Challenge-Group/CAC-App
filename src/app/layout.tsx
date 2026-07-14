import type {Metadata,Viewport} from "next";import "./globals.css";import {Analytics} from "@vercel/analytics/next";import {Header} from "@/components/layout/nav";import {PreferencesProvider} from "@/features/preferences/preferences";import{PwaRegister}from"@/components/pwa-register";
export const metadata:Metadata={title:{default:"CivicLens",template:"%s · CivicLens"},description:"Know what is changing before it affects you.",manifest:"/manifest.webmanifest"};
export const viewport:Viewport={themeColor:"#17362f",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><PreferencesProvider><PwaRegister/><Header/><main>{children}</main></PreferencesProvider><Analytics/></body></html>}
