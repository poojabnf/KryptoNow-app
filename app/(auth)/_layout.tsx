import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

// This MUST run in every page that could be an OAuth callback
if (Platform.OS === "web") {
  WebBrowser.maybeCompleteAuthSession();
}

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();

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