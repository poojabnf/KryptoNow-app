import { useAuth } from "../../context/AuthContext";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View, Platform } from "react-native";
import { useEffect } from "react";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  // Handle OAuth redirect back on web
  useEffect(() => {
    if (Platform.OS === "web") {
      // Clerk handles the session after OAuth redirect automatically
      // No action needed - isSignedIn will update
    }
  }, []);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0D2E2E" }}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  if (isSignedIn) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
