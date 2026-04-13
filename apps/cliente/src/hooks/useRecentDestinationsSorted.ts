import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getRecentDestinations,
  addRecentDestination,
  type RecentDestination,
} from '../lib/recentDestinations';
import { distanceKm } from '../lib/location';

const MAX_ITEMS = 10;

export function useRecentDestinationsSorted(originLat: number, originLng: number) {
  const [recentDestinations, setRecentDestinations] = useState<RecentDestination[]>([]);

  const loadRecentDestinations = useCallback(() => {
    getRecentDestinations().then(setRecentDestinations);
  }, []);

  useEffect(() => {
    loadRecentDestinations();
  }, [loadRecentDestinations]);

  const sortedRecentDestinations = useMemo(
    () =>
      [...recentDestinations]
        .map((item) => ({
          item,
          dist: distanceKm(originLat, originLng, item.latitude, item.longitude),
        }))
        .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity))
        .map(({ item }) => item)
        .slice(0, MAX_ITEMS),
    [recentDestinations, originLat, originLng],
  );

  const saveRecentDestination = useCallback(
    async (dest: RecentDestination) => {
      await addRecentDestination(dest);
      loadRecentDestinations();
    },
    [loadRecentDestinations],
  );

  return {
    sortedRecentDestinations,
    loadRecentDestinations,
    saveRecentDestination,
  };
}
