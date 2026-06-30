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
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return {
    profile,
    twoPerson,
    roommateCount,
    isPrivate: profile === "private",
    isDorm: profile === "dorm",
    isFamily: profile === "family",
    loading,
  };
}