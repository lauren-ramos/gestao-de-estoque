import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../../src/components/AppHeader';
import { Card } from '../../../src/components/Card';
import { FormField } from '../../../src/components/FormField';
import { FilePicker } from '../../../src/components/FilePicker';
import { AppButton } from '../../../src/components/AppButton';
import { Colors } from '../../../src/constants/colors';
import { relatarErroOC, atualizarStatusOC } from '../../../src/services/database';
import { uploadFile } from '../../../src/services/storage';

export default function RelatarErroScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [descricao, setDescricao] = useState('');
  const [fotoUri, setFotoUri] = useState('');
  const [notaUri, setNotaUri] = useState('');
  const [recebidoPor, setRecebidoPor] = useState('');
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!descricao.trim()) {
      Alert.alert('Campo obrigatório', 'Descreva o erro encontrado.');
      return;
    }
    setSaving(true);
    try {
      const [fotoUrl, notaUrl] = await Promise.all([
        fotoUri ? uploadFile(fotoUri, 'fotos', `erro/${id}`).catch(() => fotoUri) : Promise.resolve(undefined),
        notaUri ? uploadFile(notaUri, 'notas-fiscais', `erro/${id}`).catch(() => notaUri) : Promise.resolve(undefined),
      ]);

      await relatarErroOC({
        oc_id: id,
        descricao: descricao.trim(),
        foto_url: fotoUrl,
        nota_fiscal_url: notaUrl,
        recebido_por: recebidoPor.trim() || undefined,
      });

      await atualizarStatusOC(id, 'erro');

      Alert.alert('Erro relatado!', 'O erro foi registrado para a OC.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  }

  function limpar() {
    setDescricao('');
    setFotoUri('');
    setNotaUri('');
    setRecebidoPor('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.back}>
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Relatar erro OC #{id?.slice(-6)}</Text>
          </View>

          <Card>
            <FormField
              label="Descrição do erro"
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Descreva o problema encontrado..."
              multiline
              numberOfLines={5}
              style={styles.textarea}
              textAlignVertical="top"
            />

            <View style={styles.row}>
              <FilePicker label="Foto" mode="photo" onChange={setFotoUri} />
              <View style={styles.spacer} />
              <FilePicker label="Nota Fiscal" mode="document" onChange={setNotaUri} />
            </View>

            <FormField label="Recebido por" value={recebidoPor} onChangeText={setRecebidoPor} placeholder="Nome do responsável" />

            <AppButton label="Salvar" onPress={salvar} icon="checkmark-circle-outline" loading={saving} />
            <AppButton label="Limpar" onPress={limpar} variant="secondary" icon="trash-outline" />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  textarea: { height: 120, paddingTop: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  spacer: { width: 12 },
});
