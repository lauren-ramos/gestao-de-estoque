import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface Props extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onIconPress?: () => void;
  error?: string;
}

export function FormField({ label, icon, onIconPress, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, error && styles.rowError]}>
        <TextInput
          style={[styles.input, icon && styles.inputWithIcon, style]}
          placeholderTextColor={Colors.textMuted}
          {...rest}
        />
        {icon && (
          <TouchableOpacity onPress={onIconPress} style={styles.iconBtn}>
            <Ionicons name={icon} size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
  },
  rowError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
  },
  inputWithIcon: {
    paddingRight: 0,
  },
  iconBtn: {
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  error: {
    fontSize: 11,
    color: Colors.error,
    marginTop: 2,
  },
});
