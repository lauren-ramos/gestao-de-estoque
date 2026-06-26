import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface Props {
  userName?: string;
  onNotificationPress?: () => void;
}

export function AppHeader({ userName = 'Usuário', onNotificationPress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {/* 2×2 dot grid — fi-rr-apps equivalent */}
        <View style={styles.dotsGrid}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotPurple]} />
          <View style={[styles.dot, styles.dotPurple]} />
        </View>
        <View>
          <Text style={styles.greeting}>Olá 👋,</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
      </View>

      {/* fi-rr-bell-notification-social-media equivalent */}
      <TouchableOpacity onPress={onNotificationPress} style={styles.bell}>
        <MaterialCommunityIcons
          name="bell-badge-outline"
          size={24}
          color={Colors.text}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dotsGrid: {
    width: 26,
    height: 26,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  dotPurple: {
    backgroundColor: Colors.primary,
  },
  greeting: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  userName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  bell: {
    padding: 4,
  },
});
