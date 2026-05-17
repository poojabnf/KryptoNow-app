import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

export default function PortfolioAnalytics() {
  const chartData = [
    { name: 'Ethereum', population: 45, color: '#627EEA', legendFontColor: '#A0C4C4', legendFontSize: 13 },
    { name: 'Polygon',  population: 25, color: '#8247E5', legendFontColor: '#A0C4C4', legendFontSize: 13 },
    { name: 'Arbitrum', population: 20, color: '#28A0F0', legendFontColor: '#A0C4C4', legendFontSize: 13 },
    { name: 'Optimism', population: 10, color: '#FF0420', legendFontColor: '#A0C4C4', legendFontSize: 13 },
  ];

  const screenWidth = Platform.OS === 'web'
    ? Math.min(Dimensions.get('window').width - 32, 600)
    : Dimensions.get('window').width - 32;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Asset Allocation</Text>
        <Text style={styles.subtitle}>Cross-chain distribution</Text>
      </View>
      <PieChart
        data={chartData}
        width={screenWidth}
        height={200}
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: '#111118',
          backgroundGradientTo:   '#111118',
          // ✅ Bug 4 fix: was rgba(0, 212, 170, ) — missing opacity value
          color: (opacity = 1) => `rgba(0, 212, 170, ${opacity})`,
        }}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />
      <View style={styles.donutHole} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111118',
    borderRadius: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#1E1E2E',
    overflow: 'hidden',
    marginVertical: 12,
    position: 'relative',
    justifyContent: 'center',
  },
  header:   { paddingHorizontal: 20, marginBottom: 10 },
  title:    { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#6B6B8A', marginTop: 4 },
  donutHole: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#111118',
    left: '28%', top: '55%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 10,
    borderWidth: 4,
    borderColor: 'rgba(17,17,24,0.8)',
  },
});
