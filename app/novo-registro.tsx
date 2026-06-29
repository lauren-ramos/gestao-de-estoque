import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../src/components/AppHeader';
import { Card } from '../src/components/Card';
import { FormField } from '../src/components/FormField';
import { AppButton } from '../src/components/AppButton';
import { Colors } from '../src/constants/colors';
import { createMovimentacao, getInsumos } from '../src/services/database';
import type { Insumo, MovementType } from '../src/types';

type Tab = MovementType;

function insumoDisplayName(ins: Insumo): string {
  return ins.detalhe ? `${ins.nome} - ${ins.detalhe}` : ins.nome;
}

export default function NovoRegistroScreen() {
  const router = useRouter();
  const { insumoNome: paramNome } = useLocalSearchParams<{ insumoNome?: string }>();

  const [tab, setTab] = useState<Tab>('entrada');
  const [insumoQuery, setInsumoQuery] = useState(paramNome ?? '');
  const [suggestions, setSuggestions] = useState<Insumo[]>([]);
  const [allInsumos, setAllInsumos] = useState<Insumo[]>([]);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const [data, setData] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getInsumos().then(setAllInsumos).catch(() => {});
  }, []);

  function handleInsumoChange(text: string) {
    setInsumoQuery(text);
    setSelectedInsumo(null);
    if (text.trim().length >= 2) {
      const q = text.toLowerCase().trim();
      const filtered = allInsumos.filter(
        (r) =>
          r.nome.toLowerCase().includes(q) ||
          (r.detalhe ?? '').toLowerCase().includes(q) ||
          (r.sienge_code ?? '').includes(q),
      );
      setSuggestions(filtered.slice(0, 8));
    } else {
      setSuggestions([]);
    }
  }

  function selectSuggestion(resource: Insumo) {
    setInsumoQuery(insumoDisplayName(resource));
    setSelectedInsumo(resource);
    setSuggestions([]);
  }

  async function salvar() {
    if (!insumoQuery.trim() || !quantidade.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha o insumo e a quantidade.');
      return;
    }
    setSaving(true);
    try {
      const dateValue = data.trim() || new Date().toISOString().slice(0, 10);
      await createMovimentacao({
        insumo_nome: insumoQuery.trim(),
        insumo_id: '',
        tipo: tab,
        quantidade: parseFloat(quantidade),
        data: dateValue,
        observacao: detalhe.trim() || undefined,
      });

      Alert.alert('Salvo!', 'Registro salvo com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  }

  function limpar() {
    setInsumoQuery('');
    setSelectedInsumo(null);
    setSuggestions([]);
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.back}>
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Novo registro</Text>
          </View>

          <Card>
            <View style={styles.tabs}>
              <TabBtn label="Entrada" active={tab === 'entrada'} onPress={() => setTab('entrada')} />
              <TabBtn label="Saída" active={tab === 'saida'} onPress={() => setTab('saida')} />
            </View>

            {/* Campo insumo com autocomplete */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Insumo</Text>
              <View style={[styles.searchBox, selectedInsumo && styles.searchBoxSelected]}>
                <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={insumoQuery}
                  onChangeText={handleInsumoChange}
                  placeholder="Nome ou código do insumo..."
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {insumoQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setInsumoQuery(''); setSuggestions([]); setSelectedInsumo(null); }}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {selectedInsumo && (
                <View style={styles.selectedChip}>
                  <Text style={styles.selectedCode}>
                    Cód. {selectedInsumo.sienge_code ?? '—'}
                  </Text>
                  <Text style={styles.selectedUnit}>
                    Qtd: {selectedInsumo.quantidade_atual ?? 0}
                  </Text>
                </View>
              )}

              {suggestions.length > 0 && (
                <View style={styles.dropdown}>
                  {suggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestionItem}
                      onPress={() => selectSuggestion(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionCode}>{item.sienge_code ?? '—'}</Text>
                      <Text style={styles.suggestionName} numberOfLines={1}>
                        {insumoDisplayName(item)}
                      </Text>
                      <Text style={styles.suggestionQtd}>{item.quantidade_atual ?? 0}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <FormField
              label="Detalhe / Observação"
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
  tabs: { flexDirection: 'row', gap: 12, marginBottom: 20 },
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

  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.background,
  },
  searchBoxSelected: { borderColor: Colors.primary },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 0 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  selectedCode: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectedUnit: { fontSize: 11, color: Colors.textMuted },

  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  suggestionCode: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    minWidth: 40,
  },
  suggestionName: { flex: 1, fontSize: 13, color: Colors.text },
  suggestionQtd: { fontSize: 11, color: Colors.textMuted },
});
