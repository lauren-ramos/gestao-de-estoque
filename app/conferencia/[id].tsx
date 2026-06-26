import React, { useEffect, useState } from 'react';
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
import { AppHeader } from '../../src/components/AppHeader';
import { Card } from '../../src/components/Card';
import { FormField } from '../../src/components/FormField';
import { FilePicker } from '../../src/components/FilePicker';
import { AppButton } from '../../src/components/AppButton';
import { Colors } from '../../src/constants/colors';
import { salvarItemOC, atualizarStatusOC, createMovimentacao } from '../../src/services/database';
import { uploadFile } from '../../src/services/storage';
import { sincronizarEntradaOC } from '../../src/services/sienge';

export default function ConferenciaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [insumo, setInsumo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [fotoUri, setFotoUri] = useState('');
  const [notaUri, setNotaUri] = useState('');
  const [recebidoPor, setRecebidoPor] = useState('');
  const [saving, setSaving] = useState(false);

  async function cadastrarEntrada() {
    if (!insumo.trim() || !quantidade.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha o insumo e a quantidade.');
      return;
    }
    setSaving(true);
    try {
      const [fotoUrl, notaUrl] = await Promise.all([
        fotoUri ? uploadFile(fotoUri, 'fotos', `oc/${id}`).catch(() => fotoUri) : Promise.resolve(undefined),
        notaUri ? uploadFile(notaUri, 'notas-fiscais', `oc/${id}`).catch(() => notaUri) : Promise.resolve(undefined),
      ]);

      await salvarItemOC({
        oc_id: id,
        insumo: insumo.trim(),
        detalhe: detalhe.trim() || undefined,
        quantidade: parseFloat(quantidade),
        valor_total: valorTotal ? parseFloat(valorTotal) : undefined,
        observacao: observacao.trim() || undefined,
        foto_url: fotoUrl,
        nota_fiscal_url: notaUrl,
        recebido_por: recebidoPor.trim() || undefined,
      });

      await createMovimentacao({
        insumo_nome: insumo.trim(),
        insumo_id: '',
        tipo: 'entrada',
        quantidade: parseFloat(quantidade),
        data: new Date().toISOString().slice(0, 10),
        observacao: observacao.trim() || undefined,
        foto_url: fotoUrl,
        nota_fiscal_url: notaUrl,
        recebido_por: recebidoPor.trim() || undefined,
        oc_id: id,
      });

      await atualizarStatusOC(id, 'conferido');

      await sincronizarEntradaOC(id, [
        { codigoInsumo: insumo.trim(), quantidade: parseFloat(quantidade), valorTotal: valorTotal ? parseFloat(valorTotal) : undefined },
      ]).catch(() => {});

      Alert.alert('Entrada cadastrada!', 'OC conferida com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
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
            <Text style={styles.title}>Conferência da OC #{id?.slice(-6)}</Text>
          </View>

          <Card>
            <FormField label="Insumo" value={insumo} onChangeText={setInsumo} placeholder="Nome do insumo" />
            <FormField label="Detalhe" value={detalhe} onChangeText={setDetalhe} placeholder="Detalhe (opcional)" />

            <View style={styles.row}>
              <View style={styles.half}>
                <FormField
                  label="Quantidade"
                  value={quantidade}
                  onChangeText={setQuantidade}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <FormField
                  label="Valor Total"
                  value={valorTotal}
                  onChangeText={setValorTotal}
                  placeholder="R$ 0,00"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <FormField label="Observação" value={observacao} onChangeText={setObservacao} placeholder="Observação (opcional)" />

            <View style={styles.row}>
              <FilePicker label="Foto" mode="photo" onChange={setFotoUri} />
              <View style={styles.spacer} />
              <FilePicker label="Nota Fiscal" mode="document" onChange={setNotaUri} />
            </View>

            <FormField label="Recebido por" value={recebidoPor} onChangeText={setRecebidoPor} placeholder="Nome do responsável" />

            <AppButton
              label="Cadastrar entrada"
              onPress={cadastrarEntrada}
              icon="checkmark-circle-outline"
              loading={saving}
            />
            <AppButton
              label="Relatar erro"
              onPress={() => router.push({ pathname: '/conferencia/relatar-erro/[id]', params: { id } })}
              variant="secondary"
              icon="close-circle-outline"
            />
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
