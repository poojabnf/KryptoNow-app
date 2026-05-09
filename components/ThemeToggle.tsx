import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function ThemeToggle() {
  const { mode, setMode, theme } = useTheme();

  const options: { id: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'light', label: 'Light', icon: 'sunny-outline' },
    { id: 'dark', label: 'Dark', icon: 'moon-outline' },
    { id: 'pro', label: 'Pro', icon: 'terminal-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>Appearance</Text>
      
      <View style={[styles.toggleWrapper, { backgroundColor: theme.bgApp }]}>
        {options.map((opt) => {
          const isActive = mode === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.8}
              onPress={() => setMode(opt.id)}
              style={[
                styles.option,
                isActive && [styles.activeOption, { backgroundColor: theme.bgCard, borderColor: theme.border }]
              ]}
            >
              <Ionicons 
                name={opt.icon} 
                size={18} 
                color={isActive ? theme.accent : theme.textMuted} 
                style={{ marginBottom: 4 }}
              />
              <Text 
                style={[
                  styles.optionText, 
                  { color: isActive ? theme.textPrimary : theme.textMuted },
                  isActive && { fontWeight: '700' }
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginVertical: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  toggleWrapper: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeOption: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
  }
});