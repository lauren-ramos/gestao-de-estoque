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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../src/components/AppHeader';
import { Card } from '../src/components/Card';
import { FormField } from '../src/components/FormField';
import { FilePicker } from '../src/components/FilePicker';
import { AppButton } from '../src/components/AppButton';
import { Colors } from '../src/constants/colors';
import { createMovimentacao } from '../src/services/database';
import { uploadFile } from '../src/services/storage';
import { sincronizarMovimentoLegado as sincronizarMovimento } from '../src/services/sienge';

export default function EntradaScreen() {
  const router = useRouter();

  const [insumo, setInsumo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [dataEntrada, setDataEntrada] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [fotoUri, setFotoUri] = useState('');
  const [notaUri, setNotaUri] = useState('');
  const [recebidoPor, setRecebidoPor] = useState('');
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!insumo.trim() || !quantidade.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha o insumo e a quantidade.');
      return;
    }
    setSaving(true);
    try {
      const dateValue = dataEntrada.trim() || new Date().toISOString().slice(0, 10);

      const [fotoUrl, notaUrl] = await Promise.all([
        fotoUri ? uploadFile(fotoUri, 'fotos', 'entrada').catch(() => fotoUri) : Promise.resolve(undefined),
        notaUri ? uploadFile(notaUri, 'notas-fiscais', 'entrada').catch(() => notaUri) : Promise.resolve(undefined),
      ]);

      await createMovimentacao({
        insumo_nome: insumo.trim(),
        insumo_id: '',
        tipo: 'entrada',
        quantidade: parseFloat(quantidade),
        data: dateValue,
        observacao: observacao.trim() || undefined,
        foto_url: fotoUrl,
        nota_fiscal_url: notaUrl,
        recebido_por: recebidoPor.trim() || undefined,
      });

      await sincronizarMovimento({
        codigoInsumo: insumo.trim(),
        descricao: detalhe.trim(),
        tipo: 'entrada',
        quantidade: parseFloat(quantidade),
        data: dateValue,
        recebidoPor: recebidoPor.trim() || undefined,
        notaFiscal: notaUrl,
        observacao: observacao.trim() || undefined,
      }).catch(() => {});

      Alert.alert('Salvo!', 'Entrada registrada com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  }

  function limpar() {
    setInsumo(''); setDetalhe(''); setDataEntrada('');
    setQuantidade(''); setObservacao(''); setFotoUri('');
    setNotaUri(''); setRecebidoPor('');
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
            <Text style={styles.title}>Entrada de estoque</Text>
          </View>

          <Card>
            <FormField label="Insumo" value={insumo} onChangeText={setInsumo} placeholder="Nome do insumo" />
            <FormField label="Detalhe" value={detalhe} onChangeText={setDetalhe} placeholder="Detalhe (opcional)" />
            <View style={styles.row}>
              <View style={styles.half}>
                <FormField
                  label="Data de Entrada"
                  value={dataEntrada}
                  onChangeText={setDataEntrada}
                  placeholder="DD/MM/AAAA"
                  icon="calendar-outline"
                />
              </View>
              <View style={styles.half}>
                <FormField
                  label="Quantidade"
                  value={quantidade}
                  onChangeText={setQuantidade}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>
            <FormField label="Observação" value={observacao} onChangeText={setObservacao} placeholder="Observação (opcional)" />

            <View style={styles.row}>
              <FilePicker label="Foto" mode="photo" onChange={setFotoUri} />
              <View style={styles.spacer} />
              <FilePicker label="Nota Fiscal" mode="photo" onChange={setNotaUri} />
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
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  half: { flex: 1 },
  spacer: { width: 12 },
});
