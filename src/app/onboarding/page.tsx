"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { interests, roles, type UserRole } from "@/types";
import { usePreferences } from "@/features/preferences/preferences";

export default function Onboarding() {
  const { preferences, setPreferences } = usePreferences();
  const [zipCode, setZipCode] = useState(preferences.zipCode);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(preferences.roles);
  const [selectedInterests, setSelectedInterests] = useState(preferences.interests);
  const [error, setError] = useState("");
  const router = useRouter();

  function save() {
    if (!/^\d{5}$/.test(zipCode)) return setError("Enter a valid 5-digit ZIP code.");
    if (!selectedRoles.length) return setError("Choose at least one role.");
    if (selectedInterests.length < 3) return setError("Choose at least three interests.");

    setPreferences({
      zipCode,
      roles: selectedRoles,
      interests: selectedInterests,
    });
    router.push("/");
  }

  return (
    <div className="shell max-w-3xl py-10">
      <p className="eyebrow">About two minutes</p>
      <h1 className="mt-2 text-4xl font-black">Make CivicLens relevant to you</h1>
      <p className="mt-3 text-muted">
        Your guest preferences stay on this device. No account required.
      </p>

      <div className="mt-8 space-y-8">
        <fieldset>
          <legend className="text-xl font-black">1. What&apos;s your ZIP code?</legend>
          <input
            aria-describedby="form-error"
            className="field mt-3 max-w-xs"
            inputMode="numeric"
            maxLength={5}
            value={zipCode}
            onChange={(event) => setZipCode(event.target.value.replace(/\D/g, ""))}
            placeholder="28205"
          />
        </fieldset>

        <Choices
          title="2. Which roles describe you?"
          items={[...roles]}
          selected={selectedRoles}
          setSelected={setSelectedRoles}
        />

        <Choices
          title="3. Choose at least three interests"
          items={[...interests]}
          selected={selectedInterests}
          setSelected={setSelectedInterests}
        />

        {error ? (
          <p id="form-error" role="alert" className="rounded-xl bg-red-100 p-3 font-bold text-red-800">
            {error}
          </p>
        ) : null}

        <button type="button" onClick={save} className="btn btn-primary w-full sm:w-auto">
          <Check size={18} />
          Save and view my brief
        </button>
      </div>
    </div>
  );
}

function Choices<T extends string>({
  title,
  items,
  selected,
  setSelected,
}: {
  title: string;
  items: T[];
  selected: T[];
  setSelected: React.Dispatch<React.SetStateAction<T[]>>;
}) {
  function toggle(item: T) {
    setSelected((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  }

  return (
    <fieldset>
      <legend className="text-xl font-black">{title}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            type="button"
            className="chip"
            data-active={selected.includes(item)}
            aria-pressed={selected.includes(item)}
            onClick={() => toggle(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
