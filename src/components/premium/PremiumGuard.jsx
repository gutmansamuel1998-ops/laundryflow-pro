import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function PremiumGuard({ children }) {
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then((user) => {
      if (!user?.has_premium) {
        navigate("/Premium", { replace: true });
      } else {
        setChecking(false);
      }
    }).catch(() => {
      navigate("/Premium", { replace: true });
    });
  }, []);

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}