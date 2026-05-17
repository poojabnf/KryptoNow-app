import React, { Component, ErrorInfo, ReactNode } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import { useWalletStore } from "../store/walletStore"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  expanded: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    expanded: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, expanded: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    this.setState({ error, errorInfo })
  }

  private handleReset = () => {
    try {
      useWalletStore.getState().initFromStorage()
    } catch (e) {
      console.error("Failed to re-initialize store:", e)
    }
    this.setState({ hasError: false, error: null, errorInfo: null, expanded: false })
  }

  private handleCopyError = async () => {
    if (this.state.error) {
      const diagnosticInfo = `${this.state.error.message}\n\n${this.state.error.stack || ""}`
      await Clipboard.setStringAsync(diagnosticInfo)
    }
  }

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message ?? "An unexpected runtime error occurred."
      const stackTrace = this.state.error?.stack ?? "No stack trace available."

      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" />
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="shield-half" size={44} color="#F43F5E" />
              </View>
              <Text style={styles.title}>System Glitch Intercepted</Text>
              <Text style={styles.subtitle}>
                KryptoNow's rendering engine successfully caught a crash. Rest assured, your cryptographic private keys and assets are 100% secure.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="bug-outline" size={16} color="#94A3B8" />
                <Text style={styles.cardTitle}>Diagnostics Code</Text>
              </View>
              <Text style={styles.errorMessage} numberOfLines={3}>
                {errorMsg}
              </Text>

              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => this.setState({ expanded: !this.state.expanded })}
                activeOpacity={0.7}
              >
                <Text style={styles.expandButtonText}>
                  {this.state.expanded ? "Hide Technical Stack Trace" : "Show Technical Stack Trace"}
                </Text>
                <Ionicons
                  name={this.state.expanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#818CF8"
                />
              </TouchableOpacity>

              {this.state.expanded && (
                <ScrollView style={styles.console} contentContainerStyle={styles.consoleContent}>
                  <Text style={styles.consoleText}>{stackTrace}</Text>
                </ScrollView>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={this.handleCopyError}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={16} color="#94A3B8" />
                <Text style={styles.copyButtonText}>Copy Log</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color="#FFF" />
                <Text style={styles.resetButtonText}>Reload UI</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F19",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 20,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  errorMessage: {
    fontSize: 15,
    color: "#F1F5F9",
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: "500",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#818CF8",
  },
  console: {
    maxHeight: 180,
    backgroundColor: "#030712",
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  consoleContent: {
    paddingBottom: 8,
  },
  consoleText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#EF4444",
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  copyButton: {
    flex: 1,
    flexDirection: "row",
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
  },
  resetButton: {
    flex: 2,
    flexDirection: "row",
    height: 52,
    borderRadius: 12,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
})
