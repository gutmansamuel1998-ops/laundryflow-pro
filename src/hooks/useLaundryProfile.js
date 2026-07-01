import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * useLaundryProfile
 *
 * Returns the user's active Adaptive Laundry Profile and related sub-settings.
 * Other parts of the app can import this hook to quietly adapt their behaviour.
 *
 * profile: "private" | "dorm" | "family"
 * twoPerson: boolean  (Private only)
 * roommateCount: number (Dorm only)
 * isFamily: boolean
 * isDorm: boolean
 * isPrivate: boolean
 */
export function useLaundryProfile() {
  const [profile, setProfile] = useState("private");
  const [twoPerson, setTwoPerson] = useState(false);
  const [roommateCount, setRoommateCount] = useState(0);
  const [dormUtilitiesEnabled, setDormUtilitiesEnabled] = useState(false);
  const [usesLaundromat, setUsesLaundromat] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then((u) => {
      // Gracefully migrate legacy laundry_environment to laundry_profile
      const resolved =
        u?.laundry_profile ||
        (u?.laundry_environment === "shared" ? "dorm" : "private");
      setProfile(resolved);
      setTwoPerson(u?.two_person_household || false);
      setRoommateCount(u?.roommate_count || 0);
      setDormUtilitiesEnabled(u?.dorm_utilities_enabled || false);
      setUsesLaundromat(u?.uses_laundromat || false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isDorm = profile === "dorm";
  const isFamily = profile === "family";
  const isPrivate = profile === "private";

  return {
    profile,
    twoPerson,
    roommateCount,
    dormUtilitiesEnabled,
    usesLaundromat,
    isPrivate,
    isDorm,
    isFamily,
    showDormUtilities: isDorm || dormUtilitiesEnabled,
    showLaundryFunds: isDorm || isFamily || (isPrivate && usesLaundromat),
    loading,
  };
}