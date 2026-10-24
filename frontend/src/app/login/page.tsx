"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginPage from "@/components/LoginPage";
import { useHousehold } from "@/context/HouseholdContext";

export default function DedicatedLoginPage() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading, handleLoginSuccess } = useHousehold();

  useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      if (typeof window !== "undefined") {
        window.location.href = "/overview";
      } else {
        router.replace("/overview");
      }
    }
  }, [isLoggedIn, isAuthLoading, router]);

  return (
    <LoginPage
      onLoginSuccess={(email) => {
        handleLoginSuccess(email);
        if (typeof window !== "undefined") {
          window.location.href = "/overview";
        } else {
          router.replace("/overview");
        }
      }}
    />
  );
}
