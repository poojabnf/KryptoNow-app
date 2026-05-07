import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function Onboarding() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCompleteSetup = async () => {
    setLoading(true);
    try {
      const profile = {
        username: username.trim() || 'Anonymous Vault',
        onboarded: true,
        createdAt: new Date().toISOString()
      };

      if (Platform.OS === 'web') {
        localStorage.setItem('kryptonow_profile', JSON.stringify(profile));
      } else {
        await AsyncStorage.setItem('kryptonow_profile', JSON.stringify(profile));
      }

      router.replace('/dashboard');
    } catch (error) {
      console.error('[Onboarding] Save failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="shield-checkmark" size={64} color="#00D4AA" />
      </View>
      
      <Text style={styles.title}>Welcome to KryptoNow</Text>
      <Text style={styles.subtitle}>
        Your wallet is securely generated. What should we call you?
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter display name (optional)"
        placeholderTextColor="#4A7A7A"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={24}
      />

      <TouchableOpacity 
        style={[styles.btn, loading && styles.btnDisabled]} 
        onPress={handleCompleteSetup}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>
          {loading ? 'Setting up...' : 'Enter Vault'}
        </Text>
        {!loading && <Ionicons name="arrow-forward" size={20} color="#0D2E2E" />}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D2E2E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#A0C4C4',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  input: {
    width: '100%',
    backgroundColor: '#0A2020',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1A4A4A',
    color: '#FFFFFF',
    fontSize: 16,
    padding: 18,
    marginBottom: 24,
  },
  btn: {
    width: '100%',
    backgroundColor: '#00D4AA',
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: '#0D2E2E',
    fontSize: 16,
    fontWeight: '700',
  },
});