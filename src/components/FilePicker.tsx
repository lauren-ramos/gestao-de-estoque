import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface Props {
  label: string;
  mode: 'photo' | 'document';
  value?: string;
  onChange: (uri: string) => void;
}

export function FilePicker({ label, mode, value, onChange }: Props) {
  const [preview, setPreview] = useState<string | undefined>(value);

  async function pick() {
    if (mode === 'photo') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPreview(uri);
        onChange(uri);
      }
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPreview(uri);
        onChange(uri);
      }
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPreview(uri);
      onChange(uri);
    }
  }

  function handlePress() {
    if (mode === 'photo') {
      Alert.alert('Foto', 'Escolha a origem', [
        { text: 'Câmera', onPress: takePhoto },
        { text: 'Galeria', onPress: pick },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    } else {
      pick();
    }
  }

  const hasFile = Boolean(preview);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.box} onPress={handlePress} activeOpacity={0.7}>
        {hasFile && mode === 'photo' ? (
          <Image source={{ uri: preview }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <Ionicons
            name={mode === 'photo' ? 'camera-outline' : 'document-outline'}
            size={22}
            color={hasFile ? Colors.primary : Colors.textSecondary}
          />
        )}
        {hasFile && mode === 'document' && (
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} style={styles.check} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  box: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  check: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
});
