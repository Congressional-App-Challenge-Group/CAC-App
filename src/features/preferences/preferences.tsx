"use client";
import { createContext,useContext,useEffect,useState } from "react";
import type { UserPreferences } from "@/types";
const defaults:UserPreferences={zipCode:"28205",roles:["Other resident"],interests:["Public transit","Housing","Parks"]};
type Ctx={preferences:UserPreferences;setPreferences:(p:UserPreferences)=>void;following:string[];toggleFollow:(id:string)=>void;ready:boolean};
const PreferencesContext=createContext<Ctx|null>(null);
export function PreferencesProvider({children}:{children:React.ReactNode}){const [preferences,setP]=useState(defaults);const[following,setFollowing]=useState<string[]>([]);const[ready,setReady]=useState(false);useEffect(()=>{try{const p=localStorage.getItem("civiclens-preferences"),f=localStorage.getItem("civiclens-following");if(p)setP(JSON.parse(p));if(f)setFollowing(JSON.parse(f));}finally{setReady(true)}},[]);const setPreferences=(p:UserPreferences)=>{setP(p);localStorage.setItem("civiclens-preferences",JSON.stringify(p))};const toggleFollow=(id:string)=>setFollowing(old=>{const n=old.includes(id)?old.filter(x=>x!==id):[...old,id];localStorage.setItem("civiclens-following",JSON.stringify(n));return n});return <PreferencesContext.Provider value={{preferences,setPreferences,following,toggleFollow,ready}}>{children}</PreferencesContext.Provider>};
export const usePreferences=()=>{const c=useContext(PreferencesContext);if(!c)throw new Error("PreferencesProvider missing");return c};
