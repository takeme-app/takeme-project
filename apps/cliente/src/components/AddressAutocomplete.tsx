import { useState, useCallback, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { searchAddress, type AddressSuggestion } from '../lib/location';

const DEBOUNCE_MS = 400;

const COLORS = {
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (place: AddressSuggestion) => void;
  placeholder?: string;
  editable?: boolean;
  style?: object;
};

export function AddressAutocomplete({
  value,
  onChangeText,
  onSelectPlace,
  placeholder = 'Digite o endereço...',
  editable = true,
  style,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowList(false);
      return;
    }
    setLoading(true);
    try {
      const list = await searchAddress(query);
      setSuggestions(list);
      setShowList(list.length > 0);
    } catch {
      setSuggestions([]);
      setShowList(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(text);
        debounceRef.current = null;
      }, DEBOUNCE_MS);
    },
    [onChangeText, fetchSuggestions]
  );

  const handleSelect = useCallback(
    (item: AddressSuggestion) => {
      onChangeText(item.address);
      onSelectPlace(item);
      setSuggestions([]);
      setShowList(false);
    },
    [onChangeText, onSelectPlace]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.neutral700}
          editable={editable}
          onFocus={() => value.trim().length >= 2 && suggestions.length > 0 && setShowList(true)}
          onBlur={() => setTimeout(() => setShowList(false), 200)}
        />
        {loading && (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={COLORS.black} />
          </View>
        )}
      </View>
      {showList && suggestions.length > 0 && (
        <View style={styles.listWrap}>
          <ScrollView
            style={styles.listScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={true}
          >
            {suggestions.slice(0, 15).map((item, index) => (
              <TouchableOpacity
                key={`${index}-${item.latitude}-${item.longitude}`}
                style={styles.suggestionRow}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="place" size={20} color={COLORS.neutral700} />
                <Text style={styles.suggestionText} numberOfLines={2}>{item.address}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 1 },
  inputRow: { position: 'relative' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 44,
    fontSize: 16,
    color: COLORS.black,
  },
  loaderWrap: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  listWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    maxHeight: 260,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  listScroll: { maxHeight: 256 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  suggestionText: { flex: 1, fontSize: 14, color: COLORS.black },
});
