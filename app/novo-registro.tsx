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
import { AppHeader } from '../src/components/AppHeader';
import { Card } from '../src/components/Card';
import { FormField } from '../src/components/FormField';
import { AppButton } from '../src/components/AppButton';
import { Colors } from '../src/constants/colors';
import { createMovimentacao } from '../src/services/database';
import { sincronizarMovimento } from '../src/services/sienge';
import type { MovementType } from '../src/types';

type Tab = MovementType;

export default function NovoRegistroScreen() {
  const router = useRouter();
  const { insumoNome: paramNome } = useLocalSearchParams<{ insumoNome?: string }>();

  const [tab, setTab] = useState<Tab>('entrada');
  const [insumo, setInsumo] = useState(paramNome ?? '');
  const [detalhe, setDetalhe] = useState('');
  const [data, setData] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!insumo.trim() || !quantidade.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha o insumo e a quantidade.');
      return;
    }
    setSaving(true);
    try {
      const dateValue = data.trim() || new Date().toISOString().slice(0, 10);
      const mov = await createMovimentacao({
        insumo_nome: insumo.trim(),
        insumo_id: '',
        tipo: tab,
        quantidade: parseFloat(quantidade),
        data: dateValue,
        observacao: detalhe.trim() || undefined,
      });

      await sincronizarMovimento({
        codigoInsumo: insumo.trim(),
        descricao: detalhe.trim(),
        tipo: tab,
        quantidade: parseFloat(quantidade),
        data: dateValue,
      }).catch(() => {});

      Alert.alert('Salvo!', 'Registro salvo com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  }

  function limpar() {
    setInsumo('');
    setDetalhe('');
    setData('');
    setQuantidade('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.back}>
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Novo registro</Text>
          </View>

          <Card>
            {/* Tab toggle */}
            <View style={styles.tabs}>
              <TabBtn label="Entrada" active={tab === 'entrada'} onPress={() => setTab('entrada')} />
              <TabBtn label="Saída" active={tab === 'saida'} onPress={() => setTab('saida')} />
            </View>

            <FormField
              label="Insumo"
              value={insumo}
              onChangeText={setInsumo}
              placeholder="Nome do insumo"
            />
            <FormField
              label="Detalhe"
              value={detalhe}
              onChangeText={setDetalhe}
              placeholder="Detalhe (opcional)"
            />
            <FormField
              label={tab === 'entrada' ? 'Data de Entrada' : 'Data de Saída'}
              value={data}
              onChangeText={setData}
              placeholder="DD/MM/AAAA"
              icon="calendar-outline"
            />
            <FormField
              label="Quantidade"
              value={quantidade}
              onChangeText={setQuantidade}
              placeholder="0"
              keyboardType="numeric"
            />

            <AppButton label="Salvar" onPress={salvar} icon="checkmark-circle-outline" loading={saving} />
            <AppButton label="Limpar" onPress={limpar} variant="secondary" icon="trash-outline" />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  tabs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: { borderColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
});
