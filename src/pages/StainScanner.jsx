import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

// StainScanner has been consolidated into the Smart Stain Assistant (StainGuidance).
export default function StainScanner() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(createPageUrl("StainGuidance"), { replace: true });
  }, [navigate]);
  return null;
}