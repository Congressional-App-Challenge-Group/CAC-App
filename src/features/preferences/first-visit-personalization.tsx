"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, MapPin, Sparkles, X } from "lucide-react";
import { interests, roles, type UserRole } from "@/types";
import { usePreferences } from "@/features/preferences/preferences";

export function FirstVisitPersonalization() {
  const pathname = usePathname();
  const {
    preferences,
    setPreferences,
    dismissPersonalization,
    personalized,
    ready,
  } = usePreferences();
  const [zipCode, setZipCode] = useState(preferences.zipCode);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(preferences.roles);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(preferences.interests);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || personalized) return;
    setZipCode(preferences.zipCode);
    setSelectedRoles(preferences.roles);
    setSelectedInterests(preferences.interests);
  }, [personalized, preferences, ready]);

  const hiddenPage =
    pathname.startsWith("/admin") || pathname === "/login" || pathname === "/onboarding";

  if (!ready || personalized || hiddenPage) {
    return null;
  }

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  };

  const save = () => {
    if (!/^\d{5}$/.test(zipCode)) return setError("Enter a valid 5-digit ZIP code.");
    if (!selectedRoles.length) return setError("Choose at least one role.");
    if (!selectedInterests.length) return setError("Choose at least one interest.");
    setPreferences({ zipCode, roles: selectedRoles, interests: selectedInterests });
  };

  return (
    <div className="personalization-backdrop" role="presentation">
      <section
        className="personalization-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="personalization-title"
        aria-describedby="personalization-description"
      >
        <button
          type="button"
          className="personalization-close"
          onClick={dismissPersonalization}
          aria-label="Skip personalization"
        >
          <X size={18} />
        </button>

        <div className="personalization-heading">
          <span>
            <Sparkles size={19} />
          </span>
          <div>
            <p>YOUR CIVICLENS</p>
            <h2 id="personalization-title">Make the public record relevant to you.</h2>
          </div>
        </div>
        <p id="personalization-description" className="personalization-intro">
          Tell us only what helps. Guest preferences stay on this device, and a free account can
          sync them later.
        </p>

        <label className="personalization-field">
          <span><MapPin size={14} /> ZIP code</span>
          <input
            inputMode="numeric"
            maxLength={5}
            value={zipCode}
            onChange={(event) => setZipCode(event.target.value.replace(/\D/g, ""))}
            placeholder="28205"
          />
        </label>

        <fieldset className="personalization-group">
          <legend>I am a…</legend>
          <div>
            {roles.map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={selectedRoles.includes(role)}
                onClick={() => toggleRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="personalization-group">
          <legend>I care about…</legend>
          <div>
            {interests.map((interest) => (
              <button
                key={interest}
                type="button"
                aria-pressed={selectedInterests.includes(interest)}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </button>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p className="personalization-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="personalization-actions">
          <button type="button" className="personalization-save" onClick={save}>
            <Check size={17} /> Personalize my CivicLens
          </button>
          <button
            type="button"
            className="personalization-skip"
            onClick={dismissPersonalization}
          >
            Use the standard view
          </button>
        </div>
      </section>
    </div>
  );
}
